// Outil « Gérer les tags » (lien depuis le Catalogue) : catégories de tags, tags, et personnages qui les portent.
// Modifie data/mangas.json en mémoire ; la publication se fait avec le panneau GitHub (github-panel.js).
// Les catégories sont communes à tous les mangas ; un tag = une valeur dans une catégorie.

const $ = (id) => document.getElementById(id);

let data = null;
let cat = null;  // slug de la catégorie affichée
let tag = null;  // tag (valeur) affiché

const panel = createGitHubPanel({
  mount: $("gh-panel"),
  getData: () => data,
  onData: (d) => {
    data = d;
    if (!data.tags[cat]) cat = Object.keys(data.tags)[0] || null;
    if (tag && !tagValues(cat).some((v) => same(v, tag))) tag = null;
    render();
  },
});

const same = (a, b) => normalizeSearch(a) === normalizeSearch(b);

function changed() {
  panel.markDirty();
  render();
}

// Tous les personnages de tous les mangas : { c, manga, mangaTitle }
function allChars() {
  const out = [];
  Object.entries(data.mangas).forEach(([slug, m]) => m.characters.forEach((c) => out.push({ c, manga: slug, mangaTitle: m.title })));
  return out;
}

// Tags d'une catégorie : valeurs proposées + valeurs utilisées, avec le nombre de persos
function tagValues(slug) {
  if (!slug || !data.tags[slug]) return [];
  return knownTagValues(data, slug);
}
function countFor(slug, value) {
  return allChars().filter(({ c }) => ((c.tags || {})[slug] || []).some((v) => same(v, value))).length;
}
function hasTag(c, slug, value) {
  return ((c.tags || {})[slug] || []).some((v) => same(v, value));
}

// ---------- Affichage ----------

function render() {
  if (!data) return;
  renderCats();
  renderTags();
  renderTag();
  renderSearch();
}

// La rareté est propre à chaque personnage : c.tagRarity[cat][tag] (voir tagRarity / setTagRarity dans common.js)
function rarityPicker(c) {
  const sel = document.createElement("select");
  sel.className = "tm-rarity-select";
  sel.title = `Rareté de « ${tag} » chez ${c.name}`;
  [[1, "⭐"], [2, "⭐⭐"], [3, "⭐⭐⭐"]].forEach(([n, l]) => {
    const o = new Option(`${l} ${RARITY_LABELS[n]}`, n);
    if (n > maxRarity(cat, tag)) { o.disabled = true; o.text += " (max ⭐⭐ pour ce tag)"; }
    sel.add(o);
  });
  sel.value = String(tagRarity(c, cat, tag));
  sel.addEventListener("change", () => { setTagRarity(c, cat, tag, Number(sel.value)); changed(); });
  return sel;
}

function renderCats() {
  const ul = $("cats");
  ul.innerHTML = "";
  Object.entries(data.tags).forEach(([slug, t]) => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tm-item" + (slug === cat ? " active" : "");
    b.innerHTML = `<span></span><span class="muted-small"></span>`;
    b.firstChild.textContent = t.label;
    b.lastChild.textContent = `${tagValues(slug).length} tags`;
    b.addEventListener("click", () => { cat = slug; tag = null; $("tag-filter").value = ""; render(); });
    li.appendChild(b);
    ul.appendChild(li);
  });
}

function renderTags() {
  $("cat-card").hidden = !cat;
  if (!cat) return;
  $("cat-title").textContent = data.tags[cat].label;
  const q = normalizeSearch($("tag-filter").value);
  const ul = $("tags-list");
  ul.innerHTML = "";
  const values = tagValues(cat).map((v) => ({ v, n: countFor(cat, v) }))
    .filter(({ v }) => matchesSearch(searchText([v]), q))
    .sort((a, b) => b.n - a.n || a.v.localeCompare(b.v, "fr"));
  values.forEach(({ v, n }) => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tm-item" + (tag && same(tag, v) ? " active" : "");
    b.innerHTML = `<span></span><span class="muted-small"></span>`;
    b.firstChild.textContent = v;
    b.lastChild.textContent = `${n} perso${n > 1 ? "s" : ""}`;
    b.addEventListener("click", () => { tag = v; $("add-filter").value = ""; render(); });
    li.appendChild(b);
    ul.appendChild(li);
  });
  if (!values.length) ul.innerHTML = `<li class="muted-small">Aucun tag.</li>`;
}

