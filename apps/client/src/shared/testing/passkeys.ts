// A phone's passkeys as the browser's WebAuthn calls show them to the page: what it says it can do, the passkey it
// answers a sign-in with, how it answers a new passkey, and what it is told about one the server no longer holds.
// Set in place of the browser's own for one test and taken away after it.
import { vi } from "vitest";

export interface PhoneAnswers {
  /** The credential id the phone signs in with. */
  signsInWith?: string;
  /** What the browser's capabilities call says; with `capabilities` null the call is missing. */
  capabilities?: Record<string, boolean> | null;
  /** The platform authenticator's answer where the capabilities call is missing. */
  platform?: boolean;
  /** The name of the DOMException the phone throws: at a sign-in, and at a new passkey. */
  signInFails?: string;
  createFails?: string;
}

export interface Phone {
  /** The options of every sign-in the phone was asked for, with their allowed credential ids. */
  asked: { allow: string[] }[];
  /** Each passkey the phone was told the server no longer holds. */
  signalled: { rpId: string; credentialId: string }[];
  restore: () => void;
}

const bytes = (text: string) => new TextEncoder().encode(text).buffer;

function idOf(raw: ArrayBuffer | ArrayBufferView): string {
  const view = raw instanceof ArrayBuffer ? new Uint8Array(raw) : new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  return btoa(String.fromCharCode(...view))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function fakePhone({ signsInWith = "b3duLWtleQ", capabilities = { passkeyPlatformAuthenticator: true, hybridTransport: true }, platform = true, signInFails, createFails }: PhoneAnswers = {}): Phone {
  const asked: Phone["asked"] = [];
  const signalled: Phone["signalled"] = [];
  const statics = Object.assign(function PublicKeyCredential() {}, {
    ...(capabilities === null ? {} : { getClientCapabilities: () => Promise.resolve(capabilities) }),
    isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(platform),
    signalUnknownCredential: (options: { rpId: string; credentialId: string }) => (signalled.push(options), Promise.resolve()),
  });
  const get = (options: { publicKey: { allowCredentials?: { id: ArrayBuffer }[] } }) => {
    asked.push({ allow: (options.publicKey.allowCredentials ?? []).map((one) => idOf(one.id)) });
    if (signInFails !== undefined) return Promise.reject(new DOMException("The phone said no.", signInFails));
    return Promise.resolve({
      id: signsInWith,
      rawId: bytes(signsInWith),
      type: "public-key",
      response: { authenticatorData: new ArrayBuffer(37), clientDataJSON: bytes("{}"), signature: new ArrayBuffer(8), userHandle: null },
      getClientExtensionResults: () => ({}),
      authenticatorAttachment: "platform",
    });
  };
  const create = () => (createFails === undefined ? Promise.reject(new DOMException("No authenticator here.", "NotSupportedError")) : Promise.reject(new DOMException("The phone said no.", createFails)));
  vi.stubGlobal("PublicKeyCredential", statics);
  const before = Object.getOwnPropertyDescriptor(navigator, "credentials");
  Object.defineProperty(navigator, "credentials", { value: { get, create }, configurable: true });
  return {
    asked,
    signalled,
    restore: () => {
      vi.unstubAllGlobals();
      if (before === undefined) Reflect.deleteProperty(navigator, "credentials");
      else Object.defineProperty(navigator, "credentials", before);
    },
  };
}
