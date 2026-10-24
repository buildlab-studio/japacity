// The one action of a surface (docs/design/09-the-games-look.md, section 2): danfo yellow with a 4 px navy underside
// that flattens on press, a verb and the thing ("Apply · Junior developer", "Let's go"). One to a surface.
import type { ComponentProps } from "react";

export function PressButton({ className = "", type = "button", ...rest }: ComponentProps<"button">) {
  return <button type={type} className={`press-button ${className}`} data-press-button {...rest} />;
}
