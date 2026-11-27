import { eq, and, gt } from "drizzle-orm";
import { getDb } from "../db";
import { sessions, users } from "../db/schema";

export const SESSION_COOKIE = "airchess_session";
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const PBKDF2_ITERS = 100_000;

export type PublicUser = {
  id: string;
  username: string;
  displayName: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  createdAt: number;
};

export class AuthError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toHex(new Uint8Array(bytes));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERS, hash: "SHA-256" },
    key,
    256,
  );
  return `pbkdf2$${PBKDF2_ITERS}$${toHex(salt)}$${toHex(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iters = Number(parts[1]);
  if (!Number.isInteger(iters) || iters < 1000) return false;
  const salt = fromHex(parts[2]);
  const expected = fromHex(parts[3]);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: iters, hash: "SHA-256" },
    key,
    expected.length * 8,
  );
  return constantTimeEqual(new Uint8Array(bits), expected);
}

export function normalizeUsername(raw: string): string {
  const clean = raw.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(clean)) {
    throw new AuthError("Username must be 3–20 characters (letters, numbers, underscores).");
  }
  return clean;
}

export function validatePassword(raw: string): string {
  if (typeof raw !== "string" || raw.length < 6 || raw.length > 100) {
    throw new AuthError("Password must be 6–100 characters.");
  }
  return raw;
}

function publicUser(row: typeof users.$inferSelect): PublicUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    rating: row.rating,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    createdAt: row.createdAt,
  };
}

function cookieHeader(token: string, request: Request, maxAgeSeconds: number): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

function parseSessionCookie(request: Request): string | null {
  const raw = request.headers.get("Cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === SESSION_COOKIE) {
      const value = rest.join("=").trim();
      return /^[a-f0-9]{32,128}$/.test(value) ? value : null;
    }
  }
  return null;
}

async function createSessionCookie(userId: string, request: Request): Promise<string> {
  const db = getDb();
  const rawToken = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256Hex(rawToken);
  const now = Date.now();
  await db.insert(sessions).values({
    id: tokenHash,
    userId,
    expiresAt: now + SESSION_TTL_MS,
    createdAt: now,
  });
  return cookieHeader(rawToken, request, Math.floor(SESSION_TTL_MS / 1000));
}

export async function getSessionUser(request: Request): Promise<PublicUser | null> {
  const token = parseSessionCookie(request);
  if (!token) return null;
  const db = getDb();
  const tokenHash = await sha256Hex(token);
  const now = Date.now();
  const session = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, tokenHash), gt(sessions.expiresAt, now)))
    .get();
  if (!session) return null;
  const user = await db.select().from(users).where(eq(users.id, session.userId)).get();
  return user ? publicUser(user) : null;
}

export async function registerUser(
  rawUsername: string,
  rawPassword: string,
  rawDisplayName: string | undefined,
  request: Request,
) {
  const username = normalizeUsername(rawUsername);
  const password = validatePassword(rawPassword);
  const displayName = (rawDisplayName ?? "").trim().slice(0, 32) || username;
  const db = getDb();
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).get();
  if (existing) throw new AuthError("That username is already taken.", 409);

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  const now = Date.now();
  const inserted = await db
    .insert(users)
    .values({
      id,
      username,
      displayName,
      passwordHash,
      rating: 1200,
      wins: 0,
      losses: 0,
      draws: 0,
      createdAt: now,
    })
    .returning();
  const cookie = await createSessionCookie(id, request);
  return { user: publicUser(inserted[0]), cookie };
}

export async function loginUser(rawUsername: string, rawPassword: string, request: Request) {
  const username = normalizeUsername(rawUsername);
  const password = validatePassword(rawPassword);
  const db = getDb();
  const user = await db.select().from(users).where(eq(users.username, username)).get();
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new AuthError("Invalid username or password.", 401);
  }
  const cookie = await createSessionCookie(user.id, request);
  return { user: publicUser(user), cookie };
}

export async function logoutUser(request: Request): Promise<string> {
  const token = parseSessionCookie(request);
  if (token) {
    const db = getDb();
    const tokenHash = await sha256Hex(token);
    await db.delete(sessions).where(eq(sessions.id, tokenHash)).catch(() => {});
  }
  return cookieHeader("", request, 0);
}
