import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { insertFriendSchema, InsertFriend } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CategorySelector } from '@/components/category-selector';
import type { FriendCategory } from '@shared/schema';

const AVATAR_COLORS = [
  '#7c5cbf', '#d97bb6', '#e07c7c', '#e09a5a', '#5ca87c', '#5c90bf',
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  friend: InsertFriend & { id: number };
}

export function EditFriendDialog({ open, onOpenChange, friend }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const schema = insertFriendSchema.extend({
    name: insertFriendSchema.shape.name.min(1, 'Name is required'),
  });

  const form = useForm<InsertFriend>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: friend.name,
      nickname: friend.nickname ?? '',
      phone: friend.phone ?? '',
      email: friend.email ?? '',
      birthday: friend.birthday ?? '',
      location: friend.location ?? '',
      howMet: friend.howMet ?? '',
      tags: friend.tags ?? '[]',
      notes: friend.notes ?? '',
      avatarColor: friend.avatarColor ?? AVATAR_COLORS[0],
      category: (friend as any).category ?? undefined,
    },
  });

  useEffect(() => {
    form.reset({
      name: friend.name,
      nickname: friend.nickname ?? '',
      phone: friend.phone ?? '',
      email: friend.email ?? '',
      birthday: friend.birthday ?? '',
      location: friend.location ?? '',
      howMet: friend.howMet ?? '',
      tags: friend.tags ?? '[]',
      notes: friend.notes ?? '',
      avatarColor: friend.avatarColor ?? AVATAR_COLORS[0],
      category: (friend as any).category ?? undefined,
    });
  }, [friend]);

  const mutation = useMutation({
    mutationFn: (data: InsertFriend) => apiRequest('PATCH', `/api/friends/${friend.id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/friends'] });
      qc.invalidateQueries({ queryKey: ['/api/friends', friend.id] });
      qc.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({ title: 'Friend updated!' });
      onOpenChange(false);
    },
    onError: () => toast({ title: 'Failed to update friend', variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Edit {friend.name}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Name *</FormLabel>
                <FormControl><Input placeholder="Full name" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="nickname" render={({ field }) => (
              <FormItem>
                <FormLabel>Nickname</FormLabel>
                <FormControl><Input placeholder="What do you call them?" {...field} value={field.value ?? ''} /></FormControl>
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
                  <Textarea className="resize-none" rows={3} {...field} value={field.value ?? ''} />
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
                    />
                  ))}
                </div>
              </FormItem>
            )} />

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
