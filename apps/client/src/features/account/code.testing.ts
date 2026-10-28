// The account seam faked for the code step's tests (CodeForm.test.tsx, SignIn.test.tsx): every call is kept with its
// arguments, the new life's mark on a send among them, and each answer can be given per call.
import type { AccountApi, AuthResult } from "../../shared/net/auth";

const OK: AuthResult = { ok: true };

export type Faked = AccountApi & { calls: string[] };

/** The answers given in order, then OK for every call after them. */
export function answers(...given: AuthResult[]): () => Promise<AuthResult> {
  return () => Promise.resolve(given.shift() ?? OK);
}

export function codeAccount(over: Partial<AccountApi> = {}): Faked {
  const calls: string[] = [];
  const kept = (name: string, args: unknown[]) => calls.push(`${name}(${args.map((arg) => JSON.stringify(arg)).join(",")})`);
  const sendCode = over.sendCode ?? (() => Promise.resolve(OK));
  const signInWithCode = over.signInWithCode ?? (() => Promise.resolve(OK));
  const proveNewLife = over.proveNewLife ?? (() => Promise.resolve(OK));
  return {
    calls,
    ageStatus: () => Promise.resolve("unasked"),
    declareAge: () => Promise.resolve("passed"),
    usernameFree: () => Promise.resolve(null),
    startGuest: (username) => (kept("startGuest", [username]), Promise.resolve({ ok: true })),
    view: () => Promise.resolve(null),
    rename: () => Promise.resolve({ ok: true }),
    returnedFromGoogle: () => null,
    signInWithGoogle: () => (kept("signInWithGoogle", []), Promise.resolve(OK)),
    signInWithPasskey: () => (kept("signInWithPasskey", []), Promise.resolve(OK)),
    addPasskey: () => Promise.resolve(OK),
    email: () => Promise.resolve(null),
    deleteAccount: () => Promise.resolve(OK),
    signOut: () => Promise.resolve(OK),
    signOutEverywhere: () => Promise.resolve(OK),
    passkeysWork: () => Promise.resolve(true),
    passkeys: () => Promise.resolve([]),
    removePasskey: () => Promise.resolve({ ok: true, signedIn: true }),
    confirmWithPasskey: () => Promise.resolve(OK),
    usageCounts: () => Promise.resolve(null),
    setUsageCounts: () => Promise.resolve(true),
    ...over,
    sendCode: (email, bot, newLife) => (kept("sendCode", newLife === true ? [email, "new life"] : [email]), sendCode(email, bot, newLife)),
    signInWithCode: (email, code, bot) => (kept("signInWithCode", [email, code]), signInWithCode(email, code, bot)),
    proveNewLife: (email, code) => (kept("proveNewLife", [email, code]), proveNewLife(email, code)),
  };
}
