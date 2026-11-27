"use client";
import { useMemo } from "react";
import type { Chess, Color, Move, Square } from "chess.js";
import { Download, Flag, Handshake, RotateCcw, Undo2 } from "lucide-react";
import { materialSummary, pieceNames, type Action, type RoomState } from "../lib/game";
import {
  DIFFICULTY_PRESETS,
  evalWinPercent,
  formatEval,
  type DifficultyPreset,
  type EvalScore,
  type ParsedMove,
} from "../lib/stockfish";
import { ChessPiece } from "./chess-pieces";
import { MovableSurface } from "./movable-surface";

const files = "abcdefgh";

type RoomSummary = {
  code: string;
  color: Color;
  ready: boolean;
} | null;

type AiConfig = {
  active: boolean;
  playerColor: Color;
  difficulty: DifficultyPreset;
  thinking: boolean;
};

type Props = {
  chess: Chess;
  orientation: Color;
  selected: Square | null;
  legal: Move[];
  lastMove?: Move;
  room: RoomSummary;
  state: RoomState;
  busy: boolean;
  aiConfig: AiConfig;
  arranging: boolean;
  modalOpen: boolean;
  promotionOpen: boolean;
  canMove: boolean;
  isReviewing: boolean;
  viewPly: number;
  totalPlies: number;
  statusText: string;
  airTarget: string | null;
  airLocked: boolean;
  hasResult: boolean;
  showEval: boolean;
  evalScore: EvalScore | null;
  hintMove: ParsedMove | null;
  onSquareClick: (square: Square) => void;
  onFlip: () => void;
  onDownloadPgn: () => void;
  onUndo: () => void;
  onJumpLive: () => void;
  onOpenModal: (modal: "resign" | "reset") => void;
  onAction: (action: Action) => void;
};