function persoRow({ c, mangaTitle }, action, label, title, extra) {
  const li = document.createElement("li");
  li.appendChild(persoAvatar(c, "avatar avatar-small"));
  const span = document.createElement("span");
  span.className = "tm-name";
  span.innerHTML = `<strong></strong> <span class="muted-small"></span>`;
  span.querySelector("strong").textContent = c.name;
  span.querySelector(".muted-small").textContent = mangaTitle;
  li.appendChild(span);
  if (extra) li.appendChild(extra);
  const b = document.createElement("button");
  b.type = "button";
  b.className = "icon-btn" + (label === "✕" ? " danger" : "");
  b.textContent = label;
  b.title = title;
  b.addEventListener("click", action);
  li.appendChild(b);
  return li;
}

function renderTag() {
  $("tag-card").hidden = !tag;
  if (!tag) return;
  $("tag-title").textContent = `${tag}`;
  const holders = allChars().filter(({ c }) => hasTag(c, cat, tag));
  $("tag-count").textContent = `${data.tags[cat].label} · ${holders.length} personnage${holders.length > 1 ? "s" : ""}`;
  const ul = $("tag-persos");
  ul.innerHTML = "";
  holders
    .sort((x, y) => tagRarity(y.c, cat, tag) - tagRarity(x.c, cat, tag))
    .forEach((x) => ul.appendChild(persoRow(x, () => removeFrom(x.c), "✕", `Retirer « ${tag} » de ${x.c.name}`, rarityPicker(x.c))));
  if (!holders.length) ul.innerHTML = `<li class="muted-small">Aucun personnage n'a ce tag.</li>`;

  const q = normalizeSearch($("add-filter").value);
  const add = $("add-list");
  add.innerHTML = "";
  const others = allChars().filter(({ c }) => !hasTag(c, cat, tag) && matchesSearch(searchText([c.name]), q));
  others.slice(0, q ? 50 : 12).forEach((x) => add.appendChild(persoRow(x, () => addTo(x.c), "＋", `Ajouter « ${tag} » à ${x.c.name}`)));
  if (!others.length) add.innerHTML = `<li class="muted-small">Aucun personnage à ajouter.</li>`;
  else if (!q && others.length > 12) add.insertAdjacentHTML("beforeend", `<li class="muted-small">… tape un nom pour trouver les autres (${others.length} au total).</li>`);
}

// ---------- Actions sur les personnages ----------

function addTo(c) {
  c.tags = c.tags || {};
  const vals = c.tags[cat] || [];
  if (vals.some((v) => same(v, tag))) return;
  if (vals.length >= MAX_TAGS_PER_CATEGORY) {
    panel.setStatus(`${c.name} a déjà ${MAX_TAGS_PER_CATEGORY} tags en « ${data.tags[cat].label} » (maximum). Retire-lui d'abord un tag de cette catégorie.`, "err");
    return;
  }
  c.tags[cat] = vals.concat(tag); // ⭐ Commun par défaut, à régler ensuite dans la liste
  changed();
}

function removeFrom(c) {
  const vals = (c.tags || {})[cat] || [];
  c.tags[cat] = vals.filter((v) => !same(v, tag));
  if (!c.tags[cat].length) delete c.tags[cat];
  setTagRarity(c, cat, tag, 1);
  changed();
}

// ---------- Actions sur les tags ----------

