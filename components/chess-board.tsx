"use client";
import { useMemo } from "react";
import type { Chess, Color, Move, Square } from "chess.js";
import { Download, RotateCcw, Undo2 } from "lucide-react";
import { materialSummary, pieceNames } from "../lib/game";
import { ChessPiece } from "./chess-pieces";
import { MovableSurface } from "./movable-surface";

const files = "abcdefgh";

type RoomSummary = {
  code: string;
  color: Color;
  ready: boolean;
} | null;

type Props = {
  chess: Chess;
  orientation: Color;
  selected: Square | null;
  legal: Move[];
  lastMove?: Move;
  room: RoomSummary;
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
  onSquareClick: (square: Square) => void;
  onFlip: () => void;
  onDownloadPgn: () => void;
  onUndo: () => void;
  onJumpLive: () => void;
};

export function ChessBoard({
  chess,
  orientation,
  selected,
  legal,
  lastMove,
  room,
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
  onSquareClick,
  onFlip,
  onDownloadPgn,
  onUndo,
  onJumpLive,
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
            className={`square ${(Math.floor(i / 8) + (i % 8)) % 2 ? "dark" : "light"} ${selected === square ? "selected" : ""} ${lastMove?.from === square || lastMove?.to === square ? "last-move" : ""} ${check ? "in-check" : ""} ${airTarget === square ? "air-target" : ""} ${airTarget === square && airLocked ? "air-locked" : ""}`}
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
    [squares, chess, isReviewing, legal, interactive, selected, lastMove, airTarget, airLocked, onSquareClick],
  );

  function playerBar(color: Color) {
    const you = room?.color === color;
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
              : chess.turn() === color
                ? "To move"
                : "Untimed"}
        </span>
      </div>
    );
  }

  return (
    <MovableSurface as="div" className="board-region" panelId="board" title="Chessboard" enabled={arranging}>
      {playerBar(orientation === "w" ? "b" : "w")}
      <div className={`board-shell ${isReviewing ? "reviewing-board" : ""}`}>
        <div className="board-corner corner-tl" />
        <div className="board-corner corner-br" />
        <div className="board" role="group" aria-label="Chessboard">
          {boardSquares}
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
        <div className="caption-actions">
          {!room && totalPlies > 0 && (
            <button
              type="button"
              className="icon-button"
              data-air
              aria-label="Undo last move"
              title="Undo last move"
              onClick={onUndo}
            >
              <Undo2 size={15} />
            </button>
          )}
          <button
            type="button"
            className="icon-button"
            data-air
            aria-label={room ? "Export game as PGN" : "Flip board"}
            title={room ? "Export game as PGN" : "Flip board"}
            onClick={room ? onDownloadPgn : onFlip}
          >
            {room ? <Download size={16} /> : <RotateCcw size={16} />}
          </button>
        </div>
      </div>
    </MovableSurface>
  );
}
