// The app's error boundary (analytics.md R-ANALYTICS-002, 003): a screen that
// throws while it draws is replaced by a plain line and a way to reload, and
// each catch is counted once as `client/error`, keyed by its code. Nothing of
// the error itself is counted or sent.
import { Component, type ReactNode } from "react";

import { Button } from "../ui/Button";
import { say } from "../words/text";
import { counting } from "./start";

interface BoundaryProps {
  children: ReactNode;
}

interface BoundaryState {
  broken: boolean;
}

// the brief keys the count by screen, but content's list allows only render, network, authority, asset and other for client/error.
const RENDER = "render";

/** React catches a render error only in a class component; this is the one class in the client. */
export class CountedBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { broken: false };

  static getDerivedStateFromError(): BoundaryState {
    return { broken: true };
  }

  override componentDidCatch(): void {
    counting().count("client/error", RENDER);
  }

  override render(): ReactNode {
    if (!this.state.broken) return this.props.children;
    return (
      <div role="alert" className="flex flex-col items-start gap-3 p-4">
        <p>{say("ui.broken")}</p>
        <Button onClick={() => location.reload()}>{say("ui.broken.reload")}</Button>
      </div>
    );
  }
}
