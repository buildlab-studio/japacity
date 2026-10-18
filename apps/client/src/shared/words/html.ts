// Words set into a plain HTML page the game writes itself (the legal pages, the official accounts page).

/** The words with the characters HTML reads as markup written as entities, safe inside text and quoted attributes. */
export function escapeHtml(words: string): string {
  return words.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
