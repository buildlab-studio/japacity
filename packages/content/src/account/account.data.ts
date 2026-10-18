// The username's two lists (account:username-and-unconfirmed-email). The server
// folds a name before it compares (capitals, underscores, digits that stand
// for letters, letters said twice), and the same folding is applied to these
// words, so each is written once in plain letters. A name is refused when its
// folded form holds one of them anywhere.

/** The game's name and the words that would pass a player off as the game's own people. */
export const reservedNames: readonly string[] = ["japacity", "admin", "support", "staff", "official", "moderator"];

/**
 * Words no username may hold. A short first list: words that hide inside
 * ordinary names (as "sex" in Essex, "dick" in Dickson, "nazi" in Nazir) are
 * left out on purpose, since a name is matched anywhere it holds a word.
 */
export const blockedWords: readonly string[] = [
  "fuck",
  "shit",
  "cunt",
  "bitch",
  "bastard",
  "whore",
  "slut",
  "nigger",
  "nigga",
  "faggot",
  "retard",
  "rapist",
  "porn",
  "hitler",
  "paedo",
  "pedophile",
  "penis",
  "vagina",
  "wanker",
  "twat",
  "ashawo",
  "olosho",
];
