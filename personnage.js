// Fiche d'un personnage : personnage.html?manga=<slug>&perso=<slug du nom>
// « Modifier les tags » (ou le crayon du portrait) ouvre le panneau GitHub (github-panel.js) et passe la fiche
// en mode édition : ajouter / retirer un tag, changer sa rareté chez ce perso, renommer un tag (pour tous les
// persos qui l'ont, comme dans tags.html). Les catégories ne se modifient pas ici (seulement dans tags.html).
// Le crayon sur le portrait ouvre aussi l'éditeur d'image (image-editor.js).

const params = new URLSearchParams(location.search);
const mangaSlug = params.get("manga");
const persoSlug = params.get("perso");
const $ = (id) => document.getElementById(id);

let data = null;
let editing = false;   // panneau GitHub ouvert (pour changer l'image)
let panel = null;
let panelReady = null; // promesse : le panneau GitHub a fini de charger les données
let dataReady = false; // les données du panneau sont chargées : on peut modifier les tags
let notice = null;     // { cat, text } : message affiché sous la catégorie concernée

function findPerso() {
  const manga = data && data.mangas[mangaSlug];
  if (!manga) return { manga: null, index: -1 };
  return { manga, index: manga.characters.findIndex((c) => slugify(c.name) === persoSlug) };
}

function currentPerso() {
  const { manga, index } = findPerso();
  return index === -1 ? null : manga.characters[index];
}

function persoUrl(name) {
  return `personnage.html?manga=${encodeURIComponent(mangaSlug)}&perso=${encodeURIComponent(slugify(name))}`;
}

// ---------- Affichage ----------

