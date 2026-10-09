/** A bar for slow progress: a checklist item filling, a quality within its range. */
export function Meter({ value, max, label, tone = "accent" }: { value: number; max: number; label: string; tone?: "accent" | "ink" }) {
  const share = max <= 0 ? 0 : Math.min(1, Math.max(0, value / max));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      className="h-2 w-full overflow-hidden rounded-[2px] bg-sheet-muted"
    >
      <div className={`h-full rounded-[2px] ${tone === "accent" ? "bg-accent" : "bg-ink"}`} style={{ width: `${String(share * 100)}%` }} />
    </div>
  );
}
