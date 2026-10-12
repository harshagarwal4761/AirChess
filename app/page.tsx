"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Color, Square } from "chess.js";
import {
  ArrowUpRight,
  Camera,
  CameraOff,
  Check,
  ChevronRight,
  CircleHelp,
  Copy,
  Download,
  Flag,
  Hand,
  Link2,
  Maximize2,
  RotateCcw,
  ScanLine,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  applyAction,
  newGame,
  pieceNames,
  replay,
  type Action,
  type RoomState,
} from "../lib/game";
import { useHandTracking, type AirEvent } from "../hooks/use-hand-tracking";

import type { AimMode } from "../lib/air-pointer";
import { practiceOrientation } from "../lib/air-controls";

type Room = {
  code: string;
  color: Color;
  ready: boolean;
  revision: number;
  state: RoomState;
};
type Modal = "join" | "help" | "settings" | "resign" | "leave" | "reset" | null;
const symbols: Record<string, string> = {
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟",
};
const files = "abcdefgh";
function Piece({
  type,
  color,
  small = false,
}: {
  type: string;
  color: Color;
  small?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`piece ${color === "w" ? "ivory" : "obsidian"} ${small ? "small-piece" : ""}`}
    >
      {symbols[type]}
    </span>
  );
}

export default function AirChess() {
  const [local, setLocal] = useState<RoomState>(newGame);
  const [room, setRoom] = useState<Room | null>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState("");
  const [notice, setNotice] = useState("");
  const [muted, setMuted] = useState(false);
  const [opacity, setOpacity] = useState(0.42);
  const [followTurn, setFollowTurn] = useState(true);
  const [reachAssist, setReachAssist] = useState(false);
  const [aimMode, setAimMode] = useState<AimMode>("hover");
  const [flipped, setFlipped] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const keyRef = useRef("");
  const roomRef = useRef<Room | null>(null);
  const busyRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  roomRef.current = room;
  const state = room?.state ?? local;
  const chess = useMemo(() => replay(state.moves), [state.moves]);
  const orientation =
    room?.color ?? practiceOrientation(chess.turn(), followTurn, flipped);
  function changeOpacity(value: number) {
    const clamped = Math.max(0, Math.min(1, Math.round(value * 100) / 100));
    setOpacity(clamped);
    try {
      localStorage.setItem("airchess.opacity", String(clamped));
    } catch {
      /* Preference storage is optional. */
    }
  }
  useEffect(() => {
    try {
      const saved = localStorage.getItem("airchess.opacity");
      if (saved !== null && Number.isFinite(Number(saved)))
        setOpacity(Math.max(0, Math.min(1, Number(saved))));
    } catch {
      /* Use the default. */
    }
  }, []);
  const canMove =
    !state.result &&
    !busy &&
    (!room || (room.ready && room.color === chess.turn()));
  const legal = selected
    ? chess.moves({ square: selected, verbose: true })
    : [];
  const history = chess.history({ verbose: true });
  const lastMove = history.at(-1);
  const sound = useCallback(() => {
    if (muted) return;
    try {
      const ctx = (audioRef.current ??= new AudioContext());
      void ctx.resume();
      const osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(260, ctx.currentTime + 0.09);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start();
      osc.stop(ctx.currentTime + 0.13);
    } catch {
      /* Audio is optional. */
    }
  }, [muted]);
  useEffect(() => {
    if (!modal && !promotion) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>("[role=dialog]");
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input, [tabindex="0"]',
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
        const first = list[0],
          last = list.at(-1);
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
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(t);
  }, [notice]);
  const acceptRoom = useCallback((next: Room) => {
    setRoom((previous) =>
      previous &&
      previous.code === next.code &&
      previous.revision > next.revision
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
    if (!res.ok) throw new Error(data.error ?? "Connection failed. Try again.");
    return data as Room;
  }, []);
  useEffect(() => {
    keyRef.current =
      sessionStorage.getItem("airchess.key") ?? crypto.randomUUID();
    sessionStorage.setItem("airchess.key", keyRef.current);
    const saved = sessionStorage.getItem("airchess.room");
    const invite = new URLSearchParams(location.search).get("room");
    if (invite && /^\d{6}$/.test(invite) && invite !== saved) {
      setJoinCode(invite);
      setModal("join");
    } else if (saved) {
      setConnection("Reconnecting…");
      api(`/${saved}`)
        .then(acceptRoom)
        .catch((e) => {
          setNotice(e.message);
          sessionStorage.removeItem("airchess.room");
        });
    }
    setHydrated(true);
    return () => {
      void audioRef.current?.close();
    };
  }, [api, acceptRoom]);
  useEffect(() => {
    if (!room?.code) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await api(`/${room.code}`);
        if (active) acceptRoom(next);
      } catch {
        if (active) setConnection("Reconnecting… moves paused");
      }
      if (active) timer = setTimeout(poll, document.hidden ? 4000 : 900);
    };
    timer = setTimeout(poll, 900);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [room?.code, api, acceptRoom]);
  useEffect(() => {
    setSelected(null);
    setPromotion(null);
  }, [room?.code, state.moves.length, state.game]);
  async function connect(kind: "create" | "join") {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const next = await api(kind === "create" ? "" : `/${joinCode}`, {
        type: kind,
      });
      acceptRoom(next);
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
      if (room) {
        const next = await api(`/${room.code}`, {
          type: "action",
          revision: room.revision,
          action,
        });
        acceptRoom(next);
      } else setLocal(applyAction(local, chess.turn(), action));
      if (action.type === "move") sound();
      setSelected(null);
      setPromotion(null);
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "Could not complete that action.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  function move(from: string, to: string) {
    if (!canMove || (connection.startsWith("Reconnecting") && room)) return;
    const candidates = chess
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
    if (chess.get(square)?.color === chess.turn()) setSelected(square);
    else if (selected) move(selected, square);
  }
  const handleAir = (event: AirEvent) => {
    if (event.type === "cancel") {
      setSelected(null);
      return;
    }
    if (!modal && !promotion && canMove) squareClick(event.square as Square);
  };
  const hand = useHandTracking(
    handleAir,
    reachAssist,
    `${room?.code ?? "practice"}:${state.game}:${state.moves.length}:${selected}:${orientation}:${modal}:${Boolean(promotion)}:${canMove}`,
    aimMode,
  );
  const cameraActive =
    hand.status === "tracking" || hand.status === "searching";
  useEffect(() => {
    if (cameraActive || focusMode) window.scrollTo({ top: 0 });
  }, [cameraActive, focusMode]);
  const squares = Array.from(
    { length: 64 },
    (_, i) =>
      `${files[orientation === "w" ? i % 8 : 7 - (i % 8)]}${orientation === "w" ? 8 - Math.floor(i / 8) : 1 + Math.floor(i / 8)}` as Square,
  );
  const statusText =
    state.result?.text ??
    (!room?.ready && room
      ? "Waiting for your friend"
      : `${chess.turn() === "w" ? "White" : "Black"} to move${chess.isCheck() ? " · Check!" : ""}`);
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/?room=${room!.code}`,
      );
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
    setLocal(newGame());
    historyReplace();
  }
  function historyReplace() {
    window.history.replaceState({}, "", "/");
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
    const url = URL.createObjectURL(
      new Blob([c.pgn()], { type: "application/x-chess-pgn" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `airchess-${room?.code ?? "practice"}.pgn`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const captured = (color: Color) =>
    history
      .filter((m) => m.color === color && m.captured)
      .map((m, i) => (
        <Piece
          key={i}
          type={m.captured!}
          color={color === "w" ? "b" : "w"}
          small
        />
      ));
  function playerBar(color: Color, bottom = false) {
    const you = room?.color === color;
    return (
      <div
        className={`player-bar ${chess.turn() === color && !state.result ? "active-player" : ""}`}
      >
        <div className={`player-avatar ${color}`}>
          <Piece type="k" color={color} small />
        </div>
        <div className="player-name">
          <strong>
            {room
              ? you
                ? "You"
                : room.ready
                  ? "Your friend"
                  : "An open seat"
              : bottom
                ? "You control both colors"
                : "You control both colors"}
          </strong>
          <span>
            {color === "w" ? "White pieces" : "Black pieces"}
            <span className="captured">{captured(color)}</span>
          </span>
        </div>
        <span className="turn-chip">
          {state.result
            ? "Finished"
            : !room?.ready && room
              ? "Waiting"
              : chess.turn() === color
                ? "To move"
                : "Untimed"}
        </span>
      </div>
    );
  }
  return (
    <main
      className={`app ${cameraActive ? "camera-on" : ""} ${cameraActive || focusMode ? "immersive" : ""} ${hand.feedback.helper ? "air-paused" : ""}`}
      style={{ "--board-opacity": opacity } as React.CSSProperties}
    >
      <video
        ref={hand.videoRef}
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
      <canvas ref={hand.canvasRef} className="hand-canvas" aria-hidden="true" />
      <div ref={hand.cursorRef} aria-hidden="true">
        <div className="air-cursor hand-0">
          <span />
          <b>Move</b>
        </div>
      </div>
      <header className="topbar">
        <a className="brand" href="/" aria-label="AirChess home">
          <span className="brand-mark">♞</span>Air<span>Chess</span>
          <span className="beta">LAB</span>
        </a>
        <div className="top-middle">
          <span className="tiny-dot" /> A new way to make your move
        </div>
        <div className="top-actions">
          <button
            className="text-button"
            data-air
            onClick={() => setModal("help")}
          >
            <CircleHelp size={16} />
            <span>How to play</span>
          </button>
          <button
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
              <small>
                {room ? connection : "Both colors · one controller"}
              </small>
            </div>
          </div>
          <div className="board-region">
            {playerBar(orientation === "w" ? "b" : "w")}
            <div className="board-shell">
              <div className="board-corner corner-tl" />
              <div className="board-corner corner-br" />
              <div className="board" role="group" aria-label="Chessboard">
                {squares.map((square, i) => {
                  const piece = chess.get(square);
                  const isLegal = legal.some((m) => m.to === square);
                  const check =
                    piece?.type === "k" &&
                    piece.color === chess.turn() &&
                    chess.isCheck();
                  return (
                    <button
                      key={square}
                      data-square={square}
                      data-air-square={
                        !modal &&
                        !promotion &&
                        canMove &&
                        (piece?.color === chess.turn() || isLegal)
                          ? square
                          : undefined
                      }
                      className={`square ${(Math.floor(i / 8) + (i % 8)) % 2 ? "dark" : "light"} ${selected === square ? "selected" : ""} ${lastMove?.from === square || lastMove?.to === square ? "last-move" : ""} ${check ? "in-check" : ""} ${hand.feedback.target === square ? "air-target" : ""} ${hand.feedback.target === square && hand.feedback.locked ? "air-locked" : ""}`}
                      aria-label={`${square}${piece ? ` ${piece.color === "w" ? "white" : "black"} ${pieceNames[piece.type]}` : " empty"}${isLegal ? ", legal destination" : ""}`}
                      aria-pressed={selected === square}
                      onClick={() => squareClick(square)}
                    >
                      {i % 8 === 0 && (
                        <span className="rank-label">{square[1]}</span>
                      )}
                      {Math.floor(i / 8) === 7 && (
                        <span className="file-label">{square[0]}</span>
                      )}
                      {piece && <Piece type={piece.type} color={piece.color} />}{" "}
                      {isLegal && (
                        <span
                          className={`legal-marker ${piece ? "capture-marker" : ""}`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            {playerBar(orientation, true)}
            <div className="board-caption">
              <span className="status-pulse" />
              <span role="status">{statusText}</span>
              <button
                className="icon-button"
                data-air
                aria-label={room ? "Export game as PGN" : "Flip board"}
                onClick={
                  room
                    ? downloadPgn
                    : () => {
                        setFollowTurn(false);
                        setFlipped(orientation === "w");
                      }
                }
              >
                {room ? <Download size={16} /> : <RotateCcw size={16} />}
              </button>
            </div>
          </div>
          <div className="stage-footer">
            <span>
              <ShieldCheck size={14} /> Your camera stays on your device
            </span>
            <span>NO TOUCH. JUST CHESS.</span>
          </div>
        </section>
        <aside className="sidebar">
          <section className="panel camera-panel">
            <div className="panel-top">
              <span className="eyebrow">AIR CONTROLS</span>
              <span className={`badge ${cameraActive ? "live" : ""}`}>
                <span />
                {hand.status === "loading"
                  ? "Starting"
                  : cameraActive
                    ? "Live"
                    : "Camera off"}
              </span>
            </div>
            <div className="camera-illustration">
              <div className="scan-corner a" />
              <div className="scan-corner b" />
              <Hand size={52} strokeWidth={1} />
              <span className="scan-orbit" />
              {cameraActive && <span className="fps">{hand.fps} FPS</span>}
            </div>
            <h2>
              {hand.status === "tracking"
                ? hand.feedback.controllerReady
                  ? "One hand. Deliberate moves."
                  : "Choose your control hand."
                : cameraActive
                  ? "Choose your control hand."
                  : "A little wave. A new game."}
            </h2>
            <p>
              {hand.status === "tracking"
                ? hand.feedback.controllerReady
                  ? aimMode === "hover" ? "Point and hold for 1.1 seconds to select. Repeat on a highlighted destination." : "Pinch twice to select. Aim at a destination and pinch twice again."
                  : "Show only the hand you want to use, with your palm open for a moment."
                : cameraActive
                  ? "Start with just one open hand. Add your other hand after the controller is set."
                  : "Turn on your camera and bring the board to life with your hands."}
            </p>
            <button
              className={`button full ${cameraActive ? "secondary" : "primary"}`}
              data-air
              disabled={hand.status === "loading"}
              onClick={cameraActive ? hand.stop : hand.start}
            >
              {cameraActive ? <CameraOff size={17} /> : <Camera size={17} />}{" "}
              {hand.status === "loading"
                ? "Preparing hand tracking…"
                : cameraActive
                  ? "Stop camera"
                  : "Enable air controls"}
              {!cameraActive && <ArrowUpRight size={17} />}
            </button>
            <div className="aim-modes" role="group" aria-label="Move control mode">
              <button data-air aria-pressed={aimMode === "hover"} onClick={() => setAimMode("hover")}>Steady hover</button>
              <button data-air aria-pressed={aimMode === "double-pinch"} onClick={() => setAimMode("double-pinch")}>Double pinch</button>
            </div>
            {cameraActive && (
              <div className="air-feedback" role="status">
                <strong>{hand.feedback.message}</strong>
                <div className="aim-progress" role="progressbar" aria-label="Square confirmation" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hand.feedback.progress * 100)}><span style={{ width: `${hand.feedback.progress * 100}%` }} /></div>
                <span>{hand.fps} FPS · {hand.handCount} hand{hand.handCount === 1 ? "" : "s"} detected{aimMode === "double-pinch" ? ` · Pinch ${hand.feedback.pinched ? "closed" : "open"}` : ""}</span>
                <span>{hand.feedback.helper ? "Controls paused · lower the second hand to resume" : "Second open palm pauses controls. Your selected piece is kept."}</span>
                {selected && (
                  <button
                    className="text-button"
                    data-air
                    onClick={() => setSelected(null)}
                  >
                    Cancel selection
                  </button>
                )}
              </div>
            )}
            {hand.error && (
              <div className="inline-error" role="alert">
                {hand.error}
              </div>
            )}
            <div className="camera-note">
              {cameraActive
                ? "Hold over a button for 1.3s to activate it."
                : "Mouse & keyboard work here, too."}
            </div>
          </section>
          <section className="panel room-panel">
            <div className="panel-top">
              <span className="eyebrow">BETTER WITH A FRIEND</span>
              <Users size={17} />
            </div>
            {room ? (
              <>
                <h2>
                  {room.ready
                    ? "Two players. One board."
                    : "Your friend has a seat."}
                </h2>
                <p>Share the code. They join from their own laptop.</p>
                <button
                  className="room-code"
                  data-air
                  onClick={copyInvite}
                  aria-label="Copy room invite"
                >
                  {room.code}
                  <span>
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </span>
                </button>
                <div className="room-details">
                  <span className="tiny-dot" />
                  {room.ready
                    ? `You’re ${room.color === "w" ? "White" : "Black"} · Game ${state.game}`
                    : "Waiting for a second player"}
                  <button
                    className="text-button"
                    data-air
                    onClick={() => setModal("leave")}
                  >
                    Leave
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2>Make it a friendly match.</h2>
                <p>
                  Separate laptops. Shared board.
                  <br />A little friendly competition.
                </p>
                <div className="button-row">
                  <button
                    className="button secondary"
                    data-air
                    disabled={busy || !hydrated}
                    onClick={() => connect("create")}
                  >
                    <Link2 size={15} />
                    Create room
                  </button>
                  <button
                    className="button subtle"
                    data-air
                    onClick={() => setModal("join")}
                  >
                    Join room
                    <ChevronRight size={15} />
                  </button>
                </div>
              </>
            )}
          </section>
          <section className="panel moves-panel">
            <div className="panel-top">
              <span className="eyebrow">THE GAME SO FAR</span>
              <button
                className="icon-button"
                data-air
                aria-label="Download PGN"
                disabled={!history.length}
                onClick={downloadPgn}
              >
                <Download size={15} />
              </button>
            </div>
            <div className="move-table">
              <div className="move-table-header">
                <span>#</span>
                <span>WHITE</span>
                <span>BLACK</span>
              </div>
              <div className="move-scroll">
                {history.length ? (
                  Array.from(
                    { length: Math.ceil(history.length / 2) },
                    (_, i) => (
                      <div className="move-row" key={i}>
                        <span>{i + 1}.</span>
                        <span>{history[i * 2]?.san}</span>
                        <span>{history[i * 2 + 1]?.san ?? "—"}</span>
                      </div>
                    ),
                  )
                ) : (
                  <div className="empty-moves">
                    <span>♙</span>
                    <p>
                      Every great game starts
                      <br />
                      with a first move.
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="game-actions">
              {room ? (
                state.result ? (
                  <button
                    className="text-button"
                    data-air
                    disabled={busy || state.rematch === room.color}
                    onClick={() => act({ type: "rematch" })}
                  >
                    <RotateCcw size={14} />
                    {state.rematch === room.color
                      ? "Rematch requested"
                      : state.rematch
                        ? "Accept rematch"
                        : "Play again"}
                  </button>
                ) : (
                  <>
                    <button
                      className="text-button"
                      data-air
                      disabled={!room.ready || busy}
                      onClick={() => setModal("resign")}
                    >
                      <Flag size={14} />
                      Resign
                    </button>
                    <button
                      className="text-button"
                      data-air
                      disabled={
                        !room.ready || busy || state.drawOffer === room.color
                      }
                      onClick={() => act({ type: "offer-draw" })}
                    >
                      {state.drawOffer === room.color
                        ? "Draw offered"
                        : "Offer draw"}
                    </button>
                  </>
                )
              ) : (
                <button
                  className="text-button"
                  data-air
                  onClick={() => setModal("reset")}
                >
                  <RotateCcw size={14} />
                  New practice game
                </button>
              )}
              <button
                className="icon-button"
                data-air
                aria-label={muted ? "Enable move sounds" : "Mute move sounds"}
                onClick={() => setMuted(!muted)}
              >
                {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
              </button>
            </div>
          </section>
        </aside>
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
            <strong>Aim & settle</strong>
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
          Built for human connection <Sparkles size={12} />
        </span>
      </footer>
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button
            className="icon-button"
            data-air
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {room &&
        state.drawOffer &&
        state.drawOffer !== room.color &&
        !state.result && (
          <div className="draw-banner" role="status">
            <span>Your friend offers a draw.</span>
            <button
              className="button primary"
              data-air
              disabled={busy}
              onClick={() => act({ type: "accept-draw" })}
            >
              Accept
            </button>
            <button
              className="button secondary"
              data-air
              disabled={busy}
              onClick={() => act({ type: "decline-draw" })}
            >
              Keep playing
            </button>
          </div>
        )}
      {(modal || promotion) && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !promotion) setModal(null);
          }}
        >
          <section
            className={`modal ${modal === "settings" ? "settings-modal" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
          >
            <button
              className="icon-button modal-close"
              data-air
              aria-label="Close dialog"
              onClick={() => {
                setModal(null);
                setPromotion(null);
                setSelected(null);
              }}
            >
              <X size={20} />
            </button>
            {promotion ? (
              <>
                <div className="eyebrow">A NEW CHAPTER</div>
                <h2 id="dialog-title">Choose your promotion.</h2>
                <p>
                  Your pawn reached the other side. Pick the piece it becomes.
                </p>
                <div className="promotion-options">
                  {["q", "r", "b", "n"].map((type) => (
                    <button
                      key={type}
                      className="promotion-piece"
                      data-air
                      disabled={busy}
                      onClick={() =>
                        act({ type: "move", ...promotion, promotion: type })
                      }
                    >
                      <Piece type={type} color={chess.turn()} />
                      <span>{pieceNames[type]}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : modal === "join" ? (
              <>
                <div className="eyebrow">TAKE YOUR SEAT</div>
                <h2 id="dialog-title">Join your friend.</h2>
                <p>Enter their six-digit room code. You’ll play Black.</p>
                <input
                  className="code-input"
                  aria-label="Six-digit room code"
                  inputMode="numeric"
                  maxLength={6}
                  value={joinCode}
                  onChange={(e) =>
                    setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="000000"
                />
                <div className="keypad">
                  {[
                    "1",
                    "2",
                    "3",
                    "4",
                    "5",
                    "6",
                    "7",
                    "8",
                    "9",
                    "Clear",
                    "0",
                    "⌫",
                  ].map((key) => (
                    <button
                      className="button secondary"
                      data-air
                      key={key}
                      onClick={() =>
                        setJoinCode((code) =>
                          key === "Clear"
                            ? ""
                            : key === "⌫"
                              ? code.slice(0, -1)
                              : (code + key).slice(0, 6),
                        )
                      }
                    >
                      {key}
                    </button>
                  ))}
                </div>
                <button
                  className="button primary full"
                  data-air
                  disabled={joinCode.length !== 6 || busy}
                  onClick={() => connect("join")}
                >
                  {busy ? "Joining…" : "Join game"}
                  <ArrowUpRight size={17} />
                </button>
              </>
            ) : modal === "help" ? (
              <>
                <div className="eyebrow">YOUR FIRST AIR MOVE</div>
                <h2 id="dialog-title">A board. A hand. That’s it.</h2>
                <div className="help-steps">
                  <p>
                    <b>1. Choose a control hand.</b> Show just one open hand for
                    a moment. It becomes your only move controller; the second
                    hand never selects squares.
                  </p>
                  <p>
                    <b>2. Select your piece.</b> Point at your piece and keep the
                    cursor inside its square until the ring fills (1.1 seconds).
                    Steady hover needs no pinching. Move away to cancel the countdown.
                  </p>
                  <p>
                    <b>3. Choose the destination.</b> Move to a highlighted legal
                    square and hold again. Raise your second open palm to pause;
                    lower it to resume. A tracking interruption keeps your selected
                    piece, but restarts the confirmation countdown.
                  </p>
                  <p>
                    <b>4. Use the menus.</b> Hold an open fingertip over a
                    button for 1.3 seconds. You can join a room with the
                    on-screen keypad, choose promotions, and request a rematch
                    this way.
                  </p>
                </div>
                <div className="help-note">
                  Double pinch is also available in the Air controls panel: close/open twice on the piece, then twice on its destination. Your control hand plays both colors in local practice, which
                  follows the active side by default. Reach assist brings far
                  squares within a smaller hand movement. In a room, each laptop
                  controls its own color. Casual games are untimed; repetition
                  and fifty-move draws are automatic.
                </div>
                <button
                  className="button primary full"
                  data-air
                  onClick={() => setModal(null)}
                >
                  Let’s play
                  <ChevronRight size={17} />
                </button>
              </>
            ) : modal === "settings" ? (
              <>
                <div className="eyebrow">MAKE IT YOUR SPACE</div>
                <h2 id="dialog-title">A clearer view.</h2>
                <p>Adjust the board to suit your room and lighting.</p>
                <label className="setting-label" htmlFor="board-transparency">
                  Board transparency{" "}
                  <span>{Math.round((1 - opacity) * 100)}%</span>
                </label>
                <input
                  id="board-transparency"
                  className="transparency-slider"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={Math.round((1 - opacity) * 100)}
                  onChange={(e) =>
                    changeOpacity(1 - Number(e.target.value) / 100)
                  }
                />
                <div className="range-labels">
                  <span>Solid board</span>
                  <span>Clear board</span>
                </div>
                <div className="opacity-adjustments">
                  {[-5, -1, 1, 5].map((step) => (
                    <button
                      className="button secondary"
                      key={step}
                      data-air
                      aria-label={`${step > 0 ? "Increase" : "Decrease"} transparency by ${Math.abs(step)} percent`}
                      disabled={step > 0 ? opacity === 0 : opacity === 1}
                      onClick={() => changeOpacity(opacity - step / 100)}
                    >
                      {step > 0 ? "+" : ""}
                      {step}%
                    </button>
                  ))}
                </div>
                <p className="small-note">
                  Use the slider or hover over the ± buttons. Pieces stay
                  visible, even at 100% transparency. Your setting is saved.
                </p>
                {cameraActive && (
                  <button
                    className="button secondary full setting-button"
                    data-air
                    onClick={() => {
                      hand.recalibrate();
                      setModal(null);
                    }}
                  >
                    Choose control hand again
                  </button>
                )}
                <button
                  className="button secondary full setting-button"
                  data-air
                  onClick={() => setReachAssist(!reachAssist)}
                >
                  Expanded reach: {reachAssist ? "on · cursor offset" : "off · direct aim"}
                </button>
                {!room && (
                  <button
                    className="button secondary full setting-button"
                    data-air
                    onClick={() => setFollowTurn(!followTurn)}
                  >
                    Follow active side: {followTurn ? "on" : "off"}
                  </button>
                )}
                <button
                  className="button secondary full setting-button"
                  data-air
                  onClick={() => setMuted(!muted)}
                >
                  {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}Move
                  sounds: {muted ? "off" : "on"}
                </button>
                <button
                  className="button secondary full setting-button"
                  data-air
                  onClick={() => {
                    setFocusMode(!focusMode);
                    setModal(null);
                  }}
                >
                  <ScanLine size={17} />
                  {focusMode
                    ? "Exit focus view"
                    : "Focus view · fit board to screen"}
                </button>
                <button
                  className="button secondary full"
                  data-air
                  onClick={() => {
                    if (document.fullscreenElement)
                      void document.exitFullscreen();
                    else
                      void document.documentElement
                        .requestFullscreen()
                        .catch(() =>
                          setNotice("Use your browser’s fullscreen shortcut."),
                        );
                  }}
                >
                  <Maximize2 size={17} />
                  Toggle fullscreen
                </button>
                <p className="small-note">
                  Camera frames are processed on this device. Only room actions
                  and chess moves are sent to the game server.
                </p>
              </>
            ) : (
              <>
                <div className="eyebrow">ONE QUICK CHECK</div>
                <h2 id="dialog-title">
                  {modal === "resign"
                    ? "Resign this game?"
                    : modal === "leave"
                      ? "Leave the room?"
                      : "Start a fresh board?"}
                </h2>
                <p>
                  {modal === "resign"
                    ? "Your friend will win by resignation. You can both request a rematch afterward."
                    : modal === "leave"
                      ? "An active game will remain in the room. Keep the room code if you want to rejoin in this tab."
                      : "This clears your practice game. Export your moves first if you want to keep them."}
                </p>
                <div className="button-row">
                  <button
                    className="button secondary"
                    data-air
                    onClick={() => setModal(null)}
                  >
                    Go back
                  </button>
                  <button
                    className="button primary"
                    data-air
                    onClick={() => {
                      if (modal === "leave") leave();
                      else if (modal === "resign") {
                        void act({ type: "resign" });
                        setModal(null);
                      } else {
                        setLocal(newGame(local.game + 1));
                        setSelected(null);
                        setModal(null);
                      }
                    }}
                  >
                    {modal === "resign"
                      ? "Resign game"
                      : modal === "leave"
                        ? "Leave room"
                        : "New game"}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
