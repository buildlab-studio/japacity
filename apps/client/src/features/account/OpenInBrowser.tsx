// The way out of an in-app browser (account:guest-secures-the-life), one button wherever it is offered: on the start screen before
// a life exists, on the ways back in, and on the keep sheet once the life is kept. On Android it is a link that opens
// the page in Chrome, or the plain address where Chrome is not there; on an iPhone no link can, so it opens a small sheet
// that says how to do it by hand, with the address to copy. Nothing is forced: the game plays on where it is.
import { useState } from "react";

import { Button } from "../../shared/ui/Button";
import { Sheet } from "../../shared/ui/Sheet";
import { say } from "../../shared/words/text";
import { browserLink } from "./inApp";

function pageHref(): string {
  return typeof location === "undefined" ? "/" : location.href;
}

const LINK = "press inline-flex min-h-11 items-center justify-center rounded-md border border-ink/70 bg-sheet-2 px-4 font-semibold";

export function OpenInBrowser({ agent, href = pageHref() }: { agent: string; href?: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = browserLink(href, agent);

  async function copy() {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (link !== null) {
    return (
      <a className={LINK} href={link} data-open-in-browser>
        {say("ui.account.in-app.open")}
      </a>
    );
  }
  return (
    <>
      <Button onClick={() => setOpen(true)} data-open-in-browser>
        {say("ui.account.in-app.open")}
      </Button>
      <Sheet open={open} onOpenChange={setOpen} title={say("ui.account.in-app.open")}>
        <div className="flex flex-col gap-3" data-open-how>
          <p>{say("ui.account.in-app.how")}</p>
          <div>
            <Button onClick={() => void copy()}>{say("ui.account.in-app.copy")}</Button>
          </div>
          <p role="status" className={copied ? "" : "sr-only"}>
            {copied ? say("ui.account.in-app.copied") : ""}
          </p>
        </div>
      </Sheet>
    </>
  );
}
