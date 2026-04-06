import type { FriendCategory } from '@shared/schema';

export const CATEGORY_CONFIG: Record<FriendCategory, {
  label: string;
  defaultDays: number;
  color: string;        // tailwind classes for badge
  bgColor: string;      // tailwind classes for selector button (selected state)
}> = {
  bff: {
    label: 'BFF',
    defaultDays: 2,
    color: 'bg-primary/15 text-primary border border-primary/30',
    bgColor: 'bg-primary text-primary-foreground',
  },
  great_friend: {
    label: 'Great Friend',
    defaultDays: 7,
    color: 'bg-pink-500/15 text-pink-600 dark:text-pink-400 border border-pink-400/30',
    bgColor: 'bg-pink-500 text-white',
  },
  friend: {
    label: 'Friend',
    defaultDays: 14,
    color: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-400/30',
    bgColor: 'bg-sky-500 text-white',
  },
  acquaintance: {
    label: 'Acquaintance',
    defaultDays: 30,
    color: 'bg-muted text-muted-foreground border border-border',
    bgColor: 'bg-muted-foreground text-background',
  },
};

export const CATEGORY_ORDER: FriendCategory[] = ['bff', 'great_friend', 'friend', 'acquaintance'];
