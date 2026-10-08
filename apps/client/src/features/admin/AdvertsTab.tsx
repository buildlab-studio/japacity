// The adverts' review (R-ADVERT-010 to 014): every campaign with its state now,
// its advertiser, the creatives' versions and images, and the checks a named
// reviewer records before an approval. Pulling and rechecking a live campaign
// send it back to review.
import { useId, useState } from "react";

import { Tag } from "../../shared/ui/Panel";
import { formatNumber } from "../../shared/words/format";
import { campaignChecks, creativeChecks, type AdminRefusal, type CampaignRow, type CampaignStatus, type Creative, type ReviewBody } from "./admin.contract";
import { utcTime } from "./admin.format";
import { words } from "./admin.words";
import type { AdminApi, Outcome } from "./api";
import { Confirm, Field, Loaded, ReloadButton, Section, Table, useLoad } from "./admin.ui";

const STATUS_TONE: Record<CampaignStatus, "plain" | "accent" | "good" | "bad"> = {
  pending: "accent",
  approved: "plain",
  live: "good",
  paused: "accent",
  ended: "plain",
  refused: "bad",
};

/** R-ADVERT-010, R-ADVERT-012: the checks to record, a note, and the two decisions. */
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
    <fieldset aria-labelledby={legend} className="flex flex-col gap-3 rounded-lg border border-line p-3">
      <legend id={legend} className="px-1 font-semibold">
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
        <Confirm label={words("admin.review.refuse")} summary={summary("refuse")} send={() => send("refuse", body)} onDone={onDone} />
      </div>
    </fieldset>
  );
}

function CreativeVersion({ api, creative, live, onDone }: { api: AdminApi; creative: Creative; live: boolean; onDone: () => void }) {
  const name = words("admin.creative.title", { id: creative.id, version: creative.version });
  return (
    <li data-creative={`${creative.id}@${String(creative.version)}`} className="flex flex-col gap-2 rounded-lg border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="font-semibold">{name}</h4>
        <Tag tone={creative.status === "approved" ? "good" : creative.status === "refused" ? "bad" : "accent"}>{creative.status}</Tag>
      </div>
      <p className="text-sm">{words("admin.creative.file", { format: creative.file.format, width: creative.file.width, height: creative.file.height, bytes: formatNumber(creative.file.bytes) })}</p>
      <p>{words("admin.creative.text", { text: creative.text })}</p>
      <p className="break-all">{creative.link === null ? words("admin.creative.no-link") : words("admin.creative.link", { link: creative.link })}</p>
      {creative.status === "approved" && live ? (
        <img src={api.imageUrl(creative.id, creative.version)} alt={words("admin.creative.image", { id: creative.id, version: creative.version })} width={creative.file.width} height={creative.file.height} className="h-auto max-h-48 w-auto max-w-full self-start rounded border border-line" />
      ) : (
        // no admin route serves a pending version's image; the public route serves only an approved, live one.
        <p className="text-sm text-muted">{words("admin.creative.image.hidden")}</p>
      )}
      {creative.status === "pending" ? (
        <Review
          title={words("admin.creative.review")}
          what={name}
          required={creativeChecks(creative)}
          send={(outcome, body) => api.decideCreative(creative.id, creative.version, outcome, body)}
          onDone={onDone}
        />
      ) : null}
    </li>
  );
}

function CampaignCard({ api, row, onDone }: { api: AdminApi; row: CampaignRow; onDone: () => void }) {
  const { campaign, advertiser, creatives, reviews } = row;
  const waiting = campaign.status === "pending" || campaign.status === "paused";
  const showing = campaign.status === "live" || campaign.status === "approved";
  const title = words("admin.campaign.title", { id: campaign.id });
  return (
    <li data-campaign={campaign.id} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{title}</h3>
        <Tag tone={STATUS_TONE[campaign.status]}>{campaign.status}</Tag>
      </div>
      <p>
        {advertiser === null
          ? words("admin.campaign.advertiser.unknown", { id: campaign.advertiser })
          : words("admin.campaign.advertiser", { name: advertiser.businessName, country: advertiser.registration.country, number: advertiser.registration.number, contact: advertiser.contactName, email: advertiser.contactEmail })}
      </p>
      <p>{words("admin.campaign.dates", { starts: utcTime(campaign.starts), ends: utcTime(campaign.ends) })}</p>
      <p>{words("admin.campaign.facts", { slots: campaign.slots.join(", "), regions: campaign.regions.join(", "), category: campaign.category })}</p>
      {campaign.place === null ? null : <p>{words("admin.campaign.place", { name: campaign.place.name, sign: campaign.place.sign, place: campaign.place.place })}</p>}
      {waiting ? <Review title={words("admin.campaign.review")} what={title} required={campaignChecks(campaign)} send={(outcome, body) => api.decideCampaign(campaign.id, outcome, body)} onDone={onDone} /> : null}
      <div className="flex flex-wrap gap-4">
        {showing ? <Confirm label={words("admin.campaign.pull")} summary={words("admin.campaign.pull.confirm", { id: campaign.id })} send={() => api.pull(campaign.id)} onDone={onDone} /> : null}
        <Confirm
          label={words("admin.campaign.recheck")}
          summary={words("admin.campaign.recheck.confirm", { id: campaign.id })}
          send={() => api.recheck(campaign.id)}
          done={(reply) => words("admin.campaign.recheck.done", { failing: reply.failing.length === 0 ? words("admin.none") : reply.failing.join(", "), pulled: String(reply.pulled) })}
        />
      </div>
      <div>
        <h4 className="font-semibold">{words("admin.creatives")}</h4>
        {creatives.length === 0 ? (
          <p className="text-muted">{words("admin.none")}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-3">
            {creatives.map((creative) => (
              <CreativeVersion key={`${creative.id}@${String(creative.version)}`} api={api} creative={creative} live={campaign.status === "live"} onDone={onDone} />
            ))}
          </ul>
        )}
      </div>
      <Table
        caption={words("admin.reviews")}
        head={[words("admin.reviews.creative"), words("admin.reviews.version"), words("admin.reviews.reviewer"), words("admin.reviews.when"), words("admin.reviews.checks"), words("admin.reviews.list"), words("admin.reviews.outcome"), words("admin.reviews.note")]}
        rows={reviews.map((review) => [review.creative, String(review.version), review.reviewer, utcTime(review.at), review.checks.join(", "), review.bannedListVersion, review.outcome, review.note])}
      />
    </li>
  );
}

export function AdvertsTab({ api }: { api: AdminApi }) {
  const campaigns = useLoad(() => api.campaigns());
  return (
    <Section title={words("admin.adverts.title")} action={<ReloadButton onClick={campaigns.reload} />}>
      <Loaded reply={campaigns.reply}>
        {({ campaigns: rows }) =>
          rows.length === 0 ? (
            <p className="text-muted">{words("admin.adverts.none")}</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {rows.map((row) => (
                <CampaignCard key={row.campaign.id} api={api} row={row} onDone={campaigns.reload} />
              ))}
            </ul>
          )
        }
      </Loaded>
    </Section>
  );
}
