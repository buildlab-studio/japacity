// From docs/rules/guide.md, "Entries: the guides". Every source is one in
// docs/research or a rule page's Sources, with the date it was read there.
import type { GuideEntry, Id } from "@japacity/sim";

/** The three parts of every guide (guide:every-route-has-a-guide): the real rules, what the game changes, and what to read next. */
export const GUIDE_SECTIONS = ["real", "game", "next"];

const RESEARCH = "2026-10-07";
const GUIDES_PAGE = "2026-10-08";
const CHECKED = "2026-10-08";

type Source = GuideEntry["sources"][number];

function source(title: string, url: string, readOn: string = RESEARCH): Source {
  return { title, url, readOn };
}

const STUDENT_MONEY = source("gov.uk: Student visa, money", "https://www.gov.uk/student-visa/money");
const APPENDIX_FINANCE = source("gov.uk: Immigration Rules, Appendix Finance", "https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-finance");
const CENTURO = source("Centuro Global: Skilled Worker changes 2025 to 2026", "https://www.centuroglobal.com/article/uk-immigration-2025-changes/");
const DAVIDSON_COSTS = source("Davidson Morris: Skilled Worker costs 2026", "https://www.davidsonmorris.com/tier-2-visa-costs");
const SECRET_FILMING = source("BBC via Graphic: secret filming of sponsorship sellers", "https://www.graphic.com.gh/international/international-news/secret-filming-reveals-brazen-tactics-of-uk-immigration-scammers.html");
const CARE_EXTORTION = source("Guardian Nigeria: care jobs extortion scheme", "https://guardian.ng/news/nigerian-doctor-indicted-for-care-jobs-extortion-scheme-in-uk/");
const CRS_GRID = source("immigration.ca: the CRS grid", "https://www.immigration.ca/express-entry-crs-grid/");
const GULF_FEES = source("BHRRC: fees of up to £1,775 for Gulf guard jobs", "https://www.bhrrc.org/ja/最新ニュース/g4s-faces-calls-to-repay-fees-paid-by-migrant-workers-to-recruitment-agents-for-jobs-in-gulf-states-conflict-zones-includes-co-comments/");
const DUBAI_LOSS = source("Legit: a Nigerian's ₦450,000 loss to a Dubai agent", "https://www.legit.ng/people/1472165-i-got-scammed-lied-my-parents-nigerian-lady-uaes-first-female-delivery-rider-opens-video/");
const IOM_RETURNS = source("IOM Nigeria: returns home with IOM assistance", "https://nigeria.iom.int/news/over-8000-nigerian-migrants-return-home-iom-assistance-past-12-months");
const PIE_FUNDS = source("The PIE News: proof of funds loans, 2023", "https://thepienews.com/?p=180187");
const THE_LENDING = source("Times Higher Education: visa money lending, 2022", "https://www.timeshighereducation.com/news/visa-money-lending-scams-commonplace-warns-ex-minister");
const PIE_AGENTS = source("The PIE News: agents and immigration rules, 2022", "https://thepienews.com/uk-nigerian-agents-help-students-break-immigration-rules/");

function guide(id: Id<"guide">, routes: Id<"route">[], kinds: string[], sources: Source[]): GuideEntry {
  return { id, routes, kinds, sources, checkedOn: CHECKED, sections: GUIDE_SECTIONS };
}

