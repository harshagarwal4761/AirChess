import type { Color } from "chess.js";
import type { AimMode } from "./air-pointer";
import { newGame, replay, TIME_CONTROLS, type RoomState, type TimeControlId } from "./game";
import type { DifficultyPreset } from "./stockfish";

export type BoardTheme = "emerald" | "slate" | "walnut";
export type PlayMode = "practice" | "ai";

export type Preferences = {
  opacity: number;
  focusMode: boolean;
  aimMode: AimMode;
  reachAssist: boolean;
  followTurn: boolean;
  muted: boolean;
  boardTheme: BoardTheme;
  playMode: PlayMode;
  aiDifficulty: DifficultyPreset;
  aiColor: Color;
  showEval: boolean;
  twoHandPause: boolean;
  timeControl: TimeControlId;
};

export const defaultPreferences: Preferences = {
  opacity: 0.42,
  focusMode: false,
  aimMode: "hover",
  reachAssist: false,
  followTurn: true,
  muted: false,
  boardTheme: "emerald",
  playMode: "practice",
  aiDifficulty: "club",
  aiColor: "w",
  showEval: false,
  twoHandPause: false,
  timeControl: "untimed",
};

const PRACTICE_KEY = "airchess.practice.v1";

function safeGet(key: string): string | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

export function safeSet(key: string, value: string) {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  } catch {
    /* Storage may be unavailable. */
  }
}

export function readPreferences(): Preferences {
  const rawOpacity = safeGet("airchess.opacity");
  const parsedOpacity = rawOpacity !== null && Number.isFinite(Number(rawOpacity))
    ? Math.max(0, Math.min(1, Number(rawOpacity)))
    : defaultPreferences.opacity;
  const aim = safeGet("airchess.aimMode");
  const theme = safeGet("airchess.theme");
  const playMode = safeGet("airchess.playMode");
  const diff = safeGet("airchess.aiDifficulty");
  const aiColor = safeGet("airchess.aiColor");
  const tc = safeGet("airchess.timeControl") as TimeControlId | null;
  return {
    opacity: parsedOpacity,
    focusMode: safeGet("airchess.focus") === "true",
    aimMode: aim === "double-pinch" ? "double-pinch" : "hover",
    reachAssist: safeGet("airchess.reachAssist") === "true",
    followTurn: safeGet("airchess.followTurn") !== "false",
    muted: safeGet("airchess.muted") === "true",
    boardTheme: theme === "slate" || theme === "walnut" ? theme : "emerald",
    playMode: playMode === "ai" ? "ai" : "practice",
    aiDifficulty: diff === "casual" || diff === "master" ? diff : "club",
    aiColor: aiColor === "b" ? "b" : "w",
    showEval: safeGet("airchess.showEval") === "true",
    twoHandPause: safeGet("airchess.twoHandPause") === "true",
    timeControl: tc && tc in TIME_CONTROLS ? tc : "untimed",
  };
}

export function readPracticeState(): RoomState {
  const raw = safeGet(PRACTICE_KEY);
  if (!raw) return newGame();
  try {
    const parsed = JSON.parse(raw) as Partial<RoomState>;
    if (!Array.isArray(parsed.moves) || typeof parsed.game !== "number") return newGame();
    // Validate that stored SAN moves replay cleanly before trusting them.
    replay(parsed.moves);
    return {
      moves: parsed.moves,
      result: parsed.result ?? null,
      drawOffer: parsed.drawOffer ?? null,
      rematch: parsed.rematch ?? null,
      game: parsed.game,
      clock: parsed.clock ?? null,
    };
  } catch {
    return newGame();
  }
}

export function writePracticeState(state: RoomState) {
  safeSet(PRACTICE_KEY, JSON.stringify(state));
}
