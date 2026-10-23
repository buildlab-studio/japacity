# Two naira rates, the bank and the street

Sources checked October 2026.

The facts behind `../rules/rate.md`, `../rules/wallet.md`, the money stories in `../rules/director.md` and the payout rule in `../rules/abroad-money.md`. Official rates are the central bank's published rates unless a row says otherwise.

## The two rates and the gap between them

| Date | Official, ₦ to $1 | Street, ₦ to $1 | Gap | Source |
|---|---|---|---|---|
| 15 Feb 2017 | 305 | 511 | 68%, the widest found | CBN rates; BusinessDay |
| 14 Jun 2023, the float | 477 the day before, then as low as 750 | about 750 | closed | Al Jazeera |
| 21 Dec 2023 | 844.85 | 1,240 | 47% | Blueprint |
| 21 Feb 2024 | 1,542.58 | 1,900 | 23% | Ripples Nigeria |
| 31 Dec 2025 | 1,429 | 1,470 | 3% | AllAfrica |
| 7 Oct 2026 | 1,331.50 | about 1,362 | 2% | TechEconomy; Vanguard |

- **Calm**: the gap is a few percent. On 2 Oct 2026 street quotes ran from ₦1,365 to ₦1,390 against an official ₦1,329, a gap of 3% to 5% (WithinNigeria).
- **Crisis**: the gap opened to between 47% and 68% while demand for official dollars went unmet (Blueprint).
- **The float**: on 14 Jun 2023 the central bank let the official rate fall to meet the street, and the gap closed (Al Jazeera).
- **In the game**: the premium has a 2% floor, settles near 4% at supply 97, heads for about 45% at supply 40, and drops to 3% on a float (rate:street-premium-tracks-target, rate:float-jumps-official-rate).

## The bank: documented, rationed, slow

- **Travel allowance, calm**: $4,000 a quarter, for a holder of a Nigerian passport travelling within 14 days (central bank rules, Feb 2017, Nairametrics).
- **Travel allowance, crisis**: at most $2,000, two quarters a year (bank notices, Mar 2023, TechEconomy).
- **School fees**: paid straight to the university. Capped at $7,500 a semester in the 2023 crisis, with "a minimum of 16 weeks" to process (TechEconomy). The central bank's foreign exchange manual in force from 1 Jun 2026 allows up to $25,000 a semester (Nairametrics).
- **Dollar accounts at home**: ordinary domiciliary account holders have unrestricted access to their funds under the 2026 manual (Nairametrics). In Feb 2024 the central bank called a report that it would convert them to naira false (TechEconomy).
- **In the game**: the bank sells at the official rate within a monthly allowance (`var.fx-bank-allowance`: $500, cut to $200 in a scarcity), and a scarcity queues purchases for 2 months (wallet:monthly-fx-allowance, wallet:bank-queue-delays-purchases). Both are working values. A dollar salary paid into the dollar account is documented money.

## The street: instant cash, a premium, a risk

- **The aboki** is the everyday Lagos name for a street changer. The word means friend in Hausa; some argue it is insulting when a non-Hausa speaker uses it of a northerner (BellaNaija, 2020).
- **Short counts** are the common trick: a changer hands over a short bundle, or palms notes while recounting (The Sun).
- **No published buy-sell spread was found.** The game's 2% cut, and its 1.5% chance of a short count of 3% to 8%, are working values (wallet:aboki-trades-at-street-rate, wallet:aboki-short-count).

## What a falling naira does to a plan

- **Fees abroad are fixed in pounds or dollars.** $10,000 cost about ₦4.6m at the central bank rate on 9 Jun 2023 and about ₦15.4m on 29 Feb 2024, 3.3 times as much (CBN rates).
- **Proof of funds is valued on the day of application**, so a naira fall during the 28 days can leave a balance short (see `09-uk-masters-numbers.md`).
- **Unexplained money is questioned.** Interviewers ask whose money it is and how any loan will be repaid (University of the West of Scotland interview guide, Jan 2026). In the game a large cash deposit is recorded as a lot that raises the unexplained share (wallet:large-deposits-record-lots).

## Money sent home

- **Naira only**: from 1 May 2026 the central bank requires money transfer operators to pay diaspora remittances in naira, through naira settlement accounts, so recipients get the official market rate (AllAfrica, on the central bank's circular).
- **Unofficial channels**: while the street premium was wide in 2023, the World Bank said it had likely diverted remittances away from official channels (BusinessDay).
- **In the game**: the app and the bank pay naira at the official rate; the informal channel pays cash at the street rate (`../rules/abroad-money.md`, Numbers).

## Sources

- [CBN: exchange rates by currency](https://www.cbn.gov.ng/rates/ExchRateByCurrency.html)
- [BusinessDay: dollar hits ₦511, Feb 2017](https://businessday.ng/?p=184578)
- [Al Jazeera: the June 2023 float](https://www.aljazeera.com/amp/news/2023/6/14/nigeria-allows-naira-to-drop-more-than-36-on-official-market)
- [Blueprint: gap over ₦400, Dec 2023](https://blueprint.ng/fx-crisis-gap-between-official-black-market-rates-hit-over-n400/)
- [Ripples Nigeria: street rate at ₦1,900, Feb 2024](https://www.ripplesnigeria.com/naira-in-riotous-mode-on-parallel-window-dips-to-n1900/)
- [AllAfrica: rates on 31 Dec 2025](https://allafrica.com/stories/202601020193.html)
- [TechEconomy: rates on 7 Oct 2026](https://techeconomy.ng/dollar-to-naira-exchange-rate-october-7-2026)
- [Vanguard: rates on 7 Oct 2026](https://www.vanguardngr.com/2026/10/dollar-to-naira-exchange-rate-today-october-7-2026/)
- [WithinNigeria: rates on 2 Oct 2026](https://www.withinnigeria.com/2026/10/03/exchange-rate-today-october-3-2026-naira-holds-at-%E2%82%A61329-as-pound-and-euro-stay-firm/)
- [Nairametrics: travel allowance and school fee rules, Feb 2017](https://nairametrics.com/2017/02/21/cbn-reveals-what-you-need-to-access-forex-for-pta-school-medical-fees/)
- [TechEconomy: allowances cut, Mar 2023](https://www.techeconomy.ng/banks-make-adjustments-on-pta-bta-requests-as-foreign-reserves-shrink)
- [Nairametrics: the 2026 foreign exchange manual](https://nairametrics.com/2026/05/15/cbn-launches-4th-edition-fx-manual-to-boost-transparency-and-market-confidence/)
- [TechEconomy: conversion report denied, Feb 2024](https://www.techeconomy.ng/cbn-reacts-to-alleged-plan-to-convert-30bln-in-domiciliary-accounts-to-naira)
- [BellaNaija: the debate over the word, 2020](https://www.bellanaija.com/2020/04/twitter-aboki-derogatory-term/)
- [The Sun: short-changing at the street market](https://thesun.ng/bureau-de-cheat/)
- [University of the West of Scotland: credibility interview guide, Jan 2026](https://www.uws.ac.uk/media/k3hkqxbz/ukvi-credibility-interview-guide-january-2026.pdf)
- [AllAfrica: naira-only payouts from 1 May 2026](https://allafrica.com/stories/202603260150.html)
- [BusinessDay: remittances and unofficial channels](https://businessday.ng/business-economy/article/remittances-near-3-year-low-on-fx-crisis-slow-global-growth/)
