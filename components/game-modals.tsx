"use client";
import { useState } from "react";
import type { Color } from "chess.js";
import { Activity, ArrowUpRight, ChevronRight, Database, Download, Maximize2, ScanLine, Volume2, VolumeX, X } from "lucide-react";
import type { PublicUser } from "../lib/auth";
import { pieceNames, type Action } from "../lib/game";
import type { RecordedGestureSample } from "../lib/gesture-classifier";
import type { GestureLabel } from "../lib/gesture-features";
import type {
  BoardTheme,
  HoverSpeed,
  TrackingDelegateMode,
  TrackingResolution,
} from "../lib/preferences";
import { resetPanelLayout } from "../lib/panel-layout";
import { ChessPiece } from "./chess-pieces";
import { DeveloperCard } from "./developer-card";
import { MovableSurface } from "./movable-surface";
import { ProfileModal, type ArchivedGame } from "./profile-modal";

export type ModalKind =
  | "join"
  | "help"
  | "settings"
  | "about"
  | "profile"
  | "resign"
  | "leave"
  | "reset"
  | null;

type Props = {
  modal: ModalKind;
  promotion: { from: string; to: string } | null;
  turn: Color;
  busy: boolean;
  joinCode: string;
  onJoinCodeChange: (code: string) => void;
  onConnectJoin: () => void;
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  boardTheme: BoardTheme;
  onBoardThemeChange: (theme: BoardTheme) => void;
  cameraActive: boolean;
  onRecalibrate: () => void;
  reachAssist: boolean;
  onToggleReachAssist: () => void;
  inRoom: boolean;
  isAiMode: boolean;
  followTurn: boolean;
  onToggleFollowTurn: () => void;
  muted: boolean;
  onToggleMuted: () => void;
  showEval: boolean;
  onToggleEval: () => void;
  twoHandPause: boolean;
  onToggleTwoHandPause: () => void;
  trackingDelegate: TrackingDelegateMode;
  onChangeTrackingDelegate: (mode: TrackingDelegateMode) => void;
  trackingResolution: TrackingResolution;
  onChangeTrackingResolution: (res: TrackingResolution) => void;
  hoverSpeed: HoverSpeed;
  onChangeHoverSpeed: (speed: HoverSpeed) => void;
  focusMode: boolean;
  onToggleFocusMode: () => void;
  onNotice: (message: string) => void;
  onClose: () => void;
  onAction: (action: Action) => void;
  onLeaveRoom: () => void;
  onResetPractice: () => void;
  user: PublicUser | null;
  onUserChange: (user: PublicUser | null) => void;
  onReplayGame: (game: ArchivedGame) => void;
  onCaptureSample?: (label: GestureLabel) => RecordedGestureSample | null;
};

const themes: { id: BoardTheme; label: string }[] = [
  { id: "emerald", label: "Emerald" },
  { id: "slate", label: "Slate" },
  { id: "walnut", label: "Walnut" },
];

