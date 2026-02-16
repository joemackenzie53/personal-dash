"use client";
import clsx from "clsx";

export function Notice({ tone = "neutral", children }: { tone?: "neutral" | "red" | "green" | "amber"; children: any }) {
  const tones: Record<string, string> = {
    neutral: "border-neutral-200 bg-white text-neutral-700",
    red: "border-red-200 bg-red-50 text-red-800",
    green: "border-green-200 bg-green-50 text-green-800",
    amber: "border-amber-200 bg-amber-50 text-amber-900"
  };
  return <div className={clsx("rounded-xl border p-3 text-sm", tones[tone])}>{children}</div>;
}
