import * as React from "react";
import clsx from "clsx";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

export function Button({ className, variant = "primary", size = "md", ...props }: Props) {
  const base =
    "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
  const variants: Record<string, string> = {
    primary: "bg-neutral-900 text-white hover:bg-neutral-800 focus:ring-neutral-400",
    secondary: "bg-neutral-100 text-neutral-900 hover:bg-neutral-200 focus:ring-neutral-300",
    ghost: "bg-transparent text-neutral-900 hover:bg-neutral-100 focus:ring-neutral-300",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-300"
  };
  const sizes: Record<string, string> = {
    sm: "h-9 px-3 text-sm",
    md: "h-10 px-4 text-sm"
  };
  return <button className={clsx(base, variants[variant], sizes[size], className)} {...props} />;
}
