# UK master's route and money at home: working numbers

Sources checked October 2026.

The figures behind `../rules/route.md`, `../rules/document.md`, `../rules/rate.md`, `../rules/activity.md` and `../rules/obligation.md`. The game's three universities are invented; the real ones below set their price and deposit.

## Fees paid to the UK government

| Figure | Value | Holds from | Source |
|---|---|---|---|
| Student visa, applying from outside the UK | £558 | 8 Apr 2026 | gov.uk, Student visa; UKCISA |
| Immigration health surcharge, students | £776 a year | 6 Feb 2024 | gov.uk, health surcharge |
| Surcharge for a 12-month course | £1,164 | 6 Feb 2024 | Calculated from the two rules below |

- A course of 12 months or more is granted 1 month before it and 4 months after it (Appendix Student ST 25.3), so 17 months.
- The surcharge for a visa of more than a year and up to 18 months is the yearly cost plus half: £776 plus £388 (gov.uk).
- In the game: `var.uk-visa-fee` 55800 and `var.uk-surcharge` 116400 pence.

## Living money

| Figure | Value | Holds for | Source |
|---|---|---|---|
| Outside London | £1,171 a month, up to 9 months: £10,539 | Applications before 30 Nov 2026 | gov.uk, Student visa: money; ST 12.3 |
| Outside London, raised | £1,203 a month, up to 9 months: £10,827 | Applications on or after 30 Nov 2026 | Statement of Changes HC 584, 3 Sep 2026; UKCISA |

- In the game: `var.uk-living-line` starts at 117100 pence and `news.uk-living-rise` sets 120300.

## The 28-day rule and the exchange rate

| Rule | Words | Where |
|---|---|---|
| Holding period | "You must have this money for at least 28 days in a row." | gov.uk, Student visa: money |
| How recent | "The end date of the 28-day period must be within 31 days of the date you apply for your visa." | gov.uk, Student visa: money |
| Exchange rate | Foreign money is converted to pounds "using the spot exchange rate which appears on www.oanda.com for the date of the application." | Appendix Finance FIN 1.1 |

- The rate is the one on the day of application, not the day the money went in. A naira fall during the 28 days can leave a player short.
- Money from an official sponsor or a qualifying student loan does not need the 28 days (ST 12.6).

## Whose money counts

| Money | Counts? | Rule |
|---|---|---|
| The applicant's own account, alone or joint | Yes | FIN 5.1 |
| A parent's or legal guardian's account | Yes, with "proof of that relationship and written consent" | FIN 5.1, 5.3 |
| A student loan from a government, a government loan company, or a lender regulated for student loans in its country | Yes, with a lender's letter dated within 6 months | FIN 8.3, 9.2 |
| An official sponsor: a government, the British Council, an international organisation or company, a university | Yes | FIN 8.3 |
| Uncles, siblings, friends | No; promises of future support from others are not accepted | FIN 5.1, 6.1 |

- Ordinary personal loans are not named. Borrowed money paid into the account is the applicant's balance on paper, and where it came from becomes a question for the interview.

## Tuition to show

- The money to show is "any outstanding course fees as stated on the Confirmation of Acceptance for Studies" plus living money (ST 12.3).
- Fees already paid count if they are on the CAS or on a university receipt (ST 12.5). For a one-year master's that is the fee less the deposit and any discount.

## English

| Figure | Value | Source |
|---|---|---|
| Visa level for degree study | CEFR B2; the university may assess it | gov.uk, Student visa: English |
| Nigeria on the list of majority English-speaking countries | No | gov.uk, Student visa: English |
| Teesside, MA and MSc | IELTS 6.0, or WAEC English at C6 | Teesside University |
| Leicester, Finance MSc | IELTS 6.5 | University of Leicester (archived May 2026) |
| Manchester, MSc Data Science and AI | IELTS 7.0, no part below 6.5 | University of Manchester |
| How long a secure English test result is valid | "2 years from the date the test is awarded" | gov.uk, secure English language tests |
| IELTS for UKVI fee in Nigeria | ₦295,000 from 15 Jul 2025 (IELTS on computer ₦279,500) | British Council Nigeria |

