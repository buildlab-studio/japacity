// What each month-act says of itself as the month passes (docs/rules/world.md R-WORLD-030): one or
// two lines an act, keyed `activity.<id>.signal.<n>`, each with the week of the act it comes in (1 is
// the act's first week). The interface counts the days and tells them on the phone once the
// character is home; the simulation never reads them. Lines are said every month the act is on, so
// none counts modules or names a first time. First drafts in the voice of docs/rules/text.md.

export interface ActivitySignal {
  /** The week of the act the line comes in: 1 to 4. */
  week: number;
  words: string;
}

export const activitySignals: Record<string, ActivitySignal> = {
  // Jobs at home.
  "activity.job-teacher.signal.1": { week: 1, words: "School: thirty-two in the class this term. You know all their names now." },
  "activity.job-teacher.signal.2": { week: 3, words: "School: marking till late. Red pen in your bag, red pen on your hand." },
  "activity.job-customer-service.signal.1": { week: 1, words: "The call centre: a customer shouted for ten minutes. You kept your voice down." },
  "activity.job-junior-dev.signal.1": { week: 1, words: "Work: your change went live this week. Nothing broke." },
  "activity.job-mid-dev.signal.1": { week: 1, words: "Work: three reviews and a fix of your own. The juniors ask you now." },
  "activity.job-bank-officer.signal.1": { week: 1, words: "The bank: month-end targets. You were on the phone to customers till seven." },
  "activity.job-bank-senior.signal.1": { week: 1, words: "The bank: a loan file signed off and the late meeting taken." },
  "activity.job-remote-dev.signal.1": { week: 1, words: "Work: the standup is at three in the afternoon here. The light held." },
  "activity.job-phone-sales.signal.1": { week: 1, words: "The stall: a customer bargained for an hour and bought the cheapest one." },
  "activity.job-nurse.signal.1": { week: 1, words: "The ward: your shift ran late. You came home at eleven." },
  "activity.job-nurse.signal.2": { week: 3, words: "The ward: two nights in a row. The matron says you are steady." },
  // The trader's own shop (R-ACTIVITY-016).
  "activity.run-shop.signal.1": { week: 1, words: "The shop: the first week's takings in the tin. You restocked on Friday." },
  "activity.run-shop.signal.2": { week: 3, words: "The shop: a regular now. She sends her neighbour." },
  // The fish racks at Makoko (R-ACTIVITY-017).
  "activity.job-fish-racks.signal.1": { week: 1, words: "The racks: the boats came in before light. Your eyes stung from the smoke till noon." },

  // Jobs abroad.
  "activity.job-uk-nurse.signal.1": { week: 1, words: "The ward: twelve hours and a handover. You ate standing up." },
  "activity.job-uk-care.signal.1": { week: 1, words: "The rounds: six visits and a bus between each. The last one ran late." },
  "activity.job-uk-senior-care.signal.1": { week: 1, words: "The rota: you covered a shift nobody else would take." },
  "activity.job-uk-senior-dev.signal.1": { week: 1, words: "Work: you led the planning meeting. It ran over." },
  "activity.job-uk-skilled.signal.1": { week: 1, words: "Work: a long week. The manager thanked you in an email." },
  "activity.job-uk-graduate.signal.1": { week: 1, words: "Work: you presented to the team. Short, and it landed." },
  "activity.job-uk-warehouse.signal.1": { week: 1, words: "The warehouse: ten hours on your feet. The scanner beeps in your sleep." },
  "activity.job-uk-retail-part.signal.1": { week: 1, words: "The shop: a Saturday on the tills. The queue never ended." },
  "activity.job-uk-kitchen-cash.signal.1": { week: 1, words: "The kitchen: a double shift. Cash in an envelope, nothing written down." },
  "activity.job-uk-courier-cash.signal.1": { week: 1, words: "The deliveries: rain all week, on an account in someone else's name." },
  "activity.job-ca-care-aide.signal.1": { week: 1, words: "The visits: two clients and a bus in the snow between them." },
  "activity.job-ca-dev.signal.1": { week: 1, words: "Work: you shipped a fix before the long weekend." },
  "activity.job-ca-professional.signal.1": { week: 1, words: "Work: a long week of meetings. You spoke up in two." },
  "activity.job-ca-warehouse.signal.1": { week: 1, words: "The warehouse: the night shift. The cold comes in through the loading bay." },
  "activity.job-gulf-cleaner.signal.1": { week: 1, words: "The towers: you started before six. The heat came up by nine." },
  "activity.job-gulf-guard.signal.1": { week: 1, words: "The gate: twelve hours on your feet. The night was quiet." },
  "activity.job-it-farm-cash.signal.1": { week: 1, words: "The farm: picking from dawn. The boss pays at the end of the week, in cash." },

  // Side jobs.
  "activity.weekend-tutoring.signal.1": { week: 1, words: "Tutoring: Saturday with the twins. The maths is coming." },
  "activity.weekend-tutoring.signal.2": { week: 2, words: "Tutoring: their mother asks if you can do Sundays too." },
  "activity.night-support.signal.1": { week: 1, words: "Night support: the queue ran past midnight. You slept at four." },
  "activity.night-support.signal.2": { week: 2, words: "Night support: a customer in another time zone thanked you by name." },
  "activity.ride-driving.signal.1": { week: 1, words: "Driving: three rides after ten. The last one was to Lekki." },
  "activity.ride-driving.signal.2": { week: 2, words: "Driving: a passenger slept the whole way. A quiet night." },

  // The time beside work.
  "activity.apprentice-repair.signal.1": { week: 1, words: "The shop: Oga let you open a phone on your own." },
  "activity.apprentice-repair.signal.2": { week: 2, words: "The shop: a customer came back and asked for you by name." },
  "activity.study-english.signal.1": { week: 1, words: "English class: this week's essay is marked. Better than the last one." },
  "activity.study-english.signal.2": { week: 2, words: "English class: listening practice, twice through. The accents are getting easier." },
  "activity.study-english-uk.signal.1": { week: 1, words: "English class: the teacher says your writing is sharper this week." },
  "activity.study-english-uk.signal.2": { week: 2, words: "English class: you ordered at the counter and nobody asked you to repeat it." },
  "activity.learn-tech.signal.1": { week: 1, words: "Coding class: this week's module is done. The tutor says carry on." },
  "activity.learn-tech.signal.2": { week: 3, words: "Coding class: the light went off halfway. You finished the exercise on your phone." },
  "activity.learn-tech-uk.signal.1": { week: 1, words: "Coding course: this week's module is in." },
  "activity.learn-tech-uk.signal.2": { week: 3, words: "Coding course: the library shut at eight. You finished the exercise on the bus." },
  "activity.learn-tech-ca.signal.1": { week: 1, words: "Coding course: this week's module is in. The forum answered you overnight." },
  "activity.learn-tech-ca.signal.2": { week: 3, words: "Coding course: you stayed up for the last exercise. It runs." },
  "activity.build-portfolio.signal.1": { week: 1, words: "Your project: the first screen works. You show nobody yet." },
  "activity.build-portfolio.signal.2": { week: 3, words: "Your project: you fixed the bug that ate your Sunday." },
  "activity.open-source.signal.1": { week: 1, words: "Open source: your change has a review. Two small fixes asked." },
  "activity.open-source.signal.2": { week: 3, words: "Open source: merged. Your name is on the list of contributors." },
  "activity.conference-talk.signal.1": { week: 1, words: "The talk: the slides are drafted. Twenty minutes is longer than it sounds." },
  "activity.conference-talk.signal.2": { week: 2, words: "The talk: you ran it twice to the mirror. The timing holds." },
  "activity.masters-at-home.signal.1": { week: 1, words: "The master's: this month's reading is long. Half of it went on the danfo." },
  "activity.masters-at-home.signal.2": { week: 3, words: "The master's: the assignment is in, a day before the deadline." },
  "activity.nurse-certification.signal.1": { week: 1, words: "Certification: past questions on every break." },
  "activity.nurse-certification.signal.2": { week: 2, words: "Certification: the study group met at the canteen. You know the drug rounds cold." },
  "activity.interview-prep.signal.1": { week: 1, words: "Interview practice: a friend played the officer. You stumbled on the money question." },
  "activity.interview-prep.signal.2": { week: 2, words: "Interview practice: another go. You answered without looking down." },
  "activity.be-noticed.signal.1": { week: 1, words: "Work: you stayed for the late meeting. Your manager saw." },
  "activity.be-noticed.signal.2": { week: 3, words: "Work: you took the report nobody wanted. It went up with your name on it." },
  "activity.overtime.signal.1": { week: 1, words: "Overtime: you came home at eleven. The bus was full anyway." },
  "activity.morning-run.signal.1": { week: 1, words: "The run: out before the traffic. The road is quiet at five." },
  "activity.family-time.signal.1": { week: 1, words: "Family: Sunday rice at home. Everybody talked at once." },
  "activity.sleep-at-office.signal.1": { week: 1, words: "The office: you slept on the chairs in the meeting room. Security knows you now." },
  "activity.sleep-rough.signal.1": { week: 1, words: "Under the bridge: a cold night. You kept your bag under your head." },
  "activity.rest.signal.1": { week: 1, words: "Rest: you slept past noon on Saturday. Nobody called." },
};

/** The lines as a words table, merged with the rest of content's words. */
export const activitySignalsText: Record<string, string> = Object.fromEntries(Object.entries(activitySignals).map(([key, signal]) => [key, signal.words]));
