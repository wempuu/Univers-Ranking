// Groupe de jeu entre amis, sans serveur : connexion directe entre navigateurs (PeerJS / WebRTC).
// - Le créateur (hôte) ouvre groupe.html?code=XXXXXX&hote=1 : il « réserve » l'identifiant PeerJS lié au code,
//   accueille les connexions et fait autorité : il garde l'état du groupe et de la partie et le diffuse à tous.
// - Un ami ouvre groupe.html?code=XXXXXX : il se connecte à l'hôte, envoie son pseudo et affiche ce qu'il reçoit.
// L'hôte est le seul à pouvoir changer le jeu et les règles ; s'il ferme la page, le groupe disparaît.
//
// Messages ami -> hôte : join {name}, word {word}, vote {target}
// Messages hôte -> ami : state {state} (public), secret {character} (privé : le perso de ce joueur), refused {reason}

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const code = (params.get("code") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const isHost = params.get("hote") === "1";
const PEER_PREFIX = "univers-ranking-";
const MAX_PLAYERS = 12;

const myName = readPseudo() || "Joueur";
let peer = null;
let myId = null;
// État public, identique chez tout le monde
let state = { players: [], game: null, rules: {}, status: "lobby", play: null };
let mySecret = null;   // mon personnage pendant la partie
let myVote = null;     // pour qui j'ai voté
let clockOffset = 0;   // décalage entre l'horloge de l'hôte et la mienne

// (hôte) données privées
const conns = new Map(); // id du pair -> connexion
let secret = null;        // { roles: {id: "innocent"|"imposteur"}, chars: {...}, votes: {voter: target} }
let timer = null;
let dataCache = null;

let hostConn = null;      // (ami) connexion vers l'hôte

function readPseudo() {
  try { return (localStorage.getItem("ur-pseudo") || "").trim(); } catch (e) { return ""; }
}

function setStatus(text, kind = "") {
  $("status").textContent = text;
  $("status").className = `tool-status ${kind}`;
}

const playerName = (id) => (state.players.find((p) => p.id === id) || {}).name || "Un joueur parti";
const present = (id) => state.players.some((p) => p.id === id);

// ---------- Affichage ----------

function render() {
  $("lobby").hidden = false;
  $("code").textContent = code;
  renderPlayers();
  const playing = state.status === "playing" && state.play;
  $("setup-card").hidden = !!playing;
  $("play-card").hidden = !playing;
  if (playing) renderPlay(); else renderSetup();
}

function renderPlayers() {
  const ul = $("players");
  ul.innerHTML = "";
  const play = state.status === "playing" ? state.play : null;
  state.players.forEach((p) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="player-name"></span>`;
    li.querySelector(".player-name").textContent = p.name;
    if (p.host) li.insertAdjacentHTML("beforeend", ' <span class="chip small-chip">👑 Créateur</span>');
    if (p.id === myId) li.insertAdjacentHTML("beforeend", ' <span class="muted-small">(toi)</span>');
    if (play && play.phase === "words" && play.order[play.turnIndex] === p.id) li.insertAdjacentHTML("beforeend", ' <span class="chip small-chip">✍️ Son tour</span>');
    if (play && play.phase === "vote" && play.voted[p.id]) li.insertAdjacentHTML("beforeend", ' <span class="chip small-chip">✓ A voté</span>');
    if (play && play.order && !play.order.includes(p.id)) li.insertAdjacentHTML("beforeend", ' <span class="muted-small">spectateur</span>');
    ul.appendChild(li);
  });
  $("count").textContent = `(${state.players.length})`;
}

function renderSetup() {
  const sel = $("game");
  sel.innerHTML = "";
  if (GAMES.length === 0) {
    sel.innerHTML = `<option value="">Aucun jeu disponible pour l'instant</option>`;
  } else {
    sel.innerHTML = `<option value="">— Choisir un jeu —</option>`;
    GAMES.forEach((g) => {
      const o = document.createElement("option");
      o.value = g.id;
      o.textContent = g.title;
      sel.appendChild(o);
    });
  }
  sel.value = state.game || "";
  sel.disabled = !isHost || GAMES.length === 0;
  const game = GAMES.find((g) => g.id === state.game);
  $("game-desc").textContent = game ? game.description || "" :
    (GAMES.length === 0 ? "Les mini-jeux arrivent bientôt : ils apparaîtront ici avec leurs règles." : "");

  const box = $("rules");
  box.innerHTML = "";
  (game ? game.rules || [] : []).forEach((r) => box.appendChild(ruleField(r)));

  const min = game ? game.minPlayers || 1 : 1;
  const enough = state.players.length >= min;
  $("host-only").textContent = !isHost ? "Seul le créateur du groupe peut choisir le jeu, modifier les règles et lancer la partie." :
    game && !enough ? `Il faut au moins ${min} joueurs pour ce jeu.` : "";
  $("btn-start").hidden = !isHost;
  $("btn-start").disabled = !game || !enough;
}

function ruleField(r) {
  const value = state.rules[r.id] !== undefined ? state.rules[r.id] : r.default;
  const row = document.createElement("label");
  row.className = "rule-row";
  row.innerHTML = `<span class="rule-label"></span>`;
  row.querySelector(".rule-label").textContent = r.label;
  let input;
  if (r.type === "select") {
    input = document.createElement("select");
    (r.options || []).forEach(([v, label]) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = label;
      input.appendChild(o);
    });
    input.value = value;
  } else if (r.type === "toggle") {
    input = document.createElement("input");
    input.type = "checkbox";
    input.checked = !!value;
  } else {
    input = document.createElement("input");
    input.type = "number";
    if (r.min !== undefined) input.min = r.min;
    if (r.max !== undefined) input.max = r.max;
    input.step = r.step || 1;
    input.value = value;
  }
  input.className = r.type === "toggle" ? "" : "tool-input rule-input";
  input.disabled = !isHost;
  input.addEventListener("change", () => {
    let v = r.type === "toggle" ? input.checked : r.type === "number" ? Number(input.value) : input.value;
    if (r.type === "number") {
      if (Number.isNaN(v)) v = r.default;
      if (r.min !== undefined) v = Math.max(r.min, v);
      if (r.max !== undefined) v = Math.min(r.max, v);
    }
    state.rules[r.id] = v;
    broadcast();
  });
  row.appendChild(input);
  return row;
}

