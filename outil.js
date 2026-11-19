// Outil d'édition des personnages et de leurs tags (data/mangas.json).
// "Publier sur GitHub" fait un commit de data/mangas.json sur main via l'API GitHub,
// avec le jeton d'accès de la personne connectée (gardé dans ce navigateur uniquement).
// GitHub Pages redéploie ensuite le site.

const $ = (id) => document.getElementById(id);

const GH_REPO = "wempuu/Univers-Ranking";
const GH_BRANCH = "main";
const GH_PATH = "data/mangas.json";
const GH_API = `https://api.github.com/repos/${GH_REPO}/contents/${GH_PATH}`;
const TOKEN_KEY = "ur-github-token";

let data = null;        // contenu complet : { tags, mangas }
let current = null;     // slug du manga affiché
let dirty = false;
let token = null;       // jeton GitHub (null = pas connecté)
let login = null;       // pseudo GitHub de la personne connectée
let remoteSha = null;   // version du fichier sur GitHub sur laquelle on travaille
let publishing = false;

function setStatus(text, kind = "") {
  $("status").textContent = text;
  $("status").className = `tool-status ${kind}`;
}

function markDirty() {
  dirty = true;
  setStatus(token
    ? "Modifications non publiées. Clique sur « Publier sur GitHub » pour les mettre en ligne."
    : "Modifications non publiées. Connecte-toi à GitHub ci-dessus pour pouvoir publier.", "dirty");
  updatePublishButton();
}

function updatePublishButton() {
  $("btn-publish").disabled = !token || !remoteSha || !dirty || publishing;
}

function toJSON() {
  return JSON.stringify(data, null, 2) + "\n";
}

function list() {
  return data.mangas[current].characters;
}

function groups() {
  return data.mangas[current].groups || [];
}

// Catégorie effective d'un perso (catégorie inconnue => la dernière)
function groupOf(c) {
  const ids = groups().map((g) => g.id);
  return ids.includes(c.group) ? c.group : ids[ids.length - 1];
}

// Garde la liste rangée par catégorie (tri stable : l'ordre dans chaque catégorie est conservé)
function normalize() {
  const ids = groups().map((g) => g.id);
  if (ids.length === 0) return;
  const chars = list();
  const sorted = chars
    .map((c, i) => ({ c, i, g: ids.indexOf(groupOf(c)) }))
    .sort((a, b) => a.g - b.g || a.i - b.i)
    .map((x) => x.c);
  chars.splice(0, chars.length, ...sorted);
}

function isValid(d) {
  return d && typeof d === "object" && d.tags && d.mangas &&
    Object.values(d.mangas).every((m) => Array.isArray(m.characters) && m.characters.every((c) => typeof c.name === "string"));
}

// Toutes les valeurs déjà utilisées pour un tag (tous mangas confondus), pour les suggestions
function knownValues(tagSlug) {
  const set = new Set();
  Object.values(data.mangas).forEach((m) =>
    m.characters.forEach((c) => ((c.tags && c.tags[tagSlug]) || []).forEach((v) => set.add(v))));
  return [...set].sort((a, b) => a.localeCompare(b, "fr"));
}

// ---------- Affichage ----------

function renderSelect() {
  const sel = $("manga");
  sel.innerHTML = "";
  Object.entries(data.mangas).forEach(([slug, m]) => {
    const opt = document.createElement("option");
    opt.value = slug;
    opt.textContent = `${m.title} (${m.characters.length})`;
    sel.appendChild(opt);
  });
  if (!data.mangas[current]) current = Object.keys(data.mangas)[0];
  sel.value = current;
}

function renderDatalists() {
  const box = $("datalists");
  box.innerHTML = "";
  Object.keys(data.tags).forEach((tagSlug) => {
    const dl = document.createElement("datalist");
    dl.id = `dl-${tagSlug}`;
    knownValues(tagSlug).forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      dl.appendChild(opt);
    });
    box.appendChild(dl);
  });
}

function renderAddGroup() {
  const sel = $("add-group");
  const previous = sel.value;
  sel.innerHTML = "";
  groups().forEach((g) => {
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.textContent = g.label;
    sel.appendChild(opt);
  });
  if (groups().some((g) => g.id === previous)) sel.value = previous;
  sel.hidden = groups().length === 0;
}