- In the game: the schools ask no band, since a degree's statement meets the master's English (route:degree-meets-masters-english); `document.english-test` is valid 24 months; `activity.sit-english-test` costs ₦295,000.

## TB test

| Figure | Value | Source |
|---|---|---|
| Needed from Nigeria | For stays of 6 months or more | gov.uk, TB test for a visa |
| IOM clinics in Abuja, Lagos and Benin City | $94, paid in naira at the UN rate | gov.uk, TB testing in Nigeria (updated 13 May 2026) |
| Approved private clinics in Lagos | ₦120,000 | gov.uk, TB testing in Nigeria |
| Certificate valid for | 6 months from the X-ray | gov.uk, TB test for a visa |

## Decision time and the CAS

- A decision usually comes within 3 weeks from outside the UK (gov.uk, Student visa: apply). In the game: `decisionMonths` 1.
- The visa must be applied for "within 6 months of receiving your CAS" (gov.uk, Student visa: course).

## Tuition, deposits and discounts

| University | One-year master's, international | Deposit before the CAS | Entry | Source |
|---|---|---|---|---|
| Teesside, MSc or MA | £17,000 | £4,000, refunded if the visa is refused | 2026 to 2027 | Teesside University |
| Leicester, Finance MSc | £24,250 | £3,000; refunded after a refusal unless it was for "misleading documentation or credibility" | Sep 2026 | University of Leicester (archived May 2026) |
| Manchester, MSc Data Science | £35,200 | £2,500, higher for some applicants | Sep 2026 | University of Manchester (archived Jan 2026) |
| Coventry, applicants from Nigeria | | £8,000 (£4,000 for most of Africa) | Current | Coventry University |

| Discount | Amount | Automatic? | Source |
|---|---|---|---|
| Northumbria, Nigeria-domiciled self-funded taught master's | £6,000 | Yes | Northumbria University, Sep 2026 and Jan 2027 |
| Coventry Group Scholarship | £2,000 a year | Yes, once the full CAS deposit clears on time | Coventry University, 2026 to 2027 |
| Teesside Global Excellence | £2,000 | On grades | Teesside University |
| Teesside Vice Chancellor's | £7,000 | Competitive | Teesside University |

- In the game: Northgate £17,000 and £4,000, Ashby £24,250 and £5,000, Kingsmere £35,200 and £6,000. Northgate's deposit is the common real figure; Ashby's and Kingsmere's are 1.25 and 1.5 times it, a game choice (`../rules/route.md`), inside the real range of £2,500 to £8,000 for Nigerian applicants. The discounts of £2,000 to £5,000 sit inside the real £2,000 to £7,000.

## Refusals and interviews

| Figure | Value | Period | Source |
|---|---|---|---|
| Nigerian study visa refusal rate | 21% (refusals four times the year before) | Jan to Mar 2026 | Times Higher Education, on Home Office data |
| Nigerian grant rate a year earlier | 96% | Jan to Mar 2025 | The PIE News, on ApplyBoard analysis |
| All nationalities refused | About 13% | Jan to Mar 2026 | Times Higher Education |

- **Interviews**: the Home Office aims to interview most students, usually by video call and in English. Missing it means refusal. Topics: why this course and university, how fees and living costs are paid and whose money it is, how any loan is repaid, career plans, gaps in study (University of the West of Scotland guide, Jan 2026).
- **Deception**: an application must be refused for 10 years after deception in an earlier one (Immigration Rules, Part Suitability, SUI 12.1).
- In the game: the refusal base is 9% and the rules put a clean file at about 6 in 100 (route.md, Numbers).

## Dependants, work, the Graduate route

| Figure | Value | Source |
|---|---|---|
| Dependants on a taught master's | Not allowed for courses from 1 Jan 2024; only PhD and research degrees, or students sponsored by a government | Appendix Student ST 31.1 |
| Work during term | 20 hours a week, full time in vacations | Appendix Student |
| Graduate route | 2 years if applying by 31 Dec 2026; 18 months from 1 Jan 2027 | gov.uk, Graduate visa |

## Nigerian passport

| Passport | Fee in Nigeria | Holds from | Source |
|---|---|---|---|
| 32 pages, 5 years | ₦100,000 (was ₦50,000) | 1 Sep 2025 | Voice of Nigeria, on the Nigeria Immigration Service |
| 64 pages, 10 years | ₦200,000 (was ₦100,000) | 1 Sep 2025 | Voice of Nigeria |

