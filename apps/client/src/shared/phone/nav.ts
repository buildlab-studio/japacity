// What an app may ask of the handset (docs/rules/world.md R-WORLD-018): open another app, as the Calendar's coming list
// opens Japa or Bills, or put the phone away, as the Calendar's Next month does before the page turns. The handset
// provides it; an app handed in by the shell reads it without knowing the handset.
import { createContext } from "react";

export interface PhoneNavigation {
  openApp: (id: string) => void;
  close: () => void;
}

export const PhoneNav = createContext<PhoneNavigation>({ openApp: () => undefined, close: () => undefined });
