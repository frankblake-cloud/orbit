import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CATEGORY_CONFIG, CATEGORY_ORDER } from '@/lib/categories';
import { DEFAULT_CATEGORY_RULES } from '@shared/schema';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function CategoryRulesDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: rules } = useQuery<Record<string, number>>({
    queryKey: ['/api/settings/category-rules'],
    enabled: open,
  });

  const [draft, setDraft] = useState<Record<string, number>>({ ...DEFAULT_CATEGORY_RULES });

  useEffect(() => {
    if (rules) setDraft({ ...DEFAULT_CATEGORY_RULES, ...rules });
  }, [rules]);

  const mutation = useMutation({
    mutationFn: (data: Record<string, number>) =>
      apiRequest('PUT', '/api/settings/category-rules', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/settings/category-rules'] });
      qc.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({ title: 'Frequency rules saved!' });
      onOpenChange(false);
    },
    onError: () => toast({ title: 'Failed to save rules', variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Check-in Frequency</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Set how often you want to stay in touch with each tier.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {CATEGORY_ORDER.map((cat) => {
            const cfg = CATEGORY_CONFIG[cat];
            const val = draft[cat] ?? cfg.defaultDays;
            return (
              <div key={cat} className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${cfg.color} w-28 justify-center flex-shrink-0`}
                >
                  {cfg.label}
                </span>
                <span className="text-sm text-muted-foreground flex-shrink-0">every</span>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={val}
                  onChange={(e) => {
                    const n = parseInt(e.target.value);
                    if (!isNaN(n) && n >= 1) setDraft((d) => ({ ...d, [cat]: n }));
                  }}
                  className="w-16 text-center"
                />
                <span className="text-sm text-muted-foreground flex-shrink-0">
                  {val === 1 ? 'day' : 'days'}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(draft)}
          >
            {mutation.isPending ? 'Saving...' : 'Save Rules'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
