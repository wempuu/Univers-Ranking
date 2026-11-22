// Outil « Modifier la liste » : noms des personnages, catégories et ordre (data/mangas.json).
// Les tags se modifient dans la fiche de chaque personnage (personnage.html).
// Connexion, branche et publication : github-panel.js.

const $ = (id) => document.getElementById(id);

let data = null;    // contenu complet : { tags, mangas }
let current = new URLSearchParams(location.search).get("manga") || "one-piece";

const panel = createGitHubPanel({
  mount: $("gh-panel"),
  getData: () => data,
  onData: (d) => {
    data = d;
    renderSelect();
    render();
  },
});

function markDirty() {
  panel.markDirty();
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
      </div>`;
    li.querySelector(".pos").after(persoAvatar(c, "avatar avatar-small"));
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

$("list").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const i = Number(btn.closest("li").dataset.index);
  const act = btn.dataset.act;
  if (act === "up") move(i, i - 1);
  if (act === "down") move(i, i + 1);
  if (act === "del") {
    const perso = list()[i];
    if (!(await askConfirm(`Supprimer « ${perso.name} » de la liste (avec ses tags) ?`, { okLabel: "Supprimer", danger: true }))) return;
    const at = list().indexOf(perso);
    if (at !== -1) list().splice(at, 1);
    markDirty();
    render();
  }
});

// Renommer : mise à jour à chaque frappe ; à la sortie du champ on réaffiche (doublons)
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
    panel.setStatus(`« ${name} » est déjà dans la liste.`, "err");
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

// Fermer l'édition : retour à la liste des personnages du manga affiché
$("btn-close").addEventListener("click", async () => {
  if (panel.isDirty()) {
    if (!(await askConfirm("Fermer l'édition sans publier ? Tes modifications seront perdues.", { okLabel: "Fermer sans publier", danger: true }))) return;
    panel.state.dirty = false; // évite une 2e alerte du navigateur en quittant la page
  }
  leavePage(`personnages.html?manga=${encodeURIComponent(current)}`);
});

panel.start();
