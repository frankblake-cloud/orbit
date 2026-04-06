import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { sql } from 'drizzle-orm';

// ── Categories ───────────────────────────────────────────────────────────────
export const FRIEND_CATEGORIES = ['bff', 'great_friend', 'friend', 'acquaintance'] as const;
export type FriendCategory = typeof FRIEND_CATEGORIES[number];

export const CATEGORY_LABELS: Record<FriendCategory, string> = {
  bff: 'BFF',
  great_friend: 'Great Friend',
  friend: 'Friend',
  acquaintance: 'Acquaintance',
};

export const DEFAULT_CATEGORY_RULES: Record<FriendCategory, number> = {
  bff: 2,
  great_friend: 7,
  friend: 14,
  acquaintance: 30,
};

// ── Friends ─────────────────────────────────────────────────────────────────
export const friends = sqliteTable('friends', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  nickname: text('nickname'),
  phone: text('phone'),
  email: text('email'),
  birthday: text('birthday'),          // YYYY-MM-DD
  location: text('location'),
  howMet: text('how_met'),
  tags: text('tags').default('[]'),    // JSON string[]
  notes: text('notes'),
  avatarColor: text('avatar_color').default('#7c5cbf'),
  category: text('category'),          // FriendCategory | null
  createdAt: integer('created_at').default(sql`(unixepoch())`),
});

export const insertFriendSchema = createInsertSchema(friends).omit({ id: true, createdAt: true });
export type InsertFriend = z.infer<typeof insertFriendSchema>;
export type Friend = typeof friends.$inferSelect;

// ── Interactions ─────────────────────────────────────────────────────────────
export const interactions = sqliteTable('interactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  friendId: integer('friend_id').notNull(),
  type: text('type').notNull(),        // 'text' | 'call' | 'irl' | 'other'
  date: text('date').notNull(),        // YYYY-MM-DD
  notes: text('notes'),
  createdAt: integer('created_at').default(sql`(unixepoch())`),
});

export const insertInteractionSchema = createInsertSchema(interactions).omit({ id: true, createdAt: true });
export type InsertInteraction = z.infer<typeof insertInteractionSchema>;
export type Interaction = typeof interactions.$inferSelect;

// ── Reminders ────────────────────────────────────────────────────────────────
export const reminders = sqliteTable('reminders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  friendId: integer('friend_id').notNull(),
  interactionId: integer('interaction_id'),   // optional — which interaction spawned it
  dueDate: text('due_date').notNull(),        // YYYY-MM-DD
  note: text('note'),
  completed: integer('completed').default(0), // 0 = pending, 1 = done
  createdAt: integer('created_at').default(sql`(unixepoch())`),
});

export const insertReminderSchema = createInsertSchema(reminders).omit({ id: true, createdAt: true });
export type InsertReminder = z.infer<typeof insertReminderSchema>;
export type Reminder = typeof reminders.$inferSelect;

// ── Settings ─────────────────────────────────────────────────────────────────
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
