import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "quiet";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink font-semibold border border-accent hover:brightness-95",
  secondary: "bg-surface text-ink border border-ink/70 hover:bg-sunk",
  quiet: "bg-transparent text-ink underline underline-offset-4 decoration-line hover:decoration-ink",
};

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: Variant;
  small?: boolean;
}

/** A plain button. Touch targets stay at least 44px tall unless `small`. */
export function Button({ variant = "secondary", small = false, className = "", type = "button", ...rest }: ButtonProps) {
  const size = small ? "min-h-9 px-3 text-sm" : "min-h-11 px-4";
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg ${size} ${VARIANTS[variant]} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
      {...rest}
    />
  );
}
