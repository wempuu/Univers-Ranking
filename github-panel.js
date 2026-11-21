// Panneau GitHub partagé par les outils d'édition (liste des personnages, tags dans la fiche perso).
// Il gère : connexion avec un jeton (gardé dans ce navigateur), choix/création de branche,
// lecture de data/mangas.json sur GitHub et publication (commit) du fichier modifié.
// GitHub Pages redéploie le site quand la branche est main (la seule visible sur le site).
//
// Utilisation :
//   const panel = createGitHubPanel({ mount, getData, onData });
//   panel.start();        // charge les données (GitHub si connecté, sinon le site) et appelle onData(data)
//   panel.markDirty();    // à appeler après chaque modification

const GH_REPO = "wempuu/Univers-Ranking";
const SITE_BRANCH = "main";
const GH_PATH = "data/mangas.json";
const GH_REPO_API = `https://api.github.com/repos/${GH_REPO}`;
const GH_CONTENTS_API = `${GH_REPO_API}/contents/${GH_PATH}`;
const TOKEN_KEY = "ur-github-token";

// UTF-8 <-> base64 (l'API GitHub transporte le fichier en base64)
function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function fromBase64(b64) {
  const bin = atob(b64.replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
}

function readToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
}
function storeToken(value) {
  try {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  } catch (e) {}
}

