// The terms of play and the privacy notice: plain pages served beside the game
// at /terms and /privacy, read with no game, no sign-in and no script. Their words live
// in the two templates beside this file; who runs the game comes from content's
// one constant (docs/rules/region.md, "Who runs the game"), so these pages
// never spell it themselves.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { OPERATOR, type Operator } from "@japacity/content";

import { LEGAL_TEMPLATES } from "./addresses";

export { LEGAL_TEMPLATES } from "./addresses";

export interface LegalPage {
  /** Where the page is served, from the site's root: the clean address every link uses. */
  readonly path: string;
  /** The built file, at the top of the client's output. The platform serves it at `path`. */
  readonly file: string;
  readonly html: string;
}

/** The folder of the templates, from the client's root (Vite's `root`). */
export const TEMPLATE_FOLDER = "src/features/legal";

const FIELD = /\{\{operator\.(\w+)\}\}/g;

function escape(words: string): string {
  return words.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

/** A template with every `{{operator.<field>}}` filled. A field the operator does not have stops the build. */
export function fillOperator(template: string, operator: Operator = OPERATOR): string {
  return template.replace(FIELD, (_whole, field: string) => {
    if (!Object.hasOwn(operator, field)) throw new Error(`The legal pages ask for operator.${field}, which the operator constant does not have.`);
    return escape(operator[field as keyof Operator]);
  });
}

/** Both pages as served, read from the client's root. */
export function legalPages(clientRoot: string, operator: Operator = OPERATOR): LegalPage[] {
  return LEGAL_TEMPLATES.map(({ path, file, template }) => ({
    path,
    file,
    html: fillOperator(readFileSync(join(clientRoot, TEMPLATE_FOLDER, template), "utf8"), operator),
  }));
}