function charCard(c, label) {
  const div = document.createElement("div");
  div.className = "char-card";
  div.appendChild(persoAvatar({ name: c.name, image: c.image }, "avatar avatar-mid"));
  const txt = document.createElement("div");
  txt.innerHTML = `<p class="eyebrow"></p><strong></strong><p class="muted-small"></p>`;
  txt.querySelector(".eyebrow").textContent = label;
  txt.querySelector("strong").textContent = c.name;
  txt.querySelector(".muted-small").textContent = c.manga || "";
  div.appendChild(txt);
  return div;
}

function renderPlay() {
  const play = state.play;
  const inGame = play.order.includes(myId);

  // mon perso
  const sec = $("secret");
  sec.innerHTML = "";
  if (play.phase !== "result") {
    if (mySecret) sec.appendChild(charCard(mySecret, "Ton personnage — garde-le secret !"));
    else if (!inGame) sec.innerHTML = `<p class="muted-small">Partie en cours : tu joueras à la prochaine.</p>`;
  }

  // chat
  const chat = $("chat");
  chat.innerHTML = "";
  play.messages.forEach((m) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="chat-who"></span><span class="chat-word"></span>`;
    li.querySelector(".chat-who").textContent = m.name;
    li.querySelector(".chat-word").textContent = m.word || "— a passé son tour";
    if (!m.word) li.classList.add("skipped");
    chat.appendChild(li);
  });
  chat.hidden = play.messages.length === 0;
  chat.scrollTop = chat.scrollHeight;

  const wordForm = $("word-form");
  const vote = $("vote");
  const result = $("result");
  wordForm.hidden = vote.hidden = result.hidden = true;
  $("host-actions").hidden = true;

  if (play.phase === "words") {
    const turnId = play.order[play.turnIndex];
    $("play-title").textContent = `Manche ${play.round} / ${play.rounds}`;
    $("play-info").textContent = turnId === myId ? "À toi ! Donne un seul mot qui décrit ton personnage, sans trop en dire."
      : `Au tour de ${playerName(turnId)}.`;
    if (turnId === myId) {
      wordForm.hidden = false;
      if (document.activeElement !== $("word")) $("word").focus();
    }
  } else if (play.phase === "vote") {
    $("play-title").textContent = "Vote";
    const nVoted = Object.keys(play.voted).length;
    $("play-info").textContent = `Qui est l'imposteur ? (${nVoted} / ${play.order.filter(present).length} ont voté)`;
    if (inGame) {
      vote.hidden = false;
      vote.innerHTML = "";
      play.order.filter((id) => id !== myId && present(id)).forEach((id) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn ghost vote-btn" + (myVote === id ? " chosen" : "");
        b.textContent = playerName(id);
        b.addEventListener("click", () => sendVote(id));
        vote.appendChild(b);
      });
    }
  } else if (play.phase === "result") {
    renderResult(play.result);
  }
  updateTimer();
}

