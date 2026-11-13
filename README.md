<!-- Dedicated to my best friend, Osoko Emmanuel (July 1998 to June 2026). From Al-Ameen. -->

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/client/public/brand/japacity-mark-dark.svg">
    <img src="apps/client/public/brand/japacity-mark-light.svg" width="112" height="112" alt="The Japacity seal: a J inside two rings">
  </picture>
</p>

<h1 align="center">Japacity</h1>

<p align="center">
  <b>Live a Nigerian life, one month at a time, and see how ready you are to japa.</b><br>
  A life-sim for your phone's browser about leaving Nigeria, or staying.
</p>

<!-- teaser: the asset link below and the two pictures' links point at mp4s uploaded through GitHub's editor, the only way GitHub plays a video in a README. The sources are docs/teaser/japacity-teaser.mp4 and japacity-teaser-portrait.mp4. A new render needs new uploads (see apps/teaser/README.md). -->

https://github.com/user-attachments/assets/5949493c-b849-43f5-b139-ab0121b32426

<p align="center">
  <a href="https://github.com/user-attachments/assets/5949493c-b849-43f5-b139-ab0121b32426"><img src="docs/teaser/japacity-teaser-end.webp" height="300" alt="The landscape teaser's end card: the Japacity seal and name on night blue, Play it with the game's address, Japa is not by force. How ready are you?, and Free. Open source on GitHub."></a>
  <a href="https://github.com/user-attachments/assets/ac24031c-08e9-4ffb-abff-049f8905343b"><img src="docs/teaser/japacity-teaser-portrait-open.webp" height="300" alt="The portrait teaser's opening: Ada's card and the words Japa is not by force. How ready are you? over the map of Lagos from the air, with Ada standing beside them"></a>
</p>
<p align="center">Left: the teaser for a screen. Right: the teaser for a phone. Each is 28 seconds, with sound. Tap a picture to play it. The files: <a href="docs/teaser/japacity-teaser.mp4">landscape</a>, <a href="docs/teaser/japacity-teaser-portrait.mp4">portrait</a>.</p>

<p align="center">
  <img src="docs/site/public/pictures/dev-01-front-door.webp" width="30%" alt="Who are you? A sticker card with your figure, a danfo and a Ghana Must Go bag, your name with a dice beside it, and your look">
  <img src="docs/site/public/pictures/dev-06-the-world.webp" width="30%" alt="The family house seen whole in the afternoon, your brother saying Papa is asking who left the gate open, the band on top, and Map, Go places, Chats, bank, news and Phone at the foot">
  <img src="docs/site/public/pictures/dev-07-map-with-a-stop-picked.webp" width="30%" alt="The map folded on Bode Thomas with Bode Thomas Street picked, and the ride sheet: danfo, keke, okada or walk, each with its fare and time">
</p>

## How it plays

*Japa* is Nigerian for leaving the country for good. One life goes like this:

1. **Start.** Pick a look, a name, a life so far and a place to live. A travel data page is printed with your years on it.
2. **Months.** Each night you sleep is one month. You fill the month with work, study, family and errands, and cross the city by danfo, keke or okada, paying each fare.
3. **Your phone.** The Bank holds your savings for the move, jobs appear on the board, the family talks in the group chat, and your papers are kept in the box under the bed.
4. **Ways out.** You do not pick one at the start. A master's in the UK, a tech job abroad, health care in the UK, Canada's points or a Gulf contract appear once your life matches them. The Japa app shows the brief for the next step.
5. **The application.** Gather the papers, save the money, sit the test and wait for the answer. A refusal is not the end.
6. **Leaving.** If the visa is granted, the family walks you to Departures, the counter asks window or aisle, Papa says go well at the gate, and the plane leaves Lagos at night. You land at a cold bus stop with a bag and three messages from home, and the life continues abroad. If you stay, the life continues at home.

<p align="center">
  <img src="docs/site/public/pictures/front/phone.webp" width="30%" alt="The phone made big over the family house: the clock, a notice that your TB test certificate is ready, and the eleven apps from Calendar to Settings">
  <img src="docs/site/public/pictures/front/results.webp" width="30%" alt="The month is done: the visa for a master's in the UK was granted, your brother stayed home from school, the salary from a foreign company came in, and the saving for the move is full">
  <img src="docs/site/public/pictures/dev-30-phone-japa.webp" width="30%" alt="The Japa app: your plan, a master's in the UK, with how ready you are as a full bar, and Mama's brief Show the money with Pay the deposit ticked">
</p>

<p align="center">
  <img src="docs/site/public/pictures/front/departures.webp" width="30%" alt="Departures at Ikeja: the family behind the rope, Mama saying call when you land and call again when you reach the house, and Step forward">
  <img src="docs/site/public/pictures/front/gate.webp" width="30%" alt="Gate 12 to London: Papa saying greet them for us, go well, the family waving, and Board the plane">
  <img src="docs/site/public/pictures/front/plane.webp" width="30%" alt="The plane over Lagos at night, one way to London, and the line The plane lifts off. Lagos gets small.">
</p>

<p align="center">
  <img src="docs/site/public/pictures/front/send-off.webp" width="23%" alt="Just landed in London: four degrees and no coat yet, the red bus to Peckham pulling in, an aunty at the stop saying it gets colder, and Get on the bus">
  <img src="docs/site/public/pictures/front/dubai.webp" width="23%" alt="Just landed in Deira: forty one degrees and not one cloud, a taxi at the kerb, a man at the corner saying the shop needs a guard for nights, and Get in the taxi">
  <img src="docs/site/public/pictures/front/calgary.webp" width="23%" alt="Just landed in northeast Calgary: minus twenty with snow coming down, a neighbour at the stop saying buy proper boots before November, and Get in the truck">
  <img src="docs/site/public/pictures/front/castel.webp" width="23%" alt="Just landed at Castel Volturno: fifteen degrees and wind off the sea, the Via Domitiana bus, a brother at the stop saying they need people for the fields tomorrow, and Get on the bus">
</p>

## Play it

Play it in your browser, on a phone or a computer. Nothing to download.

## How it is built

- **[A deterministic simulation](docs/site/built/simulation.md):** pure functions over whole numbers, so the same choices give the same life on the phone and on the server.
- **[One Cloudflare Worker](docs/site/built/server.md):** serves the game and its API, keeps each life's log and stores lives in Postgres.
- **[Named, tested rules](docs/rules/engine.md):** every rule has a name, every name has a test that cites it, and the check fails when one is missing.

## Read more

- [How it plays](docs/site/plays/index.md)
- [How it is built](docs/site/built/index.md)
- [The rules](docs/rules/engine.md)
- [Design notes](docs/design/)
- [Working on it](docs/site/built/working.md): requirements, commands, the check and CI
- [Run your own copy](docs/site/built/your-own-copy.md), with your own domain, database and keys
- [Contributing](CONTRIBUTING.md)
- [Decisions](docs/decisions/)

## Licences

Code is MIT. Docs are CC BY 4.0. Game content and our own art are CC BY-SA 4.0. The name and logo are reserved. See [LICENSES.md](LICENSES.md).