export function GameModals({
  modal,
  promotion,
  turn,
  busy,
  joinCode,
  onJoinCodeChange,
  onConnectJoin,
  opacity,
  onOpacityChange,
  boardTheme,
  onBoardThemeChange,
  cameraActive,
  onRecalibrate,
  reachAssist,
  onToggleReachAssist,
  inRoom,
  isAiMode,
  followTurn,
  onToggleFollowTurn,
  muted,
  onToggleMuted,
  showEval,
  onToggleEval,
  twoHandPause,
  onToggleTwoHandPause,
  trackingDelegate,
  onChangeTrackingDelegate,
  trackingResolution,
  onChangeTrackingResolution,
  hoverSpeed,
  onChangeHoverSpeed,
  focusMode,
  onToggleFocusMode,
  onNotice,
  onClose,
  onAction,
  onLeaveRoom,
  onResetPractice,
  user,
  onUserChange,
  onReplayGame,
  onCaptureSample,
}: Props) {
  const [sampleLabel, setSampleLabel] = useState<GestureLabel>("pinch");
  const [samples, setSamples] = useState<RecordedGestureSample[]>([]);

  if (!modal && !promotion) return null;

  function captureGesture() {
    const sample = onCaptureSample?.(sampleLabel);
    if (!sample) {
      onNotice("Show one clear hand in front of the camera to capture a sample.");
      return;
    }
    setSamples((prev) => [...prev, sample]);
    onNotice(`Captured "${sampleLabel}" gesture sample.`);
  }

  function downloadSamples() {
    if (samples.length === 0) return;
    const blob = new Blob([JSON.stringify({ version: 1, samples }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `airchess-gestures-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !promotion) onClose();
      }}
    >
      <MovableSurface
        panelId={`dialog-${promotion ? "promotion" : modal}`}
        title="Dialog"
        enabled
        className={`modal ${modal === "settings" ? "settings-modal" : modal === "about" ? "developer-modal" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <button
          type="button"
          className="icon-button modal-close"
          data-air
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>

        {promotion ? (
          <>
            <div className="eyebrow">A NEW CHAPTER</div>
            <h2 id="dialog-title">Choose your promotion.</h2>
            <p>Your pawn reached the other side. Pick the piece it becomes.</p>
            <div className="promotion-options">
              {["q", "r", "b", "n"].map((type) => (
                <button
                  type="button"
                  key={type}
                  className="promotion-piece"
                  data-air
                  disabled={busy}
                  onClick={() => onAction({ type: "move", ...promotion, promotion: type })}
                >
                  <ChessPiece type={type} color={turn} />
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
              onChange={(e) => onJoinCodeChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
            />
            <div className="keypad">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "Clear", "0", "⌫"].map((key) => (
                <button
                  type="button"
                  className="button secondary"
                  data-air
                  key={key}
                  onClick={() =>
                    onJoinCodeChange(
                      key === "Clear"
                        ? ""
                        : key === "⌫"
                          ? joinCode.slice(0, -1)
                          : (joinCode + key).slice(0, 6),
                    )
                  }
                >
                  {key}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="button primary full"
              data-air
              disabled={joinCode.length !== 6 || busy}
              onClick={onConnectJoin}
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
                <b>1. Choose a control hand.</b> Show just one open hand for a moment. It becomes
                your only move controller; the second hand never selects squares.
              </p>
              <p>
                <b>2. Select your piece.</b> Point at your piece and keep the cursor inside its
                square until the ring fills (1.1 seconds). Steady hover needs no pinching. Move away
                to cancel the countdown.
              </p>
              <p>
                <b>3. Choose the destination.</b> Move to a highlighted legal square and hold again.
                Raise your second open palm to pause; lower it to resume. A tracking interruption
                keeps your selected piece, but restarts the confirmation countdown.
              </p>
              <p>
                <b>4. Use the menus.</b> Hold an open fingertip over a button for 1.3 seconds. You
                can join a room with the on-screen keypad, choose promotions, and request a rematch
                this way.
              </p>
            </div>
            <div className="help-note">
              Double pinch is also available in the Air controls panel: close/open twice on the
              piece, then twice on its destination. Your control hand plays both colors in local
              practice, which follows the active side by default. Reach assist brings far squares
              within a smaller hand movement. In a room, each laptop controls its own color.
            </div>
            <div className="shortcut-grid" aria-label="Keyboard shortcuts">
              <div><kbd>←</kbd><kbd>→</kbd> Step moves</div>
              <div><kbd>Home</kbd><kbd>End</kbd> Start / live</div>
              <div><kbd>F</kbd> Flip board</div>
              <div><kbd>Z</kbd> / <kbd>U</kbd> Undo move</div>
              <div><kbd>E</kbd> Toggle eval bar</div>
              <div><kbd>H</kbd> Best move hint</div>
              <div><kbd>M</kbd> Mute sounds</div>
              <div><kbd>?</kbd> Keyboard help</div>
            </div>
            <button type="button" className="button primary full" data-air onClick={onClose}>
              Let’s play
              <ChevronRight size={17} />
            </button>
          </>
        ) : modal === "about" ? (
          <DeveloperCard />
        ) : modal === "profile" ? (
          <ProfileModal
            user={user}
            onUserChange={onUserChange}
            onReplayGame={onReplayGame}
            onNotice={onNotice}
          />
        ) : modal === "settings" ? (
          <>
            <div className="eyebrow">MAKE IT YOUR SPACE</div>
            <h2 id="dialog-title">A clearer view.</h2>
            <p>Adjust the board to suit your room and lighting.</p>

            <div className="setting-label">
              <span>Board theme</span>
            </div>
            <div className="theme-picker" role="group" aria-label="Board theme">
              {themes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`theme-chip ${boardTheme === t.id ? "active" : ""}`}
                  data-air
                  aria-pressed={boardTheme === t.id}
                  onClick={() => onBoardThemeChange(t.id)}
                >
                  <span className={`theme-swatch theme-${t.id}`} />
                  {t.label}
                </button>
              ))}
            </div>

            <label className="setting-label" htmlFor="board-transparency">
              Board transparency <span>{Math.round((1 - opacity) * 100)}%</span>
            </label>
            <input
              id="board-transparency"
              className="transparency-slider"
              type="range"
              min="0"
              max="100"
              step="1"
              value={Math.round((1 - opacity) * 100)}
              onChange={(e) => onOpacityChange(1 - Number(e.target.value) / 100)}
            />
            <div className="range-labels">
              <span>Solid board</span>
              <span>Clear board</span>
            </div>
            <div className="opacity-adjustments">
              {[-5, -1, 1, 5].map((step) => (
                <button
                  type="button"
                  className="button secondary"
                  key={step}
                  data-air
                  aria-label={`${step > 0 ? "Increase" : "Decrease"} transparency by ${Math.abs(step)} percent`}
                  disabled={step > 0 ? opacity === 0 : opacity === 1}
                  onClick={() => onOpacityChange(opacity - step / 100)}
                >
                  {step > 0 ? "+" : ""}
                  {step}%
                </button>
              ))}
            </div>
            <p className="small-note">
              Use Arrange layout to drag panels or move them with the arrow buttons. Your positions
              are saved on this browser.
            </p>
            <p className="small-note">
              Pieces stay visible even at 100% transparency. All settings are saved locally.
            </p>
            <button type="button" className="button secondary full setting-button" data-air onClick={resetPanelLayout}>
              Reset panel positions
            </button>
            {cameraActive && (
              <button
                type="button"
                className="button secondary full setting-button"
                data-air
                onClick={() => {
                  onRecalibrate();
                  onClose();
                }}
              >
                Choose control hand again
              </button>
            )}
            <button type="button" className="button secondary full setting-button" data-air onClick={onToggleReachAssist}>
              Expanded reach: {reachAssist ? "on · cursor offset" : "off · direct aim"}
            </button>
            {!inRoom && (
              <button type="button" className="button secondary full setting-button" data-air onClick={onToggleFollowTurn}>
                Follow active side: {followTurn ? "on" : "off"}
              </button>
            )}
            <button type="button" className="button secondary full setting-button" data-air onClick={onToggleMuted}>
              {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
              Move sounds: {muted ? "off" : "on"}
            </button>
            <button type="button" className="button secondary full setting-button" data-air onClick={onToggleEval}>
              <Activity size={17} />
              Evaluation bar: {showEval ? "on" : "off"}
            </button>
            <button type="button" className="button secondary full setting-button" data-air onClick={onToggleTwoHandPause}>
              Two-hand palm pause: {twoHandPause ? "on · slower" : "off · faster FPS"}
            </button>
            <div className="setting-label">
              <span>Tracking engine</span>
              <strong>{trackingDelegate === "auto" ? "Auto" : trackingDelegate}</strong>
            </div>
            <div className="ai-row setting-button" role="group" aria-label="Tracking engine">
              {(["auto", "GPU", "CPU"] as TrackingDelegateMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`mini-chip ${trackingDelegate === mode ? "active" : ""}`}
                  aria-pressed={trackingDelegate === mode}
                  onClick={() => onChangeTrackingDelegate(mode)}
                >
                  {mode === "auto" ? "Auto (Fastest)" : mode === "CPU" ? "CPU (WASM)" : "GPU"}
                </button>
              ))}
            </div>
            <div className="setting-label">
              <span>Capture speed &amp; hover dwell</span>
              <strong>{trackingResolution === "fast" ? "384p" : "512p"} · {hoverSpeed === "fast" ? "0.7s" : "1.1s"}</strong>
            </div>
            <div className="ai-row setting-button" role="group" aria-label="Tracking capture resolution and hover speed">
              <button
                type="button"
                className={`mini-chip ${trackingResolution === "fast" ? "active" : ""}`}
                aria-pressed={trackingResolution === "fast"}
                onClick={() => onChangeTrackingResolution("fast")}
              >
                Fast (384p)
              </button>
              <button
                type="button"
                className={`mini-chip ${trackingResolution === "balanced" ? "active" : ""}`}
                aria-pressed={trackingResolution === "balanced"}
                onClick={() => onChangeTrackingResolution("balanced")}
              >
                Crisp (512p)
              </button>
              <button
                type="button"
                className={`mini-chip ${hoverSpeed === "standard" ? "active" : ""}`}
                aria-pressed={hoverSpeed === "standard"}
                onClick={() => onChangeHoverSpeed("standard")}
              >
                Hover 1.1s
              </button>
              <button
                type="button"
                className={`mini-chip ${hoverSpeed === "fast" ? "active" : ""}`}
                aria-pressed={hoverSpeed === "fast"}
                onClick={() => onChangeHoverSpeed("fast")}
              >
                Fast 0.7s
              </button>
            </div>
            <button
              type="button"
              className="button secondary full setting-button"
              data-air
              onClick={() => {
                onToggleFocusMode();
                onClose();
              }}
            >
              <ScanLine size={17} />
              {focusMode ? "Exit focus view" : "Focus view · fit board to screen"}
            </button>
            <button
              type="button"
              className="button secondary full"
              data-air
              onClick={() => {
                if (document.fullscreenElement) void document.exitFullscreen();
                else
                  void document.documentElement
                    .requestFullscreen()
                    .catch(() => onNotice("Use your browser’s fullscreen shortcut."));
              }}
            >
              <Maximize2 size={17} />
              Toggle fullscreen
            </button>
            <div className="sample-recorder">
              <div className="sample-recorder-head">
                <span>
                  <Database size={14} /> Gesture dataset recorder
                </span>
                <span>{samples.length} captured</span>
              </div>
              <div className="ai-row" role="group" aria-label="Gesture label">
                {(["open", "pinch", "fist"] as GestureLabel[]).map((label) => (
                  <button
                    key={label}
                    type="button"
                    className={`mini-chip ${sampleLabel === label ? "active" : ""}`}
                    aria-pressed={sampleLabel === label}
                    onClick={() => setSampleLabel(label)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="button-row">
                <button
                  type="button"
                  className="button secondary"
                  disabled={!cameraActive || !onCaptureSample}
                  onClick={captureGesture}
                >
                  Capture sample
                </button>
                <button
                  type="button"
                  className="button subtle"
                  disabled={samples.length === 0}
                  onClick={downloadSamples}
                >
                  <Download size={14} />
                  Export JSON
                </button>
                {samples.length > 0 && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setSamples([])}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <p className="small-note">
              Camera frames are processed on this device. Only room actions and chess moves are
              sent to the game server.
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
                ? inRoom
                  ? "Your friend will win by resignation. You can both request a rematch afterward."
                  : isAiMode
                    ? "Stockfish will win this game by resignation. You can review the moves or start a new game."
                    : "End this game by resignation."
                : modal === "leave"
                  ? "An active game will remain in the room. Keep the room code if you want to rejoin in this tab."
                  : "This clears your local game. Export your moves first if you want to keep them."}
            </p>
            <div className="button-row">
              <button type="button" className="button secondary" data-air onClick={onClose}>
                Go back
              </button>
              <button
                type="button"
                className="button primary"
                data-air
                onClick={() => {
                  if (modal === "leave") onLeaveRoom();
                  else if (modal === "resign") {
                    onAction({ type: "resign" });
                    onClose();
                  } else {
                    onResetPractice();
                  }
                }}
              >
                {modal === "resign" ? "Resign game" : modal === "leave" ? "Leave room" : "New game"}
              </button>
            </div>
          </>
        )}
      </MovableSurface>
    </div>
  );
}
