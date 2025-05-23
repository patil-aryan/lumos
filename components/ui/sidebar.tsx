"use client";
import { cn } from "@/lib/utils";
import React, { useState, createContext, useContext } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconMenu2, IconX } from "@tabler/icons-react";
import Link from "next/link";

interface Links {
  label: string;
  href: string;
  icon: React.JSX.Element | React.ReactNode;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
  setOpenMobile?: React.Dispatch<React.SetStateAction<boolean>>;
  openMobile?: boolean;
  activeLink?: string;
  setActiveLink?: React.Dispatch<React.SetStateAction<string>>;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined,
);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
  defaultOpen,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
  defaultOpen?: boolean;
}) => {
  const [openState, setOpenState] = useState(defaultOpen ?? false);
  const [openMobileState, setOpenMobileState] = useState(false);
  const [activeLinkState, setActiveLinkState] = useState("/chat");

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ 
        open,
        setOpen,
        animate: animate,
        openMobile: openMobileState,
        setOpenMobile: setOpenMobileState,
        activeLink: activeLinkState,
        setActiveLink: setActiveLinkState
    }}>
            {children}
      </SidebarContext.Provider>
    );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
      className,
      ...props
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) => {
      return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      <div className={cn("sidebar", className)} {...props}>
            {children}
      </div>
    </SidebarProvider>
  );
};

export const SidebarBody = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) => {
  return (
    <motion.div className={cn("sidebar-body", className)} {...props}>
      {children}
    </motion.div>
  );
};

export const SidebarGroup = ({
  children,
        className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className={cn("sidebar-group py-2", className)} {...props}>
      {children}
    </div>
  );
};

export const SidebarGroupContent = ({
  children,
        className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className={cn("sidebar-group-content", className)} {...props}>
      {children}
    </div>
  );
};

export const SidebarMenu = ({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className={cn("sidebar-menu", className)} {...props}>
      {children}
    </div>
  );
};

export const SidebarMenuList = ({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLUListElement>) => {
  return (
    <ul className={cn("sidebar-menu-list", className)} {...props}>
      {children}
    </ul>
  );
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) => {
  const { open, setOpen, animate } = useSidebar();
  return (
    <>
      <motion.div
      className={cn(
          "h-full hidden md:flex md:flex-col bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-r border-slate-200/50 dark:border-slate-800/50 overflow-hidden relative shadow-lg",
          className
        )}
        initial={false}
        animate={{
          width: animate ? (open ? "280px" : "72px") : "280px",
        }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 30,
          mass: 0.8,
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      {...props}
      >
        {children}
      </motion.div>
    </>
  );
};

export const MobileSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  const { open, setOpen } = useSidebar();
  return (
    <>
    <div
      className={cn(
          "h-12 px-4 flex flex-row md:hidden items-center justify-between bg-white/95 dark:bg-slate-900/95 backdrop-blur-md w-full border-b border-slate-200/50 dark:border-slate-800/50 shadow-sm",
          className
      )}
      {...props}
      >
        <div className="flex justify-end z-20 w-full">
          <IconMenu2
            className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors duration-200"
            onClick={() => setOpen(!open)}
          />
        </div>
        <AnimatePresence mode="wait">
          {open && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 30,
                mass: 0.8,
              }}
              className={cn(
                "fixed inset-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-[100] flex flex-col shadow-2xl",
                className
              )}
            >
              <div className="flex justify-between items-center p-4 border-b border-slate-200/50 dark:border-slate-800/50">
                <div className="text-slate-900 dark:text-slate-100 font-medium">Menu</div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                >
                  <IconX className="text-slate-600 dark:text-slate-300" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export const SidebarLink = ({
  link,
  className,
  isActive: isActiveProp,
  ...props
}: {
  link: Links;
  className?: string;
  isActive?: boolean;
}) => {
  const { open, animate, activeLink, setActiveLink } = useSidebar();
  const isActive = typeof isActiveProp === 'boolean' ? isActiveProp : activeLink === link.href;

  return (
    <Link
      href={link.href}
      className={cn(
        "flex items-center h-12 group/sidebar py-3 px-3 relative rounded-xl transition-all duration-300 ease-in-out",
        animate && !open ? "justify-center" : "gap-3",
        isActive 
          ? "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-200/50 dark:border-blue-800/50" 
          : "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100",
        className
      )}
      {...props}
      onClick={() => setActiveLink && setActiveLink(link.href)}
    >
      <div className={cn(
        "flex-shrink-0 w-6 h-6 flex items-center justify-center transition-transform duration-300",
        animate && !open ? "mr-0" : "",
        isActive ? "scale-110" : "group-hover/sidebar:scale-105"
      )}>
        {link.icon}
      </div>
      <AnimatePresence mode="wait">
        {(animate ? open : true) && (
          <motion.span
            initial={{ opacity: 0, width: 0, x: -10 }}
            animate={{ opacity: 1, width: "auto", x: 0 }}
            exit={{ opacity: 0, width: 0, x: -10 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              mass: 0.6,
              delay: 0.05,
            }}
            className="text-sm font-medium whitespace-nowrap overflow-hidden"
          >
            {link.label}
          </motion.span>
        )}
      </AnimatePresence>
      
      {/* Active indicator */}
      {isActive && (
        <motion.div
          layoutId="activeIndicator"
          className="absolute right-2 w-2 h-2 bg-blue-500 rounded-full"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      )}
    </Link>
  );
};

export const SidebarMenuAction = ({
  children,
      className,
      ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button type="button" className={cn("sidebar-menu-action", className)} {...props}>
    {children}
  </button>
    );

export const SidebarMenuButton = ({
  children,
        className,
  isActive,
  asChild,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { isActive?: boolean; asChild?: boolean }) => (
  <button
    type="button"
    className={cn(
      "sidebar-menu-button",
      isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "",
      className
    )}
      {...props}
    >
    {children}
  </button>
);

export const SidebarMenuItem = ({
  children,
        className,
  ...props
}: React.LiHTMLAttributes<HTMLLIElement>) => (
  <li className={cn("sidebar-menu-item flex items-center", className)} {...props}>
    {children}
  </li>
);
