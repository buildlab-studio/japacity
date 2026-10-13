// The ghost button (docs/design/13-the-lively-layer.md section 2): white with the navy edge and underside that flattens
// on press, for every choice beside a surface's one yellow action and for a way out to another place or app. `wide` fills
// the row, as the phone's apps lay their ways out.
import type { ComponentProps } from "react";

export function GhostButton({ className = "", type = "button", wide = false, ...rest }: ComponentProps<"button"> & { wide?: boolean }) {
  return <button type={type} className={`phone-ghost ${wide ? "w-full" : ""} ${className}`} data-ghost-button {...rest} />;
}
