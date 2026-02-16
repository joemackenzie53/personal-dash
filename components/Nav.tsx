"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { CalendarDays, ListTodo, Layers, FolderKanban, Settings, AlertTriangle } from "lucide-react";

const items = [
  { href: "/now", label: "Now", icon: ListTodo },
  { href: "/horizon", label: "Horizon", icon: CalendarDays },
  { href: "/triage", label: "Triage", icon: AlertTriangle },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function TopNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/now" className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <Layers className="h-5 w-5" />
          Personal Dash
        </Link>
        <nav className="hidden items-center gap-1 sm:flex">
          {items.map((it) => {
            const active = pathname === it.href || pathname.startsWith(it.href + "/");
            return (
              <Link
                key={it.href}
                href={it.href}
                className={clsx(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100"
                )}
              >
                {it.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white sm:hidden">
      <div className="mx-auto grid max-w-5xl grid-cols-5">
        {items.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + "/");
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={clsx(
                "flex flex-col items-center justify-center gap-1 py-2 text-xs",
                active ? "text-neutral-900" : "text-neutral-500"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
