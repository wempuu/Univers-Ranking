// Fiche d'un personnage : personnage.html?manga=<slug>&perso=<slug du nom>

(async () => {
  const params = new URLSearchParams(location.search);
  const mangaSlug = params.get("manga");
  const persoSlug = params.get("perso");
  const content = document.getElementById("content");

  let mangas;
  try {
    mangas = await loadMangas();
  } catch (e) {
    content.appendChild(emptyBlock("⚠️", "Erreur de chargement", e.message));
    return;
  }

  const manga = mangas[mangaSlug];
  if (!manga) {
    content.appendChild(emptyBlock("🔍", "Ce manga n'existe pas", "Retourne au catalogue pour en choisir un."));
    return;
  }

  const back = document.getElementById("back");
  back.href = `personnages.html?manga=${encodeURIComponent(mangaSlug)}`;
  back.textContent = `← Personnages de ${manga.title}`;

  const index = manga.characters.findIndex((n) => slugify(n) === persoSlug);
  if (index === -1) {
    content.appendChild(emptyBlock("🔍", "Personnage introuvable", `Il n'est pas (ou plus) dans la liste de ${manga.title}.`));
    return;
  }

  const name = manga.characters[index];
  document.title = `${name} · ${manga.title} · Univers Ranking`;

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
  head.querySelector("h1").textContent = name;
  content.appendChild(head);

  content.appendChild(emptyBlock("📝", "Fiche à venir", `Les infos sur ${name} arrivent bientôt.`));

  // Navigation personnage précédent / suivant
  const nav = document.createElement("div");
  nav.className = "perso-nav";
  const link = (i, label) => {
    const a = document.createElement("a");
    a.className = "card";
    a.href = `personnage.html?manga=${encodeURIComponent(mangaSlug)}&perso=${encodeURIComponent(slugify(manga.characters[i]))}`;
    a.innerHTML = `<span class="muted-small"></span><strong></strong>`;
    a.querySelector("span").textContent = label;
    a.querySelector("strong").textContent = manga.characters[i];
    return a;
  };
  nav.appendChild(index > 0 ? link(index - 1, "← Précédent") : document.createElement("span"));
  if (index < manga.characters.length - 1) {
    const next = link(index + 1, "Suivant →");
    next.classList.add("next");
    nav.appendChild(next);
  }
  content.appendChild(nav);
})();
