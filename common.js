// Fonctions partagées par les pages personnages, fiche personnage et outil d'édition.

const DATA_URL = "data/mangas.json";

// "Monkey D. Luffy" -> "monkey-d-luffy" (sert d'identifiant dans les URL)
function slugify(text) {
  return text
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Fichier complet : { tags: { <tag-slug>: { label } }, mangas: { <manga-slug>: { title, cover, characters } } }
// Un personnage : { name, tags: { <tag-slug>: [valeurs] } }
async function loadData() {
  const res = await fetch(DATA_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Impossible de charger ${DATA_URL} (${res.status})`);
  return res.json();
}

async function loadMangas() {
  return (await loadData()).mangas;
}

function isValidData(d) {
  return !!d && typeof d === "object" && !!d.tags && !!d.mangas &&
    Object.values(d.mangas).every((m) => Array.isArray(m.characters) && m.characters.every((c) => typeof c.name === "string"));
}

// Valeurs possibles d'une catégorie de tags, pour les suggestions :
// d'abord celles prévues dans data.tags[slug].values (dans leur ordre), puis celles déjà utilisées (tous mangas confondus)
function knownTagValues(data, tagSlug) {
  const planned = (data.tags[tagSlug] && data.tags[tagSlug].values) || [];
  const used = new Set();
  Object.values(data.mangas).forEach((m) =>
    m.characters.forEach((c) => ((c.tags && c.tags[tagSlug]) || []).forEach((v) => used.add(v))));
  planned.forEach((v) => used.delete(v));
  return [...planned, ...[...used].sort((a, b) => a.localeCompare(b, "fr"))];
}

// Rareté d'un tag : data.tags[cat].rarity = { <tag>: 1 | 2 | 3 } (1 = Commun par défaut)
const RARITY_LABELS = { 1: "Commun", 2: "Rare", 3: "Très rare" };
function tagRarity(data, tagSlug, value) {
  const r = data.tags[tagSlug] && data.tags[tagSlug].rarity;
  const n = r && r[value];
  return n === 2 || n === 3 ? n : 1;
}
function rarityStars(n) {
  return "⭐".repeat(n);
}

// Persos qui ont TOUS les critères [{ cat, value }] (catégories mélangées possibles)
function charactersWithTags(data, criteria) {
  const norm = (s) => normalizeSearch(s);
  const out = [];
  Object.entries(data.mangas).forEach(([slug, m]) => m.characters.forEach((c) => {
    const ok = criteria.every(({ cat, value }) => ((c.tags || {})[cat] || []).some((v) => norm(v) === norm(value)));
    if (ok) out.push({ c, manga: slug, mangaTitle: m.title });
  }));
  return out;
}

// Découpe les personnages par catégorie, dans l'ordre de manga.groups.
// Un perso sans catégorie connue va dans la dernière. Sans catégories : un seul bloc sans titre.
function groupCharacters(manga) {
  const groups = manga.groups || [];
  if (groups.length === 0) return [{ id: null, label: null, characters: manga.characters }];
  const ids = groups.map((g) => g.id);
  const fallback = ids[ids.length - 1];
  return groups.map((g) => ({
    ...g,
    characters: manga.characters.filter((c) => (ids.includes(c.group) ? c.group : fallback) === g.id),
  }));
}

// Portrait d'un personnage : son image (champ `image`) ou, à défaut, ses initiales sur un dégradé
function persoAvatar(perso, className = "avatar") {
  if (perso.image) {
    const img = document.createElement("img");
    img.className = className;
    img.src = perso.image;
    img.alt = perso.name;
    img.loading = "lazy";
    return img;
  }
  const div = document.createElement("div");
  div.className = `${className} avatar-initials`;
  const words = perso.name.replace(/\(.*?\)/g, "").split(/\s+/).filter((w) => w && !/^[A-Z]\.$/.test(w));
  div.textContent = ((words[0] || "?")[0] + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
  let h = 0;
  for (const ch of perso.name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  div.style.background = `linear-gradient(135deg, hsl(${h} 70% 45%), hsl(${(h + 60) % 360} 70% 35%))`;
  div.setAttribute("aria-label", perso.name);
  return div;
}

// ---------- Fenêtres de dialogue ----------
// Remplacent confirm() et prompt() du navigateur, que certains navigateurs (ex. le navigateur
// intégré de l'app Claude) bloquent en répondant « non » sans rien afficher.

function openDialog({ message, input, defaultValue = "", okLabel = "OK", danger = false }) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <form class="modal" role="dialog" aria-modal="true">
        <p class="dialog-message"></p>
        ${input ? '<input class="tool-input dialog-input" autocomplete="off">' : ""}
        <div class="tool-bar modal-actions">
          <button type="submit" class="btn"></button>
          <button type="button" class="btn ghost" data-r="cancel">Annuler</button>
        </div>
      </form>`;
    const form = overlay.querySelector("form");
    overlay.querySelector(".dialog-message").textContent = message;
    const ok = overlay.querySelector('button[type="submit"]');
    ok.textContent = okLabel;
    if (danger) ok.classList.add("danger");
    const field = overlay.querySelector(".dialog-input");
    if (field) field.value = defaultValue;

    const done = (value) => {
      overlay.remove();
      document.removeEventListener("keydown", onKey, true);
      resolve(value);
    };
    const cancel = () => done(input ? null : false);
    const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cancel(); } };
    document.addEventListener("keydown", onKey, true);
    form.addEventListener("submit", (e) => { e.preventDefault(); done(input ? field.value : true); });
    overlay.querySelector('[data-r="cancel"]').addEventListener("click", cancel);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) cancel(); });

    document.body.appendChild(overlay);
    (field || ok).focus();
    if (field) field.select();
  });
}

