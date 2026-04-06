import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FriendAvatar } from '@/components/friend-avatar';
import { AddFriendDialog } from '@/components/add-friend-dialog';
import { CategoryBadge } from '@/components/category-badge';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Search, Plus, MapPin, Phone, Mail, Users, BookUser, Loader2 } from 'lucide-react';

const AVATAR_COLORS = [
  '#7c5cbf', '#d97bb6', '#e07c7c', '#e09a5a', '#5ca87c', '#5c90bf',
];

// Detect Contact Picker API support
const contactPickerSupported =
  typeof navigator !== 'undefined' &&
  'contacts' in navigator &&
  'ContactsManager' in window;

interface FriendWithLast {
  id: number;
  name: string;
  nickname: string | null;
  phone: string | null;
  email: string | null;
  location: string | null;
  birthday: string | null;
  tags: string;
  avatarColor: string;
  category: string | null;
  lastInteractionDate: string | null;
}

function daysSince(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 30) return `${diff}d ago`;
  if (diff < 365) return `${Math.floor(diff / 30)}mo ago`;
  return `${Math.floor(diff / 365)}y ago`;
}

function getStatusColor(dateStr: string | null) {
  if (!dateStr) return 'text-destructive';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  if (diff <= 14) return 'text-green-600 dark:text-green-400';
  if (diff <= 30) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-destructive';
}

export default function FriendsList() {
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: friends = [], isLoading } = useQuery<FriendWithLast[]>({
    queryKey: ['/api/friends'],
  });

  const addMutation = useMutation({
    mutationFn: (data: object) => apiRequest('POST', '/api/friends', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/friends'] });
      qc.invalidateQueries({ queryKey: ['/api/stats'] });
    },
  });

  async function bulkImportFromContacts() {
    if (!contactPickerSupported) return;
    setImporting(true);
    try {
      // @ts-ignore — Contact Picker API not yet in TS lib
      const contacts = await navigator.contacts.select(
        ['name', 'tel', 'email'],
        { multiple: true }
      );
      if (!contacts || contacts.length === 0) {
        setImporting(false);
        return;
      }

      let added = 0;
      let skipped = 0;

      for (const contact of contacts) {
        const fullName = Array.isArray(contact.name) ? contact.name[0] ?? '' : contact.name ?? '';
        if (!fullName.trim()) { skipped++; continue; }

        const phone = Array.isArray(contact.tel) ? contact.tel[0] ?? '' : contact.tel ?? '';
        const email = Array.isArray(contact.email) ? contact.email[0] ?? '' : contact.email ?? '';

        // Pick a color based on name initial
        const colorIdx = fullName.charCodeAt(0) % AVATAR_COLORS.length;

        await addMutation.mutateAsync({
          name: fullName,
          phone: phone || null,
          email: email || null,
          avatarColor: AVATAR_COLORS[colorIdx],
          tags: '[]',
        });
        added++;
      }

      qc.invalidateQueries({ queryKey: ['/api/friends'] });
      qc.invalidateQueries({ queryKey: ['/api/stats'] });

      if (added > 0) {
        toast({
          title: `${added} friend${added > 1 ? 's' : ''} added to your orbit!`,
          description: skipped > 0 ? `${skipped} contacts skipped (no name).` : undefined,
        });
      } else {
        toast({ title: 'No contacts were added.', variant: 'destructive' });
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        toast({ title: 'Could not access contacts', variant: 'destructive' });
      }
    } finally {
      setImporting(false);
    }
  }

  const filtered = friends.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    (f.nickname ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (f.location ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold">Friends</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {friends.length} {friends.length === 1 ? 'person' : 'people'} in your orbit
          </p>
        </div>
        <div className="flex items-center gap-2">
          {contactPickerSupported && (
            <Button
              variant="outline"
              size="sm"
              onClick={bulkImportFromContacts}
              disabled={importing}
              data-testid="button-bulk-import"
            >
              {importing ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <BookUser className="w-4 h-4 mr-1.5" />
              )}
              {importing ? 'Importing...' : 'Import Contacts'}
            </Button>
          )}
          <Button size="sm" onClick={() => setAddOpen(true)} data-testid="button-add-friend-list">
            <Plus className="w-4 h-4 mr-1.5" />
            Add Friend
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-9"
          placeholder="Search by name, nickname, or location..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-search-friends"
        />
      </div>

      {/* Mobile import hint (when Contact Picker is not available) */}
      {!contactPickerSupported && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 text-muted-foreground text-xs">
          <BookUser className="w-4 h-4 flex-shrink-0" />
          <span>Open Orbit on your phone to bulk-import from your contacts in one tap.</span>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="skeleton w-10 h-10 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <div className="skeleton h-4 w-3/4" />
                    <div className="skeleton h-3 w-1/2" />
                  </div>
                </div>
                <div className="skeleton h-3 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && friends.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-accent-foreground" />
          </div>
          <h3 className="text-foreground font-semibold text-base mb-1">Your orbit is empty</h3>
          <p className="text-sm mb-6">Add friends manually or import from your contacts.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            {contactPickerSupported && (
              <Button variant="outline" onClick={bulkImportFromContacts} disabled={importing}>
                <BookUser className="w-4 h-4 mr-1.5" />
                Import Contacts
              </Button>
            )}
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Add Manually
            </Button>
          </div>
        </div>
      )}

      {/* No results */}
      {!isLoading && friends.length > 0 && filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No friends match "{search}"</p>
        </div>
      )}

      {/* Friends Grid */}
      {!isLoading && filtered.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((f) => {
            const tags = (() => { try { return JSON.parse(f.tags ?? '[]') as string[]; } catch { return []; } })();
            return (
              <Link key={f.id} href={`/friends/${f.id}`}>
                <Card className="hover-elevate cursor-pointer group h-full" data-testid={`card-friend-${f.id}`}>
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-start gap-3 mb-3">
                      <FriendAvatar name={f.name} color={f.avatarColor} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors">
                            {f.name}
                          </h3>
                          {f.category && <CategoryBadge category={f.category} />}
                        </div>
                        {f.nickname && (
                          <p className="text-xs text-muted-foreground truncate">"{f.nickname}"</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1 text-xs text-muted-foreground mb-3">
                      {f.location && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">{f.location}</span>
                        </div>
                      )}
                      {f.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3" />
                          <span className="truncate">{f.phone}</span>
                        </div>
                      )}
                      {f.email && !f.phone && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3 h-3" />
                          <span className="truncate">{f.email}</span>
                        </div>
                      )}
                    </div>

                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {tags.slice(0, 3).map((tag: string) => (
                          <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">{tag}</Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="text-xs text-muted-foreground">Last contact</span>
                      <span className={`text-xs font-medium ${getStatusColor(f.lastInteractionDate)}`}>
                        {daysSince(f.lastInteractionDate)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <AddFriendDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
