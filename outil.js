// Outil d'édition des listes de personnages (data/mangas.json).
// - "Ouvrir" choisit le vrai fichier du projet (Chrome/Edge) : "Enregistrer" l'écrase directement.
// - Sinon "Enregistrer" / "Télécharger" donne un mangas.json à remettre dans le dossier data/.

const $ = (id) => document.getElementById(id);
const canPickFile = "showOpenFilePicker" in window;

let data = null;        // contenu complet de mangas.json
let current = null;     // slug du manga affiché
let fileHandle = null;  // fichier ouvert sur le disque (si supporté)
let dirty = false;

function setStatus(text, kind = "") {
  $("status").textContent = text;
  $("status").className = `tool-status ${kind}`;
}

function markDirty() {
  dirty = true;
  setStatus(fileHandle
    ? "Modifications non enregistrées."
    : "Modifications non enregistrées. Clique sur « Enregistrer » pour récupérer le fichier.", "dirty");
}

function toJSON() {
  return JSON.stringify(data, null, 2) + "\n";
}

function list() {
  return data[current].characters;
}

// ---------- Affichage ----------

function renderSelect() {
  const sel = $("manga");
  sel.innerHTML = "";
  Object.entries(data).forEach(([slug, m]) => {
    const opt = document.createElement("option");
    opt.value = slug;
    opt.textContent = `${m.title} (${m.characters.length})`;
    sel.appendChild(opt);
  });
  if (!data[current]) current = Object.keys(data)[0];
  sel.value = current;
}

function render() {
  const names = list();
  const slugs = names.map(slugify);
  const ul = $("list");
  ul.innerHTML = "";

  names.forEach((name, i) => {
    const li = document.createElement("li");
    li.draggable = true;
    li.dataset.index = i;
    if (slugs.indexOf(slugs[i]) !== slugs.lastIndexOf(slugs[i])) {
      li.classList.add("dup");
      li.title = "Doublon";
    }
    li.innerHTML = `
      <span class="handle" title="Glisser pour déplacer">⠿</span>
      <span class="pos">${i + 1}</span>
      <input aria-label="Nom">
      <button type="button" class="icon-btn" data-act="up" title="Monter">↑</button>
      <button type="button" class="icon-btn" data-act="down" title="Descendre">↓</button>
      <button type="button" class="icon-btn danger" data-act="del" title="Supprimer">✕</button>`;
    const input = li.querySelector("input");
    input.value = name;
    li.querySelector('[data-act="up"]').disabled = i === 0;
    li.querySelector('[data-act="down"]').disabled = i === names.length - 1;
    ul.appendChild(li);
  });

  if (names.length === 0) {
    ul.appendChild(emptyBlock("📝", "Liste vide", "Ajoute un premier personnage avec le champ ci-dessus."));
  }

  const dupCount = ul.querySelectorAll("li.dup").length;
  $("count").textContent = `${names.length} personnage${names.length > 1 ? "s" : ""}` +
    (dupCount ? ` · ⚠️ ${dupCount} doublons` : "");
  $("manga").selectedOptions[0].textContent = `${data[current].title} (${names.length})`;
}

// ---------- Actions sur la liste ----------

function move(from, to) {
  const names = list();
  if (to < 0 || to >= names.length || from === to) return;
  const [item] = names.splice(from, 1);
  names.splice(to, 0, item);
  markDirty();
  render();
}

$("list").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const i = Number(btn.closest("li").dataset.index);
  if (btn.dataset.act === "up") move(i, i - 1);
  if (btn.dataset.act === "down") move(i, i + 1);
  if (btn.dataset.act === "del") {
    list().splice(i, 1);
    markDirty();
    render();
  }
});

// Renommer : on met à jour à chaque frappe, on réaffiche (doublons) en quittant le champ
$("list").addEventListener("input", (e) => {
  if (e.target.tagName !== "INPUT") return;
  const i = Number(e.target.closest("li").dataset.index);
  list()[i] = e.target.value;
  markDirty();
});
$("list").addEventListener("change", (e) => {
  if (e.target.tagName !== "INPUT") return;
  const i = Number(e.target.closest("li").dataset.index);
  const value = e.target.value.trim();
  if (value) list()[i] = value;
  else list().splice(i, 1); // nom vidé = supprimé
  render();
});

