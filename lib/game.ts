import { Chess, type Color } from "chess.js";
export type Result = { text: string; winner: Color | null };
export type TimeControlId = "untimed" | "blitz3_2" | "blitz5_0" | "rapid10_0";
export type ClockState = {
  control: TimeControlId;
  wMs: number;
  bMs: number;
  incrementMs: number;
  lastTickAt: number | null;
};
export const TIME_CONTROLS: Record<
  TimeControlId,
  { id: TimeControlId; label: string; baseMs: number; incrementMs: number }
> = {
  untimed: { id: "untimed", label: "Untimed", baseMs: 0, incrementMs: 0 },
  blitz3_2: { id: "blitz3_2", label: "3+2", baseMs: 180_000, incrementMs: 2_000 },
  blitz5_0: { id: "blitz5_0", label: "5+0", baseMs: 300_000, incrementMs: 0 },
  rapid10_0: { id: "rapid10_0", label: "10+0", baseMs: 600_000, incrementMs: 0 },
};
export type RoomState = {
  moves: string[];
  result: Result | null;
  drawOffer: Color | null;
  rematch: Color | null;
  game: number;
  clock?: ClockState | null;
};
export function newGame(game = 1, timeControl: TimeControlId = "untimed"): RoomState {
  const cfg = TIME_CONTROLS[timeControl] ?? TIME_CONTROLS.untimed;
  return {
    moves: [],
    result: null,
    drawOffer: null,
    rematch: null,
    game,
    clock:
      cfg.id === "untimed"
        ? null
        : {
            control: cfg.id,
            wMs: cfg.baseMs,
            bMs: cfg.baseMs,
            incrementMs: cfg.incrementMs,
            lastTickAt: null,
          },
  };
}
export function effectiveClocks(state: RoomState, turn: Color, now: number) {
  const c = state.clock;
  if (!c) return null;
  if (state.result || c.lastTickAt === null) {
    return { wMs: c.wMs, bMs: c.bMs, timedOut: null as Color | null };
  }
  const elapsed = Math.max(0, now - c.lastTickAt);
  const wMs = turn === "w" ? Math.max(0, c.wMs - elapsed) : c.wMs;
  const bMs = turn === "b" ? Math.max(0, c.bMs - elapsed) : c.bMs;
  const timedOut: Color | null = wMs === 0 ? "w" : bMs === 0 ? "b" : null;
  return { wMs, bMs, timedOut };
}
export function formatClock(ms: number): string {
  const safe = Math.max(0, ms);
  if (safe < 10_000) {
    return `${(safe / 1000).toFixed(1)}s`;
  }
  const totalSec = Math.ceil(safe / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}
export function replay(moves: string[], ply = moves.length) {
  const chess = new Chess();
  const limit = Math.max(0, Math.min(moves.length, ply));
  for (let i = 0; i < limit; i++) chess.move(moves[i]);
  return chess;
}
export function undoLocalMove(state: RoomState, steps = 1): RoomState {
  if (!state.moves.length || steps < 1) return state;
  return {
    ...state,
    moves: state.moves.slice(0, Math.max(0, state.moves.length - steps)),
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
        | "rematch"
        | "flag";
    };
function timeoutOutcome(chess: Chess, flagged: Color): Result {
  // Check whether the opponent has only a bare king (insufficient material).
  const winner: Color = flagged === "w" ? "b" : "w";
  const opponentPieces = chess
    .board()
    .flat()
    .filter((p) => p && p.color === winner && p.type !== "k");
  if (opponentPieces.length === 0) {
    return { text: "Draw — timeout vs insufficient material", winner: null };
  }
  return {
    text: `${winner === "w" ? "White" : "Black"} wins on time`,
    winner,
  };
}
export function applyAction(
  state: RoomState,
  color: Color,
  action: Action,
  now = Date.now(),
): RoomState {
  if (action.type === "rematch") {
    if (!state.result)
      throw new Error("Finish this game before requesting a rematch.");
    return state.rematch && state.rematch !== color
      ? newGame(state.game + 1, state.clock?.control ?? "untimed")
      : { ...state, rematch: color };
  }
  if (state.result) throw new Error("This game has ended.");
  if (action.type === "flag") {
    const chess = replay(state.moves);
    const clocks = effectiveClocks(state, chess.turn(), now);
    if (!clocks || !clocks.timedOut) {
      throw new Error("Clock has not expired.");
    }
    return {
      ...state,
      clock: {
        ...state.clock!,
        wMs: clocks.wMs,
        bMs: clocks.bMs,
        lastTickAt: null,
      },
      drawOffer: null,
      result: timeoutOutcome(chess, clocks.timedOut),
    };
  }
  if (action.type === "resign")
    return {
      ...state,
      result: {
        text: `${color === "w" ? "Black" : "White"} wins by resignation`,
        winner: color === "w" ? "b" : "w",
      },
      drawOffer: null,
      clock: state.clock ? { ...state.clock, lastTickAt: null } : null,
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
      clock:
        action.type === "accept-draw" && state.clock
          ? { ...state.clock, lastTickAt: null }
          : state.clock,
      result:
        action.type === "accept-draw"
          ? { text: "Draw by agreement", winner: null }
          : null,
    };
  }
  if (action.type !== "move") throw new Error("Unknown action.");
  const chess = replay(state.moves);
  if (chess.turn() !== color) throw new Error("Wait for your turn.");
  const clocks = effectiveClocks(state, color, now);
  if (clocks?.timedOut === color) {
    return {
      ...state,
      clock: {
        ...state.clock!,
        wMs: clocks.wMs,
        bMs: clocks.bMs,
        lastTickAt: null,
      },
      drawOffer: null,
      result: timeoutOutcome(chess, color),
    };
  }
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
  const nextResult = outcome(chess);
  let nextClock = state.clock ?? null;
  if (nextClock && clocks) {
    const startTick = state.moves.length >= 1;
    const wMs =
      color === "w"
        ? clocks.wMs + (startTick ? nextClock.incrementMs : 0)
        : clocks.wMs;
    const bMs =
      color === "b"
        ? clocks.bMs + (startTick ? nextClock.incrementMs : 0)
        : clocks.bMs;
    nextClock = {
      ...nextClock,
      wMs,
      bMs,
      lastTickAt: nextResult ? null : now,
    };
  }
  return {
    ...state,
    moves: [...state.moves, move.san],
    drawOffer: null,
    result: nextResult,
    clock: nextClock,
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
