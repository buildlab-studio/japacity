// A person (docs/design/13-the-lively-layer.md, section 2): the name in a pill with a flat round mark carrying the initial,
// never a face render, until the characters are redone. The mark's colour comes from the name, so a person keeps theirs.

/** How many mark colours there are (index.css --face-1 to --face-6). */
const FACE_COLOURS = 6;

/** A name's mark: its first letter, raised, and which of the mark colours it takes. */
export function faceMark(name: string): { initial: string; colour: string } {
  const letters = [...name.normalize("NFC").trim()];
  const initial = letters[0]?.toLocaleUpperCase() ?? "?";
  const sum = letters.reduce((total, letter) => total + (letter.codePointAt(0) ?? 0), 0);
  return { initial, colour: `var(--face-${String((sum % FACE_COLOURS) + 1)})` };
}

export function Face({ name, className = "" }: { name: string; className?: string }) {
  const mark = faceMark(name);
  return (
    <span className={`pill py-1 pr-3 pl-1 ${className}`} data-face={name}>
      <span className="face-mark flex size-6 shrink-0 items-center justify-center text-[13px] font-bold text-white" style={{ background: mark.colour }} aria-hidden="true" data-face-mark>
        {mark.initial}
      </span>
      {name}
    </span>
  );
}