- No official waiting time is published. The game's 1 to 3 months is a working value.

## Pay in Lagos

| Job | Monthly pay | Date | Source |
|---|---|---|---|
| Private-school teacher | ₦25,000 to ₦75,000 | Feb 2024 | BusinessDay |
| Customer-service agent | Mostly ₦70,000 to ₦150,000 | Ads, Oct 2026 | Jobberman, Lagos |
| Junior developer, local firm | ₦250,000 to ₦400,000 typical (₦150,000 to ₦500,000 range) | 2026 | Condia |
| Mid-level or senior developer, local firm | ₦700,000 to ₦2,000,000 | 2026 | Condia |
| Developer, remote for a foreign firm | $2,500 to $5,000 | 2026 | Condia, from 9 interviews |
| Bank executive trainee, the best-paying bank | About ₦541,000 (was ₦255,000) | From Mar 2025 | TechCabal |
| Nurse and other medical ads | Mostly ₦70,000 to ₦250,000 | Ads, Oct 2026 | Jobberman, Lagos |
| National minimum wage | ₦70,000, unchanged since | Signed 18 Jul 2024 | Nairametrics |

- Ad and survey figures are mostly gross. Ad bands are the site's fixed brackets, not exact offers.
- In the game the jobs pay after tax: teacher ₦90,000, customer service ₦110,000, junior developer ₦320,000, bank officer ₦320,000, mid-level developer ₦1,100,000, remote developer $2,800 (activity.md, Jobs). These are working values.

## Living costs in Lagos, one young adult

| Item | Value | Source |
|---|---|---|
| Food, cooking at home | ₦60,000 to ₦100,000 a month | Nigeria Housing Market, 2026 guide |
| Transport, daily commuter | ₦30,000 to ₦75,000 a month | Nigeria Housing Market |
| Phone data | ₦8,000 to ₦15,000 a month | Nigeria Housing Market |
| One-room self-contained flat, Ikotun Egbe | ₦250,000 to ₦350,000 a year | BusinessDay, Mar 2026 |
| Self-contained flat, outlying areas | ₦800,000 to ₦1,500,000 a year (was ₦400,000) | BusinessDay, Mar 2026 |

- **How rent is paid**: landlords ask for 1 to 2 years upfront, plus agency 10%, legal 10% and a caution deposit of 5% to 10% (Nigeria Housing Market).
- In the game: the upkeep of ₦95,000 a month is food, transport and data; the room in a compound is ₦350,000 a year plus 20% in fees; the self-contain ₦700,000 a year (home.md, Numbers).

## Exchange rates the game starts from

| Rate | Value | Date | Source |
|---|---|---|---|
| Pound, official | ₦1,758.36 (selling) | 24 Sep 2026 | CBN |
| Dollar, official (NFEM close) | ₦1,331.50 | 7 Oct 2026 | TechEconomy; Vanguard |
| Dollar, street | About ₦1,362 | 7 Oct 2026 | TechEconomy; Vanguard |
| Pound, official | ₦1,820.79 | 23 Oct 2026 | CBN |
| Dollar, official | ₦1,361.34 | 23 Oct 2026 | CBN |

- In the game: `tuning.rate.start` is ₦1,758.00 for the pound and ₦1,331.50 for the dollar. After tick 0 the rates are simulated. The gap over time is in `06-naira-rates-and-currency.md`.

## Borrowing

| Product | Rate | Date | Source |
|---|---|---|---|
| A large bank's advance to its customers | 2% a month flat, about 24% a year | Jun 2026 | Nairametrics |
| The same bank's quick loan | 2.95% a month, about 35.4% a year | Jun 2026 | Nairametrics |
| Loan apps | From 2.5% to 30% a month at one; 5% to 36% at another | 2025 | TechCabal |
| Microfinance "proof of funds" loans | 5% a month (one case 6%), ₦10m to ₦30m, plus gifts to staff | 2021 | Nairametrics |

