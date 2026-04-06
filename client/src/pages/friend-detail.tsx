import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FriendAvatar } from '@/components/friend-avatar';
import { LogInteractionDialog } from '@/components/log-interaction-dialog';
import { EditFriendDialog } from '@/components/edit-friend-dialog';
import { RemindersCard } from '@/components/reminders-card';
import { CategoryBadge } from '@/components/category-badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  MapPin, Phone, Mail, Calendar, Heart, MessageSquare,
  Phone as PhoneIcon, Sparkles, Trash2, Edit, Plus, ChevronLeft,
} from 'lucide-react';
import { Interaction } from '@shared/schema';

interface FriendWithInteractions {
  id: number;
  name: string;
  nickname: string | null;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  location: string | null;
  howMet: string | null;
  tags: string;
  notes: string | null;
  avatarColor: string;
  category: string | null;
  interactions: Interaction[];
}

const INTERACTION_ICONS: Record<string, typeof MessageSquare> = {
  text: MessageSquare, call: PhoneIcon, irl: MapPin, other: Sparkles,
};

const INTERACTION_LABELS: Record<string, string> = {
  text: 'Text / DM', call: 'Call', irl: 'In Person', other: 'Other',
};

const INTERACTION_COLORS: Record<string, string> = {
  text: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  call: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  irl: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  other: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatBirthday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function ageFromBirthday(dateStr: string): number {
  const birth = new Date(dateStr);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export default function FriendDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [logOpen, setLogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: friend, isLoading } = useQuery<FriendWithInteractions>({
    queryKey: ['/api/friends', parseInt(id!)],
    queryFn: () => apiRequest('GET', `/api/friends/${id}`).then((r) => r.json()),
  });

  const deleteInteraction = useMutation({
    mutationFn: (interactionId: number) => apiRequest('DELETE', `/api/interactions/${interactionId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/friends', parseInt(id!)] });
      qc.invalidateQueries({ queryKey: ['/api/interactions'] });
      qc.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({ title: 'Interaction removed' });
    },
  });

  const deleteFriend = useMutation({
    mutationFn: () => apiRequest('DELETE', `/api/friends/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/friends'] });
      qc.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({ title: 'Friend removed from orbit' });
      navigate('/friends');
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <div className="skeleton w-20 h-20 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-6 w-48" />
            <div className="skeleton h-4 w-32" />
          </div>
        </div>
        <div className="skeleton h-32 w-full rounded-xl" />
        <div className="skeleton h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!friend) {
    return (
      <div className="p-6 text-center py-20 text-muted-foreground">
        <p>Friend not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/friends')}>Back to friends</Button>
      </div>
    );
  }

  const tags = (() => { try { return JSON.parse(friend.tags ?? '[]') as string[]; } catch { return []; } })();

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/friends')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        data-testid="button-back"
      >
        <ChevronLeft className="w-4 h-4" />
        Friends
      </button>

      {/* Profile Header */}
      <div className="flex items-start gap-5">
        <FriendAvatar name={friend.name} color={friend.avatarColor} size="xl" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-2xl font-bold">{friend.name}</h1>
            {friend.category && <CategoryBadge category={friend.category} size="md" />}
          </div>
          {friend.nickname && (
            <p className="text-muted-foreground text-sm">"{friend.nickname}"</p>
          )}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary">{tag}</Badge>
            ))}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button size="icon" variant="outline" onClick={() => setEditOpen(true)} data-testid="button-edit-friend">
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={() => setDeleteOpen(true)}
            className="text-destructive border-destructive/40 hover:bg-destructive hover:text-white"
            data-testid="button-delete-friend"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card>
        <CardContent className="pt-5">
          <div className="grid sm:grid-cols-2 gap-4">
            {friend.phone && (
              <div className="flex items-center gap-2.5 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Phone</p>
                  <a href={`tel:${friend.phone}`} className="hover:text-primary transition-colors">{friend.phone}</a>
                </div>
              </div>
            )}
            {friend.email && (
              <div className="flex items-center gap-2.5 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Email</p>
                  <a href={`mailto:${friend.email}`} className="hover:text-primary transition-colors truncate block max-w-[200px]">{friend.email}</a>
                </div>
              </div>
            )}
            {friend.location && (
              <div className="flex items-center gap-2.5 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Location</p>
                  <p>{friend.location}</p>
                </div>
              </div>
            )}
            {friend.birthday && (
              <div className="flex items-center gap-2.5 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Birthday</p>
                  <p>{formatBirthday(friend.birthday)} · Age {ageFromBirthday(friend.birthday)}</p>
                </div>
              </div>
            )}
            {friend.howMet && (
              <div className="flex items-center gap-2.5 text-sm">
                <Heart className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">How you met</p>
                  <p>{friend.howMet}</p>
                </div>
              </div>
            )}
          </div>

          {friend.notes && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-1">Notes</p>
              <p className="text-sm whitespace-pre-wrap">{friend.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reminders for this friend */}
      <RemindersCard friendId={friend.id} title="Follow-up Reminders" />

      {/* Interaction History */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">
              Interaction History ({friend.interactions.length})
            </CardTitle>
            <Button size="sm" onClick={() => setLogOpen(true)} data-testid="button-log-interaction-detail">
              <Plus className="w-4 h-4 mr-1.5" />
              Log
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {friend.interactions.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No interactions logged yet</p>
              <p className="text-xs mt-1 mb-4">Track a text, call, or hangout.</p>
              <Button size="sm" onClick={() => setLogOpen(true)}>Log First Interaction</Button>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-4 bottom-4 w-px bg-border" />

              <div className="space-y-4">
                {friend.interactions.map((interaction) => {
                  const Icon = INTERACTION_ICONS[interaction.type] ?? Sparkles;
                  const colorClass = INTERACTION_COLORS[interaction.type] ?? INTERACTION_COLORS.other;
                  return (
                    <div key={interaction.id} className="flex gap-4 relative" data-testid={`interaction-${interaction.id}`}>
                      {/* Icon bubble */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${colorClass}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 bg-muted/40 rounded-lg p-3 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-sm font-medium">
                              {INTERACTION_LABELS[interaction.type] ?? interaction.type}
                            </span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {formatDate(interaction.date)}
                            </span>
                          </div>
                          <button
                            onClick={() => deleteInteraction.mutate(interaction.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                            aria-label="Delete interaction"
                            data-testid={`button-delete-interaction-${interaction.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {interaction.notes && (
                          <p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-wrap">{interaction.notes}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Remove from Orbit CTA */}
      <div className="pt-2">
        <Button
          variant="outline"
          className="w-full text-destructive border-destructive/40 hover:bg-destructive hover:text-white"
          onClick={() => setDeleteOpen(true)}
          data-testid="button-remove-friend-bottom"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Remove {friend.name} from Orbit
        </Button>
      </div>

      {/* Dialogs */}
      <LogInteractionDialog
        open={logOpen}
        onOpenChange={setLogOpen}
        preselectedFriendId={friend.id}
      />
      <EditFriendDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        friend={friend}
      />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {friend.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete {friend.name} and all their interaction history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteFriend.mutate()}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
