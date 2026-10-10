// Settings (docs/rules/world.md R-WORLD-018, 021, 022): the look (adire or danfo, remembered on the
// device), the sound (the existing mute: muted fetches nothing), the city's graphics choice, and
// the account, which the shell hands in so this folder never imports the account feature.
import { useState, type ReactNode } from "react";

import { chooseGraphics, type GraphicsChoice } from "../../../shared/graphics/mode";
import { setMuted } from "../../../shared/sound/sound";
import { useSound } from "../../../shared/sound/useSound";
import { say } from "../../../shared/words/text";
import type { Theme } from "../../../shared/world/contract";
import { currentTheme, setTheme, THEMES } from "../../../shared/world/theme";
import { Chips, Head } from "../act";
import { phoneWords } from "../phone.words";

// the city keeps its graphics choice under this key (features/city/mode.ts) and reads it
// when it opens; a shared home for the key, and a way for the city to hear a change, would let the
// phone's choice apply at once.
export const GRAPHICS_KEY = "japacity.city.graphics";
const GRAPHICS: readonly GraphicsChoice[] = ["auto", "low", "high"];

function readGraphics(): GraphicsChoice {
  try {
    const kept = localStorage.getItem(GRAPHICS_KEY);
    return kept === "low" || kept === "high" ? kept : "auto";
  } catch {
    return "auto";
  }
}

function keepGraphics(choice: GraphicsChoice): void {
  try {
    localStorage.setItem(GRAPHICS_KEY, choice);
  } catch {
    // A private window may refuse storage; the choice then lasts the session only.
  }
}

export function Settings({ account = null }: { account?: ReactNode }) {
  const [theme, chooseTheme] = useState<Theme>(() => currentTheme());
  const [graphics, setGraphics] = useState<GraphicsChoice>(readGraphics);
  const muted = useSound((state) => state.muted);
  return (
    <div data-phone-app="settings">
      <Head>{phoneWords("phone.settings.look")}</Head>
      <Chips
        label={phoneWords("phone.settings.look")}
        value={theme}
        onChange={(next) => {
          setTheme(next);
          chooseTheme(next);
        }}
        options={THEMES.map((value) => ({ value, label: say(`ui.world.theme.${value}`) }))}
      />

      <Head>{phoneWords("phone.settings.sound")}</Head>
      <Chips
        label={phoneWords("phone.settings.sound")}
        value={muted ? "off" : "on"}
        onChange={(next) => setMuted(next === "off")}
        options={[
          { value: "on", label: phoneWords("phone.settings.sound.on") },
          { value: "off", label: phoneWords("phone.settings.sound.off") },
        ]}
      />

      <Head>{phoneWords("phone.settings.graphics")}</Head>
      <Chips
        label={phoneWords("phone.settings.graphics")}
        value={graphics}
        onChange={(next) => {
          chooseGraphics(next);
          keepGraphics(next);
          setGraphics(next);
        }}
        options={GRAPHICS.map((value) => ({ value, label: phoneWords(`phone.settings.graphics.${value}`) }))}
      />
      <p className="mt-1 text-[12px] text-text-2">{phoneWords("phone.settings.graphics.when")}</p>

      {account === null ? null : <div data-account>{account}</div>}
    </div>
  );
}
