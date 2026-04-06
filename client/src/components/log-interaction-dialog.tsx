import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { insertInteractionSchema, InsertInteraction, Friend } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { z } from 'zod';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { MessageSquare, Phone, MapPin, Sparkles, Bell } from 'lucide-react';

const INTERACTION_TYPES = [
  { value: 'text', label: 'Text / DM', icon: MessageSquare },
  { value: 'call', label: 'Call', icon: Phone },
  { value: 'irl', label: 'In Person', icon: MapPin },
  { value: 'other', label: 'Other', icon: Sparkles },
];

// Quick relative date shortcuts
const QUICK_DATES = [
  { label: 'Tomorrow', days: 1 },
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
];

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

const formSchema = insertInteractionSchema.extend({
  date: insertInteractionSchema.shape.date.min(1, 'Date is required'),
  type: insertInteractionSchema.shape.type.min(1, 'Type is required'),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  preselectedFriendId?: number;
}

export function LogInteractionDialog({ open, onOpenChange, preselectedFriendId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [setReminder, setSetReminder] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderNote, setReminderNote] = useState('');

  const { data: friends = [] } = useQuery<Friend[]>({
    queryKey: ['/api/friends'],
    enabled: open,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      friendId: preselectedFriendId ?? 0,
      type: 'text',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    },
  });

  function handleClose() {
    form.reset();
    setSetReminder(false);
    setReminderDate('');
    setReminderNote('');
    onOpenChange(false);
  }

  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const body: any = { ...data, friendId: Number(data.friendId) };
      if (setReminder && reminderDate) {
        body.reminder = { dueDate: reminderDate, note: reminderNote || null };
      }
      return apiRequest('POST', '/api/interactions', body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/interactions'] });
      qc.invalidateQueries({ queryKey: ['/api/friends'] });
      qc.invalidateQueries({ queryKey: ['/api/stats'] });
      qc.invalidateQueries({ queryKey: ['/api/reminders'] });
      if (preselectedFriendId) {
        qc.invalidateQueries({ queryKey: ['/api/friends', preselectedFriendId] });
      }
      toast({
        title: 'Interaction logged!',
        description: setReminder && reminderDate
          ? `Reminder set for ${new Date(reminderDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
          : undefined,
      });
      handleClose();
    },
    onError: () => toast({ title: 'Failed to log interaction', variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Log an interaction</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((d) => mutation.mutate(d))}
            className="space-y-4"
          >
            {/* Friend select */}
            {!preselectedFriendId && (
              <FormField control={form.control} name="friendId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Friend *</FormLabel>
                  <Select onValueChange={(v) => field.onChange(parseInt(v))} value={field.value?.toString()}>
                    <FormControl>
                      <SelectTrigger data-testid="select-friend">
                        <SelectValue placeholder="Choose a friend..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {friends.map((f) => (
                        <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            {/* Interaction type */}
            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel>Type *</FormLabel>
                <div className="grid grid-cols-4 gap-2">
                  {INTERACTION_TYPES.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => field.onChange(value)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all ${
                        field.value === value
                          ? 'border-primary bg-accent text-accent-foreground'
                          : 'border-border text-muted-foreground hover:border-primary/50'
                      }`}
                      data-testid={`button-type-${value}`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )} />

            {/* Date */}
            <FormField control={form.control} name="date" render={({ field }) => (
              <FormItem>
                <FormLabel>Date *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} data-testid="input-interaction-date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Notes */}
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="What did you talk about? Any highlights?"
                    className="resize-none"
                    rows={2}
                    {...field}
                    value={field.value ?? ''}
                    data-testid="input-interaction-notes"
                  />
                </FormControl>
              </FormItem>
            )} />

            {/* ── Reminder Section ── */}
            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Set a follow-up reminder</span>
                </div>
                <Switch
                  checked={setReminder}
                  onCheckedChange={(v) => {
                    setSetReminder(v);
                    if (v && !reminderDate) setReminderDate(addDays(7));
                  }}
                  data-testid="switch-reminder"
                />
              </div>

              {setReminder && (
                <div className="space-y-3 pl-6 animate-in slide-in-from-top-2 duration-200">
                  {/* Quick date chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_DATES.map(({ label, days }) => {
                      const val = addDays(days);
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => setReminderDate(val)}
                          className={`px-2.5 py-1 rounded-full text-xs border transition-all ${
                            reminderDate === val
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'border-border text-muted-foreground hover:border-primary/50'
                          }`}
                          data-testid={`chip-reminder-${label.replace(' ', '-')}`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom date */}
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Follow-up date</label>
                    <Input
                      type="date"
                      value={reminderDate}
                      onChange={(e) => setReminderDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      data-testid="input-reminder-date"
                    />
                  </div>

                  {/* Reminder note */}
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">What to follow up on (optional)</label>
                    <Input
                      placeholder="e.g. Check how the job interview went"
                      value={reminderNote}
                      onChange={(e) => setReminderNote(e.target.value)}
                      data-testid="input-reminder-note"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={mutation.isPending} data-testid="button-save-interaction">
                {mutation.isPending ? 'Saving...' : setReminder ? 'Log + Set Reminder' : 'Log It'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