- In the game: salary loan 2% flat, quick loan 20% a month, held funds 5% a month up to ₦30m (obligation.md, offer.md). The agent's 3% is a working value; no press figure for agents' fees was found.

## Proof-of-funds services

- **How it is reported to work**: a lender or agent places money in the student's or a parent's account for the holding period, and takes it back after the decision. One advert offered funds "domiciled in your bank account for 30 days up to 180 days" (The PIE News, Mar 2023).
- **The same money for several students**: short-term lending by agents, possibly recycling the same funds for several students, was reported as commonplace (Times Higher Education, Feb 2022).
- **Risks**: deposits that cannot be explained draw interview questions; false documents bring a 10-year refusal; a credibility refusal can cost the deposit (see Refusals and interviews, and Leicester above).

## How families fund it

- **Land**: almost everyone who leaves has sold property, mostly land, and relatives abroad later buy land back (BusinessDay, Mar 2025; reporting, not a survey). In the game: `offer.land-buyer`.
- **Savings circles (ajo, esusu) and cooperatives**: no reporting was found that measures them as a source of study money.

## Worked totals for the game's schools

| School | Tuition less deposit | Plus living money from 30 Nov 2026 | To show | At ₦1,758 to £1 |
|---|---|---|---|---|
| Northgate | £13,000 | £10,827 | £23,827 | about ₦41.9m |
| Ashby | £19,250 | £10,827 | £30,077 | about ₦52.9m |
| Kingsmere | £29,200 | £10,827 | £40,027 | about ₦70.4m |

- Cash out before the visa at Northgate: deposit £4,000, visa £558, surcharge £1,164, so £5,722 (about ₦10.1m), plus the TB test ₦120,000, IELTS ₦295,000 and passport ₦100,000.
- At the official rate of 23 Oct 2026, ₦1,820.79, the Northgate total is about ₦43.4m.

## Sources

