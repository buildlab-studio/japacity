// Adverts (admin:sections-alarms-first, advert:named-person-approves-creatives, advert:changes-return-to-review,
// advert:reviewer-checks-and-records, advert:submissions-never-auto-post, advert:reported-advert-pulled-at-once): the
// advert figures as cards, then every campaign as a card with a state pill, the ones waiting for a person first: its
// advertiser, the creatives' versions and images, the checks a named reviewer records before an approval as the server
// lists them, and the daily counts (advert:advertiser-records-stored). Pulling and rechecking a live campaign send it
// back to review.
import type { AdminRefusal, CampaignRow, CampaignStatus, ReviewBody, ReviewedCreative } from "@japacity/api";
import { time } from "@japacity/sim";
import { useId, useState } from "react";

import { formatNumber } from "../../shared/words/format";
import { dayWords, nairaWords, shownCount, whenWords } from "./admin.format";
import { words } from "./admin.words";
import { campaignWaiting, type Shared } from "./AdminPage";
import type { Outcome } from "./api";
import { Card, Confirm, Field, Loaded, Pill, ReloadButton, Rows, Stat, Stats, Table, type Tone } from "./admin.ui";

const STATUS_TONE: Record<CampaignStatus, Tone> = {
  pending: "wait",
  approved: "plain",
  live: "ok",
  paused: "wait",
  ended: "plain",
  refused: "alarm",
};

/** advert:named-person-approves-creatives, advert:reviewer-checks-and-records: the checks to record, a note, and the two decisions. */
function Review({ title, what, required, send, onDone }: { title: string; what: string; required: readonly string[]; send: (outcome: Outcome, body: ReviewBody) => Promise<{ ok: true } | AdminRefusal>; onDone: () => void }) {
  const [made, setMade] = useState<readonly string[]>([]);
  const [note, setNote] = useState("");
  const legend = useId();
  const body = { checks: required.filter((check) => made.includes(check)), note: note.trim() };
  const summary = (outcome: Outcome) => {
    const verb = words(outcome === "approve" ? "admin.review.approve" : "admin.review.refuse");
    return body.checks.length === 0 ? words("admin.review.confirm.none", { outcome: verb, what }) : words("admin.review.confirm", { outcome: verb, what, checks: body.checks.join(", ") });
  };
  return (
    <fieldset aria-labelledby={legend} className="flex flex-col gap-3 rounded-lg border border-sheet-line bg-sheet p-3">
      <legend id={legend} className="px-1 text-sm font-semibold">
        {title}
      </legend>
      <div role="group" aria-label={words("admin.review.checks")} className="flex flex-wrap gap-x-5 gap-y-2">
        {required.map((check) => (
          <label key={check} className="flex min-h-9 items-center gap-2 text-sm">
            <input type="checkbox" checked={made.includes(check)} onChange={(event) => setMade(event.target.checked ? [...made, check] : made.filter((each) => each !== check))} />
            {check}
          </label>
        ))}
      </div>
      <Field label={words("admin.review.note")} value={note} onChange={(event) => setNote(event.target.value)} />
      <div className="flex flex-wrap gap-4">
        <Confirm label={words("admin.review.approve")} variant="primary" summary={summary("approve")} send={() => send("approve", body)} onDone={onDone} />
        <Confirm label={words("admin.review.refuse")} variant="warning" summary={summary("refuse")} send={() => send("refuse", body)} onDone={onDone} />
      </div>
    </fieldset>
  );
}

function CreativeVersion({ shared, creative, onDone }: { shared: Shared; creative: ReviewedCreative; onDone: () => void }) {
  const name = words("admin.creative.title", { id: creative.id, version: creative.version });
  return (
    <li data-creative={`${creative.id}@${String(creative.version)}`} className="flex flex-col gap-3 rounded-lg border border-sheet-line p-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <img src={shared.api.imageUrl(creative.id, creative.version)} alt={words("admin.creative.image", { id: creative.id, version: creative.version })} width={creative.file.width} height={creative.file.height} className="h-auto max-h-40 w-auto max-w-full self-start rounded border border-sheet-line" />
        <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold">{name}</h4>
            <Pill tone={creative.status === "approved" ? "ok" : creative.status === "refused" ? "alarm" : "wait"}>{creative.status}</Pill>
          </div>
          <p className="text-text-2">{words("admin.creative.file", { format: creative.file.format, width: creative.file.width, height: creative.file.height, bytes: formatNumber(creative.file.bytes) })}</p>
          <p>{words("admin.creative.text", { text: creative.text })}</p>
          <p className="break-all">{creative.link === null ? words("admin.creative.no-link") : words("admin.creative.link", { link: creative.link })}</p>
        </div>
      </div>
      {creative.status === "pending" ? <Review title={words("admin.creative.review")} what={name} required={creative.checks} send={(outcome, body) => shared.api.decideCreative(creative.id, creative.version, outcome, body)} onDone={onDone} /> : null}
    </li>
  );
}

