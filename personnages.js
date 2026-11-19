// Données des personnages par manga (clé = ?manga=<slug> dans l'URL).
// `characters` vide => la page affiche "Liste à venir".
const MANGAS = {
  "one-piece": {
    title: "One Piece",
    cover: "images/catalogue/one-piece.webp",
    characters: [
      "Monkey D. Luffy",
      "Roronoa Zoro",
      "Sanji",
      "Nami",
      "Trafalgar Law",
      "Nico Robin",
      "Portgas D. Ace",
      "Shanks",
      "Dracule Mihawk",
      "Crocodile",
      "Donquixote Rosinante (Corazón)",
      "Boa Hancock",
      "Tony Tony Chopper",
      "Sabo",
      "Uta",
      "Carrot",
      "Rocks D. Xebec",
      "Yamato",
      "Usopp",
      "Loki",
      // Mugiwaras
      "Franky",
      "Brook",
      "Jinbe",
      // Amiraux de la Marine
      "Sakazuki (Akainu)",
      "Kuzan (Aokiji)",
      "Borsalino (Kizaru)",
      "Issho (Fujitora)",
      "Aramaki (Ryokugyu)",
      // Révolutionnaires
      "Monkey D. Dragon",
      "Emporio Ivankov",
      "Inazuma",
      "Koala",
      "Hack",
      "Belo Betty",
      "Morley",
      "Lindbergh",
      "Karasu",
      "Bartholomew Kuma",
      "Ginny",
      "Bunny Joe",
      "Terry Gilteo",
      // Plus grosses primes
      "Gol D. Roger",
      "Edward Newgate (Barbe Blanche)",
      "Kaido",
      "Charlotte Linlin (Big Mom)",
      "Marshall D. Teach (Barbe Noire)",
      "Baggy",
      "Eustass Kid",
      "King",
      "Marco",
    ],
  },
  "dragon-ball": { title: "Dragon Ball", cover: "images/catalogue/dragon-ball.webp", characters: [] },
  "naruto": { title: "Naruto", cover: "images/catalogue/naruto.jpg", characters: [] },
  "bleach": { title: "Bleach", cover: "images/catalogue/bleach.webp", characters: [] },
  "hunter-x-hunter": { title: "Hunter x Hunter", cover: "images/catalogue/hunter-x-hunter.webp", characters: [] },
};

const slug = new URLSearchParams(location.search).get("manga");
const manga = MANGAS[slug];
const content = document.getElementById("content");
const cover = document.getElementById("cover");

if (!manga) {
  cover.remove();
  content.innerHTML = `<div class="empty"><div class="emoji">🔍</div><h2>Ce manga n'existe pas</h2><p>Retourne au catalogue pour en choisir un.</p></div>`;
} else {
  document.title = `${manga.title} · Personnages · Univers Ranking`;
  document.getElementById("title").textContent = manga.title;
  cover.src = manga.cover;
  cover.alt = `Couverture de ${manga.title}`;

  if (manga.characters.length === 0) {
    content.innerHTML = `<div class="empty"><div class="emoji">📝</div><h2>Liste à venir</h2><p>Les personnages de ${manga.title} arrivent bientôt.</p></div>`;
  } else {
    const list = document.createElement("ul");
    list.className = "char-list";
    manga.characters.forEach((name) => {
      const li = document.createElement("li");
      li.textContent = name;
      list.appendChild(li);
    });
    content.appendChild(list);
  }
}
