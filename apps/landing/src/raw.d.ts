// Vite's ?raw import, which the tests use to read the shipped wrangler.jsonc as text.
declare module "*?raw" {
  const text: string;
  export default text;
}
