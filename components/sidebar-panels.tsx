"use client";
import type { Color, Move } from "chess.js";
import {
  ArrowUpRight,
  Camera,
  CameraOff,
  Check,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Flag,
  Hand,
  Link2,
  RotateCcw,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { AimMode } from "../lib/air-pointer";
import type { Action, RoomState } from "../lib/game";
import { MovableSurface } from "./movable-surface";

type HandSummary = {
  status: "off" | "loading" | "searching" | "tracking" | "error";
  error: string;
  fps: number;
  latency: number;
  handCount: number;
  feedback: {
    controllerReady: boolean;
    helper: boolean;
    progress: number;
    pinched: boolean;
    message: string;
  };
  start: () => void;
  stop: () => void;
};

type RoomSummary = {
  code: string;
  color: Color;
  ready: boolean;
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
  state: RoomState;
  history: Move[];
  viewPly: number;
  onViewPlyChange: (ply: number | null) => void;
  busy: boolean;
  hydrated: boolean;
  copied: boolean;
  muted: boolean;
  onToggleMuted: () => void;
  onConnectCreate: () => void;
  onOpenJoin: () => void;
  onCopyInvite: () => void;
  onOpenModal: (modal: "leave" | "resign" | "reset") => void;
  onDownloadPgn: () => void;
  onAction: (action: Action) => void;
};

export function SidebarPanels({
  arranging,
  cameraActive,
  hand,
  aimMode,
  onAimModeChange,
  selected,
  onClearSelection,
  room,
  state,
  history,
  viewPly,
  onViewPlyChange,
  busy,
  hydrated,
  copied,
  muted,
  onToggleMuted,
  onConnectCreate,
  onOpenJoin,
  onCopyInvite,
  onOpenModal,
  onDownloadPgn,
  onAction,
}: Props) {
  const totalPlies = history.length;
  const moveRows = Math.ceil(totalPlies / 2);

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
              ? aimMode === "hover"
                ? "Point and hold for 1.1 seconds to select. Repeat on a highlighted destination."
                : "Pinch twice to select. Aim at a destination and pinch twice again."
              : "Show only the hand you want to use, with your palm open for a moment."
            : cameraActive
              ? "Start with just one open hand. Add your other hand after the controller is set."
              : "Turn on your camera and bring the board to life with your hands."}
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
              {hand.fps} FPS · {hand.latency} ms · {hand.handCount} hand{hand.handCount === 1 ? "" : "s"} detected
              {aimMode === "double-pinch" ? ` · Pinch ${hand.feedback.pinched ? "closed" : "open"}` : ""}
            </span>
            <span>
              {hand.feedback.helper
                ? "Controls paused · lower the second hand to resume"
                : "Second open palm pauses controls. Your selected piece is kept."}
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
        <div className="camera-note">
          {cameraActive ? "Hold over a button for 1.3s to activate it." : "Mouse & keyboard work here, too."}
        </div>
      </MovableSurface>

      <MovableSurface className="panel room-panel" panelId="room" title="Friendly match" enabled={arranging}>
        <div className="panel-top">
          <span className="eyebrow">BETTER WITH A FRIEND</span>
          <Users size={17} />
        </div>
        {room ? (
          <>
            <h2>{room.ready ? "Two players. One board." : "Your friend has a seat."}</h2>
            <p>Share the code. They join from their own laptop.</p>
            <button type="button" className="room-code" data-air onClick={onCopyInvite} aria-label="Copy room invite">
              {room.code}
              <span>{copied ? <Check size={16} /> : <Copy size={16} />}</span>
            </button>
            <div className="room-details">
              <span className="tiny-dot" />
              {room.ready
                ? `You’re ${room.color === "w" ? "White" : "Black"} · Game ${state.game}`
                : "Waiting for a second player"}
              <button type="button" className="text-button" data-air onClick={() => onOpenModal("leave")}>
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
          </>
        )}
      </MovableSurface>

      <MovableSurface className="panel moves-panel" panelId="history" title="Move history" enabled={arranging}>
        <div className="panel-top">
          <span className="eyebrow">THE GAME SO FAR</span>
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
              className="icon-button"
              data-air
              aria-label="Download PGN"
              disabled={!totalPlies}
              onClick={onDownloadPgn}
            >
              <Download size={15} />
            </button>
          </div>
        </div>
        <div className="move-table">
          <div className="move-table-header">
            <span>#</span>
            <span>WHITE</span>
            <span>BLACK</span>
          </div>
          <div className="move-scroll">
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
        <div className="game-actions">
          {room ? (
            state.result ? (
              <button
                type="button"
                className="text-button"
                data-air
                disabled={busy || state.rematch === room.color}
                onClick={() => onAction({ type: "rematch" })}
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
                  type="button"
                  className="text-button"
                  data-air
                  disabled={!room.ready || busy}
                  onClick={() => onOpenModal("resign")}
                >
                  <Flag size={14} />
                  Resign
                </button>
                <button
                  type="button"
                  className="text-button"
                  data-air
                  disabled={!room.ready || busy || state.drawOffer === room.color}
                  onClick={() => onAction({ type: "offer-draw" })}
                >
                  {state.drawOffer === room.color ? "Draw offered" : "Offer draw"}
                </button>
              </>
            )
          ) : (
            <button type="button" className="text-button" data-air onClick={() => onOpenModal("reset")}>
              <RotateCcw size={14} />
              New practice game
            </button>
          )}
          <button
            type="button"
            className="icon-button"
            data-air
            aria-label={muted ? "Enable move sounds" : "Mute move sounds"}
            onClick={onToggleMuted}
          >
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
        </div>
      </MovableSurface>
    </aside>
  );
}
