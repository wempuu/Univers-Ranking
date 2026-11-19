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
    <img class="manga-head-cover" alt="">
    <div>
      <p class="eyebrow"></p>
      <h1></h1>
      <button type="button" class="edit-link link-btn" data-act="toggle-edit"></button>
    </div>`;
  section.querySelector("img").src = manga.cover;
  section.querySelector("img").alt = `Couverture de ${manga.title}`;
  section.querySelector(".eyebrow").textContent = manga.title;
  section.querySelector("h1").textContent = perso.name;
  section.querySelector("[data-act]").textContent = editing ? "✕ Fermer l'édition" : "✏️ Modifier les tags";
  head.appendChild(section);

  // Tags : un bloc par type de tag défini dans data.tags
  const box = document.createElement("section");
  box.className = "tags-box" + (editing ? " editing" : "");
  Object.entries(data.tags).forEach(([tagSlug, tag]) => {
    const values = (perso.tags && perso.tags[tagSlug]) || [];
    const row = document.createElement("div");
    row.className = "tag-row";
    row.dataset.tag = tagSlug;
    row.innerHTML = `<h2 class="tag-label"></h2><div class="chips"></div>`;
    row.querySelector(".tag-label").textContent = tag.label;
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
      input.placeholder = "+ ajouter une valeur";
      input.setAttribute("list", "dl-tags");
      input.setAttribute("aria-label", `Ajouter : ${tag.label}`);
      input.addEventListener("focus", () => fillDatalist(tagSlug));
      chipsEl.appendChild(input);
    }
    box.appendChild(row);
  });
  if (editing) {
    const hint = document.createElement("p");
    hint.className = "muted-small";
    hint.style.margin = "0";
    hint.textContent = "Entrée pour ajouter. Les valeurs déjà utilisées sont proposées : réutilise-les pour que les mini-jeux puissent regrouper les personnages.";
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
    panel.start(); // recharge la dernière version (GitHub si connecté)
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
  if (btn.dataset.act === "untag") removeTag(btn.closest(".tag-row").dataset.tag, Number(btn.dataset.vi));
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
