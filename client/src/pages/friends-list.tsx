import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FriendAvatar } from '@/components/friend-avatar';
import { AddFriendDialog } from '@/components/add-friend-dialog';
import { CategoryBadge } from '@/components/category-badge';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Search, Plus, MapPin, Phone, Mail, Users, BookUser, Loader2, Upload, Trash2, X, Smartphone } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const AVATAR_COLORS = [
  '#7c5cbf', '#d97bb6', '#e07c7c', '#e09a5a', '#5ca87c', '#5c90bf',
];

// Detect Contact Picker API support
// Note: 'ContactsManager' is NOT exposed as a global on iOS Safari,
// so we only check navigator.contacts exists and has a select method.
const contactPickerSupported =
  typeof navigator !== 'undefined' &&
  'contacts' in navigator &&
  typeof (navigator as any).contacts?.select === 'function';

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
  const [vcfImporting, setVcfImporting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [confirmDeleteName, setConfirmDeleteName] = useState('');
  const [showInstallBanner, setShowInstallBanner] = useState(() => {
    try {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      const dismissed = localStorage.getItem('orbit-install-dismissed') === '1';
      return !isStandalone && !dismissed;
    } catch { return false; }
  });
  const { toast } = useToast();
  const qc = useQueryClient();

  // Check for a contact shared via the PWA share target
  useEffect(() => {
    async function checkPendingShare() {
      if (!('caches' in window)) return;
      try {
        const cache = await caches.open('orbit-share-v1');
        const response = await cache.match('/pending-contact');
        if (!response) return;
        const text = await response.text();
        await cache.delete('/pending-contact');
        if (!text.trim()) return;

        // Parse the vCard and add the friend
        const getName = (block: string) => {
          const fn = block.match(/^FN[^:]*:(.+)$/im)?.[1]?.trim();
          if (fn) return fn;
          const n = block.match(/^N[^:]*:(.+)$/im)?.[1]?.trim();
          if (n) {
            const parts = n.split(';').map((p: string) => p.trim()).filter(Boolean);
            return [parts[1], parts[0]].filter(Boolean).join(' ');
          }
          return '';
        };
        const name = getName(text);
        if (!name) return;
        const telMatch = text.match(/^TEL[^:]*:(.+)$/im);
        const emailMatch = text.match(/^EMAIL[^:]*:(.+)$/im);
        const colorIdx = name.charCodeAt(0) % AVATAR_COLORS.length;
        await addMutation.mutateAsync({
          name,
          phone: telMatch?.[1]?.trim() || null,
          email: emailMatch?.[1]?.trim() || null,
          avatarColor: AVATAR_COLORS[colorIdx],
          tags: '[]',
        });
        qc.invalidateQueries({ queryKey: ['/api/friends'] });
        qc.invalidateQueries({ queryKey: ['/api/stats'] });
        toast({ title: `${name} added to your orbit!` });
      } catch {}
    }
    checkPendingShare();
  }, []);

  const { data: friends = [], isLoading } = useQuery<FriendWithLast[]>({
    queryKey: ['/api/friends'],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/friends/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/friends'] });
      qc.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({ title: `${confirmDeleteName} removed from orbit` });
      setConfirmDeleteId(null);
    },
  });

  const addMutation = useMutation({
    mutationFn: (data: object) => apiRequest('POST', '/api/friends', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/friends'] });
      qc.invalidateQueries({ queryKey: ['/api/stats'] });
    },
  });

  // Parse a vCard (.vcf) file and bulk-import contacts
  async function importVcf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setVcfImporting(true);
    try {
      const text = await file.text();
      // Split into individual vCards
      const cards = text.split(/END:VCARD/i).map(s => s.trim()).filter(Boolean);
      let added = 0, skipped = 0;
      for (const card of cards) {
        const getName = (block: string) => {
          const fn = block.match(/^FN[^:]*:(.+)$/im)?.[1]?.trim();
          if (fn) return fn;
          // fallback: N field → Last;First;Middle
          const n = block.match(/^N[^:]*:(.+)$/im)?.[1]?.trim();
          if (n) {
            const parts = n.split(';').map(p => p.trim()).filter(Boolean);
            return [parts[1], parts[0]].filter(Boolean).join(' ');
          }
          return '';
        };
        const name = getName(card);
        if (!name) { skipped++; continue; }

        const telMatch = card.match(/^TEL[^:]*:(.+)$/im);
        const emailMatch = card.match(/^EMAIL[^:]*:(.+)$/im);
        const phone = telMatch?.[1]?.trim() ?? null;
        const email = emailMatch?.[1]?.trim() ?? null;

        const colorIdx = name.charCodeAt(0) % AVATAR_COLORS.length;
        await addMutation.mutateAsync({
          name,
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
        toast({ title: `${added} friend${added > 1 ? 's' : ''} imported from vCard!`, description: skipped > 0 ? `${skipped} skipped (no name).` : undefined });
      } else {
        toast({ title: 'No contacts found in file.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Could not read file', variant: 'destructive' });
    } finally {
      setVcfImporting(false);
    }
  }

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
          {/* vCard import — works on all devices */}
          <label>
            <input type="file" accept=".vcf,text/vcard" className="hidden" onChange={importVcf} disabled={vcfImporting} />
            <Button variant="outline" size="sm" asChild disabled={vcfImporting}>
              <span className="cursor-pointer">
                {vcfImporting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />}
                {vcfImporting ? 'Importing...' : 'Import vCard'}
              </span>
            </Button>
          </label>
          {/* Native contact picker — Android Chrome only */}
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

      {/* PWA install banner — shown until dismissed or already installed */}
      {showInstallBanner && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/10 border border-primary/25">
          <Smartphone className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary">Add Orbit to your Home Screen</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              In Safari tap <strong>Share ↑</strong> → <strong>Add to Home Screen</strong>. Once installed, open
              Contacts, tap any contact → Share → Orbit to import instantly.
            </p>
          </div>
          <button
            onClick={() => {
              localStorage.setItem('orbit-install-dismissed', '1');
              setShowInstallBanner(false);
            }}
            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
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
                      {/* Quick-delete button */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setConfirmDeleteName(f.name);
                          setConfirmDeleteId(f.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-muted-foreground hover:text-destructive transition-all flex-shrink-0 p-1 rounded"
                        aria-label={`Remove ${f.name}`}
                        data-testid={`button-quick-delete-${f.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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

      {/* Delete confirmation */}
      <AlertDialog open={confirmDeleteId !== null} onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {confirmDeleteName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete {confirmDeleteName} and all their interaction history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDeleteId !== null && deleteMutation.mutate(confirmDeleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
