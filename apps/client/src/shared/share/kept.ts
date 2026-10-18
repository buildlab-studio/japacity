// The japa type kept on this device with the send-off card (decision 0024: "kept on the data page"), read from
// the gallery's own storage so the data page, which is shared code, needs nothing from the card feature. The
// gallery writes the entries; this reads only the one field the page shows, and never trusts the shape.
import { type JapaType, japaTypes } from "@japacity/content";
import { browserStorage, CARDS_KEY } from "../kept/storage";

interface Read {
  getItem: (key: string) => string | null;
}

/** The type kept with this life's send-off card, or null before the send-off has been closed (or on a blocked storage). */
export function keptTypeOf(scenario: string, read: Read | null = browserStorage()): JapaType | null {
  if (read === null) return null;
  try {
    const parsed: unknown = JSON.parse(read.getItem(CARDS_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return null;
    for (const entry of parsed as unknown[]) {
      if (typeof entry !== "object" || entry === null) continue;
      const { scenario: own, card, type } = entry as { scenario?: unknown; card?: { kind?: unknown }; type?: unknown };
      if (own === scenario && card?.kind === "send-off" && typeof type === "string" && (japaTypes as readonly string[]).includes(type)) return type as JapaType;
    }
    return null;
  } catch {
    return null;
  }
}