// Oui / non : résout true ou false
function askConfirm(message, { okLabel = "Confirmer", danger = false } = {}) {
  return openDialog({ message, okLabel, danger });
}

// Texte : résout la saisie, ou null si annulé
function askText(message, defaultValue = "", okLabel = "Valider") {
  return openDialog({ message, input: true, defaultValue, okLabel });
}

// ---------- Recherche ----------

// Texte comparable : minuscules, sans accents ni ponctuation ("Corazón" -> "corazon")
function normalizeSearch(text) {
  return String(text).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Barre de recherche réutilisable. `onSearch(query normalisée)` est appelé à chaque frappe.
// Raccourcis : « / » met le curseur dans la barre, Échap la vide.
function createSearchBar({ placeholder, onSearch }) {
  const wrap = document.createElement("div");
  wrap.className = "search-bar";
  wrap.innerHTML = `
    <span class="search-icon" aria-hidden="true">🔍</span>
    <input type="search" autocomplete="off" spellcheck="false">
    <span class="search-count muted-small" aria-live="polite"></span>
    <button type="button" class="search-clear" title="Effacer la recherche" aria-label="Effacer la recherche" hidden>✕</button>`;
  const input = wrap.querySelector("input");
  const clearBtn = wrap.querySelector(".search-clear");
  input.placeholder = placeholder;
  input.setAttribute("aria-label", placeholder);
  const run = () => {
    clearBtn.hidden = input.value === "";
    onSearch(normalizeSearch(input.value));
  };
  const clear = () => { input.value = ""; run(); input.focus(); };
  input.addEventListener("input", run);
  input.addEventListener("keydown", (e) => { if (e.key === "Escape") clear(); });
  clearBtn.addEventListener("click", clear);
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
      e.preventDefault();
      input.focus();
    }
  });
  return {
    el: wrap,
    setCount: (text) => { wrap.querySelector(".search-count").textContent = text; },
  };
}

// Texte de recherche d'un élément : plusieurs libellés (nom, tags…) normalisés et séparés,
// pour qu'une recherche ne puisse pas déborder d'un libellé sur le suivant
function searchText(labels) {
  return labels.map(normalizeSearch).filter(Boolean).join(" | ");
}

// La recherche doit correspondre au DÉBUT d'un mot, et ses lettres et mots doivent se suivre dans l'ordre :
// « on » trouve « One Piece » mais pas « Dragon Ball » ; « monkey d » trouve « Monkey D. Luffy ».
function matchesSearch(haystack, query) {
  return !query || (" " + haystack).includes(" " + query);
}

function emptyBlock(emoji, title, text) {
  const div = document.createElement("div");
  div.className = "empty";
  div.innerHTML = `<div class="emoji"></div><h2></h2><p></p>`;
  div.querySelector(".emoji").textContent = emoji;
  div.querySelector("h2").textContent = title;
  div.querySelector("p").textContent = text;
  return div;
}
