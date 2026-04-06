interface Props {
  score: number | null;
  streak: { current: number; longest: number };
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#5ca87c';   // green
  if (score >= 50) return '#e09a5a';   // amber
  return '#e07c7c';                     // red
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Thriving';
  if (score >= 75) return 'Strong';
  if (score >= 55) return 'Good';
  if (score >= 35) return 'Fading';
  return 'Neglected';
}

export function OrbitScore({ score, streak }: Props) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const safeScore = score ?? 0;
  const offset = circumference * (1 - safeScore / 100);
  const color = score !== null ? getScoreColor(safeScore) : '#a0a0a0';

  return (
    <div className="flex items-center gap-6">
      {/* Circular gauge */}
      <div className="relative flex-shrink-0">
        <svg width="140" height="140" viewBox="0 0 120 120">
          {/* Track */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            className="text-muted/30"
          />
          {/* Progress */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={score !== null ? offset : circumference}
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s ease' }}
          />
        </svg>
        {/* Score number in center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {score !== null ? (
            <>
              <span className="text-3xl font-bold font-display leading-none" style={{ color }}>
                {safeScore}
              </span>
              <span className="text-xs text-muted-foreground mt-0.5">/ 100</span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground text-center px-2 leading-tight">
              Add friends to unlock
            </span>
          )}
        </div>
      </div>

      {/* Right side info */}
      <div className="flex-1 space-y-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-0.5">Orbit Score</p>
          {score !== null ? (
            <p className="text-xl font-bold font-display" style={{ color }}>
              {getScoreLabel(safeScore)}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Set tiers on friends to activate</p>
          )}
        </div>

        {/* Streak */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center bg-accent rounded-xl px-4 py-2 min-w-[60px]">
            <span className="text-2xl leading-none">🔥</span>
            <span className="text-xl font-bold font-display leading-tight mt-0.5">{streak.current}</span>
            <span className="text-xs text-muted-foreground">streak</span>
          </div>
          {streak.longest > 0 && streak.longest > streak.current && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{streak.longest}</span>
              <br />best ever
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
