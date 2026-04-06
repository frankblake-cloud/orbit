import type { Express } from 'express';
import { createServer } from 'http';
import { storage } from './storage';
import {
  insertFriendSchema, insertInteractionSchema, insertReminderSchema,
  DEFAULT_CATEGORY_RULES, FriendCategory, CATEGORY_LABELS,
} from '@shared/schema';

// ── Gamification helpers ──────────────────────────────────────────────────────

const CATEGORY_WEIGHTS: Record<string, number> = {
  bff: 4,
  great_friend: 3,
  friend: 2,
  acquaintance: 1,
};

function calcOrbitScore(
  friends: any[],
  rules: Record<string, number>,
  now: Date
): number | null {
  if (friends.length === 0) return null;

  let weightedScore = 0;
  let totalWeight = 0;

  for (const f of friends) {
    const threshold = f.category
      ? (rules[f.category] ?? DEFAULT_CATEGORY_RULES[f.category as FriendCategory] ?? 14)
      : 14;
    const weight = CATEGORY_WEIGHTS[f.category ?? ''] ?? 1;

    let friendScore = 0;
    if (f.lastInteractionDate) {
      const daysSince = Math.floor(
        (now.getTime() - new Date(f.lastInteractionDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSince <= threshold) {
        friendScore = 1;
      } else {
        // Partial credit: decay linearly until 2× threshold
        friendScore = Math.max(0, 1 - (daysSince - threshold) / threshold);
      }
    }
    // Never contacted → score 0

    weightedScore += friendScore * weight;
    totalWeight += weight;
  }

  return Math.round((weightedScore / totalWeight) * 100);
}

function calcStreak(interactions: any[], now: Date): { current: number; longest: number } {
  if (interactions.length === 0) return { current: 0, longest: 0 };

  // Build a set of distinct dates with interactions
  const dateset = new Set(interactions.map((i) => i.date));

  const toStr = (d: Date) => d.toISOString().split('T')[0];

  const today = toStr(now);
  const yesterday = toStr(new Date(now.getTime() - 86400000));

  // Streak is alive if last interaction was today or yesterday
  const startDate = dateset.has(today)
    ? today
    : dateset.has(yesterday)
    ? yesterday
    : null;

  if (!startDate) return { current: 0, longest: 0 };

  // Count current streak backwards from startDate
  let current = 0;
  const check = new Date(startDate + 'T00:00:00Z');
  while (dateset.has(toStr(check))) {
    current++;
    check.setUTCDate(check.getUTCDate() - 1);
  }

  // Count longest streak
  const sorted = Array.from(dateset).sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + 'T00:00:00Z');
    const curr = new Date(sorted[i] + 'T00:00:00Z');
    const diff = (curr.getTime() - prev.getTime()) / 86400000;
    if (diff === 1) {
      run++;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }

  return { current, longest };
}

function calcBadges(data: {
  totalInteractions: number;
  totalFriends: number;
  streak: number;
  orbitScore: number | null;
  totalReminders: number;
  friendsWithBirthdays: number;
  hasBFF: boolean;
  allTiersRepresented: boolean;
}): Array<{ id: string; name: string; description: string; icon: string; unlocked: boolean }> {
  const { totalInteractions, totalFriends, streak, orbitScore, totalReminders, friendsWithBirthdays, hasBFF, allTiersRepresented } = data;

  return [
    {
      id: 'first_touch',
      name: 'First Touch',
      description: 'Log your first interaction',
      icon: '👋',
      unlocked: totalInteractions >= 1,
    },
    {
      id: 'bff_club',
      name: 'BFF Club',
      description: 'Add a BFF to your orbit',
      icon: '💜',
      unlocked: hasBFF,
    },
    {
      id: 'inner_circle',
      name: 'Inner Circle',
      description: 'Add 5 or more friends',
      icon: '🫂',
      unlocked: totalFriends >= 5,
    },
    {
      id: 'social_butterfly',
      name: 'Social Butterfly',
      description: 'Add 15 or more friends',
      icon: '🦋',
      unlocked: totalFriends >= 15,
    },
    {
      id: 'full_orbit',
      name: 'Full Orbit',
      description: 'Have friends in all 4 tiers',
      icon: '🪐',
      unlocked: allTiersRepresented,
    },
    {
      id: 'on_a_roll',
      name: 'On a Roll',
      description: '3-day interaction streak',
      icon: '🔥',
      unlocked: streak >= 3,
    },
    {
      id: 'week_streak',
      name: 'Week Streak',
      description: '7 days in a row',
      icon: '⚡',
      unlocked: streak >= 7,
    },
    {
      id: 'month_streak',
      name: 'Month Streak',
      description: '30 days in a row',
      icon: '🌙',
      unlocked: streak >= 30,
    },
    {
      id: 'orbit_star',
      name: 'Orbit Star',
      description: 'Reach an Orbit Score of 80+',
      icon: '⭐',
      unlocked: orbitScore !== null && orbitScore >= 80,
    },
    {
      id: 'perfect_orbit',
      name: 'Perfect Orbit',
      description: 'Reach a perfect 100 Orbit Score',
      icon: '✨',
      unlocked: orbitScore !== null && orbitScore >= 100,
    },
    {
      id: 'birthday_tracker',
      name: 'Birthday Tracker',
      description: 'Add birthdays for 3+ friends',
      icon: '🎂',
      unlocked: friendsWithBirthdays >= 3,
    },
    {
      id: 'planner',
      name: 'Planner',
      description: 'Set 3 or more reminders',
      icon: '🔔',
      unlocked: totalReminders >= 3,
    },
  ];
}

export function registerRoutes(httpServer: ReturnType<typeof createServer>, app: Express) {
  // ── Friends ──────────────────────────────────────────────────────────────
  app.get('/api/friends', (_req, res) => {
    const friends = storage.getFriends();
    const enriched = friends.map((f) => {
      const interactions = storage.getInteractions(f.id);
      return { ...f, lastInteractionDate: interactions[0]?.date ?? null };
    });
    res.json(enriched);
  });

  app.get('/api/friends/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const friend = storage.getFriend(id);
    if (!friend) return res.status(404).json({ message: 'Friend not found' });
    const interactions = storage.getInteractions(id);
    const reminders = storage.getReminders(id);
    res.json({ ...friend, interactions, reminders });
  });

  app.post('/api/friends', (req, res) => {
    const parsed = insertFriendSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(storage.createFriend(parsed.data));
  });

  app.patch('/api/friends/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const parsed = insertFriendSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = storage.updateFriend(id, parsed.data);
    if (!updated) return res.status(404).json({ message: 'Friend not found' });
    res.json(updated);
  });

  app.delete('/api/friends/:id', (req, res) => {
    storage.deleteFriend(parseInt(req.params.id));
    res.status(204).send();
  });

  // ── Interactions ─────────────────────────────────────────────────────────
  app.get('/api/interactions', (_req, res) => {
    const recent = storage.getRecentInteractions(20);
    const enriched = recent.map((i) => {
      const friend = storage.getFriend(i.friendId);
      return { ...i, friendName: friend?.name ?? 'Unknown' };
    });
    res.json(enriched);
  });

  app.post('/api/interactions', (req, res) => {
    const parsed = insertInteractionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const interaction = storage.createInteraction(parsed.data);

    if (req.body.reminder) {
      const { dueDate, note } = req.body.reminder;
      if (dueDate) {
        storage.createReminder({
          friendId: parsed.data.friendId,
          interactionId: interaction.id,
          dueDate,
          note: note ?? null,
          completed: 0,
        });
      }
    }

    res.status(201).json(interaction);
  });

  app.delete('/api/interactions/:id', (req, res) => {
    storage.deleteInteraction(parseInt(req.params.id));
    res.status(204).send();
  });

  // ── Reminders ─────────────────────────────────────────────────────────────
  app.get('/api/reminders', (_req, res) => {
    const reminders = storage.getPendingReminders();
    const enriched = reminders.map((r) => {
      const friend = storage.getFriend(r.friendId);
      return { ...r, friendName: friend?.name ?? 'Unknown', friendAvatarColor: friend?.avatarColor ?? '#7c5cbf' };
    });
    res.json(enriched);
  });

  app.post('/api/reminders', (req, res) => {
    const parsed = insertReminderSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(storage.createReminder(parsed.data));
  });

  app.patch('/api/reminders/:id/complete', (req, res) => {
    const updated = storage.completeReminder(parseInt(req.params.id));
    if (!updated) return res.status(404).json({ message: 'Reminder not found' });
    res.json(updated);
  });

  app.delete('/api/reminders/:id', (req, res) => {
    storage.deleteReminder(parseInt(req.params.id));
    res.status(204).send();
  });

  // ── Settings — Category Rules ─────────────────────────────────────────────
  app.get('/api/settings/category-rules', (_req, res) => {
    res.json(storage.getCategoryRules());
  });

  app.put('/api/settings/category-rules', (req, res) => {
    const rules = req.body as Record<string, number>;
    for (const [key, val] of Object.entries(rules)) {
      if (typeof val !== 'number' || val < 1) {
        return res.status(400).json({ message: `Invalid value for ${key}` });
      }
    }
    storage.setCategoryRules(rules);
    res.json(rules);
  });

  // ── Stats ─────────────────────────────────────────────────────────────────
  app.get('/api/stats', (_req, res) => {
    const friends = storage.getFriends();
    const allInteractions = storage.getInteractions();
    const pendingReminders = storage.getPendingReminders();
    const allReminders = storage.getReminders();
    const categoryRules = storage.getCategoryRules();

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
    const todayStr = now.toISOString().split('T')[0];

    const interactionsThisMonth = allInteractions.filter(
      (i) => i.date >= thirtyDaysAgoStr
    ).length;

    // Enrich friends with last interaction date
    const enrichedFriends = friends.map((f) => {
      const interactions = storage.getInteractions(f.id);
      return { ...f, lastInteractionDate: interactions[0]?.date ?? null };
    });

    // ── Orbit Score ────────────────────────────────────────────────────────
    const orbitScore = calcOrbitScore(enrichedFriends, categoryRules, now);

    // ── Streak ────────────────────────────────────────────────────────────
    const streak = calcStreak(allInteractions, now);

    // ── Category Progress ─────────────────────────────────────────────────
    const CATEGORY_ORDER = ['bff', 'great_friend', 'friend', 'acquaintance'] as const;
    const categoryProgress = CATEGORY_ORDER
      .map((cat) => {
        const inCategory = enrichedFriends.filter((f) => f.category === cat);
        if (inCategory.length === 0) return null;
        const threshold = categoryRules[cat] ?? DEFAULT_CATEGORY_RULES[cat];
        const thresholdDate = new Date(now.getTime() - threshold * 24 * 60 * 60 * 1000);
        const thresholdStr = thresholdDate.toISOString().split('T')[0];
        const onTrack = inCategory.filter(
          (f) => f.lastInteractionDate && f.lastInteractionDate >= thresholdStr
        ).length;
        return {
          category: cat,
          label: CATEGORY_LABELS[cat],
          total: inCategory.length,
          onTrack,
          frequencyDays: threshold,
        };
      })
      .filter(Boolean);

    // ── Needs Attention ────────────────────────────────────────────────────
    const DEFAULT_DAYS = 14;
    const needsAttention = enrichedFriends
      .map((f) => {
        const daysThreshold = f.category
          ? (categoryRules[f.category] ?? DEFAULT_CATEGORY_RULES[f.category as FriendCategory] ?? DEFAULT_DAYS)
          : DEFAULT_DAYS;
        return { ...f, daysThreshold };
      })
      .filter((f) => {
        if (!f.lastInteractionDate) return true;
        const thresholdDate = new Date(now.getTime() - f.daysThreshold * 24 * 60 * 60 * 1000);
        return f.lastInteractionDate < thresholdDate.toISOString().split('T')[0];
      })
      .sort((a, b) => {
        const aLast = a.lastInteractionDate ? new Date(a.lastInteractionDate).getTime() : 0;
        const bLast = b.lastInteractionDate ? new Date(b.lastInteractionDate).getTime() : 0;
        return aLast - bLast;
      });

    // ── Upcoming Birthdays ─────────────────────────────────────────────────
    const upcomingBirthdays = friends
      .filter((f) => {
        if (!f.birthday) return false;
        const bday = new Date(f.birthday);
        const thisYear = new Date(now.getFullYear(), bday.getMonth(), bday.getDate());
        const nextYear = new Date(now.getFullYear() + 1, bday.getMonth(), bday.getDate());
        const upcoming = thisYear >= now ? thisYear : nextYear;
        return upcoming.getTime() - now.getTime() <= 30 * 24 * 60 * 60 * 1000;
      })
      .map((f) => {
        const bday = new Date(f.birthday!);
        const thisYear = new Date(now.getFullYear(), bday.getMonth(), bday.getDate());
        const nextYear = new Date(now.getFullYear() + 1, bday.getMonth(), bday.getDate());
        const upcoming = thisYear >= now ? thisYear : nextYear;
        return { ...f, upcomingBirthday: upcoming.toISOString().split('T')[0] };
      })
      .sort((a, b) => a.upcomingBirthday.localeCompare(b.upcomingBirthday));

    // ── Badges ────────────────────────────────────────────────────────────
    const categoriesRepresented = new Set(
      friends.filter((f) => f.category).map((f) => f.category)
    );
    const badges = calcBadges({
      totalInteractions: allInteractions.length,
      totalFriends: friends.length,
      streak: streak.current,
      orbitScore,
      totalReminders: allReminders.length,
      friendsWithBirthdays: friends.filter((f) => f.birthday).length,
      hasBFF: friends.some((f) => f.category === 'bff'),
      allTiersRepresented: ['bff', 'great_friend', 'friend', 'acquaintance'].every(
        (cat) => categoriesRepresented.has(cat)
      ),
    });

    // Overdue reminders
    const overdueReminders = pendingReminders.filter((r) => r.dueDate <= todayStr);

    res.json({
      totalFriends: friends.length,
      interactionsThisMonth,
      overdueRemindersCount: overdueReminders.length,
      orbitScore,
      streak,
      categoryProgress,
      badges,
      needsAttention,
      upcomingBirthdays,
      categoryRules,
    });
  });
}
