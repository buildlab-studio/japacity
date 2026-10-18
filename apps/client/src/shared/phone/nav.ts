// What an app may ask of the handset (world:phone-rises-over-scene): open another app, as the Calendar's coming list
// opens Japa or Bills, put the phone away, as the Calendar's Next month does before the page turns, or put it away
// onto the map at a stop, as a paper's visit does in Papers (world:phone-holds-what-phones-hold). The handset provides it; an app handed in by
// the shell reads it without knowing the handset.
import { createContext } from "react";

export interface PhoneNavigation {
  openApp: (id: string) => void;
  close: () => void;
  /** Puts the phone away and opens the map with this stop picked; absent where the phone stands over no map. */
  openMap?: (stop: string) => void;
}

export const PhoneNav = createContext<PhoneNavigation>({ openApp: () => undefined, close: () => undefined });
