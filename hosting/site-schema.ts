import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const spawnerPlayers = sqliteTable("spawner_players", {
  token: text("token").primaryKey(),
  id: text("id").notNull().unique(),
  name: text("name").notNull(),
  roomId: text("room_id"),
});

export const spawnerRooms = sqliteTable("spawner_rooms", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  hostId: text("host_id").notNull(),
  seed: integer("seed").notNull(),
  members: text("members").notNull(),
  state: text("state").notNull(),
  revision: integer("revision").notNull().default(0),
});

export const spawnerRequests = sqliteTable("spawner_requests", {
  id: text("id").primaryKey(),
  token: text("token").notNull(),
  result: text("result").notNull(),
  createdAt: integer("created_at").notNull(),
});
