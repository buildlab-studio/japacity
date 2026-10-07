import * as sim from "@japacity/sim";

// A namespace import proves the workspace link without depending on any
// particular export, so this placeholder survives the real sim landing.
const simExportCount = Object.keys(sim).length;

export function App() {
  return (
    <main>
      <h1>Japacity</h1>
      <p data-testid="sim-link">Simulation linked ({String(simExportCount)} exports).</p>
    </main>
  );
}
