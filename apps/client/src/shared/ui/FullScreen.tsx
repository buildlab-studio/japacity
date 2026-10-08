// A full-screen sheet for the staged moments and the share cards. Built on Base
// UI's dialog for the focus trap and the escape key, like Sheet.
import { Dialog } from "@base-ui/react/dialog";
import type { ReactNode } from "react";

export interface FullScreenProps {
  open: boolean;
  onClose: () => void;
  /** The dialog's accessible name. */
  title: string;
  tone?: "accent" | "ink";
  children: ReactNode;
}

export function FullScreen({ open, onClose, title, tone = "ink", children }: FullScreenProps) {
  const toneClass = tone === "accent" ? "bg-accent text-accent-ink" : "bg-ink text-paper";
  return (
    <Dialog.Root open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <Dialog.Portal>
        <Dialog.Popup
          aria-label={title}
          className={`data-ending-style:pointer-events-none data-closed:pointer-events-none fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 overflow-y-auto p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] outline-hidden ${toneClass}`}
        >
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
