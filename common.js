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

// Toutes les valeurs déjà utilisées pour un tag (tous mangas confondus), pour les suggestions
function knownTagValues(data, tagSlug) {
  const set = new Set();
  Object.values(data.mangas).forEach((m) =>
    m.characters.forEach((c) => ((c.tags && c.tags[tagSlug]) || []).forEach((v) => set.add(v))));
  return [...set].sort((a, b) => a.localeCompare(b, "fr"));
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

function emptyBlock(emoji, title, text) {
  const div = document.createElement("div");
  div.className = "empty";
  div.innerHTML = `<div class="emoji"></div><h2></h2><p></p>`;
  div.querySelector(".emoji").textContent = emoji;
  div.querySelector("h2").textContent = title;
  div.querySelector("p").textContent = text;
  return div;
}
