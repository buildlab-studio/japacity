// The one line a field says about itself (world:field-says-its-state). A problem carries the circle-and-mark icon in the out
// colour and a good state the tick in money in's colour, so colour never speaks alone; help is the quiet ink with no icon, never
// bold. The box's own edge on a problem is the stylesheet's, from its `aria-invalid` (index.css).
import { Check, CircleAlert } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

/** What a field's line says: a problem to fix, a good state, or what the field is for. */
export type FieldState = "problem" | "good" | "help";

const LOOK: Record<FieldState, string> = {
  problem: "font-bold text-out",
  good: "font-bold text-in",
  help: "text-text-2",
};

const ICON = { problem: CircleAlert, good: Check } as const;

type FieldNoteProps = Omit<ComponentProps<"p">, "children"> & {
  /** null: the line stands mounted and empty, as a live region does before its words. */
  state: FieldState | null;
  children?: ReactNode;
};

/** The line: under the label for help, directly under the box for a state; the caller places it and gives it its id and role. */
export function FieldNote({ state, className = "", children, ...rest }: FieldNoteProps) {
  const said = state !== null && children !== null && children !== undefined && children !== "" && children !== false;
  const shown = said ? state : null;
  const Icon = shown === "problem" || shown === "good" ? ICON[shown] : null;
  const look = `text-[13px] leading-snug ${shown === null ? "" : LOOK[shown]} ${Icon === null ? "" : "flex items-start gap-1"} ${className}`.replace(/\s+/g, " ").trim();
  return (
    <p {...rest} className={look} data-field-note={shown ?? ""}>
      {Icon === null ? (
        children
      ) : (
        <>
          <Icon size={14} strokeWidth={shown === "good" ? 3 : 2.5} className="mt-[2px] shrink-0" aria-hidden />
          <span>{children}</span>
        </>
      )}
    </p>
  );
}