export const guideTable: Record<Id<"guide">, GuideEntry> = {
  "guide.uk-masters": guide(
    "guide.uk-masters",
    ["route.uk-masters"],
    ["route", "school", "document", "setpiece", "wallet"],
    [
      STUDENT_MONEY,
      source("gov.uk: Student visa, apply", "https://www.gov.uk/student-visa/apply"),
      APPENDIX_FINANCE,
      source("UKCISA: Visa fees from 8 April 2026", "https://www.ukcisa.org.uk/news/uk-visa-fees-increasing-from-8-april-2026/"),
      source("UKCISA: Rule changes, September 2026", "https://www.ukcisa.org.uk/news/student-update-changes-to-the-immigration-rules-september-2026/"),
      source("University of the West of Scotland: credibility interview guide, Jan 2026", "https://www.uws.ac.uk/media/k3hkqxbz/ukvi-credibility-interview-guide-january-2026.pdf"),
      source("Times Higher Education: refusal rates rise, May 2026", "https://www.timeshighereducation.com/news/visa-refusal-rates-climb-uk-amid-falling-applicant-numbers"),
      source("gov.uk: TB testing in Nigeria", "https://www.gov.uk/government/publications/tuberculosis-test-for-a-uk-visa-clinics-in-nigeria/tuberculosis-testing-in-nigeria"),
    ],
  ),
  "guide.uk-care": guide(
    "guide.uk-care",
    ["route.uk-care"],
    ["route", "offer", "document", "status"],
    [
      source("Pinsent Masons: care route closes", "https://www.pinsentmasons.com/out-law/news/uk-care-worker-visa-route-closes"),
      CENTURO,
      DAVIDSON_COSTS,
      source("NMC: costs for nurses trained outside the UK", "https://www.nmc.org.uk/registration/joining-the-register/register-nurse-midwife/trained-outside-uk/how-to-guide/check-ready/costs/"),
      source("BusinessDay: no abroad dreams without two years, NMCN", "https://businessday.ng/news/article/no-abroad-dreams-without-2yrs-work-nmcn-tells-nigerian-nurses/"),
      CARE_EXTORTION,
      SECRET_FILMING,
    ],
  ),
  "guide.uk-skilled": guide(
    "guide.uk-skilled",
    ["route.uk-skilled"],
    ["route", "offer", "status"],
    [
      CENTURO,
      source("Jobbatical: salary thresholds", "https://www.jobbatical.com/blog/uk-skilled-worker-visas-salary-thresholds"),
      DAVIDSON_COSTS,
      source("Chambers: the UK 60-day rule", "https://chambers.com/articles/i-lost-my-job-on-a-skilled-worker-visa-the-60-day-rule-explained"),
      SECRET_FILMING,
    ],
  ),
  "guide.canada-points": guide(
    "guide.canada-points",
    ["route.canada-points"],
    ["route", "points", "news"],
    [
      CRS_GRID,
      source("Canada.ca: points criteria", "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score/crs-criteria.html"),
      source("CIC News: foreign work experience and CRS", "https://www.cicnews.com/2025/07/how-foreign-work-experience-can-boost-your-crs-score-in-a-competitive-express-entry-pool-0757515.html"),
      source("CIC News: healthcare draw, Feb 2026", "https://www.cicnews.com/2026/02/latest-express-entry-draw-sees-thousands-of-healthcare-professionals-invited-0271898.html"),
      source("immigration.ca: 3,500 healthcare invitations, Sep 2026", "https://immigration.ca/canada-invites-3500-healthcare-workers-express-entry-september-4-2026/"),
      source("Liberty Immigration: proof of funds 2026", "https://libertyimmigration.ca/express-entry-proof-of-funds-2026-updated-settlement-fund-requirements/"),
    ],
  ),
  "guide.global-talent": guide(
    "guide.global-talent",
    ["route.uk-talent"],
    ["route", "document", "quality"],
    [
      source("GOV.UK: Global Talent", "https://www.gov.uk/global-talent"),
      source("Migrate UK: Global Talent fees 2026", "https://migrate-uk.com/articles/global-talent-visa-fees-2026-complete-cost-breakdown"),
      source("Lewis Silkin: digital technology applicants", "https://lewissilkin.com/en/insights/factsheet-global-talent-digital-technology-applicants"),
      source("Techloy: Nigeria's rank for tech endorsements", "https://techloy.com/nigeria-ranked-third-globally-for-uk-global-tech-talent-visa-in-2021"),
    ],
  ),
  "guide.gulf-work": guide(
    "guide.gulf-work",
    ["route.gulf-contract"],
    ["route", "offer", "status"],
    [
      source("Africanews: UAE lifts the 2022 visa ban", "https://africanews.com/2024/07/17/uae-lifts-2022-visa-ban-on-nigerians"),
      source("Pakistan Bureau of Emigration: UAE security guard listings, AED 1,200 to 2,267", "https://beoe.gov.pk/foreign-jobs/1279899/1498048/55-security-guards-required-in-united-arab-emirates-salary-1200-2267-dirham-aed"),
      GULF_FEES,
      DUBAI_LOSS,
      source("Channels: Saudi-bound women stopped", "https://www.channelstv.com/2025/08/18/naptip-rescues-25-saudi-bound-women-from-trafficking-ring"),
    ],
  ),
  "guide.road": guide(
    "guide.road",
    ["route.road"],
    ["route", "setpiece", "offer"],
    [
      source("FIJ: Soyombo, part one", "https://fij.ng/article/undercover-europe-through-the-sahara-desert-and-the-mediterranean-sea-i/"),
      source("UNRIC: Sahara deaths report", "https://unric.org/en/migration-twice-as-many-migrants-die-crossing-the-sahara-than-the-mediterranean-sea/"),
      source("ANSA: 2024 central Mediterranean deaths", "https://www.ansa.it/amp/english/news/2024/12/11/618-dead-and-918-missing-in-central-med-in-2024-iom_64811c93-838e-4cbe-af8d-9b9311e00dfd.html"),
      source("Guardian Nigeria: stranded in Libya", "https://guardian.ng/news/7000-nigerians-stranded-in-libya-nidcom-reveals/"),
      IOM_RETURNS,
      source("IOM: Nigerian returns from Libya, 2026 flights", "https://www.arise.tv/additional-180-nigerians-return-from-libya-under-iom-repatriation-programme/"),
      source("Leadership: NAPTIP figures", "https://leadership.ng/naptip-rescues-25642-victims-secures-750-convictions/"),
    ],
  ),
  "guide.proof-of-funds": guide(
    "guide.proof-of-funds",
    [],
    ["route", "wallet", "obligation", "offer"],
    [
      STUDENT_MONEY,
      APPENDIX_FINANCE,
      source("University of Westminster: the 28-day rule", "https://www.westminster.ac.uk/international/visas-and-advice/visas/student-visa/financial-requirements-and-the-28-day-rule"),
      source("Case note: unexplained deposits and study permits", "https://dadkhah.ca/blog/case-law/2856/federal-court-unexplained-bank-deposits-are-fatal-to-study-permit-applications/"),
      THE_LENDING,
      PIE_FUNDS,
    ],
  ),
  "guide.rates": guide(
    "guide.rates",
    [],
    ["wallet", "news"],
    [
      APPENDIX_FINANCE,
      source("Al Jazeera: the June 2023 float", "https://www.aljazeera.com/amp/news/2023/6/14/nigeria-allows-naira-to-drop-more-than-36-on-official-market"),
      source("Ripples Nigeria: naira at 1,900, Feb 2024", "https://www.ripplesnigeria.com/naira-in-riotous-mode-on-parallel-window-dips-to-n1900/"),
      source("AllAfrica: rates at the end of 2025", "https://allafrica.com/stories/202601020193.html"),
      source("Nairametrics: banks raise dollar limits, Sep 2026", "https://nairametrics.com/2026/09/07/gtco-firstbank-others-raise-dollar-spending-limits-as-fx-scarcity-eases/"),
      source("The Sun: short-changing at the street market", "https://thesun.ng/bureau-de-cheat/"),
    ],
  ),
  "guide.agents": guide(
    "guide.agents",
    [],
    ["offer", "route"],
    [
      source("BusinessDay: sponsorship certificate fraud", "https://businessday.ng/news/article/japa-nigerian-victims-lament-activity-of-uk-certificate-of-sponsorship-fraudster/"),
      source("Premium Times: EFCC case", "https://www.premiumtimesng.com/news/top-news/863801-how-nigerian-woman-allegedly-defrauded-victim-of-n19m-e8370-for-uk-certificate-efcc.html"),
      CARE_EXTORTION,
      SECRET_FILMING,
      DUBAI_LOSS,
      GULF_FEES,
      PIE_AGENTS,
      source("Immigration and Asylum Act 1999, section 82", "https://www.legislation.gov.uk/ukpga/1999/33/section/82", GUIDES_PAGE),
    ],
  ),
  "guide.numbers": guide(
    "guide.numbers",
    [],
    ["route", "wallet", "activity", "obligation"],
    [
      STUDENT_MONEY,
      source("UKCISA: Visa fees from 8 April 2026", "https://www.ukcisa.org.uk/news/uk-visa-fees-increasing-from-8-april-2026/"),
      CENTURO,
      CRS_GRID,
      DAVIDSON_COSTS,
    ],
  ),
  // The people routes: joining a partner, and going as a dependant (person.md and undertaking.md, read 8 Oct 2026).
  "guide.uk-family": guide(
    "guide.uk-family",
    ["route.uk-partner", "route.uk-dependant"],
    ["route", "people", "interview", "status", "wallet"],
    [
      source("gov.uk: Family visa, partner or spouse", "https://www.gov.uk/uk-family-visa/partner-spouse", GUIDES_PAGE),
      source("gov.uk: Family visa, proof of income for a partner", "https://www.gov.uk/uk-family-visa/proof-income-partner", GUIDES_PAGE),
      source("gov.uk: Skilled Worker visa, your partner and children", "https://www.gov.uk/skilled-worker-visa/your-partner-and-children", GUIDES_PAGE),
      source("gov.uk: Student visa, family members", "https://www.gov.uk/student-visa/family-members", GUIDES_PAGE),
    ],
  ),
  "guide.ca-family": guide(
    "guide.ca-family",
    ["route.ca-spouse", "route.ca-accompany"],
    ["route", "people", "interview", "obligation", "wallet"],
    [
      source("Justice Laws: IRPR s. 130, the five-year requirement", "https://laws-lois.justice.gc.ca/eng/regulations/SOR-2002-227/section-130.html", GUIDES_PAGE),
      source("Justice Laws: IRPR s. 132, length of the undertaking", "https://laws-lois.justice.gc.ca/eng/regulations/SOR-2002-227/section-132.html", GUIDES_PAGE),
      CRS_GRID,
    ],
  ),
};