function render() {
  normalize();
  const chars = list();
  const slugs = chars.map((c) => slugify(c.name));
  const ul = $("list");
  ul.innerHTML = "";
  renderDatalists();
  renderAddGroup();
  const hasGroups = groups().length > 0;

  chars.forEach((c, i) => {
    const g = hasGroups ? groupOf(c) : null;
    const prevSame = i > 0 && (!hasGroups || groupOf(chars[i - 1]) === g);
    const nextSame = i < chars.length - 1 && (!hasGroups || groupOf(chars[i + 1]) === g);

    if (hasGroups && (i === 0 || groupOf(chars[i - 1]) !== g)) {
      const head = document.createElement("li");
      head.className = "group-head";
      head.textContent = groups().find((x) => x.id === g).label;
      ul.appendChild(head);
    }

    const li = document.createElement("li");
    li.draggable = true;
    li.dataset.index = i;
    if (slugs.indexOf(slugs[i]) !== slugs.lastIndexOf(slugs[i])) {
      li.classList.add("dup");
      li.title = "Doublon";
    }
    li.innerHTML = `
      <div class="row-main">
        <span class="handle" title="Glisser pour déplacer">⠿</span>
        <span class="pos">${i + 1}</span>
        <input class="name-input" aria-label="Nom">
        <button type="button" class="icon-btn" data-act="up" title="Monter">↑</button>
        <button type="button" class="icon-btn" data-act="down" title="Descendre">↓</button>
        <button type="button" class="icon-btn danger" data-act="del" title="Supprimer">✕</button>
      </div>
      <div class="row-tags"></div>`;
    li.querySelector(".name-input").value = c.name;
    li.querySelector('[data-act="up"]').disabled = !prevSame;
    li.querySelector('[data-act="down"]').disabled = !nextSame;

    if (hasGroups) {
      const sel = document.createElement("select");
      sel.className = "group-select";
      sel.setAttribute("aria-label", "Catégorie");
      groups().forEach((grp) => {
        const opt = document.createElement("option");
        opt.value = grp.id;
        opt.textContent = grp.label;
        sel.appendChild(opt);
      });
      sel.value = g;
      li.querySelector(".name-input").after(sel);
    }

    const tagsBox = li.querySelector(".row-tags");
    Object.entries(data.tags).forEach(([tagSlug, tag]) => {
      const group = document.createElement("div");
      group.className = "tag-edit";
      group.dataset.tag = tagSlug;
      group.innerHTML = `<span class="muted-small"></span>`;
      group.querySelector("span").textContent = `${tag.label} :`;
      ((c.tags && c.tags[tagSlug]) || []).forEach((v, vi) => {
        const chip = document.createElement("span");
        chip.className = "chip small";
        chip.innerHTML = `<span></span><button type="button" data-act="untag" title="Retirer">×</button>`;
        chip.querySelector("span").textContent = v;
        chip.querySelector("button").dataset.vi = vi;
        group.appendChild(chip);
      });
      const input = document.createElement("input");
      input.className = "tag-input";
      input.placeholder = "+ ajouter";
      input.setAttribute("list", `dl-${tagSlug}`);
      input.setAttribute("aria-label", `Ajouter : ${tag.label}`);
      group.appendChild(input);
      tagsBox.appendChild(group);
    });
    ul.appendChild(li);
  });

  if (chars.length === 0) {
    ul.appendChild(emptyBlock("📝", "Liste vide", "Ajoute un premier personnage avec le champ ci-dessus."));
  }

  const dupCount = ul.querySelectorAll("li.dup").length;
  $("count").textContent = `${chars.length} personnage${chars.length > 1 ? "s" : ""}` +
    (dupCount ? ` · ⚠️ ${dupCount} doublons` : "");
  $("manga").selectedOptions[0].textContent = `${data.mangas[current].title} (${chars.length})`;
}

// ---------- Actions sur la liste ----------

// Déplace un perso à la place d'un autre ; il prend la catégorie de la cible
function move(from, to) {
  const chars = list();
  if (to < 0 || to >= chars.length || from === to) return;
  const target = chars[to];
  const [item] = chars.splice(from, 1);
  if (groups().length) item.group = groupOf(target);
  chars.splice(to, 0, item);
  markDirty();
  render();
}

// Change de catégorie : le perso passe à la fin de sa nouvelle catégorie
function setGroup(i, groupId) {
  const chars = list();
  const [item] = chars.splice(i, 1);
  item.group = groupId;
  chars.push(item);
  markDirty();
  render();
}

function addTag(i, tagSlug, value) {
  value = value.trim();
  if (!value) return;
  const c = list()[i];
  c.tags = c.tags || {};
  const values = (c.tags[tagSlug] = c.tags[tagSlug] || []);
  // réutilise l'orthographe existante si la valeur existe déjà ailleurs (ex. "epeiste" -> "Épéiste")
  const existing = knownValues(tagSlug).find((v) => slugify(v) === slugify(value));
  value = existing || value;
  if (!values.some((v) => slugify(v) === slugify(value))) values.push(value);
  markDirty();
  render();
  const again = document.querySelector(`#list li[data-index="${i}"] .tag-edit[data-tag="${tagSlug}"] .tag-input`);
  if (again) again.focus();
}

