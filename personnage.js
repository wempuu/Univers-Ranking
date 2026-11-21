// Fiche d'un personnage : personnage.html?manga=<slug>&perso=<slug du nom>
// Les tags sont en lecture seule ici : ils se gèrent dans l'outil « Gérer les tags » (tags.html, lien depuis le Catalogue).
// Le crayon sur le portrait ouvre le panneau GitHub (github-panel.js) puis l'éditeur d'image (image-editor.js).

const params = new URLSearchParams(location.search);
const mangaSlug = params.get("manga");
const persoSlug = params.get("perso");
const $ = (id) => document.getElementById(id);

let data = null;
let editing = false;   // panneau GitHub ouvert (pour changer l'image)
let panel = null;
let panelReady = null; // promesse : le panneau GitHub a fini de charger les données

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
  head.appendChild(section);

  // Tags : un bloc par catégorie définie dans data.tags (lecture seule)
  const box = document.createElement("section");
  box.className = "tags-box";
  Object.entries(data.tags).forEach(([tagSlug, tag]) => {
    const values = (perso.tags && perso.tags[tagSlug]) || [];
    const row = document.createElement("div");
    row.className = "tag-row";
    row.innerHTML = `<h2 class="tag-label"></h2><div class="chips"></div>`;
    row.querySelector(".tag-label").textContent = tag.label;
    const chipsEl = row.querySelector(".chips");
    if (values.length === 0) chipsEl.innerHTML = `<span class="muted-small">Non renseigné</span>`;
    values.forEach((v) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = v;
      chipsEl.appendChild(chip);
    });
    box.appendChild(row);
  });
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

// ---------- Panneau GitHub (pour l'image) ----------

function openPanel() {
  editing = true;
  $("editor").hidden = false;
  if (!panel) {
    panel = createGitHubPanel({
      mount: $("editor"),
      getData: () => data,
      onData: (d) => { data = d; render(); },
    });
    panelReady = panel.start(); // recharge la dernière version (GitHub si connecté)
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
  if (btn.dataset.act === "edit-image") editImage();
  if (btn.dataset.act === "close-edit") closePanel();
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