function createGitHubPanel({ mount, getData, onData }) {
  const s = {
    token: null,         // jeton GitHub (null = pas connecté)
    login: null,         // pseudo GitHub
    branch: SITE_BRANCH, // branche lue et publiée
    remoteLoaded: false, // la branche a été lue sur GitHub (publication possible)
    remoteSha: null,     // version du fichier sur la branche (null = absent, il sera créé)
    dirty: false,
    publishing: false,
  };

  mount.innerHTML = `
    <section class="gh-box">
      <div class="gh-connected" data-r="connected" hidden>
        <span>✅ Connecté à GitHub en tant que <strong data-r="login"></strong></span>
        <button class="btn ghost small" data-r="logout" type="button">Se déconnecter</button>
      </div>
      <form data-r="form">
        <label><strong>Connexion GitHub</strong> — colle ton jeton d'accès pour pouvoir publier
          <div class="tool-bar" style="margin:8px 0 0">
            <input class="tool-input" data-r="token" type="password" placeholder="github_pat_… ou ghp_…" autocomplete="off" spellcheck="false">
            <button class="btn" type="submit">Se connecter</button>
          </div>
        </label>
        <details class="gh-help">
          <summary>Comment obtenir un jeton ?</summary>
          <ol>
            <li>Le propriétaire du dépôt doit t'avoir ajouté comme collaborateur (Settings → Collaborators), sauf si c'est ton dépôt.</li>
            <li>Sur GitHub : photo de profil → <b>Settings</b> → <b>Developer settings</b> → <b>Personal access tokens</b>.</li>
            <li><b>Propriétaire du dépôt :</b> « Fine-grained tokens » → Generate new token → Repository access : <i>Only select repositories</i> → <b>Univers-Ranking</b> → Permissions : <b>Contents : Read and write</b>.</li>
            <li><b>Collaborateur :</b> « Tokens (classic) » → Generate new token → coche uniquement <b>public_repo</b>.</li>
            <li>Copie le jeton et colle-le ici. Il reste uniquement dans ce navigateur.</li>
          </ol>
        </details>
      </form>
    </section>
    <div class="tool-bar" data-r="branch-bar" hidden>
      <span class="muted-small">Branche</span>
      <select class="branch-select" data-r="branch" aria-label="Branche"></select>
      <button class="btn ghost small" data-r="new-branch" type="button">＋ Nouvelle branche</button>
      <span class="branch-warn" data-r="branch-warn" hidden>⚠️ Seule la branche <b>main</b> est visible sur le site.</span>
    </div>
    <div class="tool-bar">
      <button class="btn" data-r="publish" type="button" disabled>🚀 Publier sur GitHub</button>
      <button class="btn ghost" data-r="reload" type="button">↻ Recharger</button>
    </div>
    <p class="tool-status" data-r="status">Chargement…</p>`;
  const el = (r) => mount.querySelector(`[data-r="${r}"]`);

  // ---------- Affichage ----------

  function setStatus(text, kind = "") {
    el("status").textContent = text;
    el("status").className = `tool-status ${kind}`;
  }

  function refresh() {
    el("connected").hidden = !s.token;
    el("form").hidden = !!s.token;
    el("login").textContent = s.login || "";
    el("branch-bar").hidden = !s.token;
    el("branch-warn").hidden = s.branch === SITE_BRANCH;
    el("publish").disabled = !s.token || !s.remoteLoaded || !s.dirty || s.publishing;
    el("publish").textContent = s.branch === SITE_BRANCH ? "🚀 Publier sur GitHub" : `🚀 Publier sur ${s.branch}`;
  }

  function markDirty() {
    s.dirty = true;
    setStatus(!s.token
      ? "Modifications non publiées. Connecte-toi à GitHub ci-dessus pour pouvoir publier."
      : s.branch === SITE_BRANCH
        ? "Modifications non publiées. Clique sur « Publier sur GitHub » pour les mettre en ligne."
        : `Modifications non publiées. « Publier » les enverra sur la branche ${s.branch} (pas sur le site).`, "dirty");
    refresh();
  }

  // ---------- API GitHub ----------

  async function gh(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${s.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
    });
    let body = null;
    try { body = await res.json(); } catch (e) {}
    return { res, body };
  }

  // Vérifie le jeton : qui est connecté, et a-t-il le droit d'écrire dans le dépôt ?
  async function connect(value) {
    s.token = value;
    const me = await gh("https://api.github.com/user");
    if (!me.res.ok) {
      s.token = null;
      throw new Error(me.res.status === 401 ? "Jeton invalide ou expiré." : `GitHub a répondu ${me.res.status}.`);
    }
    const repo = await gh(GH_REPO_API);
    if (!repo.res.ok || !(repo.body.permissions && repo.body.permissions.push)) {
      s.token = null;
      throw new Error("Ce jeton ne permet pas de modifier le dépôt Univers-Ranking (droit d'écriture manquant).");
    }
    s.login = me.body.login;
    storeToken(value);
  }

  // `ensure` : branche à garder dans la liste même si GitHub ne la renvoie pas encore (juste créée)
  async function loadBranches(ensure = null) {
    const { res, body } = await gh(`${GH_REPO_API}/branches?per_page=100`);
    if (!res.ok) throw new Error(`Impossible de lister les branches (${res.status}).`);
    const names = body.map((b) => b.name);
    if (ensure && !names.includes(ensure)) names.push(ensure);
    names.sort((a, b) => (a === SITE_BRANCH ? -1 : b === SITE_BRANCH ? 1 : a.localeCompare(b, "fr")));
    const sel = el("branch");
    sel.innerHTML = "";
    names.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name === SITE_BRANCH ? `${name} (site en ligne)` : name;
      sel.appendChild(opt);
    });
    if (!names.includes(s.branch)) s.branch = SITE_BRANCH;
    sel.value = s.branch;
  }

  // Lit le fichier sur la branche (plus frais que le site, qui peut avoir quelques minutes de retard).
  // Fichier absent : on garde les données affichées, la publication le créera. Renvoie un message dans ce cas.
  async function loadRemote() {
    s.remoteLoaded = false;
    const { res, body } = await gh(`${GH_CONTENTS_API}?ref=${encodeURIComponent(s.branch)}`);
    if (res.status === 404) {
      s.remoteSha = null;
      s.remoteLoaded = true;
      s.dirty = true;
      return `La branche ${s.branch} n'a pas encore de fichier ${GH_PATH} : les données affichées y seront créées à la publication.`;
    }
    if (!res.ok) throw new Error(`Impossible de lire ${GH_PATH} sur la branche ${s.branch} (${res.status}).`);
    const parsed = JSON.parse(fromBase64(body.content));
    if (!isValidData(parsed)) throw new Error(`${GH_PATH} sur la branche ${s.branch} n'a pas le format attendu (ancienne version ?).`);
    s.remoteSha = body.sha;
    s.remoteLoaded = true;
    s.dirty = false;
    onData(parsed);
    return null;
  }

  async function loadFromSite() {
    const parsed = await loadData();
    if (!isValidData(parsed)) throw new Error(`${GH_PATH} n'a pas le format attendu.`);
    s.dirty = false;
    onData(parsed);
  }

  // ---------- Actions ----------

  async function publish() {
    if (!s.token || !s.dirty || s.publishing) return;
    s.publishing = true;
    refresh();
    setStatus("Publication en cours…");
    const payload = {
      message: `Mise à jour des personnages depuis l'outil (${s.login})`,
      content: toBase64(JSON.stringify(getData(), null, 2) + "\n"),
      branch: s.branch,
    };
    if (s.remoteSha) payload.sha = s.remoteSha;
    const { res, body } = await gh(GH_CONTENTS_API, { method: "PUT", body: JSON.stringify(payload) });
    s.publishing = false;
    if (res.ok) {
      s.remoteSha = body.content.sha;
      s.dirty = false;
      const time = new Date().toLocaleTimeString("fr-FR");
      setStatus(s.branch === SITE_BRANCH
        ? `Publié à ${time} ! Le site sera à jour pour tout le monde dans 1 à 2 minutes.`
        : `Publié sur la branche ${s.branch} à ${time}. Le site en ligne (main) n'est pas modifié.`, "ok");
    } else if (res.status === 409 || res.status === 422) {
      setStatus("Quelqu'un a publié une autre modification entre-temps. Note tes changements, clique sur « Recharger », puis refais-les.", "err");
    } else if (res.status === 401 || res.status === 403 || res.status === 404) {
      setStatus("GitHub a refusé la publication : le jeton n'a pas (ou plus) le droit d'écrire dans le dépôt.", "err");
    } else {
      setStatus(`Erreur de publication (${res.status}) : ${(body && body.message) || "inconnue"}.`, "err");
    }
    refresh();
  }

  async function reload() {
    if (s.dirty && !(await askConfirm("Recharger effacera tes modifications non publiées. Continuer ?", { okLabel: "Recharger", danger: true }))) return;
    try {
      if (s.token) {
        const msg = await loadRemote();
        if (msg) setStatus(msg, "dirty");
        else setStatus(`Dernière version de la branche ${s.branch} chargée depuis GitHub.`, "ok");
      } else {
        await loadFromSite();
        setStatus("Données du site rechargées.", "ok");
      }
    } catch (err) {
      setStatus(`Erreur : ${err.message}`, "err");
    }
    refresh();
  }

  async function switchBranch(name) {
    if (s.dirty && !(await askConfirm("Changer de branche effacera tes modifications non publiées. Continuer ?", { okLabel: "Changer de branche", danger: true }))) {
      el("branch").value = s.branch;
      return;
    }
    s.branch = name;
    s.dirty = false;
    refresh();
    setStatus(`Chargement de la branche ${s.branch}…`);
    try {
      const msg = await loadRemote();
      setStatus(msg || `Branche ${s.branch} chargée.`, msg ? "dirty" : "ok");
    } catch (err) {
      setStatus(`Erreur : ${err.message}`, "err");
    }
    refresh();
  }

  // Crée une branche à partir de la branche actuelle et bascule dessus en gardant les modifications en cours
  async function createBranch() {
    const raw = await askText(`Nom de la nouvelle branche (créée à partir de « ${s.branch} ») :`, "", "Créer la branche");
    if (raw === null) return;
    const name = raw.trim().replace(/\s+/g, "-");
    if (!/^[A-Za-z0-9._\/-]+$/.test(name) || name.startsWith("/") || name.endsWith("/") || name.includes("..")) {
      setStatus("Nom de branche invalide : utilise des lettres, chiffres, tirets, points ou /.", "err");
      return;
    }
    setStatus(`Création de la branche ${name}…`);
    const head = await gh(`${GH_REPO_API}/git/ref/heads/${encodeURIComponent(s.branch)}`);
    if (!head.res.ok) { setStatus(`Erreur : branche ${s.branch} introuvable (${head.res.status}).`, "err"); return; }
    const created = await gh(`${GH_REPO_API}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${name}`, sha: head.body.object.sha }),
    });
    if (!created.res.ok) {
      setStatus(created.res.status === 422
        ? `La branche « ${name} » existe déjà.`
        : `Erreur de création (${created.res.status}) : ${(created.body && created.body.message) || "inconnue"}.`, "err");
      return;
    }
    // La nouvelle branche part du même commit : le fichier y est identique, on garde les modifications en cours
    s.branch = name;
    await loadBranches(name);
    refresh();
    if (s.dirty) markDirty();
    else setStatus(`Branche ${name} créée. Tes prochaines publications iront sur cette branche.`, "ok");
  }

  // Envoie (ou remplace) un fichier du dépôt sur la branche choisie, ex. une image de personnage.
  // `base64` : contenu déjà encodé. Fait un commit à part, indépendant de la publication des données.
  async function putFile(path, base64, message) {
    if (!s.token) throw new Error("Connecte-toi à GitHub d'abord.");
    const url = `${GH_REPO_API}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;
    const current = await gh(`${url}?ref=${encodeURIComponent(s.branch)}`);
    const payload = { message: `${message} (${s.login})`, content: base64, branch: s.branch };
    if (current.res.ok && current.body && current.body.sha) payload.sha = current.body.sha;
    const r = await gh(url, { method: "PUT", body: JSON.stringify(payload) });
    if (!r.res.ok) throw new Error(`GitHub a refusé l'envoi (${r.res.status}) : ${(r.body && r.body.message) || "erreur inconnue"}.`);
    return r.body;
  }

  function disconnect() {
    s.token = null;
    s.login = null;
    s.remoteLoaded = false;
    s.branch = SITE_BRANCH;
    storeToken(null);
    refresh();
    setStatus("Déconnecté. Le jeton a été effacé de ce navigateur.");
  }

  el("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const value = el("token").value.trim();
    if (!value) return;
    if (s.dirty && !(await askConfirm("Se connecter recharge la dernière version publiée et efface tes modifications non publiées. Continuer ?", { okLabel: "Se connecter", danger: true }))) return;
    setStatus("Vérification du jeton…");
    try {
      await connect(value);
      el("token").value = "";
      s.branch = SITE_BRANCH;
      await loadBranches();
      await loadRemote();
      setStatus("Connecté. Tu peux modifier puis cliquer sur « Publier sur GitHub ».", "ok");
    } catch (err) {
      setStatus(`Connexion impossible : ${err.message}`, "err");
    }
    refresh();
  });
  el("logout").addEventListener("click", disconnect);
  el("publish").addEventListener("click", publish);
  el("reload").addEventListener("click", reload);
  el("branch").addEventListener("change", (e) => switchBranch(e.target.value));
  el("new-branch").addEventListener("click", createBranch);

  window.addEventListener("beforeunload", (e) => {
    if (s.dirty) { e.preventDefault(); e.returnValue = ""; }
  });

  async function start() {
    const saved = readToken();
    let loaded = false;
    if (saved) {
      try {
        await connect(saved);
        await loadBranches();
        await loadRemote();
        loaded = true;
        setStatus("Connecté. Dernière version publiée chargée depuis GitHub.", "ok");
      } catch (err) {
        s.token = null;
        storeToken(null);
        setStatus(`Reconnexion impossible : ${err.message} Colle un nouveau jeton.`, "err");
      }
    }
    if (!loaded) {
      try {
        await loadFromSite();
        if (!saved) setStatus("Données du site chargées. Connecte-toi à GitHub pour pouvoir publier tes modifications.");
      } catch (err) {
        setStatus(`Erreur : ${err.message}`, "err");
      }
    }
    refresh();
  }

  refresh();
  return {
    start,
    markDirty,
    setStatus,
    isDirty: () => s.dirty,
    isConnected: () => !!s.token,
    branch: () => s.branch,
    putFile,
    state: s, // exposé pour les tests
  };
}