function render() {
  const head = $("head"), tags = $("tags"), nav = $("perso-nav");
  head.innerHTML = tags.innerHTML = nav.innerHTML = "";

  const { manga, index } = findPerso();
  if (!manga) {
    head.appendChild(emptyBlock("🔍", "Ce manga n'existe pas", "Retourne au catalogue pour en choisir un."));
    return;
  }
  const back = $("back");
  back.href = `personnages.html?manga=${encodeURIComponent(mangaSlug)}`;
  back.textContent = `← Personnages de ${manga.title}`;

  if (index === -1) {
    head.appendChild(emptyBlock("🔍", "Personnage introuvable", `Il n'est pas (ou plus) dans la liste de ${manga.title}.`));
    return;
  }

  const chars = manga.characters;
  const perso = chars[index];
  document.title = `${perso.name} · ${manga.title} · Univers Ranking`;

  // En-tête
  const section = document.createElement("section");
  section.className = "manga-head";
  section.innerHTML = `
    <div>
      <p class="eyebrow"></p>
      <h1></h1>
      <button type="button" class="edit-link link-btn" data-act="edit-tags">✎ Modifier les tags</button>
      <button type="button" class="edit-link link-btn" data-act="close-edit" hidden>✕ Fermer</button>
    </div>`;
  const avatarBtn = document.createElement("button");
  avatarBtn.type = "button";
  avatarBtn.className = "avatar-edit";
  avatarBtn.dataset.act = "edit-image";
  avatarBtn.title = "Changer l'image";
  avatarBtn.appendChild(persoAvatar(perso, "avatar avatar-big"));
  const hint = document.createElement("span");
  hint.className = "avatar-edit-hint";
  hint.textContent = "✏️";
  hint.setAttribute("aria-hidden", "true");
  avatarBtn.appendChild(hint);
  section.prepend(avatarBtn);
  section.querySelector(".eyebrow").textContent = manga.title;
  section.querySelector("h1").textContent = perso.name;
  section.querySelector('[data-act="close-edit"]').hidden = !editing;
  section.querySelector('[data-act="edit-tags"]').hidden = editing;
  head.appendChild(section);

  // Tags : un bloc par catégorie définie dans data.tags (modifiables en mode édition)
  const canEdit = editing && dataReady;
  const box = document.createElement("section");
  box.className = "tags-box" + (canEdit ? " editing" : "");
  if (editing && !dataReady) box.innerHTML = `<p class="muted-small">Chargement de la dernière version des données…</p>`;
  Object.entries(data.tags).forEach(([tagSlug, tag]) => {
    const values = (perso.tags && perso.tags[tagSlug]) || [];
    const row = document.createElement("div");
    row.className = "tag-row";
    row.innerHTML = `<h2 class="tag-label"></h2><div class="chips"></div>`;
    row.querySelector(".tag-label").textContent = canEdit ? `${tag.label} · ${values.length}/${MAX_TAGS_PER_CATEGORY}` : tag.label;
    const chipsEl = row.querySelector(".chips");
    if (values.length === 0 && !canEdit) chipsEl.innerHTML = `<span class="muted-small">Non renseigné</span>`;
    values.forEach((v) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      const r = tagRarity(perso, tagSlug, v);
      if (canEdit) {
        chip.classList.add("chip-edit");
        chip.append(tagEditControls(tagSlug, v, r));
      } else {
        chip.textContent = v + " ";
        const stars = document.createElement("span");
        stars.className = "chip-stars";
        stars.textContent = rarityStars(r);
        chip.appendChild(stars);
        chip.title = `${RARITY_LABELS[r]} ${rarityStars(r)}`;
      }
      chipsEl.appendChild(chip);
    });
    if (canEdit) chipsEl.appendChild(addTagSelect(perso, tagSlug));
    if (canEdit && notice && notice.cat === tagSlug) {
      const p = document.createElement("p");
      p.className = "tag-notice" + (notice.ok ? " ok" : "");
      p.textContent = notice.text;
      row.appendChild(p);
    }
    box.appendChild(row);
  });
  if (canEdit) {
    const help = document.createElement("p");
    help.className = "muted-small";
    help.textContent = `Rareté propre à ce personnage (⭐ Commun, ⭐⭐ Rare, ⭐⭐⭐ Très rare). ${MAX_TAGS_PER_CATEGORY} tags maximum par catégorie. ` +
      "✎ renomme le tag pour tous les personnages qui l'ont. Clique sur « Publier sur GitHub » pour enregistrer.";
    box.appendChild(help);
  }
  tags.appendChild(box);

  // Navigation personnage précédent / suivant
  const wrap = document.createElement("div");
  wrap.className = "perso-nav";
  const link = (i, label) => {
    const a = document.createElement("a");
    a.className = "card";
    a.href = persoUrl(chars[i].name);
    a.innerHTML = `<span class="muted-small"></span><strong></strong>`;
    a.querySelector("span").textContent = label;
    a.querySelector("strong").textContent = chars[i].name;
    return a;
  };
  wrap.appendChild(index > 0 ? link(index - 1, "← Précédent") : document.createElement("span"));
  if (index < chars.length - 1) {
    const next = link(index + 1, "Suivant →");
    next.classList.add("next");
    wrap.appendChild(next);
  }
  nav.appendChild(wrap);
}

// ---------- Édition des tags ----------

const same = (a, b) => normalizeSearch(a) === normalizeSearch(b);

// Contenu d'une pastille en mode édition : nom, rareté, renommer, retirer
function tagEditControls(cat, value, r) {
  const frag = document.createDocumentFragment();
  const name = document.createElement("span");
  name.textContent = value;
  const sel = document.createElement("select");
  sel.className = "chip-rarity";
  sel.dataset.act = "rarity";
  sel.dataset.cat = cat;
  sel.dataset.value = value;
  sel.title = "Rareté chez ce personnage";
  [1, 2, 3].forEach((n) => sel.add(new Option(rarityStars(n), n)));
  sel.value = r;
  const btn = (act, text, title) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip-x";
    b.dataset.act = act;
    b.dataset.cat = cat;
    b.dataset.value = value;
    b.textContent = text;
    b.title = title;
    return b;
  };
  frag.append(name, sel, btn("rename-tag", "✎", `Renommer « ${value} » (pour tous les personnages)`),
    btn("remove-tag", "✕", `Retirer « ${value} » à ce personnage`));
  return frag;
}

