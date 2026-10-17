// R-CLOCK-031: the words of the bank-full notice, sent by the server.
// Every other word lives in packages/content; this one key stays with the job that sends it.
export const notifyText = {
  "notify.bank-full": "Your months are full. Come and live them.",
} as const;

/** The game's name, the notice's title. */
export const NOTICE_TITLE = "Japacity";
