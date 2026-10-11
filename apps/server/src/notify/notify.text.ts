// R-CLOCK-031: the words of the bank-full notice, sent by the server.
// every other word lives in packages/content; it is added into content's text table and the job reads it there.
export const notifyText = {
  "notify.bank-full": "Your months are full. Come and live them.",
} as const;

/** The game's name, the notice's title. */
export const NOTICE_TITLE = "Japacity";
