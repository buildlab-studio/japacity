# 0007. Mail is sent through Cloudflare Email Service

Status: Accepted

## Context

- The game sends mail for two things only: the sign-in codes and the passkey notices (account:sign-in-routes-rate-limited).
- It needs a provider that sends transactional mail from the Worker.
- There should be no secret to keep.
- The sending reputation should be kept apart from the domain that receives mail.

## Decision

The codes and the notices are sent through Cloudflare Email Service, by a `send_email` binding named `MAIL` on the game's Worker, in production and on staging.

**The sender**

- The binding may send from one address only (`allowed_sender_addresses`): `game@mail.japacity.app`, display name Japacity.
- That address is kept in one constant, `SENDER` in `apps/server/src/mail/mail.ts`. A test holds it equal to the binding's list.

**Every mail**

- It carries `Reply-To: hello@japacity.app`, since the sending subdomain has no inbox.
- It has a text part and a plain HTML part that say the same.

**One seam sends**, trying in order:

1. Mailpit on the local stack;
2. else the binding, when it is bound;
3. else every send is refused.

**Failures**

- A send the binding refuses fails with the binding's error code alone: never its message, the address or the code (server:secrets-stay-on-server).
- No reply waits on a send (account:email-code-is-short-lived).

## Consequences

- A binding means no API key to keep, rotate or leak.
- It sends transactional mail only, which is all the game sends.
- The sending subdomain keeps the reputation of the game's mail apart from the main domain `japacity.app`, which only receives mail.
- Tests never send: the binding is faked there.

## Alternatives

- **An outside mail provider's HTTP API, called from the Worker.** It works the same, but needs an API key kept as a secret and rotated, and a sending domain set up with that provider.
