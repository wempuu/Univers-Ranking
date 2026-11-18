# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Univers-Ranking is a pop culture mini games website (French UI), hosted on GitHub Pages from the `main` branch root.

## Stack

Plain static HTML/CSS/JS — no build step, no dependencies, no tests yet. Any static file server works for local preview; pushing to `main` redeploys the site.

## Architecture

- `index.html` — home page (Accueil).
- `jeux.html` — games menu; currently shows an empty state, no games exist yet.
- `style.css` — shared styles (color tokens on `:root`) for every page; includes `.grid` / `.card` for game listings.
- Both pages share the same header/nav (Accueil, Jeux); keep them in sync when editing.
- `.nojekyll` — tells GitHub Pages to serve files as-is.

To add a game: create `jeux/<game>.html` (+ `.js`), link `../style.css`, and in `jeux.html` replace the `.empty` block with a `.grid` of `<a class="card">` entries.
