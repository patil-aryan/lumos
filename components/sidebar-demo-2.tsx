"use client";

import React, { useState, useEffect } from "react";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useSession } from "next-auth/react";

// Inner component that has access to sidebar context
function SidebarLayoutInner({ children }: { children: React.ReactNode }) {
  const { open } = useSidebar();
  const { data: session, status } = useSession();

  // Update CSS variable when sidebar state changes
  useEffect(() => {
    const sidebarWidth = open ? 280 : 72;
    document.documentElement.style.setProperty('--sidebar-width', `${sidebarWidth}px`);
    
    // Dispatch custom event for components that need to listen to sidebar changes
    const event = new CustomEvent('sidebar-state-change', {
      detail: { isOpen: open, width: sidebarWidth }
    });
    window.dispatchEvent(event);
  }, [open]);

  // Debug logging
  useEffect(() => {
    console.log('SidebarLayoutInner - Session status:', status);
    console.log('SidebarLayoutInner - Session data:', session);
  }, [session, status]);

  return (
    <div className="flex w-full h-screen bg-background">
      <AppSidebar user={session?.user} />
      <main className="flex-1 h-full overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

export default function AppSidebarLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <SidebarProvider defaultOpen={true} animate={true}>
      <SidebarLayoutInner>
        {children}
      </SidebarLayoutInner>
    </SidebarProvider>
  );
} 