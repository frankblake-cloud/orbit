import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FriendAvatar } from '@/components/friend-avatar';
import { LogInteractionDialog } from '@/components/log-interaction-dialog';
import { AddFriendDialog } from '@/components/add-friend-dialog';
import { RemindersCard } from '@/components/reminders-card';
import { CategoryBadge } from '@/components/category-badge';
import { CategoryRulesDialog } from '@/components/category-rules-dialog';
import { OrbitScore } from '@/components/orbit-score';
import { CategoryProgressCard } from '@/components/category-progress-card';
import { BadgesCard } from '@/components/badges-card';
import { useState } from 'react';
import {
  Users, MessageSquare, Phone, MapPin, Sparkles,
  Bell, Calendar, Plus, Clock, Settings2,
} from 'lucide-react';

interface CategoryProgressItem {
  category: string;
  label: string;
  total: number;
  onTrack: number;
  frequencyDays: number;
}

interface BadgeItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
}

interface StatsData {
  totalFriends: number;
  interactionsThisMonth: number;
  overdueRemindersCount: number;
  orbitScore: number | null;
  streak: { current: number; longest: number };
  categoryProgress: CategoryProgressItem[];
  badges: BadgeItem[];
  needsAttention: Array<{
    id: number;
    name: string;
    avatarColor: string;
    category: string | null;
    lastInteractionDate: string | null;
    daysThreshold: number;
  }>;
  upcomingBirthdays: Array<{
    id: number; name: string; avatarColor: string; birthday: string; upcomingBirthday: string;
  }>;
}

interface RecentInteraction {
  id: number;
  friendId: number;
  friendName: string;
  type: string;
  date: string;
  notes: string | null;
}

const INTERACTION_ICONS: Record<string, typeof MessageSquare> = {
  text: MessageSquare, call: Phone, irl: MapPin, other: Sparkles,
};

const INTERACTION_LABELS: Record<string, string> = {
  text: 'Text', call: 'Call', irl: 'In Person', other: 'Other',
};

function daysSince(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return `${diff}d ago`;
}

