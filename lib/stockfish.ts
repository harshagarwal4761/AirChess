import type { Color } from "chess.js";

export type DifficultyPreset = "casual" | "club" | "master";

export type DifficultyConfig = {
  label: string;
  subtitle: string;
  skill: number;
  depth: number;
  movetime: number;
};

export const DIFFICULTY_PRESETS: Record<DifficultyPreset, DifficultyConfig> = {
  casual: { label: "Casual", subtitle: "Friendly pace", skill: 2, depth: 5, movetime: 250 },
  club: { label: "Club", subtitle: "Balanced play", skill: 10, depth: 10, movetime: 500 },
  master: { label: "Master", subtitle: "Full Stockfish", skill: 20, depth: 14, movetime: 900 },
};

export type EvalScore =
  | { type: "cp"; value: number }
  | { type: "mate"; value: number };

export type ParsedMove = {
  from: string;
  to: string;
  promotion?: "q" | "r" | "b" | "n";
};

export type UciInfo = {
  depth: number;
  score: EvalScore | null;
  bestMove: ParsedMove | null;
};

export function parseUciMove(uci: string | undefined): ParsedMove | null {
  if (!uci || uci === "(none)" || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return null;
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length === 5 ? (uci[4] as "q" | "r" | "b" | "n") : undefined,
  };
}

/** Parse a UCI `info` line, normalizing evaluation to White's perspective. */
export function parseUciInfo(line: string, sideToMove: Color): UciInfo | null {
  if (!line.startsWith("info ") || !line.includes(" score ")) return null;
  const depthMatch = line.match(/\bdepth\s+(\d+)/);
  const cpMatch = line.match(/\bscore\s+cp\s+(-?\d+)/);
  const mateMatch = line.match(/\bscore\s+mate\s+(-?\d+)/);
  const pvMatch = line.match(/\bpv\s+([a-h][1-8][a-h][1-8][qrbn]?)/);

  const flip = sideToMove === "b" ? -1 : 1;
  let score: EvalScore | null = null;
  if (mateMatch) {
    score = { type: "mate", value: Number(mateMatch[1]) * flip };
  } else if (cpMatch) {
    score = { type: "cp", value: Number(cpMatch[1]) * flip };
  }
  if (!score) return null;

  return {
    depth: depthMatch ? Number(depthMatch[1]) : 0,
    score,
    bestMove: parseUciMove(pvMatch?.[1]),
  };
}

export function parseBestMove(line: string): ParsedMove | null {
  if (!line.startsWith("bestmove ")) return null;
  const token = line.split(/\s+/)[1];
  return parseUciMove(token);
}

/** Format a White-perspective evaluation for compact display (`+1.4`, `-0.5`, `M2`). */
export function formatEval(score: EvalScore | null): string {
  if (!score) return "0.0";
  if (score.type === "mate") {
    const abs = Math.abs(score.value);
    return score.value >= 0 ? `+M${abs}` : `-M${abs}`;
  }
  const tenths = Math.round(Math.abs(score.value) / 10);
  if (tenths === 0) return "0.0";
  return `${score.value > 0 ? "+" : "-"}${(tenths / 10).toFixed(1)}`;
}

/** Smoothly map evaluation to White's percentage height [4, 96] for the eval bar. */
export function evalWinPercent(score: EvalScore | null): number {
  if (!score) return 50;
  if (score.type === "mate") return score.value > 0 ? 100 : score.value < 0 ? 0 : 50;
  const pct = 50 + 50 * (2 / (1 + Math.exp(-0.004 * score.value)) - 1);
  return Math.max(4, Math.min(96, Math.round(pct * 10) / 10));
}
