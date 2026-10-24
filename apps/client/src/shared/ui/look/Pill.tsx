// A pill (docs/design/09-the-games-look.md, section 2): white with the thin edge, for a count, a name or a marker.
import type { ReactNode } from "react";

export function Pill({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <span className={`pill ${className}`} data-pill>
      {children}
    </span>
  );
}
