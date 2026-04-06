import { CATEGORY_CONFIG } from '@/lib/categories';
import type { FriendCategory } from '@shared/schema';

interface CategoryProgressItem {
  category: string;
  label: string;
  total: number;
  onTrack: number;
  frequencyDays: number;
}

interface Props {
  data: CategoryProgressItem[];
}

export function CategoryProgressCard({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <p className="text-sm">Assign tiers to friends to see progress here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.map((item) => {
        const cfg = CATEGORY_CONFIG[item.category as FriendCategory];
        const pct = item.total > 0 ? Math.round((item.onTrack / item.total) * 100) : 0;
        const allGood = item.onTrack === item.total;

        return (
          <div key={item.category}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg?.color ?? ''}`}
                >
                  {item.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  every {item.frequencyDays}d
                </span>
              </div>
              <span className="text-xs font-medium">
                <span className={allGood ? 'text-green-600 dark:text-green-400' : 'text-foreground'}>
                  {item.onTrack}/{item.total}
                </span>
                <span className="text-muted-foreground"> on track</span>
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  backgroundColor: allGood
                    ? '#5ca87c'
                    : pct >= 50
                    ? '#e09a5a'
                    : '#e07c7c',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
