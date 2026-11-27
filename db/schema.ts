import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  rating: integer("rating").notNull().default(1200),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  draws: integer("draws").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const rooms = sqliteTable("rooms", {
  code: text("code").primaryKey(),
  white: text("white").notNull(),
  black: text("black"),
  whiteUserId: text("white_user_id"),
  blackUserId: text("black_user_id"),
  whiteName: text("white_name"),
  blackName: text("black_name"),
  archivedGame: integer("archived_game").notNull().default(0),
  state: text("state").notNull(),
  revision: integer("revision").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const games = sqliteTable("games", {
  id: text("id").primaryKey(),
  mode: text("mode").notNull(),
  roomCode: text("room_code"),
  whiteUserId: text("white_user_id"),
  blackUserId: text("black_user_id"),
  whiteName: text("white_name").notNull(),
  blackName: text("black_name").notNull(),
  timeControl: text("time_control").notNull().default("untimed"),
  moves: text("moves").notNull(),
  resultText: text("result_text").notNull(),
  winner: text("winner"),
  whiteRatingBefore: integer("white_rating_before"),
  whiteRatingAfter: integer("white_rating_after"),
  blackRatingBefore: integer("black_rating_before"),
  blackRatingAfter: integer("black_rating_after"),
  createdAt: integer("created_at").notNull(),
});