function formatUpcomingBirthday(upcomingBirthday: string): string {
  const upcoming = new Date(upcomingBirthday);
  const today = new Date();
  const diff = Math.ceil((upcoming.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const month = upcoming.toLocaleDateString('en-US', { month: 'short' });
  const day = upcoming.getDate();
  if (diff === 0) return 'Birthday today!';
  if (diff === 1) return `Tomorrow · ${month} ${day}`;
  return `In ${diff} days · ${month} ${day}`;
}

export default function Dashboard() {
  const [logOpen, setLogOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery<StatsData>({
    queryKey: ['/api/stats'],
  });

  const { data: recent = [], isLoading: recentLoading } = useQuery<RecentInteraction[]>({
    queryKey: ['/api/interactions'],
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Your Orbit</h1>
          <p className="text-muted-foreground text-sm mt-1">Keep your friendships close</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setLogOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Log Interaction
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Users className="w-4 h-4 mr-1.5" />
            Add Friend
          </Button>
        </div>
      </div>

      {/* ── Hero: Orbit Score ──────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <CardContent className="pt-6 pb-6">
          {statsLoading ? (
            <div className="flex items-center gap-6">
              <div className="skeleton w-[140px] h-[140px] rounded-full" />
              <div className="flex-1 space-y-3">
                <div className="skeleton h-4 w-24" />
                <div className="skeleton h-6 w-32" />
                <div className="skeleton h-14 w-20 rounded-xl" />
              </div>
            </div>
          ) : (
            <OrbitScore
              score={stats?.orbitScore ?? null}
              streak={stats?.streak ?? { current: 0, longest: 0 }}
            />
          )}
        </CardContent>
      </Card>

      {/* ── Stats Row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
                <Users className="w-4 h-4 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold font-display">
                  {statsLoading ? '—' : stats?.totalFriends ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">Total friends</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
                <Clock className="w-4 h-4 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold font-display">
                  {statsLoading ? '—' : stats?.interactionsThisMonth ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">This month</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Category Progress + Badges ────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <span className="text-base">📊</span>
              Tier Progress
              <button
                onClick={() => setRulesOpen(true)}
                className="ml-auto p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Edit check-in frequency"
              >
                <Settings2 className="w-3.5 h-3.5" />
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="skeleton h-3 w-1/3" />
                    <div className="skeleton h-2 w-full rounded-full" />
                  </div>
                ))}
              </div>
            ) : (
              <CategoryProgressCard data={stats?.categoryProgress ?? []} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <span className="text-base">🏅</span>
              Achievements
              {!statsLoading && stats?.badges && (
                <span className="ml-auto text-xs text-muted-foreground font-normal">
                  {stats.badges.filter((b) => b.unlocked).length}/{stats.badges.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="skeleton h-16 rounded-xl" />
                ))}
              </div>
            ) : (
              <BadgesCard badges={stats?.badges ?? []} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Reminders ────────────────────────────────────────────────────── */}
      <RemindersCard />

      {/* ── Needs Attention + Birthdays ───────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              Needs Attention
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {statsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="skeleton w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-1">
                      <div className="skeleton h-4 w-3/4" />
                      <div className="skeleton h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : stats?.needsAttention.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <div className="text-3xl mb-2">🎉</div>
                <p className="text-sm font-medium">You're all caught up!</p>
                <p className="text-xs mt-1">Great job staying in touch.</p>
              </div>
            ) : (
              stats?.needsAttention.slice(0, 6).map((f) => (
                <Link key={f.id} href={`/friends/${f.id}`}>
                  <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                    <FriendAvatar name={f.name} color={f.avatarColor} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium">{f.name}</p>
                        {f.category && <CategoryBadge category={f.category} />}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Last: {daysSince(f.lastInteractionDate)}
                        {f.category && (
                          <span className="text-muted-foreground/60"> · every {f.daysThreshold}d</span>
                        )}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Upcoming Birthdays
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {statsLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="skeleton w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-1">
                      <div className="skeleton h-4 w-3/4" />
                      <div className="skeleton h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : stats?.upcomingBirthdays.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <div className="text-3xl mb-2">📅</div>
                <p className="text-sm font-medium">No birthdays coming up</p>
                <p className="text-xs mt-1">Add birthdays when you add friends.</p>
              </div>
            ) : (
              stats?.upcomingBirthdays.map((f) => (
                <Link key={f.id} href={`/friends/${f.id}`}>
                  <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                    <FriendAvatar name={f.name} color={f.avatarColor} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{f.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatUpcomingBirthday(f.upcomingBirthday)}
                      </p>
                    </div>
                    <span className="text-lg">🎂</span>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Activity ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="skeleton w-8 h-8 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <div className="skeleton h-4 w-1/2" />
                    <div className="skeleton h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <div className="text-4xl mb-3">💬</div>
              <p className="text-sm font-medium">No interactions logged yet</p>
              <p className="text-xs mt-1 mb-4">Start logging to see your activity here.</p>
              <Button size="sm" onClick={() => setLogOpen(true)}>Log your first interaction</Button>
            </div>
          ) : (
            <div className="space-y-1">
              {recent.slice(0, 8).map((i) => {
                const Icon = INTERACTION_ICONS[i.type] ?? Sparkles;
                return (
                  <Link key={i.id} href={`/friends/${i.friendId}`}>
                    <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                      <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon className="w-3.5 h-3.5 text-accent-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{i.friendName}</span>
                          <Badge variant="outline" className="text-xs px-1.5 py-0">
                            {INTERACTION_LABELS[i.type] ?? i.type}
                          </Badge>
                        </div>
                        {i.notes && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{i.notes}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 mt-0.5">
                        {daysSince(i.date)}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <LogInteractionDialog open={logOpen} onOpenChange={setLogOpen} />
      <AddFriendDialog open={addOpen} onOpenChange={setAddOpen} />
      <CategoryRulesDialog open={rulesOpen} onOpenChange={setRulesOpen} />
    </div>
  );
}
