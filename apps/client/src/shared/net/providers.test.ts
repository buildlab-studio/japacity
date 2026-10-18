import { getAuthenticatorName } from "@better-auth/passkey";
import { describe, expect, test } from "vitest";

import { PROVIDERS, providerOf } from "./providers";

describe("a passkey's provider by its AAGUID (account:passkeys-listed-and-removed)", () => {
  test("[account:passkeys-listed-and-removed] given each AAGUID the page names, then it names it as the auth library's own table does, whatever its case", () => {
    for (const aaguid of Object.keys(PROVIDERS)) {
      expect(providerOf(aaguid)).toBe(getAuthenticatorName(aaguid));
      expect(providerOf(` ${aaguid.toUpperCase()} `)).toBe(getAuthenticatorName(aaguid));
    }
  });

  test("[account:passkeys-listed-and-removed] given the all-zero AAGUID of a private authenticator, an unknown one or none, then no provider is named", () => {
    for (const aaguid of ["00000000-0000-0000-0000-000000000000", "12345678-1234-1234-1234-123456789abc", "", null, undefined]) expect(providerOf(aaguid)).toBeNull();
  });
});
