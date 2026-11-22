// Règles et tirage du jeu Undercover (utilisé par groupe.js, côté créateur du groupe).
//
// - Les innocents reçoivent tous le même personnage ; les imposteurs reçoivent tous un autre personnage
//   choisi par le moteur de similitude ci-dessous, selon la difficulté choisie dans le groupe.
// - Imposteurs : 1 jusqu'à 4 joueurs, puis un de plus à 5, 8 et 11 joueurs (ou le nombre choisi par le créateur).
// - Manches de mots : 2 avec un imposteur, +1 par imposteur supplémentaire.

// ===================== BARÈME DE SIMILITUDE (à modifier ici) =====================
const SIMILARITY = {
  // Points de correspondance : chaque tag commun aux deux persos rapporte ces points, selon sa catégorie
  matchPoints: { physique: 20, role: 20, "style-de-combat": 20, caractere: 20 },
  defaultMatchPoints: 20, // catégorie ajoutée plus tard sans barème
  // Bonus de rareté d'un tag commun. La rareté retenue est la plus basse des deux persos
  // (Feu ⭐⭐⭐ chez A et ⭐⭐⭐ chez B = +25 ; Feu ⭐⭐⭐ chez A et ⭐⭐ chez B = +10).
  rarityBonus: { 1: 0, 2: 10, 3: 25 },
  // Condition obligatoire (toutes difficultés) : nombre minimum de tags communs ⭐⭐⭐ chez LES DEUX persos
  minSharedVeryRare: 1,
  // Fourchettes de score par difficulté : min inclus, max exclu (null = pas de maximum)
  difficulties: {
    facile: { label: "Facile", min: 200, max: null },
    difficile: { label: "Difficile", min: 100, max: 200 },
  },
  defaultDifficulty: "facile",
};
// ==================================================================================

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

  // Score de similitude entre deux persos, recalculé à chaque fois à partir des tags et raretés actuels.
  // Renvoie { score, match, rarity, veryRare, common: [{ cat, value, rarity, a, b }] }
  similarity(a, b) {
    const S = SIMILARITY;
    let match = 0, rarity = 0, veryRare = 0;
    const common = [];
    Object.keys(a.tags || {}).forEach((cat) => {
      const bVals = (b.tags || {})[cat] || [];
      const seen = new Set(); // un tag n'est jamais compté deux fois
      (a.tags[cat] || []).forEach((v) => {
        const n = normalizeSearch(v);
        if (seen.has(n)) return;
        const bv = bVals.find((x) => normalizeSearch(x) === n);
        if (bv === undefined) return;
        seen.add(n);
        const ra = tagRarity(a, cat, v), rb = tagRarity(b, cat, bv);
        const r = Math.min(ra, rb);
        match += S.matchPoints[cat] != null ? S.matchPoints[cat] : S.defaultMatchPoints;
        rarity += S.rarityBonus[r] || 0;
        if (ra === 3 && rb === 3) veryRare++;
        common.push({ cat, value: v, rarity: r, a: ra, b: rb });
      });
    });
    return { score: match + rarity, match, rarity, veryRare, common };
  },

  difficulty(id) {
    return SIMILARITY.difficulties[id] || SIMILARITY.difficulties[SIMILARITY.defaultDifficulty];
  },

  // La paire est-elle jouable dans cette difficulté ? (condition ⭐⭐⭐ + fourchette de points)
  compatible(sim, diff) {
    return sim.veryRare >= SIMILARITY.minSharedVeryRare &&
      sim.score >= diff.min && (diff.max == null || sim.score < diff.max);
  },

  // Tire le perso des innocents, puis l'imposteur au hasard parmi les persos compatibles avec lui.
  // Si le premier perso tiré n'a aucun partenaire compatible, on en tire un autre.
  pickCharacters(data, univers, difficultyId) {
    const diff = Undercover.difficulty(difficultyId);
    const chars = Undercover.pool(data, univers);
    const order = chars.map((c) => c).sort(() => Math.random() - 0.5);
    for (const a of order) {
      const candidates = [];
      chars.forEach((b) => {
        if (b === a || (b.name === a.name && b.manga === a.manga)) return;
        const sim = Undercover.similarity(a, b);
        if (Undercover.compatible(sim, diff)) candidates.push({ b, sim });
      });
      if (!candidates.length) continue;
      const { b, sim } = candidates[Math.floor(Math.random() * candidates.length)];
      // révélation : les tags communs, les plus rares d'abord
      const shared = sim.common
        .slice()
        .sort((x, y) => y.rarity - x.rarity)
        .map((c) => ({ category: (data.tags[c.cat] && data.tags[c.cat].label) || c.cat, value: c.value, stars: c.rarity }));
      const pub = (c) => ({ name: c.name, image: c.image || null, manga: c.mangaTitle });
      return { innocent: pub(a), impostor: pub(b), shared, score: sim.score, difficulty: diff.label };
    }
    return null;
  },
};
