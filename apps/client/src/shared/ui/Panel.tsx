import { useId, type ComponentProps, type ReactNode } from "react";

/** A titled section of the screen. The heading names it for screen readers. */
export function Panel({ title, action, children, className = "" }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={`@container flex flex-col gap-3 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className="text-sm font-semibold tracking-wide text-text-2 uppercase">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A card. Other attributes, such as a `data-` mark for tests and styles, pass through to the box. */
export function Card({ children, className = "", tone = "plain", ...rest }: ComponentProps<"div"> & { tone?: "plain" | "attention" | "muted" }) {
  const toneClass =
    tone === "attention" ? "border-l-4 border-l-accent" : tone === "muted" ? "opacity-80" : "";
  return (
    <div {...rest} className={`rounded-md border border-sheet-line bg-sheet-2 p-4 ${toneClass} ${className}`}>
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-text-2">{children}</p>;
}

export function Tag({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "accent" | "good" | "bad" }) {
  const toneClass =
    tone === "accent"
      ? "bg-accent text-accent-ink"
      : tone === "good"
        ? "border border-good text-good"
        : tone === "bad"
          ? "border border-bad text-bad"
          : "border border-sheet-line text-text-2";
  return <span className={`inline-flex items-center gap-1 rounded-[4px] px-2 py-0.5 text-xs font-medium ${toneClass}`}>{children}</span>;
}
