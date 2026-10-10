// Vite's ?raw import, which the tests use to read the waitlist's schema.sql as text.
declare module "*?raw" {
  const text: string;
  export default text;
}
