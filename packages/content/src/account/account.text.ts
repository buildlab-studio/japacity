// The emails the server sends (account.md R-ACCOUNT-002, R-ACCOUNT-003, R-ACCOUNT-014).
// {code} is the sign-in code, {minutes} how long it works, {date} when a passkey was added.
export const accountText: Record<string, string> = {
  "mail.code.subject": "Your Japacity code",
  "mail.code.body": "Your code is {code}. It works for {minutes} minutes.\n\nIf you did not ask for it, do nothing. Nobody can sign in without the code.",
  "mail.passkey-added.subject": "A passkey was added to your Japacity account",
  "mail.passkey-added.body": "A new passkey was added to your account on {date}. It can now sign in for you.\n\nIf you did not add it, someone else may have your phone or your email.",
};
