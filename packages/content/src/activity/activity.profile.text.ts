// The waiting months' acts (activity:waiting-months-build-profile): names, blurbs and the lines the raise and the
// quiz are told with.
export const activityProfileText: Record<string, string> = {
  "activity.open-source.name": "Work on open source",
  "activity.open-source.blurb": "Fixes and features for code anyone can read. People who matter see your name on it, and some months it adds a piece worth showing.",
  "activity.tech-posts.name": "Post about your work",
  "activity.tech-posts.blurb": "A thread from the phone on what you built this month. It takes an evening and none of your free time.",
  "activity.conference-talk.name": "Give a talk",
  "activity.conference-talk.blurb": "Twenty minutes on what you built, in front of the room at the hub. Once in a career like this one.",
  "activity.be-noticed.name": "Get noticed at work",
  "activity.be-noticed.blurb": "Stay late, take the job nobody wants, make sure your manager sees it. Some months it turns into a raise.",
  "activity.nurse-certification.name": "Sit the certification exam",
  "activity.nurse-certification.blurb": "Three questions at the clinic. Two right and the certificate comes in two months.",
  "activity.masters-at-home.name": "A master's at home",
  "activity.masters-at-home.blurb": "Evenings and weekends at a university here for twelve months, the fees paid month by month. A master's adds to Canada's points.",

  // activity:waiting-months-build-profile: the draw at work, the quiz marked the moment it is answered, and what the acts built.
  "line.activity.raised": "Your manager noticed: {rise} more a month from next month.",
  "line.activity.not-noticed": "{job}: you stayed late again. Nobody has said anything yet.",
  "line.activity.exam-passed": "The exam: {right} of {asked} right. You passed.",
  // What a waiting month's act came to, the month it happens.
  "line.activity.piece-built": "A piece for the portfolio: {pieces} of {need}.",
  "line.activity.piece-built-more": "Another piece for the portfolio. That made {pieces}.",
  "line.activity.first-merged": "Your first contribution was merged. Your name is on it.",
  "line.activity.contributed": "More of your fixes were merged. No new piece this month.",
  "line.activity.exam-failed": "The exam: {right} of {asked} right. A pass needs {pass}. You can sit it again.",
  // How the talk went, from its answer, and what it counted for.
  "line.activity.exam-passed.activity.conference-talk": "The talk went well: three people asked for your handle. It counts toward the endorsement's letters.",
  "line.activity.exam-failed.activity.conference-talk": "The talk fell flat. It still counts toward the endorsement's letters.",
  // A course at home cut short by the flight (activity:waiting-months-build-profile).
  "line.activity.course-ended": "Your course ends with the flight: {activity}. Nothing more is charged for it.",
};
