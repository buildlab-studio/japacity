// How a drawn card leaves the device (docs/rules/share.md R-SHARE-003,
// R-SHARE-009, R-SHARE-011): the Web Share API when it takes the file, a
// download when it does not. Only ever after the player's tap.
import type { ShareKind } from "@japacity/content";

import { say } from "../words/text";
import { cardLink } from "./face";

export type Travelled = "shared" | "saved" | "cancelled";

/** The parts of the browser this needs, so a test can stand in for them. */
export interface Device {
  canShare: ((data: ShareData) => boolean) | undefined;
  share: ((data: ShareData) => Promise<void>) | undefined;
  save: (file: File) => void;
}

/** Saves a file through a link with `download`, the way every browser allows. */
export function saveFile(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking at once can cancel the download in some browsers; a minute is long enough.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function browserDevice(): Device {
  return {
    canShare: typeof navigator.canShare === "function" ? (data) => navigator.canShare(data) : undefined,
    share: typeof navigator.share === "function" ? (data) => navigator.share(data) : undefined,
    save: saveFile,
  };
}

export function cardFile(blob: Blob, kind: ShareKind): File {
  return new File([blob], `japacity-${kind}.jpg`, { type: "image/jpeg" });
}

/** The data handed to the share sheet: the file, the game's words and the kind's link. */
export function shareData(file: File, kind: ShareKind): ShareData {
  return { files: [file], text: say("share.message"), url: cardLink(kind) };
}

/** True when this device's share sheet takes an image file. */
export function canShareFiles(device: Device): boolean {
  if (device.canShare === undefined || device.share === undefined) return false;
  try {
    return device.canShare({ files: [new File([], "card.jpg", { type: "image/jpeg" })] });
  } catch {
    return false;
  }
}

export async function sendCard(blob: Blob, kind: ShareKind, device: Device = browserDevice()): Promise<Travelled> {
  const file = cardFile(blob, kind);
  const data = shareData(file, kind);
  if (device.share !== undefined && device.canShare?.(data) === true) {
    try {
      await device.share(data);
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    }
  }
  device.save(file);
  return "saved";
}
