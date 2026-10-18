// A card (docs/design/09-the-lively-layer.md, section 2): white, a 20 px radius, the thin edge and a soft shadow. Other
// attributes, such as a data- mark for tests and pictures, pass through to the box.
import type { ComponentProps } from "react";

export function LivelyCard({ className = "", children, ...rest }: ComponentProps<"div">) {
  return (
    <div {...rest} className={`lively-card ${className}`} data-lively-card>
      {children}
    </div>
  );
}
