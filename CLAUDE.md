# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Univers-Ranking is a pop culture mini games website (French UI), hosted on GitHub Pages from the `main` branch root.

## Stack

Plain static HTML/CSS/JS — no build step, no dependencies, no tests yet. Any static file server works for local preview; pushing to `main` redeploys the site.

## Architecture

- `index.html` — home page (Accueil).
- `catalogue.html` — catalogue of universes; "Mangas" section with one `.card.manga` per series (cover image from `images/catalogue/<slug>`, shown at 2:3; the `--c1`/`--c2` gradient is the fallback behind it).
- `personnages.html?manga=<slug>` + `personnages.js` — one shared character page for every manga; all data lives in the `MANGAS` object in the script (empty `characters` array shows "Liste à venir"). Catalogue cards link here. `characters` is a plain list of names (no ranks or vote counts shown); One Piece has 50 names, in priority order: popular top 20, then missing Straw Hats, admirals, 4 revolutionaries (Dragon, Sabo, Ivankov, Karasu), bounties of 1 billion+, then key characters from arcs (no duplicates).
- `jeux.html` — games menu; currently shows an empty state, no games exist yet.
- `style.css` — shared styles (color tokens on `:root`) for every page; includes `.grid` / `.card` for game listings.
- All pages share the same header/nav (Accueil, Catalogue, Jeux); keep them in sync when editing.
- `.nojekyll` — tells GitHub Pages to serve files as-is.

To add a game: create `jeux/<game>.html` (+ `.js`), link `../style.css`, and in `jeux.html` replace the `.empty` block with a `.grid` of `<a class="card">` entries.
