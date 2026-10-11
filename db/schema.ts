import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const rooms = sqliteTable("rooms", {
  code: text("code").primaryKey(),
  white: text("white").notNull(),
  black: text("black"),
  state: text("state").notNull(),
  revision: integer("revision").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