function renderResult(r) {
  $("play-title").textContent = r.aborted ? "Partie arrêtée" : r.impostorsWin ? "Victoire des imposteurs 🕵️" : "Victoire des innocents 🎉";
  $("play-info").textContent = r.aborted ? r.aborted :
    r.eliminated ? `${r.eliminated.name} a été éliminé${r.eliminated.role === "imposteur" ? " : c'était un imposteur !" : " : c'était un innocent…"}`
      : "Égalité : personne n'est éliminé, les imposteurs s'en sortent.";
  const box = $("result");
  box.hidden = false;
  box.innerHTML = "";
  const pair = document.createElement("div");
  pair.className = "reveal-pair";
  pair.appendChild(charCard(r.innocent, "Perso des innocents"));
  pair.appendChild(charCard(r.impostor, "Perso des imposteurs"));
  box.appendChild(pair);
  if (r.shared && r.shared.length) {
    const p = document.createElement("p");
    p.className = "muted-small";
    p.textContent = "Points communs : " + r.shared.map((s) => `${s.value} (${s.category})`).join(", ");
    box.appendChild(p);
  }
  const ul = document.createElement("ul");
  ul.className = "players reveal-roles";
  r.players.forEach((p) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="player-name"></span> <span class="chip small-chip"></span> <span class="muted-small"></span>`;
    li.querySelector(".player-name").textContent = p.name;
    li.querySelector(".chip").textContent = p.role === "imposteur" ? "🕵️ Imposteur" : "😇 Innocent";
    li.querySelector(".muted-small").textContent = r.aborted ? "" : `${p.votes} vote${p.votes > 1 ? "s" : ""}`;
    ul.appendChild(li);
  });
  box.appendChild(ul);
  if (isHost) $("host-actions").hidden = false;
  else box.insertAdjacentHTML("beforeend", '<p class="muted-small">En attente du créateur pour la suite…</p>');
}

function updateTimer() {
  const play = state.status === "playing" ? state.play : null;
  if (!play || !play.deadline || play.phase === "result") { $("timer").textContent = ""; return; }
  const left = Math.max(0, Math.ceil((play.deadline - (Date.now() - clockOffset)) / 1000));
  $("timer").textContent = `⏱ ${left} s`;
  $("timer").classList.toggle("urgent", left <= 10);
}
setInterval(updateTimer, 500);

// ---------- Hôte : groupe ----------

function broadcast() {
  state.hostNow = Date.now();
  render();
  const msg = { type: "state", state };
  conns.forEach((c) => { if (c.open) c.send(msg); });
}

function sendTo(id, msg) {
  if (id === myId) { handleLocal(msg); return; }
  const c = conns.get(id);
  if (c && c.open) c.send(msg);
}

function handleLocal(msg) {
  if (msg.type === "secret") { mySecret = msg.character; myVote = null; }
}

function startHost(attempt = 0) {
  peer = new Peer(PEER_PREFIX + code);
  peer.on("open", (id) => {
    myId = id;
    state.players = [{ id, name: myName, host: true }];
    setStatus("Groupe créé ! Partage le code avec tes amis.", "ok");
    broadcast();
  });
  peer.on("connection", (conn) => {
    conn.on("data", (msg) => hostReceive(conn, msg));
    const leave = () => {
      if (!conns.has(conn.peer)) return;
      conns.delete(conn.peer);
      state.players = state.players.filter((p) => p.id !== conn.peer);
      onPlayerLeft(conn.peer);
      broadcast();
    };
    conn.on("close", leave);
    conn.on("error", leave);
  });
  peer.on("error", (err) => {
    if (err.type === "unavailable-id") {
      // code déjà pris (ou ancienne session pas encore libérée après un rechargement) : on réessaie un peu
      if (attempt < 4) { peer.destroy(); setStatus("Code occupé, nouvelle tentative…"); setTimeout(() => startHost(attempt + 1), 2500); return; }
      setStatus("Ce code est déjà utilisé par un autre groupe. Reviens à la page Jouer pour en créer un nouveau.", "err");
      return;
    }
    setStatus(`Erreur de connexion : ${err.type || err.message}`, "err");
  });
}

function hostReceive(conn, msg) {
  if (!msg) return;
  if (msg.type === "join") {
    if (state.players.length >= MAX_PLAYERS) { conn.send({ type: "refused", reason: "Le groupe est complet." }); return; }
    conns.set(conn.peer, conn);
    const name = String(msg.name || "Joueur").slice(0, 24);
    state.players = state.players.filter((p) => p.id !== conn.peer).concat({ id: conn.peer, name, host: false });
    broadcast();
    return;
  }
  if (msg.type === "word") onWord(conn.peer, msg.word);
  if (msg.type === "vote") onVote(conn.peer, msg.target);
}

// ---------- Hôte : partie d'Undercover ----------

function clearTimer() { if (timer) { clearTimeout(timer); timer = null; } }

function setDeadline(seconds, onExpire) {
  clearTimer();
  state.play.deadline = Date.now() + seconds * 1000;
  timer = setTimeout(onExpire, seconds * 1000);
}

async function startGame() {
  const game = GAMES.find((g) => g.id === state.game);
  if (!game || game.id !== "undercover") return;
  if (state.players.length < Undercover.MIN_PLAYERS) { setStatus("Il faut au moins 3 joueurs.", "err"); return; }
  try {
    if (!dataCache) dataCache = await loadData();
  } catch (e) {
    setStatus("Impossible de charger les personnages.", "err");
    return;
  }
  const rules = { ...defaultRules(game), ...state.rules };
  const pick = Undercover.pickCharacters(dataCache, rules.univers);
  if (!pick) { setStatus("Pas assez de personnages avec des tags en commun pour cet univers.", "err"); return; }

  const ids = shuffle(state.players.map((p) => p.id));
  const nImp = Undercover.impostorCount(ids.length, rules.imposteurs);
  const impostors = new Set(shuffle(ids).slice(0, nImp));
  secret = { roles: {}, pick, votes: {}, names: {} };
  ids.forEach((id) => {
    secret.roles[id] = impostors.has(id) ? "imposteur" : "innocent";
    secret.names[id] = playerName(id);
  });

  state.status = "playing";
  state.play = {
    phase: "words",
    round: 1,
    rounds: Undercover.roundsFor(nImp),
    order: ids,
    turnIndex: 0,
    messages: [],
    voted: {},
    deadline: null,
    result: null,
  };
  // chacun reçoit son perso en privé
  ids.forEach((id) => sendTo(id, { type: "secret", character: secret.roles[id] === "imposteur" ? pick.impostor : pick.innocent }));
  setStatus(`Partie lancée : ${nImp} imposteur${nImp > 1 ? "s" : ""}, ${state.play.rounds} manches de mots.`, "ok");
  startTurn();
}

function startTurn() {
  const play = state.play;
  // saute les joueurs partis
  while (play.turnIndex < play.order.length && !present(play.order[play.turnIndex])) play.turnIndex++;
  if (play.turnIndex >= play.order.length) {
    play.round++;
    play.turnIndex = 0;
    if (play.round > play.rounds) { startVote(); return; }
    startTurn();
    return;
  }
  setDeadline(Number(state.rules.temps) || 60, () => onWord(play.order[play.turnIndex], null, true));
  broadcast();
}

function onWord(from, word, timeout = false) {
  const play = state.play;
  if (!play || play.phase !== "words" || play.order[play.turnIndex] !== from) return;
  // un seul mot : on garde le premier, sans espaces, 30 caractères max
  const clean = timeout ? null : String(word || "").trim().split(/\s+/)[0].slice(0, 30) || null;
  if (!clean && !timeout) return;
  play.messages.push({ id: from, name: playerName(from), word: clean, round: play.round });
  play.turnIndex++;
  startTurn();
}

function startVote() {
  const play = state.play;
  play.phase = "vote";
  play.voted = {};
  secret.votes = {};
  setDeadline(Number(state.rules.vote) || 60, finishVote);
  broadcast();
}

function onVote(from, target) {
  const play = state.play;
  if (!play || play.phase !== "vote" || !play.order.includes(from) || from === target) return;
  if (!play.order.includes(target) || !present(target)) return;
  secret.votes[from] = target;
  play.voted[from] = true;
  const voters = play.order.filter(present);
  if (voters.every((id) => secret.votes[id])) finishVote();
  else broadcast();
}

function finishVote() {
  clearTimer();
  const play = state.play;
  const tally = {};
  Object.values(secret.votes).forEach((t) => { tally[t] = (tally[t] || 0) + 1; });
  const max = Math.max(0, ...Object.values(tally));
  const top = Object.keys(tally).filter((id) => tally[id] === max);
  const eliminatedId = max > 0 && top.length === 1 ? top[0] : null;
  const eliminated = eliminatedId ? { id: eliminatedId, name: secret.names[eliminatedId], role: secret.roles[eliminatedId] } : null;
  endGame({
    eliminated,
    impostorsWin: !eliminated || eliminated.role !== "imposteur",
    tally,
  });
}

function endGame(extra) {
  clearTimer();
  const play = state.play;
  play.phase = "result";
  play.deadline = null;
  play.result = {
    ...extra,
    innocent: secret.pick.innocent,
    impostor: secret.pick.impostor,
    shared: secret.pick.shared,
    players: play.order.map((id) => ({
      id,
      name: secret.names[id],
      role: secret.roles[id],
      votes: (extra.tally || {})[id] || 0,
    })),
  };
  broadcast();
}

function onPlayerLeft(id) {
  const play = state.status === "playing" ? state.play : null;
  if (!play || play.phase === "result" || !play.order.includes(id)) return;
  if (play.order.filter(present).length < Undercover.MIN_PLAYERS) {
    endGame({ aborted: "Moins de 3 joueurs restants : la partie s'arrête.", tally: {} });
    return;
  }
  if (play.phase === "words" && play.order[play.turnIndex] === id) startTurn();
  if (play.phase === "vote") {
    Object.keys(secret.votes).forEach((v) => { if (secret.votes[v] === id) { delete secret.votes[v]; delete play.voted[v]; } });
    if (play.order.filter(present).every((v) => secret.votes[v])) finishVote();
  }
}

function backToLobby() {
  clearTimer();
  state.status = "lobby";
  state.play = null;
  secret = null;
  mySecret = null;
  broadcast();
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Ami ----------

function startGuest() {
  peer = new Peer();
  peer.on("open", (id) => {
    myId = id;
    hostConn = peer.connect(PEER_PREFIX + code, { reliable: true });
    const t = setTimeout(() => {
      if (!hostConn.open) setStatus("Impossible de rejoindre ce groupe : vérifie le code, et que le créateur a bien la page du groupe ouverte.", "err");
    }, 12000);
    hostConn.on("open", () => {
      clearTimeout(t);
      hostConn.send({ type: "join", name: myName });
      setStatus("Tu as rejoint le groupe ! Le créateur choisit le jeu et les règles.", "ok");
    });
    hostConn.on("data", (msg) => {
      if (!msg) return;
      if (msg.type === "state") {
        const wasPlaying = state.status === "playing";
        state = msg.state;
        clockOffset = Date.now() - (state.hostNow || Date.now());
        if (state.status !== "playing") { mySecret = null; myVote = null; }
        if (!wasPlaying && state.status === "playing") myVote = null;
        render();
      }
      if (msg.type === "secret") { mySecret = msg.character; myVote = null; render(); }
      if (msg.type === "refused") { setStatus(msg.reason, "err"); hostConn.close(); }
    });
    hostConn.on("close", () => {
      $("lobby").hidden = true;
      setStatus("Le créateur a fermé le groupe.", "err");
    });
  });
  peer.on("error", (err) => {
    if (err.type === "peer-unavailable") {
      setStatus("Aucun groupe avec ce code. Vérifie-le, ou demande au créateur de garder la page du groupe ouverte.", "err");
      return;
    }
    setStatus(`Erreur de connexion : ${err.type || err.message}`, "err");
  });
}

function sendWord(word) {
  if (isHost) onWord(myId, word);
  else hostConn.send({ type: "word", word });
}

function sendVote(target) {
  myVote = target;
  if (isHost) onVote(myId, target);
  else { hostConn.send({ type: "vote", target }); render(); }
}

// ---------- Boutons ----------

$("game").addEventListener("change", (e) => {
  if (!isHost) return;
  state.game = e.target.value || null;
  const game = GAMES.find((g) => g.id === state.game);
  state.rules = game ? defaultRules(game) : {};
  broadcast();
});

$("word-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const word = $("word").value.trim();
  if (!word) return;
  if (/\s/.test(word)) { setStatus("Un seul mot, sans espace.", "err"); return; }
  $("word").value = "";
  sendWord(word);
});

$("btn-copy").addEventListener("click", async () => {
  const link = `${location.origin}${location.pathname}?code=${code}`;
  const text = `Rejoins mon groupe sur Univers Ranking ! Code : ${code}\n${link}`;
  try {
    await navigator.clipboard.writeText(text);
    $("btn-copy").textContent = "✓ Copié !";
  } catch (e) {
    await askText("Copie ce texte et envoie-le à tes amis :", text, "OK");
  }
  setTimeout(() => { $("btn-copy").textContent = "📋 Copier l'invitation"; }, 2000);
});

$("btn-leave").addEventListener("click", async () => {
  const msg = isHost ? "Quitter va fermer le groupe pour tout le monde. Continuer ?" : "Quitter le groupe ?";
  if (!(await askConfirm(msg, { okLabel: "Quitter", danger: true }))) return;
  if (peer) peer.destroy();
  location.href = "./";
});

$("btn-start").addEventListener("click", () => { if (isHost) startGame(); });
$("btn-replay").addEventListener("click", () => { if (isHost) startGame(); });
$("btn-lobby").addEventListener("click", () => { if (isHost) backToLobby(); });

window.addEventListener("beforeunload", (e) => {
  if (isHost && state.players.length > 1) { e.preventDefault(); e.returnValue = ""; }
});

// ---------- Démarrage ----------

if (!/^[A-Z0-9]{6}$/.test(code)) {
  setStatus("Code de groupe invalide. Reviens à la page Jouer pour créer ou rejoindre un groupe.", "err");
} else if (typeof Peer === "undefined") {
  setStatus("Impossible de charger le module de connexion. Vérifie ta connexion internet.", "err");
} else if (isHost) {
  startHost();
} else {
  startGuest();
}
