import { relations } from "drizzle-orm";
import { boolean, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["user", "admin"]);

export const userTable = pgTable("user", {
  id: text("id").primaryKey(),
  email: text("email").unique(),
  isEmailVerified: boolean("is_email_verified").notNull().default(false),
  hashedPassword: text("hashed_password"),
  name: text("name"),
  profilePictureUrl: text("profile_picture_url"),
  role: roleEnum("role").notNull().default("user"),
});

export const emailVerificationTable = pgTable("email_verification", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
});

export const emailVerificationTablesRelations = relations(
  emailVerificationTable,
  ({ one }) => ({
    user: one(userTable, {
      fields: [emailVerificationTable.userId],
      references: [userTable.id],
    }),
  })
);

export const sessionTable = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
});

export const sessionTableRelations = relations(sessionTable, ({ one }) => ({
  user: one(userTable, {
    fields: [sessionTable.userId],
    references: [userTable.id],
  }),
}));

export const providerEnum = pgEnum("provider", ["google", "github"]);

export const oauthAccountTable = pgTable("oauth_account", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
  provider: providerEnum("provider").notNull(),
  providerUserId: text("provider_user_id").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
    mode: "date",
  }),
});

export const oauthAccountTableRelations = relations(
  oauthAccountTable,
  ({ one }) => ({
    user: one(userTable, {
      fields: [oauthAccountTable.userId],
      references: [userTable.id],
    }),
  })
);
