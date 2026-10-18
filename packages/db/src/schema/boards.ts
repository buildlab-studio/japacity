// city:boards-switch-when-and-who, city:board-line-and-ranking: one row of board figures per character, gone with
// the character (account:deleted-data-removed-within-month). `week_start` is the figure when `week` began.
import { sql } from "drizzle-orm";
import { bigint, boolean, index, integer, pgTable, text } from "drizzle-orm/pg-core";

import { characters } from "./characters";

export const boardFigures = pgTable(
  "board_figures",
  {
    character: text("character")
      .primaryKey()
      .references(() => characters.id, { onDelete: "cascade" }),
    account: text("account").notNull(),
    scenario: text("scenario").notNull(),
    joinedAt: bigint("joined_at", { mode: "number" }).notNull(),
    joinedWeek: integer("joined_week").notNull(),
    listed: boolean("listed").notNull(),
    v: integer("v").notNull(),
    figure: integer("figure"),
    week: integer("week").notNull(),
    weekStart: integer("week_start"),
  },
  (table) => [
    index("board_figures_figure_idx").on(table.figure.desc(), table.joinedAt, table.character).where(sql`${table.listed} and ${table.figure} is not null`),
    index("board_figures_week_idx").on(table.week),
    index("board_figures_account_idx").on(table.account),
    index("board_figures_joined_week_idx").on(table.joinedWeek),
  ],
);
