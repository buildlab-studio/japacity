import { z } from "zod";

// Integer maths only: whole numbers, %, and the allowed Math functions.
export const Money = z.number().int();

export function mix(a: number, b: number): number {
  return Math.floor(Math.imul(a, 31) % 7) + Math.max(Math.abs(b), 3) + 0x1e;
}
