// Données des personnages par manga (clé = ?manga=<slug> dans l'URL).
// `characters` vide => la page affiche "Liste à venir".
const MANGAS = {
  "one-piece": {
    title: "One Piece",
    cover: "images/catalogue/one-piece.webp",
    subtitle: "Top 20 du 2e sondage mondial de popularité (ONE PIECE WT100, 2026)",
    source: "https://onepiecewt100-2026.com/en/final-rankings/",
    characters: [
      { name: "Monkey D. Luffy", points: 2378519 },
      { name: "Roronoa Zoro", points: 2148793 },
      { name: "Sanji", points: 1399204 },
      { name: "Nami", points: 1007955 },
      { name: "Trafalgar Law", points: 732301 },
      { name: "Nico Robin", points: 322461 },
      { name: "Portgas D. Ace", points: 301112 },
      { name: "Shanks", points: 204827 },
      { name: "Dracule Mihawk", points: 202744 },
      { name: "Crocodile", points: 201971 },
      { name: "Donquixote Rosinante (Corazón)" },
      { name: "Boa Hancock" },
      { name: "Tony Tony Chopper" },
      { name: "Sabo" },
      { name: "Uta" },
      { name: "Carrot" },
      { name: "Rocks D. Xebec" },
      { name: "Yamato" },
      { name: "Usopp" },
      { name: "Loki" },
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
  document.getElementById("subtitle").textContent = manga.subtitle || "";
  cover.src = manga.cover;
  cover.alt = `Couverture de ${manga.title}`;

  if (manga.characters.length === 0) {
    content.innerHTML = `<div class="empty"><div class="emoji">📝</div><h2>Liste à venir</h2><p>Les personnages de ${manga.title} arrivent bientôt.</p></div>`;
  } else {
    const fmt = new Intl.NumberFormat("fr-FR");
    const list = document.createElement("ol");
    list.className = "ranking";
    manga.characters.forEach((c, i) => {
      const li = document.createElement("li");
      if (i < 3) li.classList.add(`podium-${i + 1}`);
      li.innerHTML = `<span class="rank">${i + 1}</span><span class="name"></span><span class="points"></span>`;
      li.querySelector(".name").textContent = c.name;
      li.querySelector(".points").textContent = c.points ? `${fmt.format(c.points)} pts` : "";
      list.appendChild(li);
    });
    content.appendChild(list);

    if (manga.source) {
      const src = document.createElement("p");
      src.className = "source";
      src.innerHTML = `Source : <a target="_blank" rel="noopener"></a>`;
      const a = src.querySelector("a");
      a.href = manga.source;
      a.textContent = "classement officiel";
      content.appendChild(src);
    }
  }
}
