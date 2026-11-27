import type { Color } from "chess.js";

export type EloResult = {
  whiteAfter: number;
  blackAfter: number;
  whiteDelta: number;
  blackDelta: number;
};

/** Standard Elo rating update (K = 32) clamped to a floor of 100. */
export function calculateElo(
  whiteRating: number,
  blackRating: number,
  winner: Color | null,
  kFactor = 32,
): EloResult {
  const expectedWhite = 1 / (1 + 10 ** ((blackRating - whiteRating) / 400));
  const expectedBlack = 1 - expectedWhite;
  const actualWhite = winner === "w" ? 1 : winner === "b" ? 0 : 0.5;
  const actualBlack = 1 - actualWhite;

  const whiteDelta = Math.round(kFactor * (actualWhite - expectedWhite));
  const blackDelta = Math.round(kFactor * (actualBlack - expectedBlack));

  return {
    whiteAfter: Math.max(100, whiteRating + whiteDelta),
    blackAfter: Math.max(100, blackRating + blackDelta),
    whiteDelta,
    blackDelta,
  };
}
