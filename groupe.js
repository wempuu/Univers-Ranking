// Groupe de jeu entre amis, sans serveur : connexion directe entre navigateurs (PeerJS / WebRTC).
// - Le créateur (hôte) ouvre groupe.html?code=XXXXXX&hote=1 : il « réserve » l'identifiant PeerJS
//   lié au code, accueille les connexions et garde l'état du groupe (joueurs, jeu, règles).
// - Un ami ouvre groupe.html?code=XXXXXX : il se connecte à l'hôte, envoie son pseudo et reçoit l'état.
// L'hôte est le seul à pouvoir changer le jeu et les règles ; s'il ferme la page, le groupe disparaît.

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const code = (params.get("code") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const isHost = params.get("hote") === "1";
const PEER_PREFIX = "univers-ranking-";
const MAX_PLAYERS = 12;

const myName = readPseudo() || "Joueur";
let peer = null;
let state = { players: [], game: null, rules: {}, status: "lobby" };
const conns = new Map(); // (hôte) id du pair -> connexion
let hostConn = null;     // (ami) connexion vers l'hôte

function readPseudo() {
  try { return (localStorage.getItem("ur-pseudo") || "").trim(); } catch (e) { return ""; }
}

function setStatus(text, kind = "") {
  $("status").textContent = text;
  $("status").className = `tool-status ${kind}`;
}

// ---------- Affichage ----------

function render() {
  $("lobby").hidden = false;
  $("code").textContent = code;

  // joueurs
  const ul = $("players");
  ul.innerHTML = "";
  state.players.forEach((p) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="player-name"></span>`;
    li.querySelector(".player-name").textContent = p.name;
    if (p.host) li.insertAdjacentHTML("beforeend", ' <span class="chip small-chip">👑 Créateur</span>');
    if (p.id === (peer && peer.id)) li.insertAdjacentHTML("beforeend", ' <span class="muted-small">(toi)</span>');
    ul.appendChild(li);
  });
  $("count").textContent = `(${state.players.length})`;

  // jeu
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

  // règles
  const box = $("rules");
  box.innerHTML = "";
  (game ? game.rules || [] : []).forEach((r) => box.appendChild(ruleField(r)));

  $("host-only").textContent = isHost ? "" : "Seul le créateur du groupe peut choisir le jeu et modifier les règles.";
  $("btn-start").hidden = !isHost;
  $("btn-start").disabled = !game || state.players.length < 1;
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

// ---------- Hôte ----------

function broadcast() {
  render();
  const msg = { type: "state", state };
  conns.forEach((c) => { if (c.open) c.send(msg); });
}

function startHost(attempt = 0) {
  peer = new Peer(PEER_PREFIX + code);
  peer.on("open", (id) => {
    state.players = [{ id, name: myName, host: true }];
    setStatus("Groupe créé ! Partage le code avec tes amis.", "ok");
    broadcast();
  });
  peer.on("connection", (conn) => {
    conn.on("data", (msg) => {
      if (!msg || msg.type !== "join") return;
      if (state.players.length >= MAX_PLAYERS) { conn.send({ type: "refused", reason: "Le groupe est complet." }); return; }
      conns.set(conn.peer, conn);
      const name = String(msg.name || "Joueur").slice(0, 24);
      state.players = state.players.filter((p) => p.id !== conn.peer).concat({ id: conn.peer, name, host: false });
      broadcast();
    });
    const leave = () => {
      conns.delete(conn.peer);
      state.players = state.players.filter((p) => p.id !== conn.peer);
      broadcast();
    };
    conn.on("close", leave);
    conn.on("error", leave);
  });
  peer.on("error", (err) => {
    if (err.type === "unavailable-id") {
      // code déjà pris (ou ancienne session pas encore libérée après un rechargement) : on réessaie un peu
      if (attempt < 4) { peer.destroy(); setStatus("Code occupé, nouvelle tentative…"); setTimeout(() => startHost(attempt + 1), 2500); return; }
      setStatus("Ce code est déjà utilisé par un autre groupe. Reviens à l'accueil pour en créer un nouveau.", "err");
      return;
    }
    setStatus(`Erreur de connexion : ${err.type || err.message}`, "err");
  });
}

// ---------- Ami ----------

function startGuest() {
  peer = new Peer();
  peer.on("open", () => {
    hostConn = peer.connect(PEER_PREFIX + code, { reliable: true });
    const timer = setTimeout(() => {
      if (!hostConn.open) setStatus("Impossible de rejoindre ce groupe : vérifie le code, et que le créateur a bien la page du groupe ouverte.", "err");
    }, 12000);
    hostConn.on("open", () => {
      clearTimeout(timer);
      hostConn.send({ type: "join", name: myName });
      setStatus("Tu as rejoint le groupe ! Le créateur choisit le jeu et les règles.", "ok");
    });
    hostConn.on("data", (msg) => {
      if (msg && msg.type === "state") { state = msg.state; render(); }
      if (msg && msg.type === "refused") { setStatus(msg.reason, "err"); hostConn.close(); }
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

// ---------- Boutons ----------

$("game").addEventListener("change", (e) => {
  if (!isHost) return;
  state.game = e.target.value || null;
  const game = GAMES.find((g) => g.id === state.game);
  state.rules = game ? defaultRules(game) : {};
  broadcast();
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

$("btn-start").addEventListener("click", () => {
  // les jeux seront branchés ici quand ils existeront
  setStatus("Ce jeu n'est pas encore jouable.", "err");
});

window.addEventListener("beforeunload", (e) => {
  if (isHost && state.players.length > 1) { e.preventDefault(); e.returnValue = ""; }
});

// ---------- Démarrage ----------

if (!/^[A-Z0-9]{6}$/.test(code)) {
  setStatus("Code de groupe invalide. Reviens à l'accueil pour créer ou rejoindre un groupe.", "err");
} else if (typeof Peer === "undefined") {
  setStatus("Impossible de charger le module de connexion. Vérifie ta connexion internet.", "err");
} else if (isHost) {
  startHost();
} else {
  startGuest();
}
