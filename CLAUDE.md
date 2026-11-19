# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Univers-Ranking is a pop culture mini games website (French UI), hosted on GitHub Pages from the `main` branch root.

## Stack

Plain static HTML/CSS/JS — no build step, no dependencies, no tests yet. Pages `fetch` `data/mangas.json`, so preview through a local HTTP server (opening files via `file://` breaks the character pages). Pushing to `main` redeploys the site.

## Architecture

- `index.html` — home page (Accueil).
- `catalogue.html` — catalogue of universes; "Mangas" section with one `.card.manga` per series (cover image from `images/catalogue/<slug>`, shown at 2:3; the `--c1`/`--c2` gradient is the fallback behind it).
- `data/mangas.json` — single source of truth: `{ <manga-slug>: { title, cover, characters: [names] } }`. Empty `characters` shows "Liste à venir". `characters` is a plain list of names (no ranks or vote counts shown); One Piece has 75 names, in priority order: popular top 20, then missing Straw Hats, admirals, 4 revolutionaries (Dragon, Sabo, Ivankov, Karasu), bounties down to ~700 million, then key characters from arcs (no duplicates).
- `common.js` — shared helpers: `loadMangas()`, `slugify()` (character URL id, derived from the name, so renaming a character changes its URL), `emptyBlock()`.
- `personnages.html?manga=<slug>` + `personnages.js` — character list for a manga; catalogue cards link here, each name links to the character page.
- `personnage.html?manga=<slug>&perso=<name-slug>` + `personnage.js` — character page (placeholder "Fiche à venir" + previous/next links).
- `outil.html` + `outil.js` — hand editor for `data/mangas.json` (add, rename, reorder by drag or arrows, delete, duplicate check). Saves in place via the File System Access API (Chrome/Edge, after "Ouvrir"), otherwise downloads a new `mangas.json`. Not linked in the nav; reachable from "Modifier la liste" on each character list.
- `jeux.html` — games menu; currently shows an empty state, no games exist yet.
- `style.css` — shared styles (color tokens on `:root`) for every page; includes `.grid` / `.card` for game listings.
- All pages share the same header/nav (Accueil, Catalogue, Jeux); keep them in sync when editing.
- `.nojekyll` — tells GitHub Pages to serve files as-is.
- Cache busting: every page loads `style.css?v=N` and `*.js?v=N`. GitHub Pages caches files for 10 minutes, so a browser can mix new HTML with old JS after a deploy. When changing any CSS/JS, bump `N` in all `*.html` files (e.g. `sed -i "s/?v=2\"/?v=3\"/g" *.html`).

To add a game: create `jeux/<game>.html` (+ `.js`), link `../style.css`, and in `jeux.html` replace the `.empty` block with a `.grid` of `<a class="card">` entries.
