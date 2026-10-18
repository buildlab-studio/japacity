---
layout: home

hero:
  name: Japacity
  text: How it is built, and how it plays
  tagline: A browser life-sim about leaving Nigeria. You live a Nigerian life a month at a time, in Lagos, and ways out appear as your life comes to match them.
  image:
    src: /pictures/dev-06-the-world.webp
    alt: The family house seen whole from above on the first visit, the band showing the name, the part of the day, the age and the money, the home's card at the foot, and the round Map and Phone buttons
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
  - title: A life, not a menu
    details: You pick a look, an archetype, a name and an age. A page of your years so far is printed, and the life starts at home at the age you chose.
    link: /plays/front-door
  - title: Routes find you
    details: "Nobody picks a way out at the start. Study, work and people move your japacity: how much of a known route's checklist you already meet, shown on the phone as a bar that fills and a word."
    link: /plays/routes
  - title: A pure, deterministic engine
    details: The simulation is plain functions over whole numbers, with named random streams. The same commands always give the same life, on the phone and on the server.
    link: /built/simulation
  - title: Every rule has a name and a test
    details: The rule pages are the contract. Each rule's name is cited by a test, and the check fails when one is missing.
    link: /built/
  - title: One Worker for the whole game
    details: Online, a Cloudflare Worker serves the client and the API, keeps the command log and replays it, and stores lives in Postgres.
    link: /built/server
  - title: Kept with the code
    details: This site lives in the repository beside the code it describes, and changes with it.
    link: /built/working
---
