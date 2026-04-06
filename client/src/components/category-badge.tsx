import { CATEGORY_CONFIG } from '@/lib/categories';
import type { FriendCategory } from '@shared/schema';

interface Props {
  category: string | null | undefined;
  size?: 'sm' | 'md';
}

export function CategoryBadge({ category, size = 'sm' }: Props) {
  if (!category) return null;
  const cfg = CATEGORY_CONFIG[category as FriendCategory];
  if (!cfg) return null;

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${cfg.color} ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
      }`}
    >
      {cfg.label}
    </span>
  );
}
