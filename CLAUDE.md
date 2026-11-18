# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Univers-Ranking is a pop culture mini games website (French UI), hosted on GitHub Pages from the `main` branch root.

## Stack

Plain static HTML/CSS/JS — no build step, no dependencies, no tests yet. Any static file server works for local preview; pushing to `main` redeploys the site.

## Architecture

- `index.html` — home page listing the games as cards.
- `style.css` — shared styles (color tokens on `:root`) for every page.
- `games/<game>.html` + `games/<game>.js` — one page and script per mini game; game data lives inline in the script.
- `.nojekyll` — tells GitHub Pages to serve files as-is.

To add a game: create its page/script in `games/`, link `../style.css`, and add a card in `index.html`.
