// The credits screen (city.md R-CITY-021, guides.md R-GUIDE-008 to R-GUIDE-010): the map data
// credit with its link, each register row's attribution, the fonts, where generated media is used,
// all from credits.json, and the game's own licences with the way to the repository's full list.
// Reached from the city's menu and, through the shell, from the phone's Settings (CreditsRow), online or not.
import { LICENCES_URL } from "@japacity/content";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

import { loadJson, loadManifest } from "../../shared/three/manifest";
import { Sheet } from "../../shared/ui/Sheet";
import { cityWords } from "./city.words";

/** credits.json as tools/assets/credits.ts writes it. */
export interface CreditsFile {
  mapData: { text: string; link: string; sources: string[] }[];
  assets: { file: string; attribution: string }[];
  fonts: { family: string; attribution: string }[];
  generated: string;
}

const OSM = "OpenStreetMap";

/** A map data line with "OpenStreetMap" as the link the guidelines ask for. */
function MapLine({ text, link }: { text: string; link: string }) {
  const at = text.indexOf(OSM);
  if (at === -1) {
    return (
      <p>
        <a href={link} className="underline underline-offset-4">
          {text}
        </a>
      </p>
    );
  }
  return (
    <p>
      {text.slice(0, at)}
      <a href={link} className="underline underline-offset-4" target="_blank" rel="noreferrer">
        {OSM}
      </a>
      {text.slice(at + OSM.length)}
    </p>
  );
}

export function CreditsList({ credits }: { credits: CreditsFile }) {
  return (
    <div className="flex flex-col gap-4 text-sm">
      {credits.mapData.length === 0 ? null : (
        <section className="flex flex-col gap-1" data-credits="map">
          <h3 className="font-semibold">{cityWords("city.credits.map")}</h3>
          {credits.mapData.map((line) => (
            <MapLine key={line.text} text={line.text} link={line.link} />
          ))}
        </section>
      )}
      {credits.assets.length === 0 ? null : (
        <section className="flex flex-col gap-1" data-credits="assets">
          <h3 className="font-semibold">{cityWords("city.credits.assets")}</h3>
          {credits.assets.map((row) => (
            <p key={row.file}>{row.attribution}</p>
          ))}
        </section>
      )}
      <section className="flex flex-col gap-1" data-credits="fonts">
        <h3 className="font-semibold">{cityWords("city.credits.fonts")}</h3>
        {credits.fonts.map((font) => (
          <p key={font.family}>{font.attribution}</p>
        ))}
      </section>
      <section className="flex flex-col gap-1" data-credits="generated">
        <h3 className="font-semibold">{cityWords("city.credits.generated")}</h3>
        <p>{credits.generated}</p>
      </section>
      <section className="flex flex-col gap-1" data-credits="licences">
        <h3 className="font-semibold">{cityWords("city.credits.licences")}</h3>
        <p>{cityWords("city.credits.licences.line")}</p>
        <p>
          <a href={LICENCES_URL} className="underline underline-offset-4" target="_blank" rel="noreferrer">
            {cityWords("city.credits.licences.full")}
          </a>
        </p>
      </section>
    </div>
  );
}

export function CreditsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [credits, setCredits] = useState<CreditsFile | null>(null);
  useEffect(() => {
    if (!open || credits !== null) return;
    void loadManifest()
      .then((manifest) => loadJson<CreditsFile>(manifest, "credits.json"))
      .then(setCredits)
      .catch(() => setCredits(null));
  }, [open, credits]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={cityWords("city.credits")}>
      {credits === null ? <p className="text-text-2">{cityWords("city.credits.loading")}</p> : <CreditsList credits={credits} />}
    </Sheet>
  );
}

/** The Credits row the shell places in the phone's Settings, beside the ready lives: the same sheet as the city's menu opens (R-CITY-021). */
export function CreditsRow() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="lively-card press mt-1 flex w-full items-center justify-between gap-2 p-3 text-left"
        onClick={() => setOpen(true)}
        data-credits-row
      >
        <span className="min-w-0">
          <span className="block text-[17px] font-bold">{cityWords("city.credits")}</span>
          <span className="block text-[14px] text-text-2">{cityWords("city.credits.hint")}</span>
        </span>
        <ArrowRight size={20} className="shrink-0" aria-hidden />
      </button>
      <CreditsSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