- [gov.uk: Student visa](https://www.gov.uk/student-visa)
- [gov.uk: Student visa, money](https://www.gov.uk/student-visa/money)
- [gov.uk: Student visa, apply](https://www.gov.uk/student-visa/apply)
- [gov.uk: Student visa, course and CAS](https://www.gov.uk/student-visa/course)
- [gov.uk: Student visa, English](https://www.gov.uk/student-visa/knowledge-of-english)
- [gov.uk: Immigration health surcharge, how much](https://www.gov.uk/healthcare-immigration-application/how-much-pay)
- [gov.uk: Immigration Rules, Appendix Finance](https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-finance)
- [gov.uk: Immigration Rules, Appendix Student](https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-student)
- [gov.uk: Immigration Rules, Part Suitability](https://www.gov.uk/guidance/immigration-rules/immigration-rules-part-suitability)
- [gov.uk: Statement of changes HC 584, 3 Sep 2026](https://www.gov.uk/government/publications/statement-of-changes-to-the-immigration-rules-hc-584-3-september-2026)
- [gov.uk: Secure English language tests](https://www.gov.uk/guidance/prove-your-english-language-abilities-with-a-secure-english-language-test-selt)
- [gov.uk: TB testing in Nigeria](https://www.gov.uk/government/publications/tuberculosis-test-for-a-uk-visa-clinics-in-nigeria/tuberculosis-testing-in-nigeria)
- [gov.uk: TB test for a visa](https://www.gov.uk/tb-test-visa)
- [gov.uk: Graduate visa](https://www.gov.uk/graduate-visa)
- [UKCISA: rule changes, September 2026](https://www.ukcisa.org.uk/news/student-update-changes-to-the-immigration-rules-september-2026/)
- [UKCISA: visa fees from 8 April 2026](https://www.ukcisa.org.uk/news/uk-visa-fees-increasing-from-8-april-2026/)
- [Times Higher Education: refusal rates rise, May 2026](https://www.timeshighereducation.com/news/visa-refusal-rates-climb-uk-amid-falling-applicant-numbers)
- [The PIE News: Nigerian grant rate, 2025](https://thepienews.com/visa-refusals-study-in-uk/)
- [University of the West of Scotland: credibility interview guide, Jan 2026](https://www.uws.ac.uk/media/k3hkqxbz/ukvi-credibility-interview-guide-january-2026.pdf)
- [Teesside University: international fees and deposits](https://www.tees.ac.uk/sections/international/fees.cfm)
- [Teesside University: scholarships](https://www.tees.ac.uk/sections/international/africa_excellence_scholarship.cfm)
- [Teesside University London: English requirements](https://www.tees.ac.uk/london/international/english.cfm)
- [University of Leicester: Finance MSc 2026, archived May 2026](https://web.archive.org/web/20260514131137/https://le.ac.uk/courses/finance-msc/2026)
- [University of Leicester: deposit, archived May 2026](https://web.archive.org/web/20260513130132/https://le.ac.uk/study/postgraduates/fees-funding/how-to-pay/deposit)
- [University of Manchester: MSc Data Science 2026, archived Jan 2026](https://web.archive.org/web/20260119054311/https://www.manchester.ac.uk/study/masters/courses/list/11552/msc-data-science-computer-science-data-informatics/)
- [University of Manchester: MSc Data Science and AI](https://www.manchester.ac.uk/study/masters/courses/list/22195/msc-data-science-and-artificial-intelligence-computer-science-data-informatics/)
- [Coventry University: how to apply and deposits](https://www.coventry.ac.uk/international-students-hub/apply/)
- [Coventry University: Group Scholarship](https://www.coventry.ac.uk/international-students-hub/apply-for-a-scholarship/coventry-university-group-scholarship/)
- [Northumbria University: scholarship for Nigerian applicants, 2026 to 2027](https://www.northumbria.ac.uk/study-at-northumbria/fees-funding/international-fees-funding/26-27-pgt-international-scholarships-nigeria)
- [British Council Nigeria: IELTS questions](https://www.britishcouncil.org.ng/exam/ielts/book-test/ielts-faqs-frequently-asked-questions), the fees from 15 Jul 2025
- [Voice of Nigeria: passport fees from 1 Sep 2025](https://von.gov.ng/nigeria-immigration-service-reviews-passport-application-fees/)
- [BusinessDay: private-school teachers' pay, Feb 2024](https://businessday.ng/?p=811018)
- [Jobberman: customer service jobs, Lagos](https://www.jobberman.com/jobs/customer-service-support/lagos)
- [Jobberman: medical jobs, Lagos](https://www.jobberman.com/jobs/medical-pharmaceutical/lagos)
- [Condia: software engineer pay, 2026](https://thecondia.com/software-engineer-salary-nigeria/)
- [TechCabal: bank salaries raised, Feb 2025](https://techcabal.com/2025/02/20/wema-bank-raises-salaries/)
- [Nairametrics: minimum wage by state, May 2026](https://nairametrics.com/2026/05/01/minimum-wage-2026-what-every-state-in-nigeria-pays/)
- [Nigeria Housing Market: cost of living in Lagos](https://www.nigeriahousingmarket.com/guides/cost-of-living-in-lagos)
- [BusinessDay: Lagos rents, Mar 2026](https://businessday.ng/?p=1103216)
- [CBN: exchange rates by currency](https://www.cbn.gov.ng/rates/ExchRateByCurrency.html)
- [TechEconomy: rates on 7 Oct 2026](https://techeconomy.ng/dollar-to-naira-exchange-rate-october-7-2026)
- [Vanguard: rates on 7 Oct 2026](https://www.vanguardngr.com/2026/10/dollar-to-naira-exchange-rate-today-october-7-2026/)
- [Nairametrics: bank lending rates, Jun 2026](https://nairametrics.com/nigerian-bank-lending-rates-how-gtbank-zenith-access-compare-in-june-2026/)
- [TechCabal: loan app rates, 2025](https://techcabal.com/2025/11/20/best-interest-rate-loan-apps-nigeria-2025/)
- [Nairametrics: microfinance proof-of-funds loans, 2021](https://nairametrics.com/?p=335489)
- [The PIE News: proof-of-funds loans, 2023](https://thepienews.com/?p=180187)
- [Times Higher Education: visa money lending, 2022](https://www.timeshighereducation.com/news/visa-money-lending-scams-commonplace-warns-ex-minister)
- [BusinessDay: japa and the land cycle, Mar 2025](https://businessday.ng/real-estate/article/how-japa-wave-drives-unending-land-cycle-in-nigeria/)