$("list").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const i = Number(btn.closest("li").dataset.index);
  const act = btn.dataset.act;
  if (act === "up") move(i, i - 1);
  if (act === "down") move(i, i + 1);
  if (act === "del") {
    list().splice(i, 1);
    markDirty();
    render();
  }
  if (act === "untag") {
    const tagSlug = btn.closest(".tag-edit").dataset.tag;
    const values = list()[i].tags[tagSlug];
    values.splice(Number(btn.dataset.vi), 1);
    if (values.length === 0) delete list()[i].tags[tagSlug];
    markDirty();
    render();
  }
});

$("list").addEventListener("keydown", (e) => {
  if (!e.target.classList.contains("tag-input") || e.key !== "Enter") return;
  e.preventDefault();
  addTag(Number(e.target.closest("li").dataset.index), e.target.closest(".tag-edit").dataset.tag, e.target.value);
});

// Renommer : mise à jour à chaque frappe ; à la sortie du champ on réaffiche (doublons).
// Un tag tapé puis quitté sans Entrée est ajouté aussi.
$("list").addEventListener("input", (e) => {
  if (!e.target.classList.contains("name-input")) return;
  list()[Number(e.target.closest("li").dataset.index)].name = e.target.value;
  markDirty();
});
$("list").addEventListener("change", (e) => {
  const i = Number(e.target.closest("li")?.dataset.index);
  if (e.target.classList.contains("group-select")) {
    setGroup(i, e.target.value);
    return;
  }
  if (e.target.classList.contains("name-input")) {
    const value = e.target.value.trim();
    if (value) list()[i].name = value;
    else list().splice(i, 1); // nom vidé = supprimé
    render();
  }
  if (e.target.classList.contains("tag-input") && e.target.value.trim()) {
    addTag(i, e.target.closest(".tag-edit").dataset.tag, e.target.value);
  }
});

// Glisser-déposer
let dragFrom = null;
$("list").addEventListener("dragstart", (e) => {
  const li = e.target.closest("li");
  if (!li || !li.dataset.index || e.target.tagName === "INPUT") return;
  dragFrom = Number(li.dataset.index);
  li.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
});
$("list").addEventListener("dragover", (e) => {
  const li = e.target.closest("li");
  if (dragFrom === null || !li || !li.dataset.index) return;
  e.preventDefault();
  document.querySelectorAll(".drop-target").forEach((el) => el.classList.remove("drop-target"));
  li.classList.add("drop-target");
});
$("list").addEventListener("drop", (e) => {
  const li = e.target.closest("li");
  if (dragFrom === null || !li || !li.dataset.index) return;
  e.preventDefault();
  move(dragFrom, Number(li.dataset.index));
});
$("list").addEventListener("dragend", () => {
  dragFrom = null;
  document.querySelectorAll(".dragging, .drop-target").forEach((el) => el.classList.remove("dragging", "drop-target"));
});

// Ajouter un personnage
$("add-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("add-name").value.trim();
  if (!name) return;
  if (list().some((c) => slugify(c.name) === slugify(name))) {
    setStatus(`« ${name} » est déjà dans la liste.`, "err");
    return;
  }
  const perso = groups().length ? { name, group: $("add-group").value, tags: {} } : { name, tags: {} };
  if ($("add-where").value === "start") list().unshift(perso);
  else list().push(perso);
  $("add-name").value = "";
  markDirty();
  render();
  const row = $("list").querySelector(`li[data-index="${list().indexOf(perso)}"]`);
  if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
});

$("manga").addEventListener("change", (e) => {
  current = e.target.value;
  render();
});

// ---------- GitHub ----------

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

