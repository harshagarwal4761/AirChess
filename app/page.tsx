"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Color, Square } from "chess.js";
import { ArrowUpRight, CircleHelp, ScanLine, Settings2, ShieldCheck, X } from "lucide-react";
import { ChessBoard } from "../components/chess-board";
import { GameModals, type ModalKind } from "../components/game-modals";
import { SidebarPanels } from "../components/sidebar-panels";
import { useHandTracking, type AirEvent } from "../hooks/use-hand-tracking";
import { practiceOrientation } from "../lib/air-controls";
import type { AimMode } from "../lib/air-pointer";
import { applyAction, newGame, replay, undoLocalMove, type Action, type RoomState } from "../lib/game";
import { resetPanelLayout } from "../lib/panel-layout";
import {
  defaultPreferences,
  readPracticeState,
  readPreferences,
  safeSet,
  writePracticeState,
  type BoardTheme,
} from "../lib/preferences";
import { playChessSound, type SoundKind } from "../lib/sound";

type Room = {
  code: string;
  color: Color;
  ready: boolean;
  revision: number;
  state: RoomState;
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
  const [flipped, setFlipped] = useState(false);
  const [focusMode, setFocusMode] = useState(defaultPreferences.focusMode);
  const [arranging, setArranging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [viewPly, setViewPly] = useState<number | null>(null);

  const keyRef = useRef("");
  const roomRef = useRef<Room | null>(null);
  const busyRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  const practiceLoadedRef = useRef(false);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  const state = room?.state ?? local;
  const activePly = viewPly === null ? state.moves.length : Math.max(0, Math.min(state.moves.length, viewPly));
  const isReviewing = activePly < state.moves.length;

  const liveChess = useMemo(() => replay(state.moves), [state.moves]);
  const displayChess = useMemo(
    () => (isReviewing ? replay(state.moves, activePly) : liveChess),
    [isReviewing, state.moves, activePly, liveChess],
  );
  const orientation = room?.color ?? practiceOrientation(liveChess.turn(), followTurn, flipped);

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
    (!room || (room.ready && room.color === liveChess.turn()));

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

  const acceptRoom = useCallback((next: Room) => {
    setRoom((previous) =>
      previous && previous.code === next.code && previous.revision > next.revision
        ? previous
        : next,
    );
    sessionStorage.setItem("airchess.room", next.code);
    setConnection("Connected");
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
    const invite = new URLSearchParams(location.search).get("room");
    queueMicrotask(() => {
      setFocusMode(prefs.focusMode);
      setOpacity(prefs.opacity);
      setAimMode(prefs.aimMode);
      setReachAssist(prefs.reachAssist);
      setFollowTurn(prefs.followTurn);
      setMuted(prefs.muted);
      setBoardTheme(prefs.boardTheme);
      setLocal(savedPractice);
      practiceLoadedRef.current = true;
      if (invite && /^\d{6}$/.test(invite) && invite !== savedRoom) {
        setJoinCode(invite);
        setModal("join");
      } else if (savedRoom) {
        setConnection("Reconnecting…");
        api(`/${savedRoom}`)
          .then(acceptRoom)
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
    if (!room?.code) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      if (active) timer = setTimeout(poll, document.hidden ? 4000 : 900);
    };
    const poll = async () => {
      try {
        const next = await api(`/${room.code}`);
        if (active) acceptRoom(next);
        schedule();
      } catch (e) {
        if (!active) return;
        if (e instanceof ApiError && (e.status === 401 || e.status === 403 || e.status === 404)) {
          sessionStorage.removeItem("airchess.room");
          setRoom(null);
          roomRef.current = null;
          setConnection("");
          setNotice(e.message);
          return;
        }
        setConnection("Reconnecting… moves paused");
        schedule();
      }
    };
    const onVisibility = () => {
      if (!document.hidden && active) {
        clearTimeout(timer);
        void poll();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    timer = setTimeout(poll, 900);
    return () => {
      active = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [room?.code, api, acceptRoom]);

  useEffect(() => {
    queueMicrotask(() => {
      setSelected(null);
      setPromotion(null);
      setViewPly(null);
    });
  }, [room?.code, state.moves.length, state.game]);

  async function connect(kind: "create" | "join") {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const next = await api(kind === "create" ? "" : `/${joinCode}`, { type: kind });
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
        const nextLocal = applyAction(local, liveChess.turn(), action);
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
    feedback: handFeedback,
  } = useHandTracking(
    handleAir,
    reachAssist,
    `${room?.code ?? "practice"}:${state.game}:${state.moves.length}:${selected}:${orientation}:${modal}:${Boolean(promotion)}:${canMove}:${arranging}:${isReviewing}`,
    aimMode,
  );

  const cameraActive = handStatus === "tracking" || handStatus === "searching";
  useEffect(() => {
    if (cameraActive || focusMode) window.scrollTo({ top: 0 });
  }, [cameraActive, focusMode]);

  const statusText =
    state.result?.text ??
    (!room?.ready && room
      ? "Waiting for your friend"
      : `${liveChess.turn() === "w" ? "White" : "Black"} to move${liveChess.isCheck() ? " · Check!" : ""}`);

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
              {room ? `Room ${room.code}` : "Practice space"}
              <small>{room ? connection : "Both colors · one controller"}</small>
            </div>
          </div>

          <ChessBoard
            chess={displayChess}
            orientation={orientation}
            selected={isReviewing ? null : selected}
            legal={legal}
            lastMove={lastMove}
            room={room}
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
            onSquareClick={handleBoardSquareClick}
            onFlip={() => {
              setFollowTurn(false);
              safeSet("airchess.followTurn", "false");
              setFlipped(orientation === "w");
            }}
            onDownloadPgn={downloadPgn}
            onUndo={() => {
              setLocal((prev) => undoLocalMove(prev));
              setSelected(null);
              setViewPly(null);
            }}
            onJumpLive={() => setViewPly(null)}
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
            feedback: handFeedback,
            start: startHand,
            stop: stopHand,
          }}
          aimMode={aimMode}
          onAimModeChange={changeAimMode}
          selected={selected}
          onClearSelection={() => setSelected(null)}
          room={room}
          state={state}
          history={fullHistory}
          viewPly={activePly}
          onViewPlyChange={setViewPly}
          busy={busy}
          hydrated={hydrated}
          copied={copied}
          muted={muted}
          onToggleMuted={toggleMuted}
          onConnectCreate={() => void connect("create")}
          onOpenJoin={() => setModal("join")}
          onCopyInvite={() => void copyInvite()}
          onOpenModal={(nextModal) => setModal(nextModal)}
          onDownloadPgn={downloadPgn}
          onAction={(action) => void act(action)}
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
        followTurn={followTurn}
        onToggleFollowTurn={toggleFollowTurn}
        muted={muted}
        onToggleMuted={toggleMuted}
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
          setLocal(newGame(local.game + 1));
          setSelected(null);
          setViewPly(null);
          setModal(null);
        }}
      />
    </main>
  );
}