$("btn-new-tag").addEventListener("click", async () => {
  if (!cat) return;
  const v = ((await askText(`Nouveau tag dans « ${data.tags[cat].label} » :`, "", "Créer")) || "").trim();
  if (!v) return;
  const existing = tagValues(cat).find((x) => same(x, v));
  if (existing) { tag = existing; render(); panel.setStatus(`Le tag « ${existing} » existe déjà.`, "err"); return; }
  const t = data.tags[cat];
  t.values = (t.values || []).concat(v); // gardé dans les valeurs proposées, même sans perso pour l'instant
  tag = v;
  changed();
});

$("btn-rename-tag").addEventListener("click", async () => {
  if (!tag) return;
  const v = ((await askText(`Nouveau nom pour « ${tag} » (un nom déjà existant fusionne les deux tags) :`, tag, "Renommer")) || "").trim();
  if (!v || v === tag) return;
  const existingTarget = tagValues(cat).find((x) => same(x, v) && !same(x, tag));
  const target = existingTarget || v;
  allChars().forEach(({ c }) => {
    const vals = (c.tags || {})[cat];
    if (!vals || !vals.some((x) => same(x, tag))) return;
    // rareté du perso : un renommage la garde ; une fusion garde la plus haute des deux
    const had = vals.some((x) => same(x, target));
    const r = had ? Math.max(tagRarity(c, cat, tag), tagRarity(c, cat, target)) : tagRarity(c, cat, tag);
    const out = [];
    vals.forEach((x) => { const y = same(x, tag) ? target : x; if (!out.some((z) => same(z, y))) out.push(y); });
    c.tags[cat] = out;
    setTagRarity(c, cat, tag, 1);
    setTagRarity(c, cat, target, r);
  });
  const t = data.tags[cat];
  if (t.values) {
    const out = [];
    t.values.forEach((x) => { const y = same(x, tag) ? target : x; if (!out.some((z) => same(z, y))) out.push(y); });
    t.values = out;
  }
  criteria = criteria
    .map((x) => (x.cat === cat && same(x.value, tag) ? { cat, value: target } : x))
    .filter((x, i, all) => all.findIndex((y) => y.cat === x.cat && same(y.value, x.value)) === i);
  tag = target;
  changed();
});

