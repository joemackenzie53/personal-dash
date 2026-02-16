"use client";
import * as React from "react";
import clsx from "clsx";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
};

export function Modal({ open, title, onClose, children }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-200 p-4">
          <div className="text-sm font-semibold text-neutral-900">{title || "Details"}</div>
          <button
            onClick={onClose}
            className={clsx("rounded-lg p-2 hover:bg-neutral-100")}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
