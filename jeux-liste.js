// Catalogue des mini-jeux jouables en groupe.
// Pour ajouter un jeu, ajoute un objet dans GAMES :
//   {
//     id: "devine-perso",                  // identifiant unique
//     title: "Devine le perso",
//     description: "Trouve le personnage à partir de ses tags.",
//     rules: [                              // règles modifiables par le créateur du groupe
//       { id: "manches", label: "Nombre de manches", type: "number", min: 1, max: 20, default: 5 },
//       { id: "temps", label: "Temps par manche (s)", type: "number", min: 10, max: 120, step: 5, default: 30 },
//       { id: "univers", label: "Univers", type: "select", options: [["one-piece", "One Piece"]], default: "one-piece" },
//       { id: "indices", label: "Indices", type: "toggle", default: true },
//     ],
//   }
// Le groupe (groupe.js) affiche automatiquement le jeu et ses règles.

const GAMES = [
  {
    id: "undercover",
    title: "Undercover",
    minPlayers: 3,
    description: "Chacun reçoit un personnage secret. Les innocents ont tous le même ; les imposteurs en ont un autre, " +
      "qui lui ressemble (au moins 3 tags en commun). Chacun à son tour donne un mot pour décrire son perso, " +
      "puis tout le monde vote pour démasquer l'imposteur. 3 joueurs minimum.",
    rules: [
      { id: "univers", label: "Personnages", type: "select", options: [["tous", "Tous les univers"], ["one-piece", "One Piece"]], default: "tous" },
      { id: "imposteurs", label: "Imposteurs", type: "select", options: [["auto", "Automatique"], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"]], default: "auto" },
      { id: "temps", label: "Temps pour donner un mot (s)", type: "number", min: 15, max: 180, step: 5, default: 60 },
      { id: "vote", label: "Temps pour voter (s)", type: "number", min: 15, max: 180, step: 5, default: 60 },
    ],
  },
];

// Valeurs par défaut des règles d'un jeu
function defaultRules(game) {
  const rules = {};
  (game.rules || []).forEach((r) => { rules[r.id] = r.default; });
  return rules;
}
