// Fenêtre « Changer l'image » d'un personnage.
// Elle ouvre l'image COMPLÈTE (imageSource) avec le cadrage actuel (imageCrop) : on peut zoomer
// (curseur, boutons − / +, molette) et déplacer le cadre en cliquant-glissant, ou choisir une autre image.
// Résultat : un portrait JPEG 320×320 + le cadrage { x, y, w } en fractions de l'image complète.
//
//   openImageEditor({ title, current, source, crop, onSave: async ({ cropped, crop, newSource }) => {}, onError: (err) => {}, onRemove })
//   La fenêtre se ferme dès « Valider » ; onSave fait l'envoi ensuite, onError reçoit son éventuelle erreur.
//   - cropped   : portrait en base64
//   - crop      : { x, y, w } (x, y = coin haut-gauche en fractions de la largeur / hauteur ; w = côté en fraction de la largeur)
//   - newSource : image complète en base64 si elle a changé (nouveau fichier), sinon null

const IMG_OUT = 320;     // taille du portrait exporté
const SRC_MAX = 1400;    // taille max de l'image complète enregistrée
const ZOOM_MAX = 12;

function openImageEditor({ title, current, source, crop, onSave, onError, onRemove }) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <h2 class="modal-title"></h2>
      <div class="cropper">
        <canvas width="${IMG_OUT}" height="${IMG_OUT}"></canvas>
        <div class="cropper-guides" aria-hidden="true"></div>
        <p class="cropper-empty muted-small">Chargement de l'image…</p>
      </div>
      <div class="cropper-zoom">
        <button type="button" class="icon-btn" data-r="zoom-out" title="Dézoomer">−</button>
        <input type="range" min="1" max="${ZOOM_MAX}" step="0.01" value="1" aria-label="Zoom">
        <button type="button" class="icon-btn" data-r="zoom-in" title="Zoomer">+</button>
      </div>
      <p class="muted-small cropper-hint">Clique et maintiens pour déplacer l'image ; zoome avec le curseur ou la molette. Place la tête au centre du carré.</p>
      <p class="tool-status" data-r="msg"></p>
      <div class="tool-bar modal-actions">
        <button type="button" class="btn ghost" data-r="pick">📁 Choisir une autre image</button>
        <button type="button" class="btn" data-r="save" disabled>✓ Valider</button>
        <button type="button" class="btn ghost" data-r="remove">Retirer l'image</button>
        <button type="button" class="btn ghost" data-r="cancel">Annuler</button>
      </div>
      <input type="file" accept="image/*" hidden>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector(".modal-title").textContent = title;
  const $m = (sel) => overlay.querySelector(sel);
  const canvas = $m("canvas");
  const ctx = canvas.getContext("2d");
  const zoom = $m('input[type="range"]');
  const fileInput = $m('input[type="file"]');
  if (!current) $m('[data-r="remove"]').hidden = true;

  let img = null;            // image complète en cours de cadrage
  let isNewSource = false;   // vrai si l'image complète doit être (ré)enregistrée
  let base = 1;              // échelle minimale : l'image couvre tout le carré
  let ox = 0, oy = 0;        // position du coin haut-gauche de l'image dans le carré (px)
  let busy = false;

  const scale = () => base * Number(zoom.value);

  function setMsg(text, kind = "") {
    $m('[data-r="msg"]').textContent = text;
    $m('[data-r="msg"]').className = `tool-status ${kind}`;
  }

  function clamp() {
    const s = scale();
    ox = Math.min(0, Math.max(IMG_OUT - img.width * s, ox));
    oy = Math.min(0, Math.max(IMG_OUT - img.height * s, oy));
  }

  function draw() {
    ctx.fillStyle = "#1f2142";
    ctx.fillRect(0, 0, IMG_OUT, IMG_OUT);
    if (!img) return;
    ctx.imageSmoothingQuality = "high";
    const s = scale();
    ctx.drawImage(img, ox, oy, img.width * s, img.height * s);
  }

  // Zoom en gardant fixe le point (px, py) du carré (par défaut le centre)
  function setZoom(value, px = IMG_OUT / 2, py = IMG_OUT / 2) {
    if (!img) return;
    const before = scale();
    zoom.value = Math.min(ZOOM_MAX, Math.max(1, value));
    const k = scale() / before;
    ox = px - (px - ox) * k;
    oy = py - (py - oy) * k;
    clamp();
    draw();
  }

  // Met l'image en place ; `c` = cadrage { x, y, w } à restaurer, sinon image centrée en entier
  function useImage(pic, c, fresh) {
    img = pic;
    isNewSource = fresh;
    base = Math.max(IMG_OUT / img.width, IMG_OUT / img.height);
    if (c && c.w > 0) {
      const s = IMG_OUT / (c.w * img.width);
      zoom.value = Math.min(ZOOM_MAX, Math.max(1, s / base));
      ox = -c.x * img.width * scale();
      oy = -c.y * img.height * scale();
    } else {
      zoom.value = 1;
      ox = (IMG_OUT - img.width * base) / 2;
      oy = (IMG_OUT - img.height * base) / 2;
    }
    clamp();
    $m(".cropper-empty").hidden = true;
    $m('[data-r="save"]').disabled = false;
    setMsg("");
    draw();
  }

  function loadUrl(url) {
    return new Promise((resolve, reject) => {
      const pic = new Image();
      pic.onload = () => resolve(pic);
      pic.onerror = reject;
      pic.src = url;
    });
  }

  // Ouverture : image complète + cadrage enregistrés ; à défaut, le portrait actuel (qu'on pourra recadrer)
  (async () => {
    try {
      if (source) { useImage(await loadUrl(source), crop, false); return; }
    } catch (e) { /* original introuvable : on se rabat sur le portrait */ }
    try {
      if (current) {
        useImage(await loadUrl(current), null, true);
        setMsg("Image complète introuvable : tu recadres le portrait actuel. Choisis une autre image pour plus de marge.");
        return;
      }
    } catch (e) { /* rien à afficher */ }
    $m(".cropper-empty").textContent = "Choisis une image sur ton appareil.";
  })();

  async function loadFile(file) {
    if (!file || !file.type.startsWith("image/")) { setMsg("Ce fichier n'est pas une image.", "err"); return; }
    const url = URL.createObjectURL(file);
    try {
      useImage(await loadUrl(url), null, true);
    } catch (e) {
      setMsg("Impossible de lire cette image.", "err");
    }
  }

  // ----- Zoom : curseur, boutons, molette -----
  let lastZoom = Number(zoom.value);
  zoom.addEventListener("input", () => {
    if (!img) return;
    const target = Number(zoom.value);
    zoom.value = lastZoom;
    setZoom(target);
    lastZoom = Number(zoom.value);
  });
  const step = (f) => { setZoom(Number(zoom.value) * f); lastZoom = Number(zoom.value); };
  $m('[data-r="zoom-in"]').addEventListener("click", () => step(1.2));
  $m('[data-r="zoom-out"]').addEventListener("click", () => step(1 / 1.2));
  canvas.addEventListener("wheel", (e) => {
    if (!img) return;
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const k = IMG_OUT / r.width;
    setZoom(Number(zoom.value) * (e.deltaY < 0 ? 1.1 : 1 / 1.1), (e.clientX - r.left) * k, (e.clientY - r.top) * k);
    lastZoom = Number(zoom.value);
  }, { passive: false });

  // ----- Glisser pour déplacer (souris et tactile) -----
  let drag = null;
  canvas.addEventListener("pointerdown", (e) => {
    if (!img) return;
    drag = { x: e.clientX, y: e.clientY, ox, oy, ratio: IMG_OUT / canvas.getBoundingClientRect().width };
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("dragging");
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    ox = drag.ox + (e.clientX - drag.x) * drag.ratio;
    oy = drag.oy + (e.clientY - drag.y) * drag.ratio;
    clamp();
    draw();
  });
  const endDrag = () => { drag = null; canvas.classList.remove("dragging"); };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  // ----- Boutons -----
  function close() {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
  }
  function onKey(e) { if (e.key === "Escape" && !busy) close(); }
  document.addEventListener("keydown", onKey);

  $m('[data-r="pick"]').addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => loadFile(fileInput.files[0]));
  $m('[data-r="cancel"]').addEventListener("click", () => { if (!busy) close(); });
  overlay.addEventListener("click", (e) => { if (e.target === overlay && !busy) close(); });
  $m('[data-r="remove"]').addEventListener("click", async () => {
    // la fenêtre de confirmation s'ouvre par-dessus ; on masque le recadrage le temps de répondre
    overlay.hidden = true;
    const ok = await askConfirm("Retirer l'image de ce personnage ? (ses initiales s'afficheront à la place)", { okLabel: "Retirer", danger: true });
    overlay.hidden = false;
    if (!ok) return;
    onRemove();
    close();
  });

  // Image complète réduite (côté max SRC_MAX) en JPEG base64
  function sourceToBase64() {
    const k = Math.min(1, SRC_MAX / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    const g = c.getContext("2d");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85).split(",")[1];
  }

  // Valider : on prépare les images, on ferme tout de suite la fenêtre, et l'envoi continue en arrière-plan
  // (sa progression et ses erreurs s'affichent dans la page via onSave / onError).
  $m('[data-r="save"]').addEventListener("click", async () => {
    if (!img || busy) return;
    busy = true;
    const s = scale();
    const result = {
      cropped: canvas.toDataURL("image/jpeg", 0.88).split(",")[1],
      crop: {
        x: +(-ox / (img.width * s)).toFixed(5),
        y: +(-oy / (img.height * s)).toFixed(5),
        w: +(IMG_OUT / (img.width * s)).toFixed(5),
      },
      newSource: isNewSource ? sourceToBase64() : null,
    };
    close();
    try {
      await onSave(result);
    } catch (err) {
      if (onError) onError(err);
    }
  });

  return { loadFile, close, state: () => ({ zoom: Number(zoom.value), ox, oy, hasImage: !!img, isNewSource }) }; // exposé pour les tests
}
