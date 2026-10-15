// The dedication page fetched only when it is first opened (docs/rules/account.md R-ACCOUNT-032; engine.md R-ENGINE-020,
// the first visit's size): the third light and the version line's five taps stay on the first visit, small, and the
// page with its sheet comes in its own chunk on the first tap. Until then nothing of it is drawn.
import { lazy, Suspense, useState } from "react";

import type { DedicationProps } from "./Dedication";

const Page = lazy(() => import("./Dedication").then((page) => ({ default: page.Dedication })));

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
