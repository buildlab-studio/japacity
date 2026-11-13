---
layout: home

hero:
  name: Japacity
  text: How it is built, and how it plays
  tagline: A browser life-sim about leaving Nigeria. You live a Nigerian life in Lagos a month at a time, and ways out (study, skilled work, tech, health care) open as your life comes to fit them.
  image:
    src: /pictures/dev-06-the-world.webp
    alt: The family house seen whole from above on the first visit, the band showing the name, the part of the day, the age, the place and the money, a line from the brother, and the round Map and Phone buttons with their hints
  actions:
    - theme: brand
      text: How it plays
      link: /plays/
    - theme: alt
      text: How it is built
      link: /built/
    - theme: alt
      text: The rules
      link: /rules/engine

features:
  - title: You build a person
    details: You pick a look, an archetype, a name and an age. A page of the years so far is printed, and the life starts at home at the age you chose.
    link: /plays/front-door
  - title: Routes open as the life fits them
    details: "Nobody picks a way out at the start. Study, work and people move your japacity: how much of a known route's checklist you already meet, shown on the phone as a filling bar and a word."
    link: /plays/routes
  - title: A pure, deterministic engine
    details: The simulation is plain functions over whole numbers, with named random streams. The same commands always give the same life, on the phone and on the server.
    link: /built/simulation
  - title: Every rule has a name and a test
    details: The rule pages are the specification. A test cites each rule's name, and the check fails when one is missing.
    link: /built/
  - title: One Worker for the whole game
    details: Online, a Cloudflare Worker serves the client and the API, keeps the command log and replays it, and stores lives in Postgres.
    link: /built/server
  - title: Kept with the code
    details: This site lives in the repository beside the code it describes, and changes with it.
    link: /built/working
---
