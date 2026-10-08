// A stand-in for the game behind the gate in the browser test: one page and one route,
// so the test can tell the game from the gate's screen.
import { createServer } from "node:http";

const PORT = Number(process.env.GATE_E2E_GAME_PORT ?? "8791");

createServer((request, response) => {
  if (request.url?.startsWith("/api/") === true) {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>The game</title></head><body><h1>The game</h1><p>${request.url ?? ""}</p></body></html>`);
}).listen(PORT, "127.0.0.1");
