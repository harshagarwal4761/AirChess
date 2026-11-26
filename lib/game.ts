import { Chess, type Color } from "chess.js";
export type Result = { text: string; winner: Color | null };
export type RoomState = {
  moves: string[];
  result: Result | null;
  drawOffer: Color | null;
  rematch: Color | null;
  game: number;
};
export function newGame(game = 1): RoomState {
  return { moves: [], result: null, drawOffer: null, rematch: null, game };
}
export function replay(moves: string[], ply = moves.length) {
  const chess = new Chess();
  const limit = Math.max(0, Math.min(moves.length, ply));
  for (let i = 0; i < limit; i++) chess.move(moves[i]);
  return chess;
}
export function undoLocalMove(state: RoomState): RoomState {
  if (!state.moves.length) return state;
  return {
    ...state,
    moves: state.moves.slice(0, -1),
    result: null,
    drawOffer: null,
    rematch: null,
  };
}
const pieceValues: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const captureOrder: Record<string, number> = { q: 0, r: 1, b: 2, n: 3, p: 4 };
export function materialSummary(chess: Chess) {
  let white = 0;
  let black = 0;
  for (const row of chess.board()) {
    for (const cell of row) {
      if (!cell) continue;
      if (cell.color === "w") white += pieceValues[cell.type] ?? 0;
      else black += pieceValues[cell.type] ?? 0;
    }
  }
  const diff = white - black;
  const history = chess.history({ verbose: true });
  const captured = (color: Color) =>
    history
      .filter((m) => m.color === color && m.captured)
      .map((m) => m.captured!)
      .sort((a, b) => (captureOrder[a] ?? 9) - (captureOrder[b] ?? 9));
  return {
    whiteCaptured: captured("w"),
    blackCaptured: captured("b"),
    whiteAdvantage: diff > 0 ? diff : 0,
    blackAdvantage: diff < 0 ? -diff : 0,
  };
}
export function outcome(chess: Chess): Result | null {
  if (chess.isCheckmate())
    return {
      text: `${chess.turn() === "w" ? "Black" : "White"} wins by checkmate`,
      winner: chess.turn() === "w" ? "b" : "w",
    };
  if (chess.isStalemate()) return { text: "Draw by stalemate", winner: null };
  if (chess.isInsufficientMaterial())
    return { text: "Draw — insufficient material", winner: null };
  if (chess.isThreefoldRepetition())
    return { text: "Draw by threefold repetition", winner: null };
  if (chess.isDrawByFiftyMoves())
    return { text: "Draw by the fifty-move rule", winner: null };
  return null;
}
export type Action =
  | { type: "move"; from: string; to: string; promotion?: string }
  | {
      type:
        | "resign"
        | "offer-draw"
        | "accept-draw"
        | "decline-draw"
        | "rematch";
    };
export function applyAction(
  state: RoomState,
  color: Color,
  action: Action,
): RoomState {
  if (action.type === "rematch") {
    if (!state.result)
      throw new Error("Finish this game before requesting a rematch.");
    return state.rematch && state.rematch !== color
      ? newGame(state.game + 1)
      : { ...state, rematch: color };
  }
  if (state.result) throw new Error("This game has ended.");
  if (action.type === "resign")
    return {
      ...state,
      result: {
        text: `${color === "w" ? "Black" : "White"} wins by resignation`,
        winner: color === "w" ? "b" : "w",
      },
      drawOffer: null,
    };
  if (action.type === "offer-draw") {
    if (state.drawOffer && state.drawOffer !== color)
      throw new Error("Respond to the existing draw offer.");
    return { ...state, drawOffer: color };
  }
  if (action.type === "accept-draw" || action.type === "decline-draw") {
    if (!state.drawOffer || state.drawOffer === color)
      throw new Error("There is no opponent draw offer.");
    return {
      ...state,
      drawOffer: null,
      result:
        action.type === "accept-draw"
          ? { text: "Draw by agreement", winner: null }
          : null,
    };
  }
  if (action.type !== "move") throw new Error("Unknown action.");
  const chess = replay(state.moves);
  if (chess.turn() !== color) throw new Error("Wait for your turn.");
  const candidates = chess
    .moves({ verbose: true })
    .filter((m) => m.from === action.from && m.to === action.to);
  if (!candidates.length) throw new Error("That move is not legal.");
  if (
    candidates[0].promotion &&
    !["q", "r", "b", "n"].includes(action.promotion ?? "")
  )
    throw new Error("Choose a promotion piece.");
  const move = chess.move({
    from: action.from,
    to: action.to,
    promotion: action.promotion,
  });
  return {
    ...state,
    moves: [...state.moves, move.san],
    drawOffer: null,
    result: outcome(chess),
  };
}
export const pieceNames: Record<string, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};
