// Fiche d'un personnage : personnage.html?manga=<slug>&perso=<slug du nom>
// Bouton « Modifier les tags » : passe la fiche en mode édition (ajout/retrait de valeurs)
// avec le panneau GitHub (connexion, branche, publication) de github-panel.js.

const params = new URLSearchParams(location.search);
const mangaSlug = params.get("manga");
const persoSlug = params.get("perso");
const $ = (id) => document.getElementById(id);

let data = null;
let editing = false;
let panel = null;

function findPerso() {
  const manga = data && data.mangas[mangaSlug];
  if (!manga) return { manga: null, index: -1 };
  return { manga, index: manga.characters.findIndex((c) => slugify(c.name) === persoSlug) };
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
      <button type="button" class="edit-link link-btn" data-act="toggle-edit"></button>
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
  section.querySelector("[data-act=\"toggle-edit\"]").textContent = editing ? "✕ Fermer l'édition" : "✏️ Modifier les tags";
  head.appendChild(section);

  // Tags : un bloc par type de tag défini dans data.tags
  const box = document.createElement("section");
  box.className = "tags-box" + (editing ? " editing" : "");
  Object.entries(data.tags).forEach(([tagSlug, tag]) => {
    const values = (perso.tags && perso.tags[tagSlug]) || [];
    const row = document.createElement("div");
    row.className = "tag-row";
    row.dataset.tag = tagSlug;
    row.innerHTML = `<div class="tag-head"><h2 class="tag-label"></h2></div><div class="chips"></div>`;
    row.querySelector(".tag-label").textContent = tag.label;
    if (editing) {
      const actions = document.createElement("div");
      actions.className = "tag-actions";
      actions.innerHTML = `
        <button type="button" class="link-btn" data-act="cat-rename">✎ Renommer</button>
        <button type="button" class="link-btn" data-act="cat-values">☰ Valeurs proposées</button>
        <button type="button" class="link-btn danger-link" data-act="cat-delete">🗑 Supprimer</button>`;
      row.querySelector(".tag-head").appendChild(actions);
    }
    const chipsEl = row.querySelector(".chips");
    if (values.length === 0 && !editing) {
      chipsEl.innerHTML = `<span class="muted-small">Non renseigné</span>`;
    }
    values.forEach((v, vi) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.innerHTML = `<span></span>`;
      chip.querySelector("span").textContent = v;
      if (editing) {
        const x = document.createElement("button");
        x.type = "button";
        x.className = "chip-x";
        x.title = `Retirer « ${v} »`;
        x.dataset.act = "untag";
        x.dataset.vi = vi;
        x.textContent = "×";
        chip.appendChild(x);
      }
      chipsEl.appendChild(chip);
    });
    if (editing) {
      const input = document.createElement("input");
      input.className = "tool-input tag-add";
      input.placeholder = "+ ajouter un tag";
      input.setAttribute("list", "dl-tags");
      input.setAttribute("aria-label", `Ajouter : ${tag.label}`);
      input.addEventListener("focus", () => fillDatalist(tagSlug));
      chipsEl.appendChild(input);

      // Valeurs proposées de la catégorie pas encore mises : un clic pour les ajouter
      const planned = (tag.values || []).filter((v) => !values.some((x) => slugify(x) === slugify(v)));
      if (planned.length) {
        const sugg = document.createElement("div");
        sugg.className = "chips suggestions";
        planned.forEach((v) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "chip ghost";
          b.dataset.act = "quick-tag";
          b.dataset.value = v;
          b.textContent = `+ ${v}`;
          sugg.appendChild(b);
        });
        row.appendChild(sugg);
      }
    }
    box.appendChild(row);
  });
  if (editing) {
    const add = document.createElement("button");
    add.type = "button";
    add.className = "btn ghost small";
    add.dataset.act = "cat-new";
    add.textContent = "＋ Nouvelle catégorie de tags";
    add.style.justifySelf = "start";
    box.appendChild(add);
    const hint = document.createElement("p");
    hint.className = "muted-small";
    hint.style.margin = "0";
    hint.textContent = "Entrée pour ajouter. Les valeurs déjà utilisées sont proposées : réutilise-les pour que les mini-jeux puissent regrouper les personnages. Les catégories sont communes à tous les personnages et tous les mangas.";
    box.appendChild(hint);
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

function fillDatalist(tagSlug) {
  const dl = $("dl-tags");
  dl.innerHTML = "";
  knownTagValues(data, tagSlug).forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    dl.appendChild(opt);
  });
}

// ---------- Édition ----------

function currentPerso() {
  const { manga, index } = findPerso();
  return index === -1 ? null : manga.characters[index];
}

function addTag(tagSlug, raw) {
  const perso = currentPerso();
  const value = raw.trim();
  if (!perso || !value) return;
  perso.tags = perso.tags || {};
  const values = (perso.tags[tagSlug] = perso.tags[tagSlug] || []);
  // réutilise l'orthographe existante si la valeur existe déjà (ex. "epeiste" -> "Épéiste")
  const existing = knownTagValues(data, tagSlug).find((v) => slugify(v) === slugify(value));
  const finalValue = existing || value;
  if (!values.some((v) => slugify(v) === slugify(finalValue))) {
    values.push(finalValue);
    panel.markDirty();
  }
  render();
  const again = document.querySelector(`.tag-row[data-tag="${tagSlug}"] .tag-add`);
  if (again) again.focus();
}