// Liste déroulante « ＋ Ajouter » : les tags de la catégorie que le perso n'a pas, puis « Nouveau tag… »
function addTagSelect(perso, cat) {
  const sel = document.createElement("select");
  sel.className = "tool-input tag-add";
  sel.dataset.act = "add-tag";
  sel.dataset.cat = cat;
  const held = (perso.tags || {})[cat] || [];
  if (held.length >= MAX_TAGS_PER_CATEGORY) {
    sel.add(new Option(`Maximum atteint (${MAX_TAGS_PER_CATEGORY})`, ""));
    sel.disabled = true;
    return sel;
  }
  sel.add(new Option("＋ Ajouter un tag…", ""));
  knownTagValues(data, cat).filter((v) => !held.some((h) => same(h, v))).forEach((v) => {
    const clash = conflictingTag(perso, cat, v);
    const o = new Option(clash ? `${v} (incompatible avec « ${clash} »)` : v, v);
    o.disabled = !!clash;
    sel.add(o);
  });
  sel.add(new Option("＋ Nouveau tag…", "__new__"));
  return sel;
}

function tagsChanged(msg = null) {
  notice = msg;
  panel.markDirty();
  render();
}

// Ajoute un tag au perso, rangé dans l'ordre de la liste de la catégorie (⭐ par défaut)
async function addTag(cat, value) {
  const perso = currentPerso();
  if (!perso) return;
  const label = data.tags[cat].label;
  if (value === "__new__") {
    value = ((await askText(`Nouveau tag dans « ${label} » :`, "", "Créer")) || "").trim();
    if (!value) return render();
    const other = tagCategoryOf(data, value, cat);
    if (other) return tagsChanged({ cat, text: `« ${value} » existe déjà dans la catégorie « ${data.tags[other].label} » : un tag n'appartient qu'à une catégorie.` });
    value = knownTagValues(data, cat).find((x) => same(x, value)) || value;
  }
  perso.tags = perso.tags || {};
  const vals = perso.tags[cat] || [];
  if (vals.some((v) => same(v, value))) return tagsChanged({ cat, text: `${perso.name} a déjà « ${value} ».` });
  const clash = conflictingTag(perso, cat, value);
  if (clash) return tagsChanged({ cat, text: `Impossible : ${perso.name} a déjà « ${clash} », qui exclut « ${value} ».` });
  if (vals.length >= MAX_TAGS_PER_CATEGORY) return tagsChanged({ cat, text: `Impossible : déjà ${MAX_TAGS_PER_CATEGORY} tags en « ${label} ».` });
  const t = data.tags[cat];
  if (!(t.values || []).some((x) => same(x, value))) t.values = (t.values || []).concat(value); // nouveau tag : en fin de liste
  const order = knownTagValues(data, cat);
  const pos = (x) => order.findIndex((y) => same(x, y));
  perso.tags[cat] = vals.concat(value).sort((a, b) => pos(a) - pos(b));
  tagsChanged();
}

function removeTag(cat, value) {
  const perso = currentPerso();
  if (!perso || !perso.tags || !perso.tags[cat]) return;
  perso.tags[cat] = perso.tags[cat].filter((v) => !same(v, value));
  if (!perso.tags[cat].length) delete perso.tags[cat];
  setTagRarity(perso, cat, value, 1);
  tagsChanged();
}

function setRarity(cat, value, n) {
  const perso = currentPerso();
  if (!perso) return;
  setTagRarity(perso, cat, value, n);
  tagsChanged();
}

// Renomme le tag pour TOUS les persos qui l'ont (un nom existant de la catégorie fusionne les deux tags)
async function renameTag(cat, value) {
  const holders = [];
  Object.values(data.mangas).forEach((m) => m.characters.forEach((c) => {
    if (((c.tags || {})[cat] || []).some((v) => same(v, value))) holders.push(c.name);
  }));
  const n = holders.length;
  const v = ((await askText(`Nouveau nom pour « ${value} ». Le tag sera renommé pour ${n === 1 ? "le seul personnage qui l'a" : `les ${n} personnages qui l'ont`} ` +
    "(un nom déjà existant dans la catégorie fusionne les deux tags) :", value, "Renommer")) || "").trim();
  if (!v || v === value) return;
  const other = tagCategoryOf(data, v, cat);
  if (other) return tagsChanged({ cat, text: `« ${v} » existe déjà dans la catégorie « ${data.tags[other].label} » : un tag n'appartient qu'à une catégorie.` });
  const target = renameTagValue(data, cat, value, v);
  tagsChanged({ cat, ok: true, text: `« ${value} » renommé en « ${target} » pour ${n} personnage${n > 1 ? "s" : ""}.` });
}

