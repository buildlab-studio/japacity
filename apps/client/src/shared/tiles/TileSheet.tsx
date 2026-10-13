// `?tiles` in development: every tile of the table on one page, by kind, the stand-ins marked, for checking the
// pictures by eye and for the build notes' contact sheet. Never in a player's build (main.tsx asks only in development).
import { standIns, TILE_TABLE } from "./tiles.data";
import { Tile } from "./Tile";

const KINDS: readonly { title: string; has: (id: string) => boolean }[] = [
  { title: "Jobs", has: (id) => id.startsWith("activity.job-") },
  { title: "Acts", has: (id) => id.startsWith("activity.") && !id.startsWith("activity.job-") },
  { title: "Offers", has: (id) => id.startsWith("offer.") },
  { title: "Places", has: (id) => id.startsWith("place.") },
  { title: "The home's things", has: (id) => id.startsWith("thing.") },
  { title: "Papers", has: (id) => id.startsWith("document.") },
  { title: "Ways out", has: (id) => id.startsWith("route.") },
  { title: "The phone's own", has: (id) => id.startsWith("phone.") },
];

export function TileSheet() {
  const ids = Object.keys(TILE_TABLE).sort();
  return (
    <main className="min-h-dvh px-4 py-3" style={{ background: "#eaf3fb", color: "#1c2a5e" }} data-tile-sheet>
      <p className="text-sm font-semibold">
        {standIns().length} of {ids.length} pictures stand in for a model not yet made (dashed).
      </p>
      {KINDS.map((kind) => (
        <section key={kind.title} className="mt-3">
          <h2 className="text-sm font-bold">{kind.title}</h2>
          <ul className="mt-1 grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))" }}>
            {ids.filter(kind.has).map((id) => (
              <li key={id} className="flex flex-col items-center rounded-lg bg-white p-1 text-center" style={{ border: typeof TILE_TABLE[id] === "string" ? "1px solid #1c2a5e" : "1px dashed #8a93b8" }}>
                <Tile of={id} size={56} />
                <span className="mt-0.5 break-all text-[9px] leading-tight">{id.replace(/^(activity|offer|place|thing)\./, "")}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}

export default TileSheet;
