// Liste des personnages d'un manga : personnages.html?manga=<slug>
// Les données viennent de data/mangas.json (modifiable avec outil.html).

(async () => {
  const slug = new URLSearchParams(location.search).get("manga");
  const content = document.getElementById("content");
  const cover = document.getElementById("cover");

  let mangas;
  try {
    mangas = await loadMangas();
  } catch (e) {
    cover.remove();
    content.appendChild(emptyBlock("⚠️", "Erreur de chargement", e.message));
    return;
  }

  const manga = mangas[slug];
  if (!manga) {
    cover.remove();
    content.appendChild(emptyBlock("🔍", "Ce manga n'existe pas", "Retourne au catalogue pour en choisir un."));
    return;
  }

  document.title = `${manga.title} · Personnages · Univers Ranking`;
  document.getElementById("title").textContent = manga.title;
  cover.src = manga.cover;
  cover.alt = `Couverture de ${manga.title}`;

  const edit = document.getElementById("edit-link");
  edit.href = `outil.html?manga=${encodeURIComponent(slug)}`;
  edit.hidden = false;

  if (manga.characters.length === 0) {
    content.appendChild(emptyBlock("📝", "Liste à venir", `Les personnages de ${manga.title} arrivent bientôt.`));
    return;
  }

  groupCharacters(manga).forEach((group) => {
    if (group.characters.length === 0) return;
    if (group.label) {
      const h2 = document.createElement("h2");
      h2.className = "section-title";
      h2.textContent = group.label;
      content.appendChild(h2);
    }
    const list = document.createElement("ul");
    list.className = "char-list";
    group.characters.forEach((perso) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = `personnage.html?manga=${encodeURIComponent(slug)}&perso=${encodeURIComponent(slugify(perso.name))}`;
      a.appendChild(persoAvatar(perso));
      const span = document.createElement("span");
      span.textContent = perso.name;
      a.appendChild(span);
      li.appendChild(a);
      list.appendChild(li);
    });
    content.appendChild(list);
  });
})();
