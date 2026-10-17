// The app's error boundary (analytics.md R-ANALYTICS-002, 003): a screen that throws while it
// draws is replaced by a plain line, Reload, and Tell us. Each catch is counted once as `client/error` keyed `render`,
// and said in the console with the error's name, message and component stack and the build it ran on, so a broken
// screen says why to whoever looks. Nothing of the error is counted or sent; Tell us opens the feedback box with the
// error's name and the build written in, never the message or the stack, and the player sends it or not.
import { Component, useState, type ErrorInfo, type ReactNode } from "react";

import { FEEDBACK_MAX_CHARS, FeedbackForm } from "../moderation/Feedback";
import { useModeration } from "../moderation/ModerationProvider";
import { words } from "../moderation/moderation.words";
import { buildOf } from "../stamp/stamp";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";
import { say } from "../words/text";
import { counting } from "./start";

interface BoundaryProps {
  children: ReactNode;
}

interface BoundaryState {
  /** The caught error's name, as `nameOf` keeps it; null while the screen draws. */
  broken: string | null;
}

/** R-ANALYTICS-002: the one kind of `client/error` a render error counts as. */
const RENDER = "render";

/** The screen feedback says it was sent from: the boundary stands above every screen, so it names itself. */
const BROKEN_SCREEN = "broken";

/** An error's name in a form that can only be a name (`TypeError`), never words a player wrote. */
export function nameOf(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  const plain = name.replace(/[^\w.:-]/g, "").slice(0, 64);
  return plain === "" ? "Error" : plain;
}

/** The build the page says it is (`<meta name="japacity-build">`, R-SERVER-038), or "unknown". */
function stampOf(): string {
  return typeof document === "undefined" ? "unknown" : (buildOf(document) ?? "unknown");
}

/** The console's first line for a caught error: the build and the error's name. The error itself follows it. */
function brokenLine(error: unknown, build: string): string {
  return `Japacity build ${build}: the screen broke (${nameOf(error)}).`;
}

/** React catches a render error only in a class component; this is the one class in the client. */
export class CountedBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { broken: null };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { broken: nameOf(error) };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    counting().count("client/error", RENDER);
    // The error itself, so the console prints its name and message (never read here: R-ENGINE-015), then where it broke.
    console.error(brokenLine(error, stampOf()), error, info.componentStack ?? "");
  }

  override render(): ReactNode {
    if (this.state.broken === null) return this.props.children;
    return <Broken error={this.state.broken} />;
  }
}

/** The line, Reload, and Tell us where the game has a team to tell (online; offline the feedback box does not exist). */
function Broken({ error }: { error: string }) {
  const moderation = useModeration();
  const [telling, setTelling] = useState(false);
  return (
    <div role="alert" className="flex flex-col items-start gap-3 p-4" data-broken>
      <p>{say("ui.broken")}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => location.reload()}>
          {say("ui.broken.reload")}
        </Button>
        {moderation === null ? null : <Button onClick={() => setTelling(true)}>{say("ui.broken.tell")}</Button>}
      </div>
      {moderation === null ? null : (
        <Sheet open={telling} onOpenChange={setTelling} title={words("ui.feedback.title")} description={words("ui.feedback.intro")}>
          <FeedbackForm moderation={moderation} screen={BROKEN_SCREEN} max={FEEDBACK_MAX_CHARS} initial={say("ui.broken.feedback", { error, build: stampOf() })} />
        </Sheet>
      )}
    </div>
  );
}
