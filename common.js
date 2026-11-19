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

function emptyBlock(emoji, title, text) {
  const div = document.createElement("div");
  div.className = "empty";
  div.innerHTML = `<div class="emoji"></div><h2></h2><p></p>`;
  div.querySelector(".emoji").textContent = emoji;
  div.querySelector("h2").textContent = title;
  div.querySelector("p").textContent = text;
  return div;
}
