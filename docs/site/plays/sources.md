<script setup>
import { data } from "./sources.data";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `2026-10-08` as "8 Oct 2026". */
function day(iso) {
  const [year, month, date] = iso.split("-").map(Number);
  return `${date} ${MONTHS[month - 1]} ${year}`;
}
</script>

# Every source

Every source the game cites, in one list: the sources of each guide, the journalism the road's real-story cards draw on, and the sources of each rule page. The list is built from the guides, the game's content and the rule pages every time this site is built, so it is never out of date. Each guide page in the game keeps its own sources as well.

## The guides

<section v-for="guide in data.guides" :key="guide.id" :data-group="guide.id">
<h3>{{ guide.title }}</h3>
<ul>
<li v-for="source in guide.sources" :key="source.url"><a :href="source.url" rel="noreferrer">{{ source.title }}</a><span v-if="source.readOn">, read on {{ day(source.readOn) }}</span></li>
</ul>
</section>

## The real-story cards

When the road ends, the real-story card credits the reporting the road follows. Nothing from that reporting is reproduced in the game. Read it where it was published.

<ul data-group="real-story">
<li v-for="item in data.journalism" :key="item.credit"><a v-if="item.link" :href="item.link" rel="noreferrer">{{ item.credit }}</a><span v-else>{{ item.credit }}</span></li>
</ul>

See [The road](./road.md) for the card itself.

## The rule pages

<section v-for="page in data.rules" :key="page.name" :data-group="`rules/${page.name}`">
<h3><a :href="`/rules/${page.name}`">{{ page.title }}</a></h3>
<ul>
<li v-for="source in page.sources" :key="source.url"><a :href="source.url" rel="noreferrer">{{ source.title }}</a><span v-if="source.readOn">, read on {{ day(source.readOn) }}</span></li>
</ul>
</section>

## The rules it rests on

- [Guides, sources and credits](../../rules/guide.md): guide:guide-entry-fields (each guide's own sources), guide:one-sources-page (this list).
- [The road](../../rules/road.md): road:real-story-card-after-chain (the real-story card, its credits and links in content).
