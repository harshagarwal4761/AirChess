import type { AimMode } from "./air-pointer";
import { newGame, replay, type RoomState } from "./game";

export type BoardTheme = "emerald" | "slate" | "walnut";

export type Preferences = {
  opacity: number;
  focusMode: boolean;
  aimMode: AimMode;
  reachAssist: boolean;
  followTurn: boolean;
  muted: boolean;
  boardTheme: BoardTheme;
};

export const defaultPreferences: Preferences = {
  opacity: 0.42,
  focusMode: false,
  aimMode: "hover",
  reachAssist: false,
  followTurn: true,
  muted: false,
  boardTheme: "emerald",
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
  return {
    opacity: parsedOpacity,
    focusMode: safeGet("airchess.focus") === "true",
    aimMode: aim === "double-pinch" ? "double-pinch" : "hover",
    reachAssist: safeGet("airchess.reachAssist") === "true",
    followTurn: safeGet("airchess.followTurn") !== "false",
    muted: safeGet("airchess.muted") === "true",
    boardTheme: theme === "slate" || theme === "walnut" ? theme : "emerald",
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
    };
  } catch {
    return newGame();
  }
}

export function writePracticeState(state: RoomState) {
  safeSet(PRACTICE_KEY, JSON.stringify(state));
}
