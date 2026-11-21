// Règles et tirage du jeu Undercover (utilisé par groupe.js, côté créateur du groupe).
//
// - Les innocents reçoivent tous le même personnage ; les imposteurs reçoivent tous un autre personnage
//   qui partage au moins 3 tags avec celui des innocents, chacun dans une catégorie de tags différente.
// - Imposteurs : 1 jusqu'à 4 joueurs, puis un de plus à 5, 8 et 11 joueurs (ou le nombre choisi par le créateur).
// - Manches de mots : 2 avec un imposteur, +1 par imposteur supplémentaire.

const Undercover = {
  MIN_PLAYERS: 3,

  // Nombre d'imposteurs : réglage du créateur, ou automatique. Toujours moins de la moitié des joueurs.
  impostorCount(nPlayers, rule) {
    const auto = nPlayers <= 4 ? 1 : nPlayers <= 7 ? 2 : nPlayers <= 10 ? 3 : 4;
    const wanted = rule && rule !== "auto" ? Number(rule) : auto;
    const max = Math.max(1, Math.floor((nPlayers - 1) / 2));
    return Math.min(Math.max(1, wanted), max);
  },

  roundsFor(impostors) {
    return 2 + (impostors - 1);
  },

  // Personnages du ou des univers choisis
  pool(data, univers) {
    const out = [];
    Object.entries(data.mangas).forEach(([slug, m]) => {
      if (univers && univers !== "tous" && univers !== slug) return;
      m.characters.forEach((c) => out.push({ ...c, manga: slug, mangaTitle: m.title }));
    });
    return out;
  },

  // Tags communs, regroupés par catégorie : { categorie: [valeurs communes] }
  sharedByCategory(a, b) {
    const shared = {};
    Object.keys(a.tags || {}).forEach((cat) => {
      const bVals = ((b.tags || {})[cat] || []).map(normalizeSearch);
      const common = (a.tags[cat] || []).filter((v) => bVals.includes(normalizeSearch(v)));
      if (common.length) shared[cat] = common;
    });
    return shared;
  },

  // Tire le perso des innocents et celui des imposteurs (3 tags communs dans 3 catégories différentes)
  pickCharacters(data, univers) {
    const chars = Undercover.pool(data, univers);
    const pairs = [];
    chars.forEach((a) => {
      const candidates = chars.filter((b) => b !== a && Object.keys(Undercover.sharedByCategory(a, b)).length >= 3);
      if (candidates.length) pairs.push({ a, candidates });
    });
    if (!pairs.length) return null;
    const { a, candidates } = pairs[Math.floor(Math.random() * pairs.length)];
    const b = candidates[Math.floor(Math.random() * candidates.length)];
    const shared = Undercover.sharedByCategory(a, b);
    // un tag par catégorie pour la révélation finale
    const reveal = Object.entries(shared).map(([cat, vals]) => ({
      category: (data.tags[cat] && data.tags[cat].label) || cat,
      value: vals[0],
    }));
    const pub = (c) => ({ name: c.name, image: c.image || null, manga: c.mangaTitle });
    return { innocent: pub(a), impostor: pub(b), shared: reveal };
  },
};
