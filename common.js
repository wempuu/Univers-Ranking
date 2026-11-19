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

function emptyBlock(emoji, title, text) {
  const div = document.createElement("div");
  div.className = "empty";
  div.innerHTML = `<div class="emoji"></div><h2></h2><p></p>`;
  div.querySelector(".emoji").textContent = emoji;
  div.querySelector("h2").textContent = title;
  div.querySelector("p").textContent = text;
  return div;
}
