// The guides from inside the game (R-GUIDE-005, R-GUIDE-011): a row in the phone's Settings, under About the game,
// beside the credits (`row`), or a small book button; either way the guide
// for the route in view, every guide, the numbers and how the game was made. The credits are a
// screen of the game itself (R-GUIDE-008), not a page here.
// The pages are the prerendered ones, opened beside the game so the life stays where it is.
import { content, guideForRoute } from "@japacity/content";
import { ArrowRight, BookOpen } from "lucide-react";
import { useState } from "react";

import { useView } from "../../authority/GameProvider";
import { Button } from "../../shared/ui/Button";
import { counting } from "../../shared/analytics/start";
import { Sheet } from "../../shared/ui/Sheet";
import { nameOf, say } from "../../shared/words/text";
import { LEGAL_LINKS } from "../../shared/ui/LegalLinks";
import { GUIDES_ROOT, guidePath, MADE_PATH, NUMBERS_PATH } from "./paths";

function PageLink({ href, children }: { href: string; children: string }) {
  return (
    <li>
      <a href={href} target="_blank" rel="noopener" className="underline underline-offset-4 decoration-sheet-line hover:decoration-ink">
        {children}
      </a>
    </li>
  );
}

/** `row`: drawn as a row of the phone's Settings, as the credits' row is (city.md R-CITY-021); else a small book button. */
export function GuidesMenu({ row = false }: { row?: boolean } = {}) {
  const view = useView();
  const [open, setOpen] = useState(false);
  const route = view.japacity.route;
  const routeGuide = route === null ? null : guideForRoute(content, route);
  const show = () => {
    counting().count("screen/opened", "guide");
    setOpen(true);
  };
  return (
    <>
      {row ? (
        <button type="button" aria-label={say("guide.page.menu")} className="lively-card press mt-1 flex w-full items-center justify-between gap-2 p-3 text-left" onClick={show} data-guides-row>
          <span className="min-w-0">
            <span className="block text-[17px] font-bold">{say("guide.page.menu")}</span>
            <span className="block text-[14px] text-text-2">{say("guide.page.game-note")}</span>
          </span>
          <ArrowRight size={20} className="shrink-0" aria-hidden />
        </button>
      ) : (
        <Button small variant="quiet" aria-label={say("guide.page.menu")} onClick={show}>
          <BookOpen size={18} />
        </Button>
      )}
      <Sheet open={open} onOpenChange={setOpen} title={say("guide.page.menu")} description={say("guide.page.game-note")}>
        <nav aria-label={say("guide.page.menu")} className="flex flex-col gap-4">
          {routeGuide === null || route === null ? null : (
            <ul>
              <PageLink href={guidePath(routeGuide)}>{`${say("guide.page.route-link")}: ${nameOf(route)}`}</PageLink>
            </ul>
          )}
          <ul className="flex flex-col gap-2">
            {Object.keys(content.guide).map((id) => (
              <PageLink key={id} href={guidePath(id)}>
                {say(`${id}.title`)}
              </PageLink>
            ))}
          </ul>
          <ul className="flex flex-col gap-2 border-t border-sheet-line pt-4">
            <PageLink href={GUIDES_ROOT}>{say("guide.page.all-guides")}</PageLink>
            <PageLink href={NUMBERS_PATH}>{say("guide.page.numbers.index")}</PageLink>
            <PageLink href={MADE_PATH}>{say("guide.page.made")}</PageLink>
            {LEGAL_LINKS.map((link) => (
              <PageLink key={link.href} href={link.href}>
                {say(link.words)}
              </PageLink>
            ))}
          </ul>
        </nav>
      </Sheet>
    </>
  );
}
