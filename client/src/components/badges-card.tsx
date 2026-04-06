interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
}

interface Props {
  badges: Badge[];
}

export function BadgesCard({ badges }: Props) {
  const unlocked = badges.filter((b) => b.unlocked);
  const locked = badges.filter((b) => !b.unlocked);

  return (
    <div>
      {unlocked.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">
            Earned · {unlocked.length}/{badges.length}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {unlocked.map((badge) => (
              <BadgeTile key={badge.id} badge={badge} />
            ))}
          </div>
        </div>
      )}

      {locked.length > 0 && (
        <div>
          {unlocked.length > 0 && (
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">
              Locked
            </p>
          )}
          <div className="grid grid-cols-4 gap-2">
            {locked.map((badge) => (
              <BadgeTile key={badge.id} badge={badge} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BadgeTile({ badge }: { badge: Badge }) {
  return (
    <div
      className={`flex flex-col items-center gap-1 p-2 rounded-xl text-center transition-all ${
        badge.unlocked
          ? 'bg-accent'
          : 'bg-muted/40 opacity-40 grayscale'
      }`}
      title={badge.description}
    >
      <span className="text-2xl leading-none">{badge.icon}</span>
      <span className="text-[10px] font-medium leading-tight text-foreground line-clamp-2">
        {badge.name}
      </span>
    </div>
  );
}
