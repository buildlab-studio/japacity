// A card drawn to a JPEG on the player's own device (docs/rules/share.md
// R-SHARE-009 to R-SHARE-011): from the view's card alone, nothing fetched,
// nothing sent anywhere until the player chooses to share it.
import { content } from "@japacity/content";
import type { Content } from "@japacity/sim";

import { encodeUnder, type Encoded } from "./encode";
import type { CardFace } from "./face";
import { cardSteps, previewSteps, type Size, type Step } from "./layout";
import { fontsReady, measureWith, paint } from "./paint";
import { stubSize, stubSteps, type StubFace } from "./stub";

type ShareTuning = Content["tuning"]["share"];

async function draw(size: Size, steps: (measure: ReturnType<typeof measureWith>) => Step[], maxBytes: number): Promise<Encoded> {
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (context === null) return { ok: false, reason: "no-image", bytes: 0 };
  paint(context, steps(measureWith(context)));
  return encodeUnder((quality) => new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality / 100)), maxBytes);
}

/** The whole card at `tuning.share.width` by `height`, under `maxBytes`, or the reason it was refused. */
export async function renderCard(face: CardFace, tuning: ShareTuning = content.tuning.share): Promise<Encoded> {
  const size = { width: tuning.width, height: tuning.height };
  await fontsReady([Math.round((92 * size.width) / 1080), Math.round((200 * size.width) / 1080), Math.round((72 * size.width) / 1080)]);
  return draw(size, (measure) => cardSteps(face, size, measure), tuning.maxBytes);
}

/** The fixed link preview for one kind, at the preview size, under `previewMaxBytes`. */
export async function renderPreview(face: Parameters<typeof previewSteps>[0], tuning: ShareTuning = content.tuning.share): Promise<Encoded> {
  const size = { width: tuning.previewWidth, height: tuning.previewHeight };
  await fontsReady([Math.round((66 * size.width) / 1200), Math.round((52 * size.width) / 1200)]);
  return draw(size, (measure) => previewSteps(face, size, measure), tuning.previewMaxBytes);
}

/** The send-off's ticket stub, landscape, under the same `maxBytes` as every card (R-SHARE-009). */
export async function renderStub(face: StubFace, tuning: ShareTuning = content.tuning.share): Promise<Encoded> {
  const size = stubSize(tuning);
  await fontsReady([Math.round((84 * size.width) / 1920), Math.round((56 * size.width) / 1920)]);
  return draw(size, (measure) => stubSteps(face, size, measure), tuning.maxBytes);
}
