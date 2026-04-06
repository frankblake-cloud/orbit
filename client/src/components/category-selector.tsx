import { CATEGORY_CONFIG, CATEGORY_ORDER } from '@/lib/categories';
import type { FriendCategory } from '@shared/schema';

interface Props {
  value: string | null | undefined;
  onChange: (category: FriendCategory | null) => void;
}

export function CategorySelector({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORY_ORDER.map((cat) => {
        const cfg = CATEGORY_CONFIG[cat];
        const selected = value === cat;
        return (
          <button
            key={cat}
            type="button"
            onClick={() => onChange(selected ? null : cat)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
              selected
                ? `${cfg.bgColor} border-transparent shadow-sm`
                : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground'
            }`}
          >
            {cfg.label}
          </button>
        );
      })}
    </div>
  );
}
