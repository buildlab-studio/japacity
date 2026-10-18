// Google's own sign-in button (account:guest-secures-the-life): the standard button Google's
// branding guidelines describe, so a player knows it at once and Google's review finds it as the guidelines ask. The G
// is Google's asset, unchanged (public/brand/google-g.svg); the colours, the sizes and the face are the guidelines'
// (index.css `.google-button`, the `--google-*` tokens: light on a light sheet, dark on a dark one). Nothing is added
// to the mark and nothing else is said on the button: the words are one of the guidelines' own, in content.
export interface GoogleButtonProps {
  /** One of the guidelines' texts: "Continue with Google", "Sign in with Google" or "Sign up with Google". */
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

/** Where the G is served from: Google's mark as Google gives it. */
export const GOOGLE_MARK = "/brand/google-g.svg";

export function GoogleButton({ label, onClick, disabled = false }: GoogleButtonProps) {
  return (
    <button type="button" className="google-button" onClick={onClick} disabled={disabled} data-google-button>
      <img src={GOOGLE_MARK} alt="" width={20} height={20} draggable={false} aria-hidden />
      <span className="truncate">{label}</span>
      <span aria-hidden />
    </button>
  );
}
