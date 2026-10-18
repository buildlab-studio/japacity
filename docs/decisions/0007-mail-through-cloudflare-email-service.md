# 0007. Mail leaves through Cloudflare Email Service

Status: Accepted

## Context

The game sends mail for two things only: the sign-in codes and the passkey notices (account:sign-in-routes-rate-limited). It needs a provider that sends transactional mail from the Worker, with no secret to keep and with the sending reputation kept apart from the domain that receives mail.

## Decision

The codes and the notices leave through Cloudflare Email Service, by a `send_email` binding named `MAIL` on the game's Worker, in production and on staging.

- The binding may send from one address only (`allowed_sender_addresses`): `game@mail.japacity.app`, display name Japacity, kept in one constant (`SENDER` in `apps/server/src/mail/mail.ts`) that a test holds equal to the binding's list.
- Every mail carries `Reply-To: hello@japacity.app`, since the sending subdomain has no inbox, and has a text part and a plain HTML part saying the same.
- One seam sends, in order: Mailpit on the local stack, else the binding when it is bound, else every send refused.
- A send the binding refuses rejects with the binding's error code alone, never its message, the address or the code (server:secrets-stay-on-server), and no reply waits on a send (account:email-code-is-short-lived).

## Consequences

- A binding, so there is no API key to keep, rotate or leak.
- It is included with the Workers Paid plan, with a monthly allowance and a charge per thousand past it, and a new account starts on a small daily quota that grows with good sending.
- It sends transactional mail only, which is all the game sends.
- The sending subdomain keeps the reputation of what the game sends apart from the apex `japacity.app`, which only receives mail.
- Tests never send: the binding is faked there.
