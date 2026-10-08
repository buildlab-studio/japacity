// The two pages a player reads before and while playing, served as static
// files beside the game. Opened beside the game so the life stays where it is.
import { say } from "../../shared/words/text";

export const TERMS_PATH = "/legal/terms.html";
export const PRIVACY_PATH = "/legal/privacy.html";

export const LEGAL_LINKS = [
  { href: TERMS_PATH, words: "ui.legal.terms" },
  { href: PRIVACY_PATH, words: "ui.legal.privacy" },
] as const;

export function LegalLinks() {
  return (
    <nav aria-label={say("ui.legal.label")} className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
      {LEGAL_LINKS.map((link) => (
        <a key={link.href} href={link.href} target="_blank" rel="noopener" className="underline underline-offset-4 decoration-line hover:decoration-ink">
          {say(link.words)}
        </a>
      ))}
    </nav>
  );
}