$("btn-delete-tag").addEventListener("click", async () => {
  if (!tag) return;
  const n = countFor(cat, tag);
  if (!(await askConfirm(`Supprimer le tag « ${tag} » ?${n ? ` Il sera retiré des ${n} personnage(s) qui l'ont.` : ""}`, { okLabel: "Supprimer", danger: true }))) return;
  allChars().forEach(({ c }) => {
    const vals = (c.tags || {})[cat];
    if (!vals) return;
    c.tags[cat] = vals.filter((x) => !same(x, tag));
    if (!c.tags[cat].length) delete c.tags[cat];
    setTagRarity(c, cat, tag, 1);
  });
  const t = data.tags[cat];
  if (t.values) t.values = t.values.filter((x) => !same(x, tag));
  criteria = criteria.filter((x) => !(x.cat === cat && same(x.value, tag)));
  tag = null;
  changed();
});

// ---------- Actions sur les catégories ----------

$("btn-new-cat").addEventListener("click", async () => {
  const label = ((await askText("Nom de la nouvelle catégorie de tags (ex. « Espèce ») :", "", "Créer")) || "").trim();
  if (!label) return;
  const slug = slugify(label);
  if (!slug) return;
  if (data.tags[slug]) { panel.setStatus(`La catégorie « ${data.tags[slug].label} » existe déjà.`, "err"); return; }
  data.tags[slug] = { label, values: [] };
  cat = slug;
  tag = null;
  changed();
});

$("btn-rename-cat").addEventListener("click", async () => {
  if (!cat) return;
  const label = ((await askText("Nouveau nom de la catégorie :", data.tags[cat].label, "Renommer")) || "").trim();
  if (!label || label === data.tags[cat].label) return;
  data.tags[cat].label = label; // l'identifiant (slug) ne change pas : les tags des persos restent liés
  changed();
});

$("btn-delete-cat").addEventListener("click", async () => {
  if (!cat) return;
  const n = allChars().filter(({ c }) => (c.tags || {})[cat]).length;
  if (!(await askConfirm(`Supprimer la catégorie « ${data.tags[cat].label} » et tous ses tags ?${n ? ` Elle sera retirée des ${n} personnage(s) qui l'utilisent.` : ""}`, { okLabel: "Supprimer", danger: true }))) return;
  allChars().forEach(({ c }) => {
    if (c.tags) delete c.tags[cat];
    if (c.tagRarity) { delete c.tagRarity[cat]; if (!Object.keys(c.tagRarity).length) delete c.tagRarity; }
  });
  criteria = criteria.filter((x) => x.cat !== cat);
  delete data.tags[cat];
  cat = Object.keys(data.tags)[0] || null;
  tag = null;
  changed();
});

// ---------- Recherche multi-critères (tags de catégories différentes, tous requis) ----------

let criteria = []; // [{ cat, value }]

function renderSearch() {
  const catSel = $("crit-cat"), tagSel = $("crit-tag");
  const keepCat = data.tags[catSel.value] ? catSel.value : Object.keys(data.tags)[0];
  catSel.innerHTML = "";
  Object.entries(data.tags).forEach(([slug, t]) => catSel.add(new Option(t.label, slug)));
  if (keepCat) catSel.value = keepCat;
  fillCritTags();

  const box = $("criteria");
  box.innerHTML = "";
  criteria.forEach((cr, i) => {
    const chip = document.createElement("span");
    chip.className = "chip small";
    chip.textContent = `${data.tags[cr.cat].label} : ${cr.value} `;
    const x = document.createElement("button");
    x.type = "button";
    x.textContent = "✕";
    x.title = "Retirer ce critère";
    x.addEventListener("click", () => { criteria.splice(i, 1); renderSearch(); });
    chip.appendChild(x);
    box.appendChild(chip);
  });

  const ul = $("crit-results");
  ul.innerHTML = "";
  if (!criteria.length) { $("crit-count").textContent = "Ajoute un ou plusieurs critères."; return; }
  const found = charactersWithTags(data, criteria);
  $("crit-count").textContent = `${found.length} personnage${found.length > 1 ? "s" : ""}`;
  found.forEach(({ c, manga, mangaTitle }) => {
    const li = document.createElement("li");
    li.appendChild(persoAvatar(c, "avatar avatar-small"));
    const a = document.createElement("a");
    a.className = "tm-name";
    a.href = `personnage.html?manga=${encodeURIComponent(manga)}&perso=${encodeURIComponent(slugify(c.name))}`;
    a.innerHTML = `<strong></strong> <span class="muted-small"></span>`;
    a.querySelector("strong").textContent = c.name;
    a.querySelector(".muted-small").textContent = mangaTitle;
    li.appendChild(a);
    ul.appendChild(li);
  });
}

function fillCritTags() {
  const slug = $("crit-cat").value, tagSel = $("crit-tag");
  tagSel.innerHTML = "";
  if (!slug) return;
  tagValues(slug).forEach((v) => tagSel.add(new Option(v, v)));
}

$("crit-cat").addEventListener("change", fillCritTags);
$("crit-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const slug = $("crit-cat").value, value = $("crit-tag").value;
  if (!slug || !value || criteria.some((x) => x.cat === slug && same(x.value, value))) return;
  criteria.push({ cat: slug, value });
  renderSearch();
});

$("tag-filter").addEventListener("input", renderTags);
$("add-filter").addEventListener("input", renderTag);

$("btn-close").addEventListener("click", async (e) => {
  if (!panel.isDirty()) return;
  e.preventDefault();
  if (!(await askConfirm("Fermer l'outil sans publier ? Tes modifications seront perdues.", { okLabel: "Fermer sans publier", danger: true }))) return;
  panel.state.dirty = false;
  leavePage("catalogue.html");
});

cat = new URLSearchParams(location.search).get("categorie");
panel.start();
