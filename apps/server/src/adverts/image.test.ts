import { describe, expect, test } from "vitest";

import { imageFacts } from "./image";
import { jpegOf, pngOf, webpOf } from "./adverts.testing";

describe("reading an advert's image", () => {
  test("[R-ADVERT-004] given a still PNG, JPEG or WebP, when it is read, then its format and pixel size come from its own bytes", () => {
    expect(imageFacts(pngOf(1024, 512))).toEqual({ format: "png", width: 1024, height: 512, animated: false });
    expect(imageFacts(jpegOf(512, 768))).toEqual({ format: "jpeg", width: 512, height: 768, animated: false });
    expect(imageFacts(webpOf(256, 256))).toEqual({ format: "webp", width: 256, height: 256, animated: false });
    expect(imageFacts(webpOf(768, 192, "lossless"))).toEqual({ format: "webp", width: 768, height: 192, animated: false });
    expect(imageFacts(webpOf(1024, 512, "extended"))).toEqual({ format: "webp", width: 1024, height: 512, animated: false });
  });

  test("[R-ADVERT-004] given a moving PNG or WebP, or a GIF, when it is read, then it is marked as moving or is no image at all", () => {
    expect(imageFacts(pngOf(1024, 512, 1000, true))?.animated).toBe(true);
    expect(imageFacts(webpOf(1024, 512, "extended", true))?.animated).toBe(true);
    expect(imageFacts(Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 4, 0, 2]))).toBeNull();
    expect(imageFacts(new Uint8Array())).toBeNull();
  });
});
