import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from './theme-provider';

export function AppHeader() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="flex items-center justify-between px-4 py-2 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
      <SidebarTrigger data-testid="button-sidebar-toggle" />
      <Button
        size="icon"
        variant="ghost"
        onClick={toggleTheme}
        aria-label="Toggle theme"
        data-testid="button-theme-toggle"
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </Button>
    </header>
  );
}
