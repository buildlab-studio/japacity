import { useId, type ReactNode } from "react";

/** A titled section of the screen. The heading names it for screen readers. */
export function Panel({ title, action, children, className = "" }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={`@container flex flex-col gap-3 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className="text-sm font-semibold tracking-wide text-muted uppercase">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Card({ children, className = "", tone = "plain" }: { children: ReactNode; className?: string; tone?: "plain" | "attention" | "muted" }) {
  const toneClass =
    tone === "attention" ? "border-l-4 border-l-accent" : tone === "muted" ? "opacity-80" : "";
  return <div className={`rounded-xl border border-line bg-surface p-4 ${toneClass} ${className}`}>{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-muted">{children}</p>;
}

export function Tag({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "accent" | "good" | "bad" }) {
  const toneClass =
    tone === "accent"
      ? "bg-accent text-accent-ink"
      : tone === "good"
        ? "border border-good text-good"
        : tone === "bad"
          ? "border border-bad text-bad"
          : "border border-line text-muted";
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${toneClass}`}>{children}</span>;
}