export function ChessBoard({
  chess,
  orientation,
  selected,
  legal,
  lastMove,
  room,
  state,
  busy,
  aiConfig,
  arranging,
  modalOpen,
  promotionOpen,
  canMove,
  isReviewing,
  viewPly,
  totalPlies,
  statusText,
  airTarget,
  airLocked,
  hasResult,
  showEval,
  evalScore,
  hintMove,
  onSquareClick,
  onFlip,
  onDownloadPgn,
  onUndo,
  onJumpLive,
  onOpenModal,
  onAction,
}: Props) {
  const material = useMemo(() => materialSummary(chess), [chess]);
  const squares = useMemo(
    () =>
      Array.from(
        { length: 64 },
        (_, i) =>
          `${files[orientation === "w" ? i % 8 : 7 - (i % 8)]}${orientation === "w" ? 8 - Math.floor(i / 8) : 1 + Math.floor(i / 8)}` as Square,
      ),
    [orientation],
  );

  const interactive = !arranging && !modalOpen && !promotionOpen && !isReviewing && canMove;

  const boardSquares = useMemo(
    () =>
      squares.map((square, i) => {
        const piece = chess.get(square);
        const isLegal = !isReviewing && legal.some((m) => m.to === square);
        const isHint = Boolean(hintMove && (hintMove.from === square || hintMove.to === square));
        const check =
          piece?.type === "k" &&
          piece.color === chess.turn() &&
          chess.isCheck();
        return (
          <button
            key={square}
            type="button"
            data-square={square}
            data-air-square={
              interactive && (piece?.color === chess.turn() || isLegal)
                ? square
                : undefined
            }
            className={`square ${(Math.floor(i / 8) + (i % 8)) % 2 ? "dark" : "light"} ${selected === square ? "selected" : ""} ${lastMove?.from === square || lastMove?.to === square ? "last-move" : ""} ${isHint ? "hint-square" : ""} ${check ? "in-check" : ""} ${airTarget === square ? "air-target" : ""} ${airTarget === square && airLocked ? "air-locked" : ""}`}
            aria-label={`${square}${piece ? ` ${piece.color === "w" ? "white" : "black"} ${pieceNames[piece.type]}` : " empty"}${isLegal ? ", legal destination" : ""}`}
            aria-pressed={selected === square}
            onClick={() => onSquareClick(square)}
          >
            {i % 8 === 0 && <span className="rank-label">{square[1]}</span>}
            {Math.floor(i / 8) === 7 && <span className="file-label">{square[0]}</span>}
            {piece && <ChessPiece type={piece.type} color={piece.color} />}
            {isLegal && (
              <span className={`legal-marker ${piece ? "capture-marker" : ""}`} />
            )}
          </button>
        );
      }),
    [squares, chess, isReviewing, legal, hintMove, interactive, selected, lastMove, airTarget, airLocked, onSquareClick],
  );

  function playerBar(color: Color) {
    const you = room?.color === color;
    const isAiOpponent = !room && aiConfig.active && aiConfig.playerColor !== color;
    const isHumanVsAi = !room && aiConfig.active && aiConfig.playerColor === color;
    const capturedList = color === "w" ? material.whiteCaptured : material.blackCaptured;
    const advantage = color === "w" ? material.whiteAdvantage : material.blackAdvantage;
    return (
      <div
        className={`player-bar ${chess.turn() === color && !hasResult ? "active-player" : ""}`}
      >
        <div className={`player-avatar ${color}`}>
          <ChessPiece type="k" color={color} small />
        </div>
        <div className="player-name">
          <strong>
            {room
              ? you
                ? "You"
                : room.ready
                  ? "Your friend"
                  : "An open seat"
              : isAiOpponent
                ? `Stockfish · ${DIFFICULTY_PRESETS[aiConfig.difficulty].label}`
                : isHumanVsAi
                  ? "You"
                  : "You control both colors"}
          </strong>
          <span className="player-meta">
            <span>{color === "w" ? "White pieces" : "Black pieces"}</span>
            {capturedList.length > 0 && (
              <span className="captured" aria-label={`Captured pieces (${capturedList.length})`}>
                {capturedList.map((type, idx) => (
                  <ChessPiece
                    key={`${type}-${idx}`}
                    type={type}
                    color={color === "w" ? "b" : "w"}
                    small
                  />
                ))}
              </span>
            )}
            {advantage > 0 && <span className="material-chip">+{advantage}</span>}
          </span>
        </div>
        <span className="turn-chip">
          {hasResult
            ? "Finished"
            : !room?.ready && room
              ? "Waiting"
              : isAiOpponent && aiConfig.thinking
                ? "Thinking…"
                : chess.turn() === color
                  ? "To move"
                  : "Untimed"}
        </span>
      </div>
    );
  }

  const whitePct = evalWinPercent(evalScore);
  const evalLabel = formatEval(evalScore);
  const whiteAhead = evalScore ? (evalScore.type === "mate" ? evalScore.value >= 0 : evalScore.value >= 0) : true;

  return (
    <MovableSurface as="div" className="board-region" panelId="board" title="Chessboard" enabled={arranging}>
      {playerBar(orientation === "w" ? "b" : "w")}
      <div className={`board-stage ${showEval ? "with-eval" : ""}`}>
        {showEval && (
          <div
            className={`eval-bar ${orientation === "b" ? "flipped" : ""}`}
            role="meter"
            aria-label={`Position evaluation ${evalLabel}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(whitePct)}
            title={`Stockfish evaluation: ${evalLabel}`}
          >
            <div className="eval-fill" style={{ height: `${whitePct}%` }} />
            <span className={`eval-readout ${whiteAhead ? "white-adv" : "black-adv"}`}>
              {evalLabel}
            </span>
          </div>
        )}
        <div className={`board-shell ${isReviewing ? "reviewing-board" : ""}`}>
          <div className="board-corner corner-tl" />
          <div className="board-corner corner-br" />
          <div className="board" role="group" aria-label="Chessboard">
            {boardSquares}
          </div>
        </div>
      </div>
      {playerBar(orientation)}
      <div className="board-caption">
        <span className="status-pulse" />
        {isReviewing ? (
          <>
            <span role="status">
              Viewing move {Math.ceil(viewPly / 2)} of {Math.ceil(totalPlies / 2)}
            </span>
            <button type="button" className="text-button review-live-btn" data-air onClick={onJumpLive}>
              Jump to live
            </button>
          </>
        ) : (
          <span role="status">{statusText}</span>
        )}
      </div>
      <div className="board-actions" role="toolbar" aria-label="Game actions">
        {room ? (
          hasResult ? (
            <button
              type="button"
              className="action-pill primary-pill"
              data-air
              disabled={busy || state.rematch === room.color}
              onClick={() => onAction({ type: "rematch" })}
            >
              <RotateCcw size={14} />
              <span>
                {state.rematch === room.color
                  ? "Rematch sent"
                  : state.rematch
                    ? "Accept rematch"
                    : "Play again"}
              </span>
            </button>
          ) : (
            <>
              <button
                type="button"
                className="action-pill"
                data-air
                disabled={!room.ready || busy || state.drawOffer === room.color}
                onClick={() => onAction({ type: "offer-draw" })}
              >
                <Handshake size={14} />
                <span>{state.drawOffer === room.color ? "Draw offered" : "Offer draw"}</span>
              </button>
              <button
                type="button"
                className="action-pill danger-pill"
                data-air
                disabled={!room.ready || busy}
                onClick={() => onOpenModal("resign")}
              >
                <Flag size={14} />
                <span>Resign</span>
              </button>
            </>
          )
        ) : (
          <>
            <button
              type="button"
              className="action-pill"
              data-air
              aria-label="Undo last move"
              disabled={totalPlies === 0}
              onClick={onUndo}
            >
              <Undo2 size={14} />
              <span>Undo</span>
            </button>
            {aiConfig.active && !hasResult && totalPlies > 0 && (
              <button
                type="button"
                className="action-pill danger-pill"
                data-air
                onClick={() => onOpenModal("resign")}
              >
                <Flag size={14} />
                <span>Resign</span>
              </button>
            )}
            <button
              type="button"
              className="action-pill"
              data-air
              aria-label="Flip board"
              onClick={onFlip}
            >
              <RotateCcw size={14} />
              <span>Flip</span>
            </button>
            <button
              type="button"
              className="action-pill"
              data-air
              onClick={() => onOpenModal("reset")}
            >
              <RotateCcw size={14} />
              <span>New game</span>
            </button>
          </>
        )}
        <button
          type="button"
          className="action-pill"
          data-air
          aria-label="Export game as PGN"
          disabled={totalPlies === 0}
          onClick={onDownloadPgn}
        >
          <Download size={14} />
          <span>PGN</span>
        </button>
      </div>
    </MovableSurface>
  );
}
