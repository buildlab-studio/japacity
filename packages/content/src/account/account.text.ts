// The emails the server sends (account:email-code-is-short-lived, account:passkey-needs-signed-in-session, account:sign-in-routes-rate-limited).
// {code} is the sign-in code, {minutes} how long it works, {date} when a passkey was added or a check changed. The check
// mails (admin:check-change-sends-email) name the check and its state in words, with {value} against {limit} and the {link} to the admin page.
export const accountText: Record<string, string> = {
  "mail.code.subject": "{code} is your Japacity code",
  "mail.code.body": "Your code is {code}. It works for {minutes} minutes.\n\nIf you did not ask for it, do nothing. Nobody can sign in without the code.",
  "mail.passkey-added.subject": "A passkey was added to your Japacity account",
  "mail.passkey-added.body": "A new passkey was added to your account on {date}. It can now sign in for you.\n\nIf you did not add it, someone else may have your phone or your email. Open Japacity, then Settings, then Account, to remove it and sign out on every phone.",
  "mail.check-changed.subject": "Japacity: {check} is {state}",
  "mail.check-changed.body": "The check {check} is {state} since {date}: {value} against a limit of {limit}.\n\nOpen {link} to look.",
  "mail.check.money-suspects": "Money suspects",
  "mail.check.draw-payouts": "Draw payouts",
  "mail.check.diverged-lives": "Diverged lives",
  "mail.check.asked-early": "Asked too early",
  "mail.check.reports-overdue": "Reports past target",
  "mail.check.nightly-counts": "Nightly counts",
  "mail.check.state.alarm": "in alarm",
  "mail.check.state.ok": "OK",
};
