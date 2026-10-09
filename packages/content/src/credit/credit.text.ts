// Report lines for the credit file (docs/rules/credit.md). A mark is a point, never money.
export const creditText: Record<string, string> = {
  "line.credit.first": "Your first payment on time is on your credit file. It reads {mark}.",
  "line.credit.missed": "A missed payment is on your credit file. It reads {mark} now.",
  "line.credit.judgment": "A court judgment is on your credit file. It stays there {until}.",
  "line.credit.reopened": "Your old credit file is still here, a little worse for the time away. It reads {mark}.",
};
