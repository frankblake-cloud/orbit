import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AddHabitDialog } from '@/components/add-habit-dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Flame } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface HabitHistory {
  date: string;
  completed: boolean;
}

interface HabitWithStats {
  id: number;
  name: string;
  emoji: string;
  color: string;
  completedToday: boolean;
  streak: number;
  history: HabitHistory[];
}

function formatDay(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1);
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().split('T')[0];
}

export default function Habits() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: habits = [], isLoading } = useQuery<HabitWithStats[]>({
    queryKey: ['/api/habits'],
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, date }: { id: number; date: string }) => {
      const res = await fetch(`/api/habits/${id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      });
      if (!res.ok) throw new Error('Toggle failed');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/habits'] }),
    onError: () => toast({ title: 'Failed to update habit', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/habits/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/habits'] });
      toast({ title: 'Habit deleted' });
      setDeleteId(null);
    },
    onError: () => toast({ title: 'Failed to delete habit', variant: 'destructive' }),
  });

  const today = new Date().toISOString().split('T')[0];
  const completedCount = habits.filter((h) => h.completedToday).length;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Daily Habits</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isLoading
              ? 'Loading…'
              : habits.length === 0
              ? 'No habits yet — add one to get started'
              : `${completedCount} of ${habits.length} done today`}
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          Add Habit
        </Button>
      </div>

      {/* Progress bar */}
      {habits.length > 0 && (
        <div className="w-full bg-accent rounded-full h-2 overflow-hidden">
          <div
            className="h-2 rounded-full transition-all duration-500"
            style={{
              width: `${Math.round((completedCount / habits.length) * 100)}%`,
              backgroundColor: 'hsl(var(--primary))',
            }}
          />
        </div>
      )}

      {/* Habit list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      ) : habits.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-muted-foreground">
            <div className="text-5xl mb-3">🌱</div>
            <p className="text-sm font-medium">Start building habits</p>
            <p className="text-xs mt-1 mb-5">Track your daily routines and build streaks.</p>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Add your first habit
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {habits.map((habit) => (
            <Card
              key={habit.id}
              className={`transition-all duration-200 ${
                habit.completedToday ? 'opacity-80' : ''
              }`}
            >
              <CardContent className="py-4 px-5">
                <div className="flex items-center gap-4">
                  {/* Complete button */}
                  <button
                    onClick={() => toggleMutation.mutate({ id: habit.id, date: today })}
                    disabled={toggleMutation.isPending}
                    className="flex-shrink-0 w-11 h-11 rounded-full border-2 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
                    style={{
                      borderColor: habit.completedToday ? habit.color : undefined,
                      backgroundColor: habit.completedToday ? habit.color : undefined,
                    }}
                    title={habit.completedToday ? 'Mark incomplete' : 'Mark complete'}
                  >
                    {habit.completedToday ? (
                      <span className="text-white text-lg">{habit.emoji}</span>
                    ) : (
                      <span className="text-muted-foreground text-lg">{habit.emoji}</span>
                    )}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-medium text-sm ${
                          habit.completedToday ? 'line-through text-muted-foreground' : ''
                        }`}
                      >
                        {habit.name}
                      </span>
                      {habit.streak > 0 && (
                        <span className="flex items-center gap-0.5 text-xs font-semibold text-orange-500">
                          <Flame className="w-3 h-3" />
                          {habit.streak}
                        </span>
                      )}
                    </div>

                    {/* 7-day history */}
                    <div className="flex gap-1 mt-2">
                      {habit.history.map(({ date, completed }) => (
                        <div key={date} className="flex flex-col items-center gap-1">
                          <div
                            className="w-6 h-6 rounded-md flex items-center justify-center text-xs"
                            style={
                              completed
                                ? { backgroundColor: habit.color, color: '#fff' }
                                : isToday(date)
                                ? { border: `2px solid ${habit.color}`, backgroundColor: 'transparent' }
                                : { backgroundColor: 'hsl(var(--accent))' }
                            }
                          >
                            {completed ? '✓' : ''}
                          </div>
                          <span className="text-[9px] text-muted-foreground leading-none">
                            {formatDay(date)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => setDeleteId(habit.id)}
                    className="flex-shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Delete habit"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddHabitDialog open={addOpen} onOpenChange={setAddOpen} />

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete habit?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the habit and all its completion history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