async function gh(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  let body = null;
  try { body = await res.json(); } catch (e) {}
  return { res, body };
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

function showConnection() {
  $("gh-connected").hidden = !token;
  $("gh-form").hidden = !!token;
  $("gh-login").textContent = login || "";
  updatePublishButton();
}

// Vérifie le jeton : qui est connecté, et a-t-il le droit d'écrire dans le dépôt ?
async function connect(value) {
  token = value;
  const me = await gh("https://api.github.com/user");
  if (!me.res.ok) {
    token = null;
    throw new Error(me.res.status === 401 ? "Jeton invalide ou expiré." : `GitHub a répondu ${me.res.status}.`);
  }
  const repo = await gh(`https://api.github.com/repos/${GH_REPO}`);
  if (!repo.res.ok || !(repo.body.permissions && repo.body.permissions.push)) {
    token = null;
    throw new Error("Ce jeton ne permet pas de modifier le dépôt Univers-Ranking (droit d'écriture manquant).");
  }
  login = me.body.login;
  storeToken(value);
}

function disconnect() {
  token = null;
  login = null;
  storeToken(null);
  showConnection();
  setStatus("Déconnecté. Le jeton a été effacé de ce navigateur.");
}

// Charge la dernière version publiée sur GitHub (plus fraîche que le site, qui peut avoir quelques minutes de retard)
async function loadFromGitHub() {
  const { res, body } = await gh(`${GH_API}?ref=${GH_BRANCH}`);
  if (!res.ok) throw new Error(`Impossible de lire ${GH_PATH} sur GitHub (${res.status}).`);
  const parsed = JSON.parse(fromBase64(body.content));
  if (!isValid(parsed)) throw new Error(`${GH_PATH} sur GitHub n'a pas le format attendu.`);
  data = parsed;
  remoteSha = body.sha;
  dirty = false;
}

async function publish() {
  if (!token || !dirty || publishing) return;
  publishing = true;
  updatePublishButton();
  setStatus("Publication en cours…");
  const message = `Mise à jour des personnages depuis l'outil (${login})`;
  const { res, body } = await gh(GH_API, {
    method: "PUT",
    body: JSON.stringify({ message, content: toBase64(toJSON()), sha: remoteSha, branch: GH_BRANCH }),
  });
  publishing = false;
  if (res.ok) {
    remoteSha = body.content.sha;
    dirty = false;
    setStatus(`Publié à ${new Date().toLocaleTimeString("fr-FR")} ! Le site sera à jour pour tout le monde dans 1 à 2 minutes.`, "ok");
  } else if (res.status === 409 || res.status === 422) {
    setStatus("Quelqu'un a publié une autre modification entre-temps. Note tes changements, clique sur « Recharger », puis refais-les.", "err");
  } else if (res.status === 401 || res.status === 403 || res.status === 404) {
    setStatus("GitHub a refusé la publication : le jeton n'a pas (ou plus) le droit d'écrire dans le dépôt.", "err");
  } else {
    setStatus(`Erreur de publication (${res.status}) : ${(body && body.message) || "inconnue"}.`, "err");
  }
  updatePublishButton();
}

async function reload() {
  if (dirty && !confirm("Recharger effacera tes modifications non publiées. Continuer ?")) return;
  try {
    if (token) await loadFromGitHub();
    else { data = await loadData(); dirty = false; }
    renderSelect();
    render();
    setStatus(token ? "Dernière version publiée chargée depuis GitHub." : "Liste du site rechargée.", "ok");
  } catch (err) {
    setStatus(`Erreur : ${err.message}`, "err");
  }
  updatePublishButton();
}

$("gh-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const value = $("gh-token").value.trim();
  if (!value) return;
  if (dirty && !confirm("Se connecter recharge la dernière version publiée et efface tes modifications non publiées. Continuer ?")) return;
  setStatus("Vérification du jeton…");
  try {
    await connect(value);
    $("gh-token").value = "";
    await loadFromGitHub();
    renderSelect();
    render();
    showConnection();
    setStatus(`Connecté. Tu peux modifier la liste puis cliquer sur « Publier sur GitHub ».`, "ok");
  } catch (err) {
    showConnection();
    setStatus(`Connexion impossible : ${err.message}`, "err");
  }
});

$("btn-logout").addEventListener("click", disconnect);
$("btn-publish").addEventListener("click", publish);
$("btn-reload").addEventListener("click", reload);

window.addEventListener("beforeunload", (e) => {
  if (dirty) { e.preventDefault(); e.returnValue = ""; }
});

// ---------- Démarrage ----------

(async () => {
  current = new URLSearchParams(location.search).get("manga") || "one-piece";
  const saved = readToken();
  try {
    if (saved) {
      try {
        await connect(saved);
        await loadFromGitHub();
      } catch (err) {
        storeToken(null);
        setStatus(`Reconnexion impossible : ${err.message} Colle un nouveau jeton.`, "err");
      }
    }
    if (!data) {
      data = await loadData();
      if (!isValid(data)) throw new Error("data/mangas.json n'a pas le format attendu.");
    }
    renderSelect();
    render();
    showConnection();
    if (token) setStatus(`Connecté. Dernière version publiée chargée depuis GitHub.`, "ok");
    else if (!saved) setStatus("Liste du site chargée. Connecte-toi à GitHub pour pouvoir publier tes modifications.");
  } catch (err) {
    setStatus(`Erreur : ${err.message}`, "err");
  }
})();
