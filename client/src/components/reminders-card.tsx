import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FriendAvatar } from './friend-avatar';
import { Bell, Check, Trash2, Plus } from 'lucide-react';
import { useState } from 'react';
import { LogInteractionDialog } from './log-interaction-dialog';

interface ReminderRow {
  id: number;
  friendId: number;
  friendName: string;
  friendAvatarColor: string;
  dueDate: string;
  note: string | null;
  completed: number;
}

function dueDateLabel(dueDate: string): { label: string; urgent: boolean } {
  const today = new Date().toISOString().split('T')[0];
  const diff = Math.ceil(
    (new Date(dueDate + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) /
    (1000 * 60 * 60 * 24)
  );
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, urgent: true };
  if (diff === 0) return { label: 'Due today', urgent: true };
  if (diff === 1) return { label: 'Due tomorrow', urgent: false };
  if (diff < 7) return { label: `In ${diff} days`, urgent: false };
  const d = new Date(dueDate + 'T00:00:00');
  return { label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), urgent: false };
}

interface Props {
  /** If set, only show reminders for this friend */
  friendId?: number;
  /** Title override */
  title?: string;
}

export function RemindersCard({ friendId, title = 'Follow-up Reminders' }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [logOpen, setLogOpen] = useState(false);

  const { data: reminders = [], isLoading } = useQuery<ReminderRow[]>({
    queryKey: friendId ? ['/api/friends', friendId, 'reminders'] : ['/api/reminders'],
    queryFn: () =>
      apiRequest('GET', friendId ? `/api/friends/${friendId}` : '/api/reminders')
        .then((r) => r.json())
        .then((data) => {
          if (friendId) {
            // Friend detail returns { reminders: [...] }
            return (data.reminders ?? [])
              .filter((r: any) => r.completed === 0)
              .map((r: any) => ({
                ...r,
                friendName: data.name,
                friendAvatarColor: data.avatarColor,
              }));
          }
          return data;
        }),
  });

  const completeMutation = useMutation({
    mutationFn: (id: number) => apiRequest('PATCH', `/api/reminders/${id}/complete`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/reminders'] });
      qc.invalidateQueries({ queryKey: ['/api/stats'] });
      if (friendId) qc.invalidateQueries({ queryKey: ['/api/friends', friendId, 'reminders'] });
      toast({ title: 'Marked as done!' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/reminders/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/reminders'] });
      qc.invalidateQueries({ queryKey: ['/api/stats'] });
      if (friendId) qc.invalidateQueries({ queryKey: ['/api/friends', friendId, 'reminders'] });
    },
  });

  if (!isLoading && reminders.length === 0) return null;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              {title}
              {reminders.length > 0 && (
                <Badge variant="secondary" className="text-xs">{reminders.length}</Badge>
              )}
            </CardTitle>
            {friendId && (
              <Button size="sm" variant="outline" onClick={() => setLogOpen(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="skeleton w-8 h-8 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <div className="skeleton h-4 w-1/2" />
                    <div className="skeleton h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            reminders.map((r) => {
              const { label, urgent } = dueDateLabel(r.dueDate);
              return (
                <div
                  key={r.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                    urgent
                      ? 'border-destructive/30 bg-destructive/5'
                      : 'border-border bg-muted/30'
                  }`}
                  data-testid={`reminder-${r.id}`}
                >
                  {/* Avatar / link — only when shown on Dashboard (not friend detail) */}
                  {!friendId ? (
                    <Link href={`/friends/${r.friendId}`}>
                      <FriendAvatar name={r.friendName} color={r.friendAvatarColor} size="sm" />
                    </Link>
                  ) : (
                    <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 bg-primary" />
                  )}

                  <div className="flex-1 min-w-0">
                    {!friendId && (
                      <Link href={`/friends/${r.friendId}`}>
                        <p className="text-sm font-medium hover:text-primary transition-colors">
                          {r.friendName}
                        </p>
                      </Link>
                    )}
                    {r.note && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.note}</p>
                    )}
                    <p className={`text-xs mt-1 font-medium ${urgent ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {label}
                    </p>
                  </div>

                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-green-600"
                      onClick={() => completeMutation.mutate(r.id)}
                      disabled={completeMutation.isPending}
                      aria-label="Mark done"
                      data-testid={`button-complete-reminder-${r.id}`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMutation.mutate(r.id)}
                      disabled={deleteMutation.isPending}
                      aria-label="Delete reminder"
                      data-testid={`button-delete-reminder-${r.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {friendId && (
        <LogInteractionDialog
          open={logOpen}
          onOpenChange={setLogOpen}
          preselectedFriendId={friendId}
        />
      )}
    </>
  );
}
