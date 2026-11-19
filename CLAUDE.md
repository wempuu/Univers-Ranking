# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Univers-Ranking is a pop culture mini games website (French UI), hosted on GitHub Pages from the `main` branch root.

## Stack

Plain static HTML/CSS/JS — no build step, no dependencies, no tests yet. Pages `fetch` `data/mangas.json`, so preview through a local HTTP server (opening files via `file://` breaks the character pages). Pushing to `main` redeploys the site.

## Architecture

- `index.html` — home page (Accueil).
- `catalogue.html` — catalogue of universes; "Mangas" section with one `.card.manga` per series (cover image from `images/catalogue/<slug>`, shown at 2:3; the `--c1`/`--c2` gradient is the fallback behind it).
- `data/mangas.json` — single source of truth: `{ tags: { <tag-slug>: { label } }, mangas: { <manga-slug>: { title, cover, groups: [{ id, label }], characters: [{ name, group, tags: { <tag-slug>: [values] } }] } } }`. Empty `characters` shows "Liste à venir".
- Groups (categories) are per manga and are not tags (they are series-specific). The characters array is kept sorted by group (in `groups` order), and within a group by importance in the story; the list page shows one heading per group, no ranks or vote counts. A character whose `group` is unknown falls into the last group. Empty `groups` = one flat list. One Piece groups: Pirates > Marine & Gouvernement > Révolutionnaires > Autres (75 characters; Kuzan is filed under Marine despite joining Blackbeard, Mihawk/Crocodile under Pirates). Selection history: popular top 20, missing Straw Hats, admirals, 4 revolutionaries (Dragon, Sabo, Ivankov, Karasu), bounties down to ~700 million, then key arc characters.
- Tags exist so mini games can group characters across works. Only tag so far: `style-de-combat`. Values must stay generic and reusable across series ("Épéiste", "Feu", "Transformation", "Combat à mains nues"…), never series-specific names (no "Fruit du démon", "Rokushiki"); reuse an existing value before inventing a new one. A character can have several values.
- `common.js` — shared helpers: `loadData()` (whole file), `loadMangas()` (just `mangas`), `slugify()` (character URL id, derived from the name, so renaming a character changes its URL), `groupCharacters()` (splits a manga's characters by group), `emptyBlock()`.
- `personnages.html?manga=<slug>` + `personnages.js` — character list for a manga; catalogue cards link here, each name links to the character page.
- `personnage.html?manga=<slug>&perso=<name-slug>` + `personnage.js` — character page: one block per tag type showing its values as chips, plus previous/next links.
- `outil.html` + `outil.js` — hand editor for `data/mangas.json` (add with a group, rename, change group via a select (moves to the end of that group), reorder within a group by arrows or across groups by drag (adopts the target's group), delete, duplicate check, add/remove tag values with suggestions from values already used; typed values snap to an existing spelling). Publishing: "Publier sur GitHub" commits `data/mangas.json` to the branch picked in the editor (default `main`, the only branch the site shows; a "Nouvelle branche" button creates one from the current branch) through the GitHub contents API (`PUT /repos/wempuu/Univers-Ranking/contents/data/mangas.json` with the last known `sha`, so a concurrent edit is refused instead of overwritten; if the branch has no data file yet, publishing creates it). Each user pastes their own GitHub token (owner: fine-grained, Contents read+write on this repo; collaborators: classic `public_repo`), stored only in that browser's localStorage (`ur-github-token`); when connected the editor loads the file from the API, not from Pages. Not linked in the nav; reachable from "Modifier la liste" on each character list.
- Because the editor commits straight to GitHub, the local clone falls behind: always `git pull` before editing anything locally, especially `data/mangas.json`.
- `jeux.html` — games menu; currently shows an empty state, no games exist yet.
- `style.css` — shared styles (color tokens on `:root`) for every page; includes `.grid` / `.card` for game listings.
- All pages share the same header/nav (Accueil, Catalogue, Jeux); keep them in sync when editing.
- `.nojekyll` — tells GitHub Pages to serve files as-is.
- Cache busting: every page loads `style.css?v=N` and `*.js?v=N`. GitHub Pages caches files for 10 minutes, so a browser can mix new HTML with old JS after a deploy. When changing any CSS/JS, bump `N` in all `*.html` files (currently `v=6`; e.g. `sed -i "s/?v=6\"/?v=7\"/g" *.html`).

To add a game: create `jeux/<game>.html` (+ `.js`), link `../style.css`, and in `jeux.html` replace the `.empty` block with a `.grid` of `<a class="card">` entries.
