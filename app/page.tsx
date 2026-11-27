"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Color, Square } from "chess.js";
import { ArrowUpRight, CircleHelp, ScanLine, Settings2, ShieldCheck, User, X } from "lucide-react";
import { ChessBoard } from "../components/chess-board";
import { GameModals, type ModalKind } from "../components/game-modals";
import type { ArchivedGame } from "../components/profile-modal";
import { SidebarPanels } from "../components/sidebar-panels";
import { useHandTracking, type AirEvent } from "../hooks/use-hand-tracking";
import { useStockfish } from "../hooks/use-stockfish";
import { practiceOrientation } from "../lib/air-controls";
import type { AimMode } from "../lib/air-pointer";
import type { PublicUser } from "../lib/auth";
import {
  applyAction,
  effectiveClocks,
  newGame,
  replay,
  TIME_CONTROLS,
  undoLocalMove,
  type Action,
  type RoomState,
  type TimeControlId,
} from "../lib/game";
import { resetPanelLayout } from "../lib/panel-layout";
import {
  defaultPreferences,
  readPracticeState,
  readPreferences,
  safeSet,
  writePracticeState,
  type BoardTheme,
  type PlayMode,
} from "../lib/preferences";
import { playChessSound, type SoundKind } from "../lib/sound";
import { DIFFICULTY_PRESETS, type DifficultyPreset } from "../lib/stockfish";

type Room = {
  code: string;
  color: Color | null;
  ready: boolean;
  revision: number;
  state: RoomState;
  whiteName?: string | null;
  blackName?: string | null;
  spectating?: boolean;
  serverNow?: number;
};

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function historyReplace() {
  window.history.replaceState({}, "", "/");
}

function soundKindFor(
  moves: string[],
  resultPresent: boolean,
): SoundKind {
  if (resultPresent) return "end";
  const san = moves.at(-1) ?? "";
  if (san.includes("+") || san.includes("#")) return "check";
  if (san.includes("=")) return "promote";
  if (san === "O-O" || san === "O-O-O") return "castle";
  if (san.includes("x")) return "capture";
  return "move";
}