// Glisser-déposer
let dragFrom = null;
$("list").addEventListener("dragstart", (e) => {
  const li = e.target.closest("li");
  if (!li || e.target.tagName === "INPUT") return;
  dragFrom = Number(li.dataset.index);
  li.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
});
$("list").addEventListener("dragover", (e) => {
  const li = e.target.closest("li");
  if (dragFrom === null || !li) return;
  e.preventDefault();
  document.querySelectorAll(".drop-target").forEach((el) => el.classList.remove("drop-target"));
  li.classList.add("drop-target");
});
$("list").addEventListener("drop", (e) => {
  const li = e.target.closest("li");
  if (dragFrom === null || !li) return;
  e.preventDefault();
  move(dragFrom, Number(li.dataset.index));
});
$("list").addEventListener("dragend", () => {
  dragFrom = null;
  document.querySelectorAll(".dragging, .drop-target").forEach((el) => el.classList.remove("dragging", "drop-target"));
});

// Ajouter
$("add-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("add-name").value.trim();
  if (!name) return;
  if (list().some((n) => slugify(n) === slugify(name))) {
    setStatus(`« ${name} » est déjà dans la liste.`, "err");
    return;
  }
  if ($("add-where").value === "start") list().unshift(name);
  else list().push(name);
  $("add-name").value = "";
  markDirty();
  render();
  if ($("add-where").value === "end") window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
});

$("manga").addEventListener("change", (e) => {
  current = e.target.value;
  render();
});

// ---------- Fichier ----------

async function openFile() {
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: "Fichier JSON", accept: { "application/json": [".json"] } }],
    });
    const parsed = JSON.parse(await (await handle.getFile()).text());
    if (typeof parsed !== "object" || !Object.values(parsed).every((m) => Array.isArray(m.characters))) {
      throw new Error("Ce fichier n'a pas le format de mangas.json.");
    }
    data = parsed;
    fileHandle = handle;
    dirty = false;
    renderSelect();
    render();
    setStatus(`Fichier « ${handle.name} » ouvert. « Enregistrer » l'écrasera directement.`, "ok");
  } catch (err) {
    if (err.name !== "AbortError") setStatus(`Erreur : ${err.message}`, "err");
  }
}

function download() {
  const blob = new Blob([toJSON()], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "mangas.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

async function save() {
  if (fileHandle) {
    try {
      const w = await fileHandle.createWritable();
      await w.write(toJSON());
      await w.close();
      dirty = false;
      setStatus(`Enregistré dans « ${fileHandle.name} » à ${new Date().toLocaleTimeString("fr-FR")}.`, "ok");
    } catch (err) {
      setStatus(`Erreur d'enregistrement : ${err.message}`, "err");
    }
    return;
  }
  download();
  dirty = false;
  setStatus("Fichier mangas.json téléchargé : remplace data/mangas.json du projet par celui-ci.", "ok");
}

$("btn-open").addEventListener("click", openFile);
$("btn-save").addEventListener("click", save);
$("btn-download").addEventListener("click", download);
if (!canPickFile) {
  $("btn-open").hidden = true;
}

window.addEventListener("beforeunload", (e) => {
  if (dirty) { e.preventDefault(); e.returnValue = ""; }
});

// ---------- Démarrage ----------

(async () => {
  try {
    data = await loadMangas();
    current = new URLSearchParams(location.search).get("manga") || "one-piece";
    renderSelect();
    render();
    setStatus(canPickFile
      ? "Liste du site chargée. Pour enregistrer directement dans le projet, clique d'abord sur « Ouvrir data/mangas.json »."
      : "Liste du site chargée. « Enregistrer » téléchargera le nouveau fichier mangas.json.");
  } catch (err) {
    setStatus(`Erreur : ${err.message}`, "err");
  }
})();
