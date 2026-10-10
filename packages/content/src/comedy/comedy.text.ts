// The joke versions of report lines (comedy.data.ts says which lines and how
// many), and officialdom written straight. First
// drafts for the maintainer to edit. Jokes aim at situations, systems and luck;
// bad news never has a version.
export const comedyText: Record<string, string> = {
  "line.activity.salary.v2": "Salary from {job}: {amount}. Three people you had not heard from since March sent \"How far?\" the same afternoon.",
  "line.activity.salary.v3": "Salary from {job}: {amount}. For one evening, everybody's favourite person is you.",
  "line.activity.salary.v4": "Salary from {job}: {amount}. You checked it twice, in case it changed its mind.",

  "line.activity.job-started.v2": "You started a new job: {job}. Your mother had told the whole street by noon.",
  "line.activity.job-started.v3": "You started a new job: {job}. The office chair squeaks. It is yours anyway.",
  "line.activity.job-started.v4": "You started a new job: {job}. By evening, somebody's cousin was asking if they are hiring.",

  "line.activity.rested.v2": "You rested when you had the time. Your phone rang twice. You let it.",
  "line.activity.rested.v3": "You rested when you had the time. Nobody could reach you. That was the plan.",
  "line.activity.rested.v4": "You rested when you had the time. You slept like someone with no deadlines. You have deadlines.",

  "line.activity.played.v2": "This month: {activity}. Your mother called it progress when she told people.",
  "line.activity.played.v3": "This month: {activity}. The plan is moving, at about the speed of Third Mainland at six.",

  "line.wallet.upkeep.v2": "Living costs: {amount}. Prices went up again. Nobody announced it.",
  "line.wallet.upkeep.v3": "Living costs: {amount}. Bread went up again, and somehow got smaller.",
  "line.wallet.upkeep.v4": "Living costs: {amount}. Food, fuel, light. The usual suspects.",

  "line.wallet.bank-charge.v2": "The bank's charge: {amount}. Nobody could say what for, the bank included.",
  "line.wallet.bank-charge.v3": "The bank's charge: {amount}. The message telling you about it cost extra.",
  "line.wallet.bank-charge.v4": "The bank's charge: {amount}. A small fee, for being charged.",

  "line.wallet.social.v2": "Spent going out: {amount}. The suya was worth it. Your account has questions.",
  "line.wallet.social.v3": "Spent going out: {amount}. You said one drink. The table said otherwise.",

  "line.wallet.converted.v2": "Changed money. {amount} in hand. The rate moved twice while you were deciding.",
  "line.wallet.converted.v3": "Changed money. {amount} in hand. You checked the sum twice anyway.",

  "line.wallet.gift.v2": "A gift landed: {amount}. It came with a voice note you played at least twice.",
  "line.wallet.gift.v3": "A gift landed: {amount}. Your uncle said it is \"for something small\". Nobody said what.",
  "line.wallet.gift.v4": "A gift landed: {amount}. You said thank you in three messages and one sticker.",

  "line.document.requested.v2": "Your {document} is on the way. It should be ready {month}. \"Should\" is doing a lot of work in that sentence.",
  "line.document.requested.v3": "Your {document} is on the way. It should be ready {month}. The man at the desk said to check back. He says it to everyone.",
  "line.document.requested.v4": "Your {document} is on the way. It should be ready {month}. You have a slip of paper. Guard it.",

  "line.document.issued.v2": "Your {document} is ready. You held it the way people hold a newborn.",
  "line.document.issued.v3": "Your {document} is ready. The photo looks nothing like you, which is how you know it is official.",

  "line.news.delivered.v2": "In the news this month: {story}. Your uncle had already forwarded it, with three details of his own.",
  "line.news.delivered.v3": "In the news this month: {story}. Everybody at the bus stop was an expert by evening.",
  "line.news.delivered.v4": "In the news this month: {story}. The family group has questions. Most of them are about you.",

  // Officialdom, written completely straight (row 3): the closing line of each page.
  "official.refusal.closer": "You may submit a new application at any time. A new application needs a new fee.",
  "official.bank-queue.closer": "Your request is important to us and will be processed in order of receipt.",
  "official.embassy.closer": "New appointments are released regularly. Please check again later.",
  // The refusal letter's last line, the one worth posting (row 7). Bad news, so it stays straight.
  "official.refusal.last": "Refused. Not finished.",
};
