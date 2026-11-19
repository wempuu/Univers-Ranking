// Outil d'édition des personnages et de leurs tags (data/mangas.json).
// - "Ouvrir" choisit le vrai fichier du projet (Chrome/Edge) : "Enregistrer" l'écrase directement.
// - Sinon "Enregistrer" / "Télécharger" donne un mangas.json à remettre dans le dossier data/.

const $ = (id) => document.getElementById(id);
const canPickFile = "showOpenFilePicker" in window;

let data = null;        // contenu complet : { tags, mangas }
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
  return data.mangas[current].characters;
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

function render() {
  const chars = list();
  const slugs = chars.map((c) => slugify(c.name));
  const ul = $("list");
  ul.innerHTML = "";
  renderDatalists();

  chars.forEach((c, i) => {
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
    li.querySelector('[data-act="up"]').disabled = i === 0;
    li.querySelector('[data-act="down"]').disabled = i === chars.length - 1;

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

function move(from, to) {
  const chars = list();
  if (to < 0 || to >= chars.length || from === to) return;
  const [item] = chars.splice(from, 1);
  chars.splice(to, 0, item);
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

// Ajouter un personnage
$("add-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("add-name").value.trim();
  if (!name) return;
  if (list().some((c) => slugify(c.name) === slugify(name))) {
    setStatus(`« ${name} » est déjà dans la liste.`, "err");
    return;
  }
  const perso = { name, tags: {} };
  if ($("add-where").value === "start") list().unshift(perso);
  else list().push(perso);
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
    if (!isValid(parsed)) throw new Error("Ce fichier n'a pas le format de mangas.json.");
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
if (!canPickFile) $("btn-open").hidden = true;

window.addEventListener("beforeunload", (e) => {
  if (dirty) { e.preventDefault(); e.returnValue = ""; }
});

// ---------- Démarrage ----------

(async () => {
  try {
    data = await loadData();
    if (!isValid(data)) throw new Error("data/mangas.json n'a pas le format attendu.");
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