function removeTag(tagSlug, vi) {
  const perso = currentPerso();
  if (!perso) return;
  const values = perso.tags[tagSlug];
  values.splice(vi, 1);
  if (values.length === 0) delete perso.tags[tagSlug];
  panel.markDirty();
  render();
}

// ---------- Catégories de tags (communes à tout le site) ----------

function parseValues(text) {
  const out = [];
  text.split(",").map((v) => v.trim()).filter(Boolean).forEach((v) => {
    if (!out.some((x) => slugify(x) === slugify(v))) out.push(v);
  });
  return out;
}

function newCategory() {
  const label = (prompt("Nom de la nouvelle catégorie de tags (ex. « Rôle », « Espèce ») :") || "").trim();
  if (!label) return;
  const slug = slugify(label);
  if (!slug) return;
  if (data.tags[slug]) {
    panel.setStatus(`La catégorie « ${data.tags[slug].label} » existe déjà.`, "err");
    return;
  }
  const values = parseValues(prompt(`Valeurs proposées pour « ${label} », séparées par des virgules (tu pourras en ajouter d'autres plus tard) :`) || "");
  data.tags[slug] = { label, values };
  panel.markDirty();
  render();
}

function renameCategory(slug) {
  const tag = data.tags[slug];
  const label = (prompt("Nouveau nom de la catégorie :", tag.label) || "").trim();
  if (!label || label === tag.label) return;
  tag.label = label; // l'identifiant (slug) ne change pas, les tags des personnages restent liés
  panel.markDirty();
  render();
}

function editCategoryValues(slug) {
  const tag = data.tags[slug];
  const text = prompt(
    `Valeurs proposées pour « ${tag.label} », séparées par des virgules.\n` +
    "(Retirer une valeur ici ne l'enlève pas des personnages qui l'ont déjà.)",
    (tag.values || []).join(", "));
  if (text === null) return;
  tag.values = parseValues(text);
  panel.markDirty();
  render();
}

function deleteCategory(slug) {
  const tag = data.tags[slug];
  let count = 0;
  Object.values(data.mangas).forEach((m) => m.characters.forEach((c) => { if (c.tags && c.tags[slug]) count++; }));
  if (!confirm(`Supprimer la catégorie « ${tag.label} » ?` +
      (count ? `\nElle sera retirée des ${count} personnage(s) qui l'utilisent, dans tous les mangas.` : ""))) return;
  delete data.tags[slug];
  Object.values(data.mangas).forEach((m) => m.characters.forEach((c) => { if (c.tags) delete c.tags[slug]; }));
  panel.markDirty();
  render();
}

// ---------- Image du personnage ----------

let panelReady = null; // promesse : le panneau GitHub a fini de charger les données

async function editImage() {
  if (!editing) toggleEdit();
  await panelReady;
  const perso = currentPerso();
  if (!perso) return;
  if (!panel.isConnected()) {
    panel.setStatus("Connecte-toi à GitHub ci-dessus pour pouvoir changer l'image.", "err");
    $("editor").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  openImageEditor({
    title: `Image de ${perso.name}`,
    current: perso.image || null,
    onSave: async (base64) => {
      const path = `images/personnages/${mangaSlug}/${slugify(perso.name)}.jpg`;
      await panel.putFile(path, base64, `Image de ${perso.name} depuis l'outil`);
      // ?v= force les navigateurs à recharger l'image même si le nom de fichier ne change pas
      perso.image = `${path}?v=${Date.now()}`;
      panel.markDirty();
      render();
      panel.setStatus("Image envoyée sur GitHub. Clique sur « Publier » pour enregistrer le changement sur la fiche.", "dirty");
    },
    onRemove: () => {
      delete perso.image;
      panel.markDirty();
      render();
    },
  });
}

function toggleEdit() {
  if (editing && panel && panel.isDirty() &&
      !confirm("Fermer l'édition sans publier ? Tes modifications seront perdues.")) return;
  editing = !editing;
  $("editor").hidden = !editing;
  if (editing && !panel) {
    panel = createGitHubPanel({
      mount: $("editor"),
      getData: () => data,
      onData: (d) => { data = d; render(); },
    });
    panelReady = panel.start(); // recharge la dernière version (GitHub si connecté)
  } else if (!editing && panel && panel.isDirty()) {
    location.reload(); // abandonne les modifications non publiées
    return;
  }
  render();
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  if (btn.dataset.act === "toggle-edit") toggleEdit();
  if (btn.dataset.act === "edit-image") { editImage(); return; }
  const row = btn.closest(".tag-row");
  const act = btn.dataset.act;
  if (act === "untag") removeTag(row.dataset.tag, Number(btn.dataset.vi));
  if (act === "quick-tag") addTag(row.dataset.tag, btn.dataset.value);
  if (act === "cat-new") newCategory();
  if (act === "cat-rename") renameCategory(row.dataset.tag);
  if (act === "cat-values") editCategoryValues(row.dataset.tag);
  if (act === "cat-delete") deleteCategory(row.dataset.tag);
});
$("tags").addEventListener("keydown", (e) => {
  if (!e.target.classList.contains("tag-add") || e.key !== "Enter") return;
  e.preventDefault();
  addTag(e.target.closest(".tag-row").dataset.tag, e.target.value);
});
$("tags").addEventListener("change", (e) => {
  if (!e.target.classList.contains("tag-add") || !e.target.value.trim()) return;
  addTag(e.target.closest(".tag-row").dataset.tag, e.target.value);
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
