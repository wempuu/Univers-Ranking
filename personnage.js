// Fiche d'un personnage : personnage.html?manga=<slug>&perso=<slug du nom>

(async () => {
  const params = new URLSearchParams(location.search);
  const mangaSlug = params.get("manga");
  const persoSlug = params.get("perso");
  const content = document.getElementById("content");

  let data;
  try {
    data = await loadData();
  } catch (e) {
    content.appendChild(emptyBlock("⚠️", "Erreur de chargement", e.message));
    return;
  }

  const manga = data.mangas[mangaSlug];
  if (!manga) {
    content.appendChild(emptyBlock("🔍", "Ce manga n'existe pas", "Retourne au catalogue pour en choisir un."));
    return;
  }

  const back = document.getElementById("back");
  back.href = `personnages.html?manga=${encodeURIComponent(mangaSlug)}`;
  back.textContent = `← Personnages de ${manga.title}`;

  const chars = manga.characters;
  const index = chars.findIndex((c) => slugify(c.name) === persoSlug);
  if (index === -1) {
    content.appendChild(emptyBlock("🔍", "Personnage introuvable", `Il n'est pas (ou plus) dans la liste de ${manga.title}.`));
    return;
  }

  const perso = chars[index];
  document.title = `${perso.name} · ${manga.title} · Univers Ranking`;

  const head = document.createElement("section");
  head.className = "manga-head";
  head.innerHTML = `
    <img class="manga-head-cover" alt="">
    <div>
      <p class="eyebrow"></p>
      <h1></h1>
    </div>`;
  head.querySelector("img").src = manga.cover;
  head.querySelector("img").alt = `Couverture de ${manga.title}`;
  head.querySelector(".eyebrow").textContent = manga.title;
  head.querySelector("h1").textContent = perso.name;
  content.appendChild(head);

  // Tags : un bloc par type de tag défini dans data.tags
  const tagsBox = document.createElement("section");
  tagsBox.className = "tags-box";
  Object.entries(data.tags).forEach(([tagSlug, tag]) => {
    const values = (perso.tags && perso.tags[tagSlug]) || [];
    const row = document.createElement("div");
    row.className = "tag-row";
    row.innerHTML = `<h2 class="tag-label"></h2><div class="chips"></div>`;
    row.querySelector(".tag-label").textContent = tag.label;
    const chips = row.querySelector(".chips");
    if (values.length === 0) {
      chips.innerHTML = `<span class="muted-small">Non renseigné</span>`;
    }
    values.forEach((v) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = v;
      chips.appendChild(chip);
    });
    tagsBox.appendChild(row);
  });
  content.appendChild(tagsBox);

  // Navigation personnage précédent / suivant
  const nav = document.createElement("div");
  nav.className = "perso-nav";
  const link = (i, label) => {
    const a = document.createElement("a");
    a.className = "card";
    a.href = `personnage.html?manga=${encodeURIComponent(mangaSlug)}&perso=${encodeURIComponent(slugify(chars[i].name))}`;
    a.innerHTML = `<span class="muted-small"></span><strong></strong>`;
    a.querySelector("span").textContent = label;
    a.querySelector("strong").textContent = chars[i].name;
    return a;
  };
  nav.appendChild(index > 0 ? link(index - 1, "← Précédent") : document.createElement("span"));
  if (index < chars.length - 1) {
    const next = link(index + 1, "Suivant →");
    next.classList.add("next");
    nav.appendChild(next);
  }
  content.appendChild(nav);
})();
