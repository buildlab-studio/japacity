// A card (docs/design/09-the-games-look.md, section 2): white, a 20 px radius, the thin edge and a soft shadow. Other
// attributes, such as a data- mark for tests and pictures, pass through to the box.
import type { ComponentProps } from "react";

export function LookCard({ className = "", children, ...rest }: ComponentProps<"div">) {
  return (
    <div {...rest} className={`look-card ${className}`} data-look-card>
      {children}
    </div>
  );
}
