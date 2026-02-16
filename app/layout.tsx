import "./globals.css";
import type { Metadata } from "next";
import { TopNav, BottomNav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Personal Dash",
  description: "Calendar-driven personal admin dashboard"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-neutral-50 text-neutral-900">
        <TopNav />
        <main className="mx-auto max-w-5xl px-4 pb-24 pt-6">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
