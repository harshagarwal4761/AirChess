"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Award, Copy, History, LogOut, Play, Trophy, User } from "lucide-react";
import type { PublicUser } from "../lib/auth";

export type ArchivedGame = {
  id: string;
  mode: string;
  roomCode: string | null;
  whiteName: string;
  blackName: string;
  timeControl: string;
  moves: string[];
  resultText: string;
  winner: string | null;
  whiteRatingBefore: number | null;
  whiteRatingAfter: number | null;
  blackRatingBefore: number | null;
  blackRatingAfter: number | null;
  createdAt: number;
};

type LeaderboardRow = {
  username: string;
  displayName: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
};

type Props = {
  user: PublicUser | null;
  onUserChange: (user: PublicUser | null) => void;
  onReplayGame: (game: ArchivedGame) => void;
  onNotice: (message: string) => void;
};

export function ProfileModal({ user, onUserChange, onReplayGame, onNotice }: Props) {
  const [authTab, setAuthTab] = useState<"login" | "register" | "board">("login");
  const [profileTab, setProfileTab] = useState<"history" | "board">("history");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [games, setGames] = useState<ArchivedGame[]>([]);
  const [players, setPlayers] = useState<LeaderboardRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoadingList(true);
      try {
        const [gamesRes, lbRes] = await Promise.all([
          user ? fetch("/api/games") : Promise.resolve(null),
          fetch("/api/leaderboard"),
        ]);
        if (gamesRes?.ok && active) {
          const data = (await gamesRes.json()) as { games: ArchivedGame[] };
          setGames(data.games ?? []);
        }
        if (lbRes.ok && active) {
          const data = (await lbRes.json()) as { players: LeaderboardRow[] };
          setPlayers(data.players ?? []);
        }
      } catch {
        /* Optional list fetch. */
      } finally {
        if (active) setLoadingList(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [user]);

  async function submitAuth(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const endpoint = authTab === "register" ? "/api/auth/register" : "/api/auth/login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          authTab === "register"
            ? { username, password, displayName }
            : { username, password },
        ),
      });
      const data = (await res.json()) as { user?: PublicUser; error?: string };
      if (!res.ok || !data.user) {
        setError(data.error ?? "Authentication failed.");
        return;
      }
      onUserChange(data.user);
      setPassword("");
      onNotice(`Signed in as @${data.user.username}`);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function signOut() {
    setSubmitting(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      onUserChange(null);
      setGames([]);
      onNotice("Signed out.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyShareLink(id: string) {
    try {
      await navigator.clipboard.writeText(`${location.origin}/?game=${id}`);
      onNotice("Copied replay link.");
    } catch {
      onNotice(`Share replay link: ${location.origin}/?game=${id}`);
    }
  }

  if (!user) {
    return (
      <div className="profile-modal">
        <div className="eyebrow">PLAYER ACCOUNT</div>
        <h2 id="dialog-title">Save matches &amp; track Elo.</h2>
        <p>Sign in for rated matches and game history, or keep playing as a guest anytime.</p>

        <div className="aim-modes profile-tabs" role="group" aria-label="Account options">
          <button
            type="button"
            aria-pressed={authTab === "login"}
            onClick={() => {
              setAuthTab("login");
              setError("");
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            aria-pressed={authTab === "register"}
            onClick={() => {
              setAuthTab("register");
              setError("");
            }}
          >
            Create account
          </button>
          <button
            type="button"
            aria-pressed={authTab === "board"}
            onClick={() => {
              setAuthTab("board");
              setError("");
            }}
          >
            Leaderboard
          </button>
        </div>

        {authTab === "board" ? (
          <div className="archive-list">
            {loadingList ? (
              <p className="small-note">Loading leaderboard…</p>
            ) : players.length ? (
              players.map((p, idx) => (
                <div className="archive-row" key={p.username}>
                  <span className="rank-num">#{idx + 1}</span>
                  <div className="archive-main">
                    <strong>@{p.username}</strong>
                    <span>
                      {p.wins}W · {p.losses}L · {p.draws}D
                    </span>
                  </div>
                  <span className="elo-badge">{p.rating}</span>
                </div>
              ))
            ) : (
              <p className="small-note">No rated players yet. Create the first account!</p>
            )}
          </div>
        ) : (
          <form className="auth-form" onSubmit={(e) => void submitAuth(e)}>
            <label className="auth-field">
              <span>Username</span>
              <input
                type="text"
                autoComplete="username"
                placeholder="grandmaster_42"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </label>
            {authTab === "register" && (
              <label className="auth-field">
                <span>Display name (optional)</span>
                <input
                  type="text"
                  autoComplete="name"
                  placeholder="Harsh"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </label>
            )}
            <label className="auth-field">
              <span>Password</span>
              <input
                type="password"
                autoComplete={authTab === "register" ? "new-password" : "current-password"}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {error && (
              <div className="inline-error" role="alert">
                {error}
              </div>
            )}
            <button type="submit" className="button primary full" disabled={submitting}>
              <User size={16} />
              {submitting
                ? "Please wait…"
                : authTab === "register"
                  ? "Create account"
                  : "Sign in"}
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="profile-modal">
      <div className="eyebrow">PLAYER PROFILE</div>
      <div className="profile-header">
        <div>
          <h2 id="dialog-title">{user.displayName}</h2>
          <span className="profile-handle">@{user.username}</span>
        </div>
        <div className="elo-pill">
          <Award size={15} />
          <span>{user.rating} Elo</span>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <strong>{user.wins}</strong>
          <span>Wins</span>
        </div>
        <div className="stat-card">
          <strong>{user.losses}</strong>
          <span>Losses</span>
        </div>
        <div className="stat-card">
          <strong>{user.draws}</strong>
          <span>Draws</span>
        </div>
      </div>

      <div className="aim-modes profile-tabs" role="group" aria-label="Profile sections">
        <button
          type="button"
          aria-pressed={profileTab === "history"}
          onClick={() => setProfileTab("history")}
        >
          <History size={13} /> Match history
        </button>
        <button
          type="button"
          aria-pressed={profileTab === "board"}
          onClick={() => setProfileTab("board")}
        >
          <Trophy size={13} /> Leaderboard
        </button>
      </div>

      {profileTab === "history" ? (
        <div className="archive-list">
          {loadingList ? (
            <p className="small-note">Loading your archived matches…</p>
          ) : games.length ? (
            games.map((g) => (
              <div className="archive-row" key={g.id}>
                <div className="archive-main">
                  <strong>
                    {g.whiteName} vs {g.blackName}
                  </strong>
                  <span>
                    {g.resultText} · {Math.ceil(g.moves.length / 2)} moves · {g.timeControl}
                  </span>
                </div>
                <div className="archive-actions">
                  <button
                    type="button"
                    className="mini-chip"
                    onClick={() => onReplayGame(g)}
                    aria-label={`Replay ${g.whiteName} vs ${g.blackName}`}
                  >
                    <Play size={12} /> Replay
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Copy replay link"
                    onClick={() => void copyShareLink(g.id)}
                  >
                    <Copy size={13} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="small-note">
              No archived games yet. Finish an online or Stockfish match while signed in to save it here.
            </p>
          )}
        </div>
      ) : (
        <div className="archive-list">
          {players.map((p, idx) => (
            <div className={`archive-row ${p.username === user.username ? "self-row" : ""}`} key={p.username}>
              <span className="rank-num">#{idx + 1}</span>
              <div className="archive-main">
                <strong>@{p.username}</strong>
                <span>
                  {p.wins}W · {p.losses}L · {p.draws}D
                </span>
              </div>
              <span className="elo-badge">{p.rating}</span>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        className="button secondary full signout-btn"
        disabled={submitting}
        onClick={() => void signOut()}
      >
        <LogOut size={15} />
        Sign out
      </button>
    </div>
  );
}