// ---------- Panneau GitHub (image et tags) ----------

function openPanel() {
  editing = true;
  $("editor").hidden = false;
  if (!panel) {
    panel = createGitHubPanel({
      mount: $("editor"),
      getData: () => data,
      onData: (d) => { data = d; render(); },
    });
    // recharge la dernière version (GitHub si connecté) avant de permettre les modifications
    panelReady = panel.start().finally(() => { dataReady = true; render(); });
  }
  render();
}

async function closePanel() {
  if (panel && panel.isDirty() &&
      !(await askConfirm("Fermer sans publier ? Tes modifications seront perdues.", { okLabel: "Fermer sans publier", danger: true }))) return;
  if (panel && panel.isDirty()) {
    panel.state.dirty = false; // évite une 2e alerte du navigateur
    location.reload();         // abandonne les modifications non publiées
    return;
  }
  editing = false;
  $("editor").hidden = true;
  render();
}

// ---------- Image du personnage ----------

async function editImage() {
  if (!editing) openPanel();
  await panelReady;
  const perso = currentPerso();
  if (!perso) return;
  if (!panel.isConnected()) {
    panel.setStatus("Connecte-toi à GitHub ci-dessus pour pouvoir changer l'image.", "err");
    $("editor").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const slug = slugify(perso.name);
  // on réutilise les chemins existants (le nom a pu changer depuis), sinon on en crée
  const portraitPath = perso.image ? perso.image.split("?")[0] : `images/personnages/${mangaSlug}/${slug}.jpg`;
  const sourcePath = perso.imageSource ? perso.imageSource.split("?")[0] : `images/personnages/${mangaSlug}/originaux/${slug}.jpg`;
  openImageEditor({
    title: `Image de ${perso.name}`,
    current: perso.image || null,
    source: perso.imageSource || null,
    crop: perso.imageCrop || null,
    onError: (err) => panel.setStatus(`L'image n'a pas pu être envoyée : ${err.message}`, "err"),
    onSave: async ({ cropped, crop, newSource }) => {
      panel.setStatus("Envoi de l'image sur GitHub…");
      const v = Date.now(); // ?v= force les navigateurs à recharger les images même si le nom de fichier ne change pas
      if (newSource) {
        await panel.putFile(sourcePath, newSource, `Image complète de ${perso.name} depuis l'outil`);
        perso.imageSource = `${sourcePath}?v=${v}`;
      }
      await panel.putFile(portraitPath, cropped, `Portrait de ${perso.name} depuis l'outil`);
      perso.image = `${portraitPath}?v=${v}`;
      perso.imageCrop = crop;
      panel.markDirty();
      render();
      panel.setStatus("Image envoyée sur GitHub. Clique sur « Publier » pour enregistrer le changement sur la fiche.", "dirty");
    },
    onRemove: () => {
      delete perso.image;
      delete perso.imageSource;
      delete perso.imageCrop;
      panel.markDirty();
      render();
    },
  });
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const { act, cat, value } = btn.dataset;
  if (act === "edit-image") editImage();
  if (act === "close-edit") closePanel();
  if (act === "edit-tags") openPanel();
  if (act === "remove-tag") removeTag(cat, value);
  if (act === "rename-tag") renameTag(cat, value);
});

document.addEventListener("change", (e) => {
  const sel = e.target.closest("select[data-act]");
  if (!sel) return;
  const { act, cat, value } = sel.dataset;
  if (act === "rarity") setRarity(cat, value, Number(sel.value));
  if (act === "add-tag" && sel.value) addTag(cat, sel.value);
});

// ---------- Démarrage ----------

(async () => {
  try {
    data = await loadData();
  } catch (e) {
    $("head").appendChild(emptyBlock("⚠️", "Erreur de chargement", e.message));
    return;
  }
  render();
})();
