"use client";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { Color, Move } from "chess.js";
import {
  Activity,
  ArrowUpRight,
  Bot,
  Camera,
  CameraOff,
  Check,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Eye,
  Hand,
  Lightbulb,
  Link2,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { AimMode } from "../lib/air-pointer";
import type { GestureLabel } from "../lib/gesture-features";
import { replay, TIME_CONTROLS, type RoomState, type TimeControlId } from "../lib/game";
import { detectOpening } from "../lib/openings";
import type { PlayMode } from "../lib/preferences";
import { DIFFICULTY_PRESETS, type DifficultyPreset } from "../lib/stockfish";
import { MovableSurface } from "./movable-surface";

type HandSummary = {
  status: "off" | "loading" | "searching" | "tracking" | "error";
  error: string;
  fps: number;
  latency: number;
  handCount: number;
  delegate: "" | "GPU" | "CPU";
  feedback: {
    controllerReady: boolean;
    helper: boolean;
    progress: number;
    pinched: boolean;
    gesture: GestureLabel;
    gestureConfidence: number;
    message: string;
  };
  start: () => void;
  stop: () => void;
};

type RoomSummary = {
  code: string;
  color: Color | null;
  ready: boolean;
  spectating?: boolean;
} | null;

type Props = {
  arranging: boolean;
  cameraActive: boolean;
  hand: HandSummary;
  aimMode: AimMode;
  onAimModeChange: (mode: AimMode) => void;
  selected: string | null;
  onClearSelection: () => void;
  room: RoomSummary;
  playMode: PlayMode;
  onPlayModeChange: (mode: PlayMode) => void;
  timeControl: TimeControlId;
  onTimeControlChange: (tc: TimeControlId) => void;
  aiDifficulty: DifficultyPreset;
  onAiDifficultyChange: (difficulty: DifficultyPreset) => void;
  aiColor: Color;
  onAiColorChange: (color: Color) => void;
  aiThinking: boolean;
  aiError: string;
  showEval: boolean;
  onToggleEval: () => void;
  analysisAllowed: boolean;
  hintVisible: boolean;
  onToggleHint: () => void;
  state: RoomState;
  history: Move[];
  viewPly: number;
  onViewPlyChange: (ply: number | null) => void;
  busy: boolean;
  hydrated: boolean;
  copied: boolean;
  watchCopied: boolean;
  connection: string;
  muted: boolean;
  onToggleMuted: () => void;
  onConnectCreate: () => void;
  onOpenJoin: () => void;
  onCopyInvite: () => void;
  onCopyWatchLink: () => void;
  onLeaveWatch: () => void;
  onOpenModal: (modal: "leave" | "resign" | "reset") => void;
  onDownloadPgn: () => void;
  currentFen: string;
  onNotice: (message: string) => void;
};

const difficulties: DifficultyPreset[] = ["casual", "club", "master"];
const timeControlIds: TimeControlId[] = ["untimed", "blitz3_2", "blitz5_0", "rapid10_0"];

export const SidebarPanels = memo(function SidebarPanels({
  arranging,
  cameraActive,
  hand,
  aimMode,
  onAimModeChange,
  selected,
  onClearSelection,
  room,
  playMode,
  onPlayModeChange,
  timeControl,
  onTimeControlChange,
  aiDifficulty,
  onAiDifficultyChange,
  aiColor,
  onAiColorChange,
  aiThinking,
  aiError,
  showEval,
  onToggleEval,
  analysisAllowed,
  hintVisible,
  onToggleHint,
  state,
  history,
  viewPly,
  onViewPlyChange,
  busy,
  hydrated,
  copied,
  watchCopied,
  connection,
  muted,
  onToggleMuted,
  onConnectCreate,
  onOpenJoin,
  onCopyInvite,
  onCopyWatchLink,
  onLeaveWatch,
  onOpenModal,
  onDownloadPgn,
  currentFen,
  onNotice,
}: Props) {
  const [onlineTab, setOnlineTab] = useState(false);
  const [copiedKind, setCopiedKind] = useState<"fen" | "pgn" | null>(null);
  const moveScrollRef = useRef<HTMLDivElement | null>(null);
  const totalPlies = history.length;
  const moveRows = Math.ceil(totalPlies / 2);
  const activeTab: "ai" | "practice" | "online" = room ? "online" : onlineTab ? "online" : playMode;
  const opening = useMemo(() => detectOpening(state.moves), [state.moves]);

  useEffect(() => {
    const box = moveScrollRef.current;
    if (!box) return;
    const active = box.querySelector<HTMLElement>(".active-ply");
    if (!active) {
      box.scrollTop = box.scrollHeight;
      return;
    }
    const top = active.offsetTop - box.offsetTop;
    const bottom = top + active.offsetHeight;
    if (top < box.scrollTop) {
      box.scrollTop = top;
    } else if (bottom > box.scrollTop + box.clientHeight) {
      box.scrollTop = bottom - box.clientHeight;
    }
  }, [viewPly, totalPlies]);

  async function copyBoardText(kind: "fen" | "pgn") {
    const text =
      kind === "fen"
        ? currentFen
        : (() => {
            const c = replay(state.moves);
            c.header(
              "Event",
              "AirChess game",
              "Result",
              state.result
                ? state.result.winner === "w"
                  ? "1-0"
                  : state.result.winner === "b"
                    ? "0-1"
                    : "1/2-1/2"
                : "*",
            );
            return c.pgn();
          })();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKind(kind);
      setTimeout(() => setCopiedKind((prev) => (prev === kind ? null : prev)), 2000);
    } catch {
      onNotice(`${kind.toUpperCase()}: ${text}`);
    }
  }

  return (
    <aside className="sidebar">
      <MovableSurface className="panel camera-panel" panelId="controls" title="Air controls" enabled={arranging}>
        <div className="panel-top">
          <span className="eyebrow">AIR CONTROLS</span>
          <span className={`badge ${cameraActive ? "live" : ""}`}>
            <span />
            {hand.status === "loading"
              ? "Starting"
              : cameraActive
                ? `Live${hand.delegate ? ` · ${hand.delegate}` : ""}`
                : "Camera off"}
          </span>
        </div>
        <div className="camera-illustration">
          <div className="scan-corner a" />
          <div className="scan-corner b" />
          <Hand size={44} strokeWidth={1.1} />
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
              ? aimMode === "hover"
                ? "Point and hold for 1.1s to select, then hold on a highlighted square."
                : "Pinch twice to select. Aim at a destination and pinch twice again."
              : "Show only the hand you want to use, open for a moment."
            : cameraActive
              ? "Start with one open hand. Add your other hand after calibration."
              : "Turn on your webcam to move pieces with hand gestures."}
        </p>
        <button
          type="button"
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
          <button type="button" data-air aria-pressed={aimMode === "hover"} onClick={() => onAimModeChange("hover")}>
            Steady hover
          </button>
          <button
            type="button"
            data-air
            aria-pressed={aimMode === "double-pinch"}
            onClick={() => onAimModeChange("double-pinch")}
          >
            Double pinch
          </button>
        </div>
        {cameraActive && (
          <div className="air-feedback" role="status">
            <strong>{hand.feedback.message}</strong>
            <div
              className="aim-progress"
              role="progressbar"
              aria-label="Square confirmation"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(hand.feedback.progress * 100)}
            >
              <span style={{ width: `${hand.feedback.progress * 100}%` }} />
            </div>
            <span>
              {hand.fps} FPS · {hand.latency} ms · {hand.handCount} hand{hand.handCount === 1 ? "" : "s"}
              {hand.delegate ? ` · ${hand.delegate}` : ""}
              {hand.feedback.gestureConfidence > 0 ? ` · ${hand.feedback.gesture} ${hand.feedback.gestureConfidence}%` : ""}
              {aimMode === "double-pinch" ? ` · Pinch ${hand.feedback.pinched ? "closed" : "open"}` : ""}
            </span>
            <span>
              {hand.feedback.helper
                ? "Controls paused · lower the second hand to resume"
                : "Hold a fist briefly to cancel selection."}
            </span>
            {selected && (
              <button type="button" className="text-button" data-air onClick={onClearSelection}>
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
      </MovableSurface>

      <MovableSurface className="panel mode-panel" panelId="room" title="Game mode" enabled={arranging}>
        <div className="panel-top">
          <span className="eyebrow">GAME MODE</span>
          {activeTab === "ai" ? <Bot size={16} /> : <Users size={16} />}
        </div>

        {!room && (
          <div className="aim-modes mode-tabs" role="group" aria-label="Game mode">
            <button
              type="button"
              data-air
              aria-pressed={activeTab === "practice"}
              onClick={() => {
                setOnlineTab(false);
                onPlayModeChange("practice");
              }}
            >
              Pass &amp; play
            </button>
            <button
              type="button"
              data-air
              aria-pressed={activeTab === "ai"}
              onClick={() => {
                setOnlineTab(false);
                onPlayModeChange("ai");
              }}
            >
              vs Stockfish
            </button>
            <button
              type="button"
              data-air
              aria-pressed={activeTab === "online"}
              onClick={() => setOnlineTab(true)}
            >
              Online
            </button>
          </div>
        )}

        {room ? (
          room.spectating ? (
            <>
              <h2>Spectator view · Room {room.code}</h2>
              <p>Read-only live board via stream ({connection || "Connected"}).</p>
              <div className="room-details">
                <span className="tiny-dot" />
                {room.ready ? `Live · Game ${state.game}` : "Waiting for Black seat"}
                <button type="button" className="text-button" data-air onClick={onLeaveWatch}>
                  Exit watch
                </button>
              </div>
            </>
          ) : (
            <>
              <h2>{room.ready ? "Two players. One board." : "Your friend has a seat."}</h2>
              <p>
                {state.clock
                  ? `${TIME_CONTROLS[state.clock.control].label} clock · ${connection || "Live"}`
                  : `Share the code · ${connection || "Live"}`}
              </p>
              <button type="button" className="room-code" data-air onClick={onCopyInvite} aria-label="Copy room invite">
                {room.code}
                <span>{copied ? <Check size={16} /> : <Copy size={16} />}</span>
              </button>
              <div className="room-details">
                <span className="tiny-dot" />
                {room.ready
                  ? `You’re ${room.color === "w" ? "White" : "Black"} · Game ${state.game}`
                  : "Waiting for a second player"}
                <button type="button" className="text-button" data-air onClick={onCopyWatchLink}>
                  <Eye size={12} /> {watchCopied ? "Copied!" : "Watch link"}
                </button>
                <button type="button" className="text-button" data-air onClick={() => onOpenModal("leave")}>
                  Leave
                </button>
              </div>
            </>
          )
        ) : activeTab === "ai" ? (
          <div className="ai-options">
            <div className="ai-row" role="group" aria-label="Stockfish difficulty">
              {difficulties.map((level) => (
                <button
                  key={level}
                  type="button"
                  data-air
                  className={`mini-chip ${aiDifficulty === level ? "active" : ""}`}
                  aria-pressed={aiDifficulty === level}
                  onClick={() => onAiDifficultyChange(level)}
                >
                  {DIFFICULTY_PRESETS[level].label}
                </button>
              ))}
            </div>
            <div className="ai-row" role="group" aria-label="Play as color">
              <button
                type="button"
                data-air
                className={`mini-chip ${aiColor === "w" ? "active" : ""}`}
                aria-pressed={aiColor === "w"}
                onClick={() => onAiColorChange("w")}
              >
                Play White
              </button>
              <button
                type="button"
                data-air
                className={`mini-chip ${aiColor === "b" ? "active" : ""}`}
                aria-pressed={aiColor === "b"}
                onClick={() => onAiColorChange("b")}
              >
                Play Black
              </button>
            </div>
            <div className="ai-row" role="group" aria-label="Time control">
              {timeControlIds.map((tc) => (
                <button
                  key={tc}
                  type="button"
                  data-air
                  className={`mini-chip ${timeControl === tc ? "active" : ""}`}
                  aria-pressed={timeControl === tc}
                  onClick={() => onTimeControlChange(tc)}
                >
                  {TIME_CONTROLS[tc].label}
                </button>
              ))}
            </div>
            <p className="ai-note">
              {aiThinking
                ? "Stockfish is calculating…"
                : `${DIFFICULTY_PRESETS[aiDifficulty].subtitle} · local WASM engine.`}
            </p>
            {aiError && (
              <div className="inline-error" role="alert">
                {aiError}
              </div>
            )}
          </div>
        ) : activeTab === "online" ? (
          <div className="online-setup">
            <p>Play a friend on a separate laptop with live sync &amp; optional clocks.</p>
            <div className="ai-row clock-picker" role="group" aria-label="Room time control">
              <Clock size={13} className="clock-icon" />
              {timeControlIds.map((tc) => (
                <button
                  key={tc}
                  type="button"
                  data-air
                  className={`mini-chip ${timeControl === tc ? "active" : ""}`}
                  aria-pressed={timeControl === tc}
                  onClick={() => onTimeControlChange(tc)}
                >
                  {TIME_CONTROLS[tc].label}
                </button>
              ))}
            </div>
            <div className="button-row">
              <button
                type="button"
                className="button secondary"
                data-air
                disabled={busy || !hydrated}
                onClick={onConnectCreate}
              >
                <Link2 size={15} />
                Create room
              </button>
              <button type="button" className="button subtle" data-air onClick={onOpenJoin}>
                Join room
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        ) : (
          <div className="ai-options">
            <div className="ai-row" role="group" aria-label="Time control">
              {timeControlIds.map((tc) => (
                <button
                  key={tc}
                  type="button"
                  data-air
                  className={`mini-chip ${timeControl === tc ? "active" : ""}`}
                  aria-pressed={timeControl === tc}
                  onClick={() => onTimeControlChange(tc)}
                >
                  {TIME_CONTROLS[tc].label}
                </button>
              ))}
            </div>
            <p className="ai-note">
              Play both sides locally on one board, or switch to vs Stockfish or Online above.
            </p>
          </div>
        )}
      </MovableSurface>

      <MovableSurface className="panel moves-panel" panelId="history" title="Move history" enabled={arranging}>
        <div className="panel-top">
          <span className="eyebrow">MOVES &amp; ANALYSIS</span>
          <div className="history-tools">
            {totalPlies > 0 && (
              <div className="scrub-controls" role="group" aria-label="Review moves">
                <button
                  type="button"
                  className="icon-button"
                  aria-label="First position"
                  disabled={viewPly === 0}
                  onClick={() => onViewPlyChange(0)}
                >
                  <ChevronFirst size={14} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Previous move"
                  disabled={viewPly === 0}
                  onClick={() => onViewPlyChange(Math.max(0, viewPly - 1))}
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Next move"
                  disabled={viewPly >= totalPlies}
                  onClick={() => onViewPlyChange(viewPly + 1 >= totalPlies ? null : viewPly + 1)}
                >
                  <ChevronRight size={14} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Latest move"
                  disabled={viewPly >= totalPlies}
                  onClick={() => onViewPlyChange(null)}
                >
                  <ChevronLast size={14} />
                </button>
              </div>
            )}
            <button
              type="button"
              className={`icon-button ${showEval ? "tool-active" : ""}`}
              data-air
              aria-pressed={showEval}
              aria-label="Toggle evaluation bar"
              title={analysisAllowed ? "Toggle Stockfish evaluation bar" : "Evaluation paused during live online match"}
              disabled={!analysisAllowed}
              onClick={onToggleEval}
            >
              <Activity size={14} />
            </button>
            <button
              type="button"
              className={`icon-button ${hintVisible ? "tool-active" : ""}`}
              data-air
              aria-pressed={hintVisible}
              aria-label="Show best move hint"
              title={analysisAllowed ? "Show Stockfish best move hint" : "Hints disabled during live online match"}
              disabled={!analysisAllowed || Boolean(state.result)}
              onClick={onToggleHint}
            >
              <Lightbulb size={14} />
            </button>
            <button
              type="button"
              className="icon-button"
              data-air
              aria-label={muted ? "Enable move sounds" : "Mute move sounds"}
              title={muted ? "Enable move sounds" : "Mute move sounds"}
              onClick={onToggleMuted}
            >
              {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            <button
              type="button"
              className="mini-tool-btn"
              data-air
              aria-label="Copy FEN"
              title="Copy FEN to clipboard"
              onClick={() => void copyBoardText("fen")}
            >
              {copiedKind === "fen" ? <Check size={12} /> : <Copy size={12} />}
              <span>FEN</span>
            </button>
            <button
              type="button"
              className="mini-tool-btn"
              data-air
              aria-label="Copy PGN"
              title="Copy PGN to clipboard"
              disabled={!totalPlies}
              onClick={() => void copyBoardText("pgn")}
            >
              {copiedKind === "pgn" ? <Check size={12} /> : <Copy size={12} />}
              <span>PGN</span>
            </button>
            <button
              type="button"
              className="icon-button"
              data-air
              aria-label="Download PGN"
              title="Download PGN"
              disabled={!totalPlies}
              onClick={onDownloadPgn}
            >
              <Download size={14} />
            </button>
          </div>
        </div>
        {opening && (
          <div className="opening-badge" title={`${opening.eco} · ${opening.name}`}>
            <span>{opening.eco}</span>
            <strong>{opening.name}</strong>
          </div>
        )}
        <div className="move-table">
          <div className="move-table-header">
            <span>#</span>
            <span>WHITE</span>
            <span>BLACK</span>
          </div>
          <div className="move-scroll" ref={moveScrollRef}>
            {totalPlies ? (
              Array.from({ length: moveRows }, (_, i) => {
                const whitePly = i * 2 + 1;
                const blackPly = i * 2 + 2;
                const whiteMove = history[i * 2];
                const blackMove = history[i * 2 + 1];
                return (
                  <div className="move-row" key={i}>
                    <span>{i + 1}.</span>
                    <button
                      type="button"
                      className={`move-ply ${viewPly === whitePly ? "active-ply" : ""}`}
                      onClick={() => onViewPlyChange(whitePly === totalPlies ? null : whitePly)}
                    >
                      {whiteMove?.san}
                    </button>
                    {blackMove ? (
                      <button
                        type="button"
                        className={`move-ply ${viewPly === blackPly ? "active-ply" : ""}`}
                        onClick={() => onViewPlyChange(blackPly === totalPlies ? null : blackPly)}
                      >
                        {blackMove.san}
                      </button>
                    ) : (
                      <span className="move-placeholder">—</span>
                    )}
                  </div>
                );
              })
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
      </MovableSurface>
    </aside>
  );
});
