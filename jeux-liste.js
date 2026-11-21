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

const GAMES = [];

// Valeurs par défaut des règles d'un jeu
function defaultRules(game) {
  const rules = {};
  (game.rules || []).forEach((r) => { rules[r.id] = r.default; });
  return rules;
}
