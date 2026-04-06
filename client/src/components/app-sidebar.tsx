import { LayoutDashboard, Users, Plus } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { AddFriendDialog } from './add-friend-dialog';

const navItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Friends', url: '/friends', icon: Users },
];

export function AppSidebar() {
  const [location] = useLocation();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      <Sidebar>
        <SidebarHeader className="px-4 py-5">
          {/* Orbit Logo */}
          <div className="flex items-center gap-2.5">
            <svg
              aria-label="Orbit"
              viewBox="0 0 32 32"
              fill="none"
              className="w-8 h-8 flex-shrink-0"
            >
              <circle cx="16" cy="16" r="5" fill="hsl(var(--primary))" />
              <ellipse
                cx="16" cy="16" rx="14" ry="7"
                stroke="hsl(var(--primary))"
                strokeWidth="2"
                fill="none"
                opacity="0.5"
              />
              <circle cx="28" cy="16" r="2.5" fill="hsl(var(--primary))" opacity="0.8" />
              <circle cx="4" cy="16" r="1.5" fill="hsl(var(--primary))" opacity="0.4" />
            </svg>
            <span className="font-display font-bold text-lg leading-tight text-foreground">
              Orbit
            </span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigate</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const isActive =
                    item.url === '/' ? location === '/' : location.startsWith(item.url);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild data-active={isActive}>
                        <Link href={item.url}>
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-4">
          <Button
            className="w-full"
            onClick={() => setAddOpen(true)}
            data-testid="button-add-friend-sidebar"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Friend
          </Button>
        </SidebarFooter>
      </Sidebar>

      <AddFriendDialog open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}
