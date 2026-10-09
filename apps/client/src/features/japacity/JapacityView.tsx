// The headline number: how ready this life is to leave. The display face has
// no percent sign of its own, so the sign is set in the body face.
import { useView } from "../../authority/GameProvider";
import { runningName, say } from "../../shared/words/text";

export function JapacityView({ compact = false }: { compact?: boolean }) {
  const { japacity } = useView();
  const none = japacity.percent === null;

  // With no route there is no figure to show, so the header says nothing rather than a placeholder.
  if (compact && none) return null;
  // The display face blurs at header size on a phone, so phones get the body face.
  if (compact) {
    return (
      <span className="font-sans text-xl leading-none font-bold tabular-nums sm:font-display sm:text-2xl sm:font-normal" aria-label={say("ui.japacity.title")} data-japacity-figure>
        {japacity.percent}
        <span className="font-sans font-bold">%</span>
      </span>
    );
  }

  return (
    <section aria-label={say("ui.japacity.title")} className="flex flex-col gap-1 rounded-md bg-strong p-5 text-on-strong">
      <h2 className="text-sm font-semibold tracking-wide uppercase opacity-80">{say("ui.japacity.title")}</h2>
      {none ? (
        <p className="font-display text-4xl leading-tight">{say("ui.japacity.none")}</p>
      ) : (
        <p className="font-display text-7xl leading-none text-accent">
          {japacity.percent}
          <span className="font-sans text-4xl font-bold">%</span>
        </p>
      )}
      {japacity.route === null ? null : <p className="opacity-80">{say("ui.japacity.of", { route: runningName(japacity.route) })}</p>}
    </section>
  );
}
