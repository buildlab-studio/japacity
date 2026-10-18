// Content ids the simulation's tests share, by kind. A name carries its kind when
// the same word names an entry of another kind. Nothing in the simulation imports this file.
import type { Id } from "../engine/types";

export const AGE: Id<"quality"> = "quality.age-months";
export const BELLY: Id<"quality"> = "quality.belly";
export const EDU: Id<"quality"> = "quality.edu-level";
export const ENERGY: Id<"quality"> = "quality.energy";
export const NETWORK: Id<"quality"> = "quality.network";
export const PORTFOLIO: Id<"quality"> = "quality.portfolio";
export const PREP: Id<"quality"> = "quality.interview-prep";
export const STANDING: Id<"quality"> = "quality.standing";
export const TECH: Id<"quality"> = "quality.tech";
export const WELLBEING: Id<"quality"> = "quality.wellbeing";
