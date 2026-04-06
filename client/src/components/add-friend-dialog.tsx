import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { insertFriendSchema, InsertFriend } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { BookUser, Loader2, Smartphone } from 'lucide-react';
import { CategorySelector } from '@/components/category-selector';
import type { FriendCategory } from '@shared/schema';

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

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function AddFriendDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [importing, setImporting] = useState(false);

  const schema = insertFriendSchema.extend({
    name: insertFriendSchema.shape.name.min(1, 'Name is required'),
  });

  const form = useForm<InsertFriend>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      nickname: '',
      phone: '',
      email: '',
      birthday: '',
      location: '',
      howMet: '',
      tags: '[]',
      notes: '',
      avatarColor: AVATAR_COLORS[0],
      category: undefined,
    },
  });

  const mutation = useMutation({
    mutationFn: (data: InsertFriend) => apiRequest('POST', '/api/friends', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/friends'] });
      qc.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({ title: 'Friend added to your orbit!' });
      form.reset();
      onOpenChange(false);
    },
    onError: () => toast({ title: 'Failed to add friend', variant: 'destructive' }),
  });

  async function importFromContacts() {
    if (!contactPickerSupported) return;
    setImporting(true);
    try {
      // @ts-ignore — Contact Picker API not yet in TS lib
      const contacts = await navigator.contacts.select(
        ['name', 'tel', 'email'],
        { multiple: false }
      );
      if (!contacts || contacts.length === 0) return;

      const contact = contacts[0];
      const fullName = Array.isArray(contact.name) ? contact.name[0] ?? '' : contact.name ?? '';
      const phone = Array.isArray(contact.tel) ? contact.tel[0] ?? '' : contact.tel ?? '';
      const email = Array.isArray(contact.email) ? contact.email[0] ?? '' : contact.email ?? '';

      form.setValue('name', fullName, { shouldValidate: true });
      if (phone) form.setValue('phone', phone);
      if (email) form.setValue('email', email);

      toast({ title: `Imported ${fullName || 'contact'} — fill in the rest!` });
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        toast({ title: 'Could not access contacts', variant: 'destructive' });
      }
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Add a friend</DialogTitle>
        </DialogHeader>

        {/* Contact Picker */}
        {contactPickerSupported ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={importFromContacts}
            disabled={importing}
            data-testid="button-import-contact"
          >
            {importing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <BookUser className="w-4 h-4 mr-2" />
            )}
            {importing ? 'Opening contacts...' : 'Import from Contacts'}
          </Button>
        ) : (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/60 text-muted-foreground text-xs">
            <Smartphone className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              Open Orbit on your phone to import contacts directly from your address book.
              Works on iOS Safari and Android Chrome.
            </span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">or fill in manually</span>
          <Separator className="flex-1" />
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            {/* Name */}
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Name *</FormLabel>
                <FormControl><Input placeholder="Full name" {...field} data-testid="input-friend-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Nickname */}
            <FormField control={form.control} name="nickname" render={({ field }) => (
              <FormItem>
                <FormLabel>Nickname</FormLabel>
                <FormControl><Input placeholder="What do you call them?" {...field} value={field.value ?? ''} data-testid="input-friend-nickname" /></FormControl>
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl><Input placeholder="+1 555 000 0000" {...field} value={field.value ?? ''} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input placeholder="email@example.com" {...field} value={field.value ?? ''} /></FormControl>
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="birthday" render={({ field }) => (
                <FormItem>
                  <FormLabel>Birthday</FormLabel>
                  <FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="location" render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl><Input placeholder="City, State" {...field} value={field.value ?? ''} /></FormControl>
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="howMet" render={({ field }) => (
              <FormItem>
                <FormLabel>How you met</FormLabel>
                <FormControl><Input placeholder="College, work, mutual friend..." {...field} value={field.value ?? ''} /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Things to remember about them..."
                    className="resize-none"
                    rows={3}
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
              </FormItem>
            )} />

            {/* Category */}
            <FormField control={form.control} name="category" render={({ field }) => (
              <FormItem>
                <FormLabel>Friendship tier</FormLabel>
                <CategorySelector
                  value={field.value}
                  onChange={(cat) => field.onChange(cat ?? undefined)}
                />
              </FormItem>
            )} />

            {/* Avatar Color */}
            <FormField control={form.control} name="avatarColor" render={({ field }) => (
              <FormItem>
                <FormLabel>Avatar Color</FormLabel>
                <div className="flex gap-2 flex-wrap">
                  {AVATAR_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => field.onChange(color)}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        field.value === color ? 'border-foreground scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                      aria-label={`Color ${color}`}
                    />
                  ))}
                </div>
              </FormItem>
            )} />

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={mutation.isPending} data-testid="button-save-friend">
                {mutation.isPending ? 'Adding...' : 'Add Friend'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
