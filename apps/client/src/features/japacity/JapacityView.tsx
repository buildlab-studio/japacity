// The headline number: how ready this life is to leave. The display face has
// no percent sign of its own, so the sign is set in the body face.
import { useView } from "../../authority/GameProvider";
import { runningName, say } from "../../shared/words/text";

export function JapacityView({ compact = false }: { compact?: boolean }) {
  const { japacity } = useView();
  const none = japacity.percent === null;

  if (compact) {
    return (
      <span className="font-display text-xl leading-none" aria-label={say("ui.japacity.title")}>
        {none ? (
          "--"
        ) : (
          <>
            {japacity.percent}
            <span className="font-sans font-bold">%</span>
          </>
        )}
      </span>
    );
  }

  return (
    <section aria-label={say("ui.japacity.title")} className="flex flex-col gap-1 rounded-2xl bg-ink p-5 text-paper">
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