export default function AirChess() {
  const [local, setLocal] = useState<RoomState>(newGame);
  const [room, setRoom] = useState<Room | null>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState("");
  const [notice, setNotice] = useState("");
  const [muted, setMuted] = useState(defaultPreferences.muted);
  const [opacity, setOpacity] = useState(defaultPreferences.opacity);
  const [followTurn, setFollowTurn] = useState(defaultPreferences.followTurn);
  const [reachAssist, setReachAssist] = useState(defaultPreferences.reachAssist);
  const [aimMode, setAimMode] = useState<AimMode>(defaultPreferences.aimMode);
  const [boardTheme, setBoardTheme] = useState<BoardTheme>(defaultPreferences.boardTheme);
  const [playMode, setPlayMode] = useState<PlayMode>(defaultPreferences.playMode);
  const [timeControl, setTimeControl] = useState<TimeControlId>(defaultPreferences.timeControl);
  const [aiDifficulty, setAiDifficulty] = useState<DifficultyPreset>(defaultPreferences.aiDifficulty);
  const [aiColor, setAiColor] = useState<Color>(defaultPreferences.aiColor);
  const [showEval, setShowEval] = useState(defaultPreferences.showEval);
  const [twoHandPause, setTwoHandPause] = useState(defaultPreferences.twoHandPause);
  const [hintVisible, setHintVisible] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [focusMode, setFocusMode] = useState(defaultPreferences.focusMode);
  const [arranging, setArranging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [watchCopied, setWatchCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [viewPly, setViewPly] = useState<number | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [user, setUser] = useState<PublicUser | null>(null);

  const keyRef = useRef("");
  const roomRef = useRef<Room | null>(null);
  const busyRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  const practiceLoadedRef = useRef(false);
  const flaggedRevRef = useRef<number | null>(null);
  const archivedLocalGameRef = useRef<number | null>(null);
  const skipViewResetRef = useRef(false);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  const state = room?.state ?? local;
  const activePly = viewPly === null ? state.moves.length : Math.max(0, Math.min(state.moves.length, viewPly));
  const isReviewing = activePly < state.moves.length;
  const analysisAllowed = !room || Boolean(state.result);

  const liveChess = useMemo(() => replay(state.moves), [state.moves]);
  const displayChess = useMemo(
    () => (isReviewing ? replay(state.moves, activePly) : liveChess),
    [isReviewing, state.moves, activePly, liveChess],
  );
  const orientation =
    room?.color ??
    (room?.spectating
      ? flipped
        ? "b"
        : "w"
      : playMode === "ai"
        ? aiColor
        : practiceOrientation(liveChess.turn(), followTurn, flipped));

  const clockRunning = Boolean(
    state.clock &&
      !state.result &&
      state.clock.lastTickAt !== null &&
      (!room || room.ready),
  );
  useEffect(() => {
    if (!clockRunning) return;
    const id = setInterval(() => setClockNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [clockRunning]);

  const clocks = useMemo(
    () =>
      effectiveClocks(
        state,
        liveChess.turn(),
        clockNow + (room ? clockOffset : 0),
      ),
    [state, liveChess, clockNow, room, clockOffset],
  );

  const engineEnabled = hydrated && ((!room && playMode === "ai") || (analysisAllowed && (showEval || hintVisible)));
  const {
    thinking: aiThinking,
    error: aiError,
    evalScore,
    bestHint,
    setBestHint,
    cancelSearch,
    requestMove,
    evaluatePosition,
  } = useStockfish(engineEnabled);

  function changeOpacity(value: number) {
    const clamped = Math.max(0, Math.min(1, Math.round(value * 100) / 100));
    setOpacity(clamped);
    safeSet("airchess.opacity", String(clamped));
  }
  function changeFocusMode(value: boolean) {
    setFocusMode(value);
    safeSet("airchess.focus", String(value));
  }
  function changeAimMode(value: AimMode) {
    setAimMode(value);
    safeSet("airchess.aimMode", value);
  }
  function changeBoardTheme(value: BoardTheme) {
    setBoardTheme(value);
    safeSet("airchess.theme", value);
  }
  function changePlayMode(value: PlayMode) {
    cancelSearch();
    setPlayMode(value);
    safeSet("airchess.playMode", value);
    setSelected(null);
  }
  function changeTimeControl(value: TimeControlId) {
    setTimeControl(value);
    safeSet("airchess.timeControl", value);
    if (!room && local.moves.length === 0 && !local.result) {
      setLocal(newGame(local.game, value));
    }
  }
  function changeAiDifficulty(value: DifficultyPreset) {
    setAiDifficulty(value);
    safeSet("airchess.aiDifficulty", value);
  }
  function changeAiColor(value: Color) {
    cancelSearch();
    setAiColor(value);
    safeSet("airchess.aiColor", value);
    setSelected(null);
  }
  function toggleShowEval() {
    setShowEval((v) => {
      safeSet("airchess.showEval", String(!v));
      return !v;
    });
  }
  function toggleTwoHandPause() {
    setTwoHandPause((v) => {
      safeSet("airchess.twoHandPause", String(!v));
      return !v;
    });
  }
  function toggleReachAssist() {
    setReachAssist((v) => {
      safeSet("airchess.reachAssist", String(!v));
      return !v;
    });
  }
  function toggleFollowTurn() {
    setFollowTurn((v) => {
      safeSet("airchess.followTurn", String(!v));
      return !v;
    });
  }
  function toggleMuted() {
    setMuted((v) => {
      safeSet("airchess.muted", String(!v));
      return !v;
    });
  }

  const canMove =
    !state.result &&
    !busy &&
    !isReviewing &&
    (room
      ? !room.spectating && room.ready && room.color === liveChess.turn()
      : playMode !== "ai" || (liveChess.turn() === aiColor && !aiThinking));

  const legal = useMemo(
    () => (selected && !isReviewing ? liveChess.moves({ square: selected, verbose: true }) : []),
    [liveChess, selected, isReviewing],
  );
  const fullHistory = useMemo(() => liveChess.history({ verbose: true }), [liveChess]);
  const displayHistory = useMemo(() => displayChess.history({ verbose: true }), [displayChess]);
  const lastMove = displayHistory.at(-1);

  const playSound = useCallback(
    (kind: SoundKind) => {
      if (muted) return;
      try {
        const ctx = (audioRef.current ??= new AudioContext());
        playChessSound(ctx, kind);
      } catch {
        /* Audio is optional. */
      }
    },
    [muted],
  );

  useEffect(() => {
    if (!modal && !promotion) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>("[role=dialog]");
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input, [tabindex="0"]',
        ) ?? [],
      );
    focusable()[0]?.focus();
    const keydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModal(null);
        setPromotion(null);
        setSelected(null);
      }
      if (e.key === "Tab") {
        const list = focusable();
        const first = list[0];
        const last = list.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, [modal, promotion]);

  useEffect(() => {
    if (modal || promotion || arranging) return;
    const total = state.moves.length;
    if (!total) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setViewPly((prev) => Math.max(0, (prev ?? total) - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setViewPly((prev) => {
          if (prev === null) return null;
          return prev + 1 >= total ? null : prev + 1;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal, promotion, arranging, state.moves.length]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const acceptRoom = useCallback((next: Room, via = "Connected") => {
    if (typeof next.serverNow === "number") {
      setClockOffset(next.serverNow - Date.now());
    }
    setRoom((previous) =>
      previous && previous.code === next.code && previous.revision > next.revision
        ? previous
        : next,
    );
    if (!next.spectating) sessionStorage.setItem("airchess.room", next.code);
    setConnection(via);
  }, []);

  const api = useCallback(async (path: string, body?: unknown) => {
    const res = await fetch(`/api/rooms${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${keyRef.current}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    const data = (await res.json()) as Room & { error?: string };
    if (!res.ok) throw new ApiError(data.error ?? "Connection failed. Try again.", res.status);
    return data as Room;
  }, []);

  useEffect(() => {
    const prefs = readPreferences();
    const savedPractice = readPracticeState();
    keyRef.current = sessionStorage.getItem("airchess.key") ?? crypto.randomUUID();
    sessionStorage.setItem("airchess.key", keyRef.current);
    const savedRoom = sessionStorage.getItem("airchess.room");
    const params = new URLSearchParams(location.search);
    const invite = params.get("room");
    const watch = params.get("watch") === "1";
    const replayId = params.get("game");
    fetch("/api/auth/me")
      .then((r) => (r.ok ? (r.json() as Promise<{ user?: PublicUser | null }>) : { user: null }))
      .then((d) => setUser(d.user ?? null))
      .catch(() => {});
    queueMicrotask(() => {
      setFocusMode(prefs.focusMode);
      setOpacity(prefs.opacity);
      setAimMode(prefs.aimMode);
      setReachAssist(prefs.reachAssist);
      setFollowTurn(prefs.followTurn);
      setMuted(prefs.muted);
      setBoardTheme(prefs.boardTheme);
      setPlayMode(prefs.playMode);
      setTimeControl(prefs.timeControl);
      setAiDifficulty(prefs.aiDifficulty);
      setAiColor(prefs.aiColor);
      setShowEval(prefs.showEval);
      setTwoHandPause(prefs.twoHandPause);
      setLocal(savedPractice);
      practiceLoadedRef.current = true;
      if (replayId && /^[a-f0-9-]{36}$/.test(replayId)) {
        fetch(`/api/games/${replayId}`)
          .then((r) =>
            r.ok
              ? (r.json() as Promise<{ game: ArchivedGame }>)
              : Promise.reject(new Error("Game not found.")),
          )
          .then((data) => {
            const g = data.game;
            skipViewResetRef.current = true;
            setPlayMode("practice");
            setLocal({
              moves: g.moves,
              result: { text: g.resultText, winner: (g.winner as Color | null) ?? null },
              drawOffer: null,
              rematch: null,
              game: 1,
              clock: null,
            });
            setViewPly(0);
            setNotice(`Loaded archived game: ${g.whiteName} vs ${g.blackName}`);
          })
          .catch((e) => setNotice(e instanceof Error ? e.message : "Could not load game."));
      } else if (invite && /^\d{6}$/.test(invite) && watch) {
        setConnection("Connecting to stream…");
        api(`/${invite}?watch=1`)
          .then((r) => acceptRoom(r, "Live watch"))
          .catch((e) => {
            setNotice(e instanceof Error ? e.message : "Could not open spectator view.");
            setConnection("");
          });
      } else if (invite && /^\d{6}$/.test(invite) && invite !== savedRoom) {
        setJoinCode(invite);
        setModal("join");
      } else if (savedRoom) {
        setConnection("Reconnecting…");
        api(`/${savedRoom}`)
          .then((r) => acceptRoom(r, "Connected"))
          .catch((e) => {
            setNotice(e instanceof Error ? e.message : "Could not reconnect to room.");
            setConnection("");
            sessionStorage.removeItem("airchess.room");
          });
      }
      setHydrated(true);
    });
    return () => {
      void audioRef.current?.close();
    };
  }, [api, acceptRoom]);

  useEffect(() => {
    if (!practiceLoadedRef.current) return;
    writePracticeState(local);
  }, [local]);

  useEffect(() => {
    if (!user || room || playMode !== "ai" || !local.result || !local.moves.length) return;
    if (archivedLocalGameRef.current === local.game) return;
    archivedLocalGameRef.current = local.game;
    void fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "ai",
        playerColor: aiColor,
        difficulty: aiDifficulty,
        timeControl: local.clock?.control ?? "untimed",
        moves: local.moves,
        resultText: local.result.text,
        winner: local.result.winner,
      }),
    })
      .then(() => fetch("/api/auth/me"))
      .then((r) => (r.ok ? (r.json() as Promise<{ user?: PublicUser | null }>) : null))
      .then((d) => {
        if (d?.user) setUser(d.user);
      })
      .catch(() => {});
  }, [user, room, playMode, local.result, local.moves, local.game, local.clock?.control, aiColor, aiDifficulty]);

  // Refresh user Elo/record whenever an online room game concludes.
  useEffect(() => {
    if (!user || !room?.state.result) return;
    void fetch("/api/auth/me")
      .then((r) => (r.ok ? (r.json() as Promise<{ user?: PublicUser | null }>) : null))
      .then((d) => {
        if (d?.user) setUser(d.user);
      })
      .catch(() => {});
  }, [user, room?.state.result]);

  useEffect(() => {
    if (!room?.code) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let streamAbort: AbortController | null = null;
    const suffix = room.spectating ? "?watch=1" : "";

    const handleFatal = (message: string) => {
      if (!active) return;
      if (!room.spectating) sessionStorage.removeItem("airchess.room");
      setRoom(null);
      roomRef.current = null;
      setConnection("");
      setNotice(message);
    };

    const pollOnce = async () => {
      try {
        const next = await api(`/${room.code}${suffix}`);
        if (active) acceptRoom(next, room.spectating ? "Watch polling" : "Polling");
      } catch (e) {
        if (!active) return;
        if (e instanceof ApiError && (e.status === 401 || e.status === 403 || e.status === 404)) {
          handleFatal(e.message);
          return;
        }
        setConnection("Reconnecting… moves paused");
      }
      if (active) timer = setTimeout(pollOnce, document.hidden ? 4000 : 1200);
    };

    const connectStream = async () => {
      if (!active) return;
      streamAbort = new AbortController();
      try {
        const res = await fetch(`/api/rooms/${room.code}/events${suffix}`, {
          headers: room.spectating ? undefined : { Authorization: `Bearer ${keyRef.current}` },
          signal: streamAbort.signal,
        });
        if (!res.ok || !res.body) {
          if (res.status === 401 || res.status === 403 || res.status === 404) {
            const errBody = (await res.json().catch(() => ({}))) as { error?: string };
            handleFatal(errBody.error ?? "Room unavailable.");
            return;
          }
          throw new Error("Stream failed");
        }
        if (active) setConnection(room.spectating ? "Live watch" : "Live stream");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let eventName = "message";

        while (active) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const rawLine of lines) {
            const line = rawLine.trimEnd();
            if (!line) {
              eventName = "message";
              continue;
            }
            if (line.startsWith("event:")) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              const payload = line.slice(5).trim();
              try {
                const parsed = JSON.parse(payload) as Room & { error?: string };
                if (eventName === "closed") {
                  handleFatal(parsed.error ?? "Room expired.");
                  return;
                }
                if (eventName === "state" && active) {
                  acceptRoom(parsed, room.spectating ? "Live watch" : "Live stream");
                }
              } catch {
                /* Ignore malformed SSE chunk. */
              }
            }
          }
        }
        if (active) {
          timer = setTimeout(() => void connectStream(), 150);
        }
      } catch (e) {
        if (!active || (e instanceof DOMException && e.name === "AbortError")) return;
        setConnection("Reconnecting…");
        timer = setTimeout(pollOnce, 900);
      }
    };

    const onVisibility = () => {
      if (!document.hidden && active) {
        clearTimeout(timer);
        streamAbort?.abort();
        void connectStream();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    void connectStream();
    return () => {
      active = false;
      clearTimeout(timer);
      streamAbort?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [room?.code, room?.spectating, api, acceptRoom]);

  useEffect(() => {
    queueMicrotask(() => {
      setSelected(null);
      setPromotion(null);
      if (skipViewResetRef.current) skipViewResetRef.current = false;
      else setViewPly(null);
      setHintVisible(false);
      setBestHint(null);
    });
  }, [room?.code, state.moves.length, state.game, setBestHint]);

  useEffect(() => {
    if (!hydrated || room || playMode !== "ai" || state.result || isReviewing) return;
    if (liveChess.turn() === aiColor) return;
    const fen = liveChess.fen();
    const turn = liveChess.turn();
    const timer = setTimeout(() => {
      requestMove(fen, turn, aiDifficulty, (aiMove) => {
        setLocal((prev) => {
          const checkChess = replay(prev.moves);
          if (checkChess.fen() !== fen || prev.result) return prev;
          try {
            const next = applyAction(prev, turn, { type: "move", ...aiMove });
            playSound(soundKindFor(next.moves, Boolean(next.result)));
            return next;
          } catch {
            return prev;
          }
        });
      });
    }, 180);
    return () => {
      clearTimeout(timer);
      cancelSearch();
    };
  }, [hydrated, room, playMode, state.result, isReviewing, liveChess, aiColor, aiDifficulty, requestMove, cancelSearch, playSound]);

  useEffect(() => {
    if (!hydrated || !analysisAllowed || (!showEval && !hintVisible)) return;
    if (!room && playMode === "ai" && !state.result && liveChess.turn() !== aiColor && !isReviewing) return;
    const fen = displayChess.fen();
    const turn = displayChess.turn();
    const timer = setTimeout(() => {
      evaluatePosition(fen, turn);
    }, 140);
    return () => clearTimeout(timer);
  }, [hydrated, analysisAllowed, showEval, hintVisible, room, playMode, state.result, liveChess, aiColor, isReviewing, displayChess, evaluatePosition]);

  async function connect(kind: "create" | "join") {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const next = await api(
        kind === "create" ? "" : `/${joinCode}`,
        kind === "create" ? { type: "create", timeControl } : { type: "join" },
      );
      acceptRoom(next);
      historyReplace();
      setModal(null);
      setNotice(
        kind === "create"
          ? "Room created. Share the code with your friend."
          : "You joined as Black. Your friend moves first.",
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not connect.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function act(action: Action) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const currentRoom = roomRef.current;
      if (currentRoom) {
        const next = await api(`/${currentRoom.code}`, {
          type: "action",
          revision: currentRoom.revision,
          action,
        });
        acceptRoom(next);
        if (action.type === "move" || next.state.result) {
          playSound(soundKindFor(next.state.moves, Boolean(next.state.result)));
        }
      } else {
        const nextLocal =
          action.type === "resign" && playMode === "ai"
            ? applyAction(local, aiColor, action)
            : applyAction(local, liveChess.turn(), action);
        setLocal(nextLocal);
        if (action.type === "move" || nextLocal.result) {
          playSound(soundKindFor(nextLocal.moves, Boolean(nextLocal.result)));
        }
      }
      setSelected(null);
      setPromotion(null);
      setViewPly(null);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not complete that action.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function move(from: string, to: string) {
    if (!canMove || (connection.startsWith("Reconnecting") && room)) return;
    const candidates = liveChess
      .moves({ verbose: true })
      .filter((m) => m.from === from && m.to === to);
    if (!candidates.length) {
      setNotice("Choose one of the highlighted legal squares.");
      return;
    }
    if (candidates[0].promotion) {
      setPromotion({ from, to });
      return;
    }
    void act({ type: "move", from, to });
  }

  function squareClick(square: Square) {
    if (!canMove || promotion) return;
    if (selected === square) {
      setSelected(null);
      return;
    }
    if (liveChess.get(square)?.color === liveChess.turn()) setSelected(square);
    else if (selected) move(selected, square);
  }

  const squareClickRef = useRef(squareClick);
  useEffect(() => {
    squareClickRef.current = squareClick;
  });

  const handleAir = useCallback(
    (event: AirEvent) => {
      if (event.type === "cancel") {
        setSelected(null);
        return;
      }
      if (!arranging && !modal && !promotion && canMove) {
        squareClickRef.current(event.square as Square);
      }
    },
    [arranging, modal, promotion, canMove],
  );

  const {
    videoRef,
    canvasRef,
    cursorRef,
    start: startHand,
    stop: stopHand,
    recalibrate: recalibrateHand,
    status: handStatus,
    error: handError,
    fps: handFps,
    latency: handLatency,
    handCount,
    delegate: handDelegate,
    feedback: handFeedback,
  } = useHandTracking(
    handleAir,
    reachAssist,
    `${room?.code ?? "practice"}:${state.game}:${state.moves.length}:${selected}:${orientation}:${modal}:${Boolean(promotion)}:${canMove}:${arranging}:${isReviewing}`,
    aimMode,
    twoHandPause,
  );

  const cameraActive = handStatus === "tracking" || handStatus === "searching";
  useEffect(() => {
    if (cameraActive || focusMode) window.scrollTo({ top: 0 });
  }, [cameraActive, focusMode]);

  const statusText =
    state.result?.text ??
    (!room?.ready && room
      ? "Waiting for your friend"
      : !room && playMode === "ai" && liveChess.turn() !== aiColor
        ? aiThinking
          ? "Stockfish is thinking…"
          : "Stockfish to move"
        : `${liveChess.turn() === "w" ? "White" : "Black"} to move${liveChess.isCheck() ? " · Check!" : ""}`);

  useEffect(() => {
    if (!clocks?.timedOut || state.result) return;
    if (!room) {
      queueMicrotask(() => {
        setLocal((prev) => {
          if (prev.result) return prev;
          try {
            const next = applyAction(prev, liveChess.turn(), { type: "flag" }, clockNow);
            playSound("end");
            return next;
          } catch {
            return prev;
          }
        });
      });
      return;
    }
    if (room.spectating || flaggedRevRef.current === room.revision) return;
    flaggedRevRef.current = room.revision;
    void api(`/${room.code}`, {
      type: "action",
      revision: room.revision,
      action: { type: "flag" },
    })
      .then((next) => {
        acceptRoom(next);
        playSound("end");
      })
      .catch(() => {
        flaggedRevRef.current = null;
      });
  }, [clocks?.timedOut, state.result, room, liveChess, clockNow, api, acceptRoom, playSound]);

  async function copyWatchLink() {
    try {
      await navigator.clipboard.writeText(`${location.origin}/?room=${room!.code}&watch=1`);
      setWatchCopied(true);
      setTimeout(() => setWatchCopied(false), 2500);
    } catch {
      setNotice(`Share spectator link: ${location.origin}/?room=${room!.code}&watch=1`);
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(`${location.origin}/?room=${room!.code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setNotice(`Share this room code: ${room!.code}`);
    }
  }

  function leave() {
    setRoom(null);
    roomRef.current = null;
    sessionStorage.removeItem("airchess.room");
    setConnection("");
    setModal(null);
    setLocal(readPracticeState());
    setViewPly(null);
    historyReplace();
  }

  function downloadPgn() {
    const c = replay(state.moves);
    c.header(
      "Event",
      "AirChess casual game",
      "White",
      "White",
      "Black",
      "Black",
      "Result",
      state.result
        ? state.result.winner === "w"
          ? "1-0"
          : state.result.winner === "b"
            ? "0-1"
            : "1/2-1/2"
        : "*",
    );
    const url = URL.createObjectURL(new Blob([c.pgn()], { type: "application/x-chess-pgn" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `airchess-${room?.code ?? "practice"}.pgn`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const handleBoardSquareClick = useCallback((sq: Square) => {
    squareClickRef.current(sq);
  }, []);

  return (
    <main
      data-theme={boardTheme}
      className={`app ${cameraActive ? "camera-on" : ""} ${cameraActive || focusMode ? "immersive" : ""} ${handFeedback.helper ? "air-paused" : ""}`}
      style={{ "--board-opacity": opacity } as React.CSSProperties}
    >
      <video
        ref={videoRef}
        className="camera-video"
        autoPlay
        muted
        playsInline
        aria-label="Your private camera preview"
      />
      <div className="ambient" aria-hidden="true">
        <div className="orb orb-one" />
        <div className="orb orb-two" />
        <div className="floor-grid" />
      </div>
      <div className="camera-shade" />
      <canvas ref={canvasRef} className="hand-canvas" aria-hidden="true" />
      <div ref={cursorRef} aria-hidden="true">
        <div className="air-cursor hand-0">
          <span />
          <b>Move</b>
        </div>
      </div>

      <header className="topbar">
        <div className="brand-identity">
          <Link className="brand" href="/" aria-label="AirChess home">
            <span className="brand-mark">♞</span>Air<span>Chess</span>
          </Link>
          <button
            type="button"
            className="maker-credit"
            data-air
            aria-label="About the developer, Harsh Agarwal"
            onClick={() => setModal("about")}
          >
            <span className="maker-initials">HA</span>
            <span className="maker-name">by Harsh</span>
          </button>
        </div>
        <div className="top-middle">
          <span className="tiny-dot" /> A new way to make your move
        </div>
        <div className="top-actions">
          <button
            type="button"
            className="text-button"
            data-air
            aria-pressed={arranging}
            onClick={() => {
              if (!arranging) changeFocusMode(true);
              setArranging(!arranging);
            }}
          >
            {arranging ? "Done arranging" : "Arrange layout"}
          </button>
          {arranging && (
            <button type="button" className="text-button" data-air onClick={resetPanelLayout}>
              Reset layout
            </button>
          )}
          <button type="button" className="text-button" data-air onClick={() => setModal("help")}>
            <CircleHelp size={16} />
            <span>How to play</span>
          </button>
          <button
            type="button"
            className={`text-button profile-pill ${user ? "signed-in" : ""}`}
            data-air
            aria-label={user ? `Profile for ${user.username}` : "Sign in or view leaderboard"}
            onClick={() => setModal("profile")}
          >
            <User size={15} />
            <span>{user ? `@${user.username} · ${user.rating}` : "Sign in"}</span>
          </button>
          <button
            type="button"
            className="icon-button"
            data-air
            aria-label="Settings"
            onClick={() => setModal("settings")}
          >
            <Settings2 size={18} />
          </button>
        </div>
      </header>

      <div className="workspace">
        <section className="play-area">
          <div className="section-heading">
            <div>
              <div className="eyebrow">
                <span /> THE BOARD IS YOURS
              </div>
              <h1>
                Your next move.
                <br />
                <em>In the air.</em>
              </h1>
            </div>
            <div className="session-label">
              <span className={room ? "tiny-dot" : "hollow-dot"} />
              {room
                ? room.spectating
                  ? `Watching ${room.code}`
                  : `Room ${room.code}`
                : playMode === "ai"
                  ? "vs Stockfish"
                  : "Practice space"}
              <small>
                {room
                  ? `${room.state.clock ? `${TIME_CONTROLS[room.state.clock.control].label} · ` : ""}${connection}`
                  : playMode === "ai"
                    ? `${DIFFICULTY_PRESETS[aiDifficulty].label} · You play ${aiColor === "w" ? "White" : "Black"}`
                    : "Both colors · one controller"}
              </small>
            </div>
          </div>

          <ChessBoard
            chess={displayChess}
            orientation={orientation}
            selected={isReviewing ? null : selected}
            legal={legal}
            lastMove={lastMove}
            room={room}
            state={state}
            clocks={clocks}
            busy={busy}
            aiConfig={{
              active: playMode === "ai",
              playerColor: aiColor,
              difficulty: aiDifficulty,
              thinking: aiThinking,
            }}
            arranging={arranging}
            modalOpen={Boolean(modal)}
            promotionOpen={Boolean(promotion)}
            canMove={canMove}
            isReviewing={isReviewing}
            viewPly={activePly}
            totalPlies={state.moves.length}
            statusText={statusText}
            airTarget={handFeedback.target}
            airLocked={handFeedback.locked}
            hasResult={Boolean(state.result)}
            showEval={analysisAllowed && showEval}
            evalScore={evalScore}
            hintMove={analysisAllowed && hintVisible && !isReviewing ? bestHint : null}
            onSquareClick={handleBoardSquareClick}
            onFlip={() => {
              setFollowTurn(false);
              safeSet("airchess.followTurn", "false");
              setFlipped(orientation === "w");
            }}
            onDownloadPgn={downloadPgn}
            onUndo={() => {
              cancelSearch();
              setLocal((prev) => {
                const steps =
                  playMode === "ai" && liveChess.turn() === aiColor && prev.moves.length >= 2 ? 2 : 1;
                return undoLocalMove(prev, steps);
              });
              setSelected(null);
              setViewPly(null);
            }}
            onJumpLive={() => setViewPly(null)}
            onOpenModal={(nextModal) => setModal(nextModal)}
            onAction={(action) => void act(action)}
          />

          <div className="stage-footer">
            <span>
              <ShieldCheck size={14} /> Your camera stays on your device
            </span>
            <span>NO TOUCH. JUST CHESS.</span>
          </div>
        </section>

        <SidebarPanels
          arranging={arranging}
          cameraActive={cameraActive}
          hand={{
            status: handStatus,
            error: handError,
            fps: handFps,
            latency: handLatency,
            handCount,
            delegate: handDelegate,
            feedback: handFeedback,
            start: startHand,
            stop: stopHand,
          }}
          aimMode={aimMode}
          onAimModeChange={changeAimMode}
          selected={selected}
          onClearSelection={() => setSelected(null)}
          room={room}
          playMode={playMode}
          onPlayModeChange={changePlayMode}
          timeControl={timeControl}
          onTimeControlChange={changeTimeControl}
          aiDifficulty={aiDifficulty}
          onAiDifficultyChange={changeAiDifficulty}
          aiColor={aiColor}
          onAiColorChange={changeAiColor}
          aiThinking={aiThinking}
          aiError={aiError}
          showEval={analysisAllowed && showEval}
          onToggleEval={toggleShowEval}
          analysisAllowed={analysisAllowed}
          hintVisible={analysisAllowed && hintVisible}
          onToggleHint={() => setHintVisible((v) => !v)}
          state={state}
          history={fullHistory}
          viewPly={activePly}
          onViewPlyChange={setViewPly}
          busy={busy}
          hydrated={hydrated}
          copied={copied}
          watchCopied={watchCopied}
          connection={connection}
          muted={muted}
          onToggleMuted={toggleMuted}
          onConnectCreate={() => void connect("create")}
          onOpenJoin={() => setModal("join")}
          onCopyInvite={() => void copyInvite()}
          onCopyWatchLink={() => void copyWatchLink()}
          onLeaveWatch={leave}
          onOpenModal={(nextModal) => setModal(nextModal)}
          onDownloadPgn={downloadPgn}
        />
      </div>

      <section className="gesture-strip">
        <div className="gesture-strip-title">
          <ScanLine size={19} />
          <strong>Three moves to get moving.</strong>
          <span>Your hand is the controller.</span>
        </div>
        <div className="gesture-step">
          <span className="step-number">01</span>
          <div>
            <strong>Aim &amp; settle</strong>
            <span>Follow your index cursor</span>
          </div>
        </div>
        <div className="gesture-step">
          <span className="step-number">02</span>
          <div>
            <strong>Hold to select</strong>
            <span>Select your piece</span>
          </div>
        </div>
        <div className="gesture-step">
          <span className="step-number">03</span>
          <div>
            <strong>Hold to move</strong>
            <span>Confirm the destination</span>
          </div>
        </div>
        <button
          type="button"
          className="icon-button"
          data-air
          aria-label="Read gesture guide"
          onClick={() => setModal("help")}
        >
          <ArrowUpRight size={21} />
        </button>
      </section>

      <footer className="footer">
        <span>
          AirChess <span>·</span> A small experiment in playing differently.
        </span>
        <span>
          Built by{" "}
          <button type="button" className="footer-credit" data-air onClick={() => setModal("about")}>
            Harsh Agarwal <ArrowUpRight size={12} />
          </button>
        </span>
      </footer>

      {notice && (
        <div className="toast" role="status">
          {notice}
          <button
            type="button"
            className="icon-button"
            data-air
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {room && state.drawOffer && state.drawOffer !== room.color && !state.result && (
        <div className="draw-banner" role="status">
          <span>Your friend offers a draw.</span>
          <button
            type="button"
            className="button primary"
            data-air
            disabled={busy}
            onClick={() => void act({ type: "accept-draw" })}
          >
            Accept
          </button>
          <button
            type="button"
            className="button secondary"
            data-air
            disabled={busy}
            onClick={() => void act({ type: "decline-draw" })}
          >
            Keep playing
          </button>
        </div>
      )}

      <GameModals
        modal={modal}
        promotion={promotion}
        turn={liveChess.turn()}
        busy={busy}
        joinCode={joinCode}
        onJoinCodeChange={setJoinCode}
        onConnectJoin={() => void connect("join")}
        opacity={opacity}
        onOpacityChange={changeOpacity}
        boardTheme={boardTheme}
        onBoardThemeChange={changeBoardTheme}
        cameraActive={cameraActive}
        onRecalibrate={recalibrateHand}
        reachAssist={reachAssist}
        onToggleReachAssist={toggleReachAssist}
        inRoom={Boolean(room)}
        isAiMode={playMode === "ai"}
        followTurn={followTurn}
        onToggleFollowTurn={toggleFollowTurn}
        muted={muted}
        onToggleMuted={toggleMuted}
        showEval={showEval}
        onToggleEval={toggleShowEval}
        twoHandPause={twoHandPause}
        onToggleTwoHandPause={toggleTwoHandPause}
        focusMode={focusMode}
        onToggleFocusMode={() => changeFocusMode(!focusMode)}
        onNotice={setNotice}
        onClose={() => {
          setModal(null);
          setPromotion(null);
          setSelected(null);
        }}
        onAction={(action) => void act(action)}
        onLeaveRoom={leave}
        onResetPractice={() => {
          archivedLocalGameRef.current = null;
          setLocal(newGame(local.game + 1, timeControl));
          setSelected(null);
          setViewPly(null);
          setModal(null);
        }}
        user={user}
        onUserChange={setUser}
        onReplayGame={(g) => {
          setRoom(null);
          roomRef.current = null;
          skipViewResetRef.current = true;
          setPlayMode("practice");
          safeSet("airchess.playMode", "practice");
          setLocal({
            moves: g.moves,
            result: { text: g.resultText, winner: (g.winner as Color | null) ?? null },
            drawOffer: null,
            rematch: null,
            game: 1,
            clock: null,
          });
          setViewPly(0);
          setModal(null);
          setNotice(`Replaying ${g.whiteName} vs ${g.blackName}`);
        }}
      />
    </main>
  );
}
