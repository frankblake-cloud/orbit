import { Database } from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import BetterSqlite3 from 'better-sqlite3';
import * as schema from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import {
  Friend, InsertFriend, Interaction, InsertInteraction,
  Reminder, InsertReminder, DEFAULT_CATEGORY_RULES, FriendCategory,
} from '@shared/schema';

const sqlite: Database = new BetterSqlite3('orbit.db');
export const db = drizzle(sqlite, { schema });

// Create tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS friends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    nickname TEXT,
    phone TEXT,
    email TEXT,
    birthday TEXT,
    location TEXT,
    how_met TEXT,
    tags TEXT DEFAULT '[]',
    notes TEXT,
    avatar_color TEXT DEFAULT '#7c5cbf',
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    friend_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    date TEXT NOT NULL,
    notes TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    friend_id INTEGER NOT NULL,
    interaction_id INTEGER,
    due_date TEXT NOT NULL,
    note TEXT,
    completed INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Migrate: add category column if it doesn't exist
try {
  sqlite.exec(`ALTER TABLE friends ADD COLUMN category TEXT`);
} catch {
  // Column already exists — safe to ignore
}

export interface IStorage {
  // Friends
  getFriends(): Friend[];
  getFriend(id: number): Friend | undefined;
  createFriend(data: InsertFriend): Friend;
  updateFriend(id: number, data: Partial<InsertFriend>): Friend | undefined;
  deleteFriend(id: number): void;

  // Interactions
  getInteractions(friendId?: number): Interaction[];
  createInteraction(data: InsertInteraction): Interaction;
  deleteInteraction(id: number): void;
  getRecentInteractions(limit: number): Interaction[];

  // Reminders
  getReminders(friendId?: number): Reminder[];
  getPendingReminders(): Reminder[];
  createReminder(data: InsertReminder): Reminder;
  completeReminder(id: number): Reminder | undefined;
  deleteReminder(id: number): void;

  // Settings
  getCategoryRules(): Record<string, number>;
  setCategoryRules(rules: Record<string, number>): void;
}

class SqliteStorage implements IStorage {
  // ── Friends ────────────────────────────────────────────────────────────────
  getFriends(): Friend[] {
    return db.select().from(schema.friends).orderBy(desc(schema.friends.createdAt)).all();
  }

  getFriend(id: number): Friend | undefined {
    return db.select().from(schema.friends).where(eq(schema.friends.id, id)).get();
  }

  createFriend(data: InsertFriend): Friend {
    return db.insert(schema.friends).values(data).returning().get();
  }

  updateFriend(id: number, data: Partial<InsertFriend>): Friend | undefined {
    return db.update(schema.friends).set(data).where(eq(schema.friends.id, id)).returning().get();
  }

  deleteFriend(id: number): void {
    db.delete(schema.reminders).where(eq(schema.reminders.friendId, id)).run();
    db.delete(schema.interactions).where(eq(schema.interactions.friendId, id)).run();
    db.delete(schema.friends).where(eq(schema.friends.id, id)).run();
  }

  // ── Interactions ───────────────────────────────────────────────────────────
  getInteractions(friendId?: number): Interaction[] {
    if (friendId !== undefined) {
      return db.select().from(schema.interactions)
        .where(eq(schema.interactions.friendId, friendId))
        .orderBy(desc(schema.interactions.date))
        .all();
    }
    return db.select().from(schema.interactions).orderBy(desc(schema.interactions.date)).all();
  }

  createInteraction(data: InsertInteraction): Interaction {
    return db.insert(schema.interactions).values(data).returning().get();
  }

  deleteInteraction(id: number): void {
    db.delete(schema.reminders).where(eq(schema.reminders.interactionId, id)).run();
    db.delete(schema.interactions).where(eq(schema.interactions.id, id)).run();
  }

  getRecentInteractions(limit: number): Interaction[] {
    return db.select().from(schema.interactions)
      .orderBy(desc(schema.interactions.date))
      .limit(limit)
      .all();
  }

  // ── Reminders ──────────────────────────────────────────────────────────────
  getReminders(friendId?: number): Reminder[] {
    if (friendId !== undefined) {
      return db.select().from(schema.reminders)
        .where(eq(schema.reminders.friendId, friendId))
        .orderBy(schema.reminders.dueDate)
        .all();
    }
    return db.select().from(schema.reminders).orderBy(schema.reminders.dueDate).all();
  }

  getPendingReminders(): Reminder[] {
    return db.select().from(schema.reminders)
      .where(eq(schema.reminders.completed, 0))
      .orderBy(schema.reminders.dueDate)
      .all();
  }

  createReminder(data: InsertReminder): Reminder {
    return db.insert(schema.reminders).values(data).returning().get();
  }

  completeReminder(id: number): Reminder | undefined {
    return db.update(schema.reminders)
      .set({ completed: 1 })
      .where(eq(schema.reminders.id, id))
      .returning()
      .get();
  }

  deleteReminder(id: number): void {
    db.delete(schema.reminders).where(eq(schema.reminders.id, id)).run();
  }

  // ── Settings ───────────────────────────────────────────────────────────────
  getCategoryRules(): Record<string, number> {
    const row = sqlite
      .prepare("SELECT value FROM settings WHERE key = 'category_rules'")
      .get() as { value: string } | undefined;
    if (!row) return { ...DEFAULT_CATEGORY_RULES };
    try {
      return JSON.parse(row.value);
    } catch {
      return { ...DEFAULT_CATEGORY_RULES };
    }
  }

  setCategoryRules(rules: Record<string, number>): void {
    sqlite
      .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('category_rules', ?)")
      .run(JSON.stringify(rules));
  }
}

export const storage = new SqliteStorage();
