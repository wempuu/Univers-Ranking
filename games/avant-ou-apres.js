// Données : [nom, année de sortie, type, emoji]
const ITEMS = [
  ["Star Wars", 1977, "Film", "🌌"],
  ["Titanic", 1997, "Film", "🚢"],
  ["Le Seigneur des Anneaux : La Communauté de l'anneau", 2001, "Film", "💍"],
  ["Harry Potter à l'école des sorciers (film)", 2001, "Film", "⚡"],
  ["Matrix", 1999, "Film", "🕶️"],
  ["Jurassic Park", 1993, "Film", "🦖"],
  ["Le Roi Lion", 1994, "Film", "🦁"],
  ["Toy Story", 1995, "Film", "🤠"],
  ["Avatar", 2009, "Film", "🌿"],
  ["Avengers", 2012, "Film", "🛡️"],
  ["Inception", 2010, "Film", "🌀"],
  ["Retour vers le futur", 1985, "Film", "⏰"],
  ["E.T. l'extra-terrestre", 1982, "Film", "👽"],
  ["Pulp Fiction", 1994, "Film", "🍔"],
  ["Shrek", 2001, "Film", "🧅"],
  ["La Reine des neiges", 2013, "Film", "❄️"],
  ["Les Dents de la mer", 1975, "Film", "🦈"],
  ["Le Parrain", 1972, "Film", "🌹"],
  ["Gladiator", 2000, "Film", "⚔️"],
  ["Interstellar", 2014, "Film", "🪐"],
  ["Black Panther", 2018, "Film", "🐾"],
  ["Barbie", 2023, "Film", "💖"],
  ["Le Voyage de Chihiro", 2001, "Film", "🐉"],
  ["Breaking Bad", 2008, "Série", "🧪"],
  ["Game of Thrones", 2011, "Série", "🐲"],
  ["Friends", 1994, "Série", "☕"],
  ["Stranger Things", 2016, "Série", "🚲"],
  ["Les Simpson", 1989, "Série", "🍩"],
  ["The Office (US)", 2005, "Série", "📎"],
  ["Squid Game", 2021, "Série", "🦑"],
  ["Lost", 2004, "Série", "🏝️"],
  ["Pokémon Rouge et Vert", 1996, "Jeu vidéo", "🔴"],
  ["Super Mario Bros.", 1985, "Jeu vidéo", "🍄"],
  ["Tetris", 1984, "Jeu vidéo", "🧱"],
  ["Pac-Man", 1980, "Jeu vidéo", "🟡"],
  ["The Legend of Zelda", 1986, "Jeu vidéo", "🗡️"],
  ["Sonic the Hedgehog", 1991, "Jeu vidéo", "💨"],
  ["Minecraft", 2011, "Jeu vidéo", "⛏️"],
  ["Fortnite", 2017, "Jeu vidéo", "🪂"],
  ["GTA V", 2013, "Jeu vidéo", "🚗"],
  ["Elden Ring", 2022, "Jeu vidéo", "🔥"],
  ["Dragon Ball (manga)", 1984, "Manga", "🐉"],
  ["One Piece (manga)", 1997, "Manga", "🏴‍☠️"],
  ["Naruto (manga)", 1999, "Manga", "🍥"],
].map(([name, year, type, emoji]) => ({ name, year, type, emoji }));

const $ = (id) => document.getElementById(id);
const BEST_KEY = "ur-avant-apres-best";

let score = 0;
let best = 0;
let deck = [];
let current, challenger;

try { best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch (e) {}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function draw() {
  if (deck.length === 0) deck = shuffle(ITEMS);
  let next = deck.pop();
  // évite deux œuvres de la même année (pas de réponse possible)
  let guard = 0;
  while (current && next.year === current.year && guard++ < 20) {
    deck.unshift(next);
    next = deck.pop();
  }
  return next;
}

function render(el, item, showYear) {
  el.className = "item";
  el.innerHTML = `
    <div class="emoji">${item.emoji}</div>
    <div class="type">${item.type}</div>
    <div class="name"></div>
    <div class="year">${showYear ? item.year : "?"}</div>`;
  el.querySelector(".name").textContent = item.name;
}

function updateScore() {
  $("score").textContent = score;
  $("best").textContent = best;
}

function setButtons(mode) {
  const playing = mode === "play";
  $("btn-before").hidden = !playing;
  $("btn-after").hidden = !playing;
  $("btn-next").hidden = mode !== "next";
  $("btn-restart").hidden = mode !== "over";
}

function round() {
  challenger = draw();
  render($("a"), current, true);
  render($("b"), challenger, false);
  $("msg").textContent = "";
  $("msg").className = "message";
  setButtons("play");
}

function answer(isAfter) {
  const correct = isAfter ? challenger.year > current.year : challenger.year < current.year;
  render($("b"), challenger, true);
  $("b").classList.add(correct ? "good" : "bad");

  if (correct) {
    score++;
    if (score > best) {
      best = score;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
    }
    $("msg").textContent = "Bien joué ! 🎉";
    $("msg").className = "message good";
    setButtons("next");
  } else {
    $("msg").textContent = `Perdu ! Score final : ${score}`;
    $("msg").className = "message bad";
    setButtons("over");
  }
  updateScore();
}

function start() {
  score = 0;
  deck = shuffle(ITEMS);
  current = null;
  current = draw();
  updateScore();
  round();
}

$("btn-before").addEventListener("click", () => answer(false));
$("btn-after").addEventListener("click", () => answer(true));
$("btn-next").addEventListener("click", () => { current = challenger; round(); });
$("btn-restart").addEventListener("click", start);

start();
