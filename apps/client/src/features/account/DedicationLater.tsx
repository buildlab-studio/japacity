// The dedication page fetched only when it is first opened (account:dedication-page-and-its-doors; engine:first-download-has-budget,
// the first visit's size): the third light and the version line's five taps stay on the first visit, small, and the
// page with its sheet comes in its own chunk on the first tap, its words in another (shared/words/later.ts). Until both are in nothing of it
// is drawn, so no key shows.
import { Suspense, useState } from "react";

import type { DedicationProps } from "./Dedication";
import { loadLaterWords } from "../../shared/words/later";
import { softLazy } from "../../shared/net/parts";

const Page = softLazy(() => Promise.all([import("./Dedication"), loadLaterWords("dedication")]).then(([page]) => ({ default: page.Dedication })));

export function DedicationLater(props: DedicationProps) {
  const [asked, setAsked] = useState(props.open);
  if (props.open && !asked) setAsked(true);
  if (!asked) return null;
  return (
    <Suspense fallback={null}>
      <Page {...props} />
    </Suspense>
  );
}
