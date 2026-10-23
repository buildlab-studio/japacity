// The door's first screen fetches only the pictures it keeps (assets:pictures-shipped-light): while the publish manifest
// is on its way, a look's face and figure wait with nothing fetched, so the look's own small picture is never fetched
// only to be replaced; it stands in only where the manifest cannot be read or the picture is not published.
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { PublishManifest } from "../three/manifest";
import { lookOf } from "./looks";
// Registers Testing Library's cleanup for this file.
import "../testing/render";

// The manifest is fetched once a visit, as the real loader does, and answered by each test.
let answer: { resolve: (manifest: PublishManifest) => void; reject: (reason: Error) => void } | null = null;
let asked: Promise<PublishManifest> | null = null;
vi.mock("../three/manifest", async (original) => ({
  ...(await original<typeof import("../three/manifest")>()),
  loadManifest: () =>
    (asked ??= new Promise<PublishManifest>((resolve, reject) => {
      answer = { resolve, reject };
    })),
}));

const { FaceSticker, FigurePicture } = await import("./LookPicture");

const PUBLISHED: PublishManifest = { files: { "tiles/person_ada-face.webp": "tiles/person_ada-face.0123456789ab.webp", "tiles/person_ada-figure.webp": "tiles/person_ada-figure.ba9876543210.webp" } };

function drawn(): { face: string | null | undefined; figure: string | null | undefined } {
  return {
    face: document.querySelector("[data-face-sticker] img")?.getAttribute("src"),
    figure: document.querySelector("[data-figure]")?.getAttribute("src"),
  };
}

describe("the door's pictures, fetched once", () => {
  beforeEach(() => {
    answer = null;
    asked = null;
  });

  test("[assets:pictures-shipped-light] [prologue:front-door-three-screens] given the manifest not yet read, when a look's face and figure are drawn, then neither fetches a picture, and once it is read each shows its published WebP", async () => {
    render(
      <>
        <FaceSticker look="person_ada" size={66} />
        <FigurePicture look="person_ada" />
      </>,
    );
    expect(document.querySelector("[data-face-sticker='person_ada']")).not.toBeNull();
    expect(document.querySelector("[data-figure='person_ada']")).not.toBeNull();
    expect(drawn()).toEqual({ face: undefined, figure: null });
    await act(async () => {
      answer?.resolve(PUBLISHED);
      await Promise.resolve();
    });
    expect(drawn()).toEqual({ face: "/assets/tiles/person_ada-face.0123456789ab.webp", figure: "/assets/tiles/person_ada-figure.ba9876543210.webp" });
  });

  test("[assets:pictures-shipped-light] given a manifest that cannot be read, when a look's face and figure are drawn, then the look's own small picture stands in", async () => {
    render(
      <>
        <FaceSticker look="person_ada" size={66} />
        <FigurePicture look="person_ada" />
      </>,
    );
    await act(async () => {
      answer?.reject(new Error("offline"));
      await Promise.resolve();
    });
    const standIn = lookOf("person_ada")?.picture;
    expect(standIn).toBeTruthy();
    expect(drawn()).toEqual({ face: standIn, figure: standIn });
  });

  test("[assets:pictures-shipped-light] given a manifest that does not hold a look's picture, when it is drawn, then the look's own small picture stands in", async () => {
    render(<FaceSticker look="person_ada" size={66} />);
    await act(async () => {
      answer?.resolve({ files: {} });
      await Promise.resolve();
    });
    expect(drawn().face).toBe(lookOf("person_ada")?.picture);
  });
});