function CampaignCard({ shared, row, onDone }: { shared: Shared; row: CampaignRow; onDone: () => void }) {
  const { campaign, advertiser, checks, creatives, reviews, counts } = row;
  const waiting = campaign.status === "pending" || campaign.status === "paused";
  const showing = campaign.status === "live" || campaign.status === "approved";
  const title = words("admin.campaign.title", { id: campaign.id });
  return (
    <li data-campaign={campaign.id} className="flex flex-col gap-4 rounded-xl border border-sheet-line bg-sheet-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{title}</h3>
        <Pill tone={STATUS_TONE[campaign.status]}>{campaign.status}</Pill>
        <span className="ml-auto text-xs text-text-2">{words("admin.campaign.dates", { starts: dayWords(time.dayName(time.utcDay(campaign.starts)), true), ends: dayWords(time.dayName(time.utcDay(campaign.ends)), true) })}</span>
      </div>
      <p className="text-sm">
        {advertiser === null
          ? words("admin.campaign.advertiser.unknown", { id: campaign.advertiser })
          : words("admin.campaign.advertiser", { name: advertiser.businessName, country: advertiser.registration.country, number: advertiser.registration.number, contact: advertiser.contactName, email: advertiser.contactEmail })}
      </p>
      <Rows
        rows={[
          { label: words("admin.campaign.slots"), value: campaign.slots.join(", ") },
          { label: words("admin.campaign.regions"), value: campaign.regions.join(", ") },
          { label: words("admin.campaign.category"), value: campaign.category },
          ...(campaign.place === null ? [] : [{ label: words("admin.campaign.place"), value: words("admin.campaign.place.value", { name: campaign.place.name, sign: campaign.place.sign, place: campaign.place.place }) }]),
        ]}
      />
      {waiting ? <Review title={words("admin.campaign.review")} what={title} required={checks} send={(outcome, body) => shared.api.decideCampaign(campaign.id, outcome, body)} onDone={onDone} /> : null}
      <div className="flex flex-wrap gap-4">
        {showing ? <Confirm label={words("admin.campaign.pull")} variant="warning" summary={words("admin.campaign.pull.confirm", { id: campaign.id })} send={() => shared.api.pull(campaign.id)} onDone={onDone} /> : null}
        <Confirm
          label={words("admin.campaign.recheck")}
          summary={words("admin.campaign.recheck.confirm", { id: campaign.id })}
          send={() => shared.api.recheck(campaign.id)}
          done={(reply) => words("admin.campaign.recheck.done", { failing: reply.failing.length === 0 ? words("admin.none") : reply.failing.join(", "), pulled: String(reply.pulled) })}
        />
      </div>
      <div>
        <h4 className="mb-2 text-xs font-semibold tracking-wider text-text-2 uppercase">{words("admin.creatives")}</h4>
        {creatives.length === 0 ? (
          <p className="text-sm text-text-2">{words("admin.none")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {creatives.map((creative) => (
              <CreativeVersion key={`${creative.id}@${String(creative.version)}`} shared={shared} creative={creative} onDone={onDone} />
            ))}
          </ul>
        )}
      </div>
      <Table
        caption={words("admin.reviews")}
        head={[words("admin.reviews.creative"), words("admin.reviews.version"), words("admin.reviews.reviewer"), words("admin.reviews.when"), words("admin.reviews.checks"), words("admin.reviews.list"), words("admin.reviews.outcome"), words("admin.reviews.note")]}
        rows={reviews.map((review) => [review.creative, String(review.version), review.reviewer, whenWords(review.at), review.checks.join(", "), review.bannedListVersion, review.outcome, review.note])}
      />
      <Table caption={words("admin.counts")} head={[words("admin.counts.day"), words("admin.counts.slot"), words("admin.counts.region"), words("admin.counts.impressions"), words("admin.counts.taps")]} rows={counts.map((count) => [dayWords(time.dayName(count.day)), count.slot, count.region, formatNumber(count.impressions), formatNumber(count.taps)])} />
    </li>
  );
}

export function AdvertsSection({ shared }: { shared: Shared }) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{words("admin.section.adverts")}</h2>
        <ReloadButton onClick={shared.campaigns.reload} />
      </div>
      <Loaded reply={shared.stats.reply}>
        {({ stats }) => (
          <Stats>
            <Stat label={words("admin.counts.impressions")} value={shownCount(stats.adverts.impressions)} note={words("admin.window", { from: dayWords(stats.adverts.from), to: dayWords(stats.adverts.to) })} />
            <Stat label={words("admin.counts.taps")} value={shownCount(stats.adverts.taps)} />
            <Stat label={words("admin.figure.revenue")} value={nairaWords(stats.adverts.revenueKobo)} />
            <Stat label={words("admin.figure.revenue.per")} value={nairaWords(stats.adverts.revenuePerPlayerKobo)} />
          </Stats>
        )}
      </Loaded>
      <Card title={words("admin.adverts.title")}>
        <Loaded reply={shared.campaigns.reply}>
          {({ campaigns: rows }) =>
            rows.length === 0 ? (
              <p className="text-sm text-text-2">{words("admin.adverts.none")}</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {[...rows]
                  .sort((one, two) => Number(campaignWaiting(two)) - Number(campaignWaiting(one)))
                  .map((row) => (
                    <CampaignCard key={row.campaign.id} shared={shared} row={row} onDone={shared.campaigns.reload} />
                  ))}
              </ul>
            )
          }
        </Loaded>
      </Card>
    </>
  );
}
