// Recherche dans le catalogue : filtre les cartes de manga (titre, auteur, infos affichées).

(() => {
  const cards = [...document.querySelectorAll(".card.manga")];
  cards.forEach((card) => { card.dataset.search = normalizeSearch(card.textContent); });

  const search = createSearchBar({
    placeholder: "Rechercher un manga, un auteur…",
    onSearch: (query) => {
      let shown = 0;
      cards.forEach((card) => {
        const ok = matchesSearch(card.dataset.search, query);
        card.hidden = !ok;
        if (ok) shown++;
      });
      // masque le titre d'une section (ex. « Mangas ») si aucune de ses cartes n'est visible
      document.querySelectorAll("[data-section]").forEach((title) => {
        const grid = title.nextElementSibling;
        const visible = grid && [...grid.children].some((c) => !c.hidden);
        title.hidden = !visible;
        if (grid) grid.hidden = !visible;
      });
      document.getElementById("no-result").hidden = shown > 0;
      search.setCount(query ? `${shown} résultat${shown > 1 ? "s" : ""}` : "");
    },
  });
  document.getElementById("search").appendChild(search.el);
})();
