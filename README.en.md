[🇧🇷 Português](README.md) | 🇺🇸 English

# 📖 Timoteo App

**Interactive Bible study: every book with a study sheet, a map, a timeline and people pages, and the text in four clearly licensed versions.**

A table of the 66 books of the Bible, where each book opens a study sheet (author, date, theme, outline), a map of the places it mentions and the text for reading. A timeline and people pages link back to the books and the maps. Everything is static (React + Vite), published on GitHub Pages, with a Portuguese and English interface.

**▶ Live demo: <https://andrescultori.github.io/timoteo-app/>**

> **About the content.** This is an original personal project. Study sheets, dates and people summaries are drafts under manual review: where authorship, dating or location are debated, the site shows the positions (traditional and scholarly) side by side and flags the uncertainty. Bible text is only included under a clear license.

![Grid of the 66 books by section](docs/images/grade.png)

## The problem

Studying the Bible with context means opening several sources: the text, a book overview, a map, a chronology and a list of people. Each usually lives in a different place, unlinked to the others, and almost none shows where scholars disagree.

## The solution

A single interface where the pieces link to one another:

```
Book (grid of 66)
   ↓
Sheet · Map · Text
   ↓            ↓
Timeline ⇄ Map ⇄ People
```

From the Exodus on the timeline, for example, one click opens the Exodus map already on the right place; from a place on the map, another click shows the events and the people tied to it.

## What the site has

- **A grid of the 66 books** by section, with search and a testament filter. Direct link per book (`#joh`).
- **A study sheet** for each book, in PT and EN: author, date, place, recipients, key verse, theme, historical context, people, outline and connections. Authorship and dating show the **traditional and scholarly positions side by side**; a switch in Settings (⚙) hides the scholarly one for simpler study.
- **A map** in 46 books, with its own vector coastline (no external tiles), collision-free labels, regional zoom, a legend and flags for debated locations.
- **A timeline** with 13 periods and 69 events, on a per-block scale, with approximate dates marked and debated chronologies (such as the Exodus) shown side by side. Books are tied to the period their text describes.
- **People**: 210 people, with a summary, the books they appear in, events and places; the list sorts alphabetically or by book.
- **Genealogy**: two trees: from Adam to Jesus (Genesis, Ruth, 1 Chronicles and Matthew 1) and from Abraham to the twelve tribes; every link cites the biblical text and differences are kept in notes.
- **Psalms as a table**: the 150 psalms colored by book of the Psalter, title or genre, with the psalms that have a historical title linked to David, the people and the timeline.
- **Structure of Job, Proverbs, Ecclesiastes and Song of Songs**: chapters colored by part (in Job, by speaker), the list of parts and, in Ecclesiastes and Song of Songs, the readings side by side.
- **A text reader** in KJV, WEB and ASV (English), Bíblia Livre (Portuguese), with the credit and license of each.
- Two themes, dark parchment and light parchment (serif type), PT and EN.

![Timeline, with the two readings of the Exodus date](docs/images/linha-do-tempo.png)

![Map of 2 Kings, with legend](docs/images/mapa.png)

<img src="docs/images/mapa-celular.png" alt="Map on a phone" width="260">

![A person's page, linked to books, an event and places](docs/images/personagens.png)

## Tech stack

| Layer | Technology |
|---|---|
| UI | React 18 + Vite |
| Maps | d3-geo, SVG at real pixels |
| Genealogy | d3-hierarchy, tree in SVG |
| Coastline | Natural Earth 50m (public domain), clipped |
| Places | OpenBible.info Bible Geocoding Data (CC BY 4.0) |
| Bible text | JSON files per book and version, loaded on demand |
| Validation | `npm run check` (sheets, maps, timeline, people and texts) and CI on GitHub Actions |
| Hosting | GitHub Pages via GitHub Actions |

## Design decisions

- **Bible text only under a clear license.** Each version has its license evidence in `docs/licencas-texto-biblico.md`. Versions with rights holders (ARA, NAA, NIV, ESV, NKJV and others) stay out until there is permission.
- **Never invent data.** Coordinates come from OpenBible and debated locations are flagged; timeline dates have their basis recorded in `docs/linha-do-tempo-fontes.md`.
- **Zero running cost.** A static site, with no paid API and no pay-per-use service.
- **Automatic data validation.** A script checks ids, chapter references, coordinates, the links between timeline, map and people, and the numbering of every text; CI runs it on every pull request.
- **Per-block scale on the timeline.** Four thousand years do not fit a linear scale without crushing the New Testament; each block has its own scale, and the screen says so.

## Data, formats and documentation

The format of each dataset (text, map, timeline, people, settings) is in [`docs/formatos-de-dados.md`](docs/formatos-de-dados.md) (in Portuguese). Text sources and licenses are in [`docs/licencas-texto-biblico.md`](docs/licencas-texto-biblico.md) and the basis of the dates in [`docs/linha-do-tempo-fontes.md`](docs/linha-do-tempo-fontes.md).

## Running locally

```bash
npm install
npm run dev
npm run check   # checks sheets, maps, timeline, people and texts
npm run build
```

Every pull request runs `npm run check` and `npm run build`; deployment to Pages happens on push to `main`.

## Credits

- Coastline: [Natural Earth](https://www.naturalearthdata.com/) (public domain), via the `world-atlas` package, clipped and simplified.
- Map places: [OpenBible.info Bible Geocoding Data](https://www.openbible.info/geo/), license [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Coordinates rounded and adapted.
- Projection: [d3-geo](https://github.com/d3/d3-geo) (ISC).
- Genealogy tree: [d3-hierarchy](https://github.com/d3/d3-hierarchy) (ISC).
- Texts: KJV (public domain); WEB ([eBible.org](https://ebible.org/eng-web/), public domain); ASV (public domain, digital edition by [openbibleinfo](https://github.com/openbibleinfo/American-Standard-Version-Bible)); **Bíblia Livre (BLIVRE), © 2018 Diego Santos, Mario Sérgio and Marco Teles, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)**, [source](https://github.com/blivre/BibliaLivre).

Original idea of the table: "TaBíblia Periódica" (Grupo de Jovens Conquistando as Nações; source cited: Sociedade Bíblica do Brasil). This project has its own design and code.

*Code license: [MIT](LICENSE). Bible texts and third-party data follow the licenses stated above.*
