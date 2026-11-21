// Fenêtre « Changer l'image » d'un personnage : choisir un fichier, le recadrer en carré
// (glisser pour déplacer, curseur pour zoomer), puis renvoyer un JPEG 320×320 en base64.
//
//   openImageEditor({ title, current, onSave: async (base64) => {}, onRemove: () => {} })

const IMG_OUT = 320;

function openImageEditor({ title, current, onSave, onRemove }) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <h2 class="modal-title"></h2>
      <div class="cropper">
        <canvas width="${IMG_OUT}" height="${IMG_OUT}"></canvas>
        <div class="cropper-guides" aria-hidden="true"></div>
        <p class="cropper-empty muted-small">Choisis une image sur ton appareil.</p>
      </div>
      <label class="cropper-zoom" hidden>
        <span class="muted-small">Zoom</span>
        <input type="range" min="1" max="5" step="0.01" value="1">
      </label>
      <p class="muted-small cropper-hint" hidden>Fais glisser l'image pour centrer la tête dans le carré.</p>
      <p class="tool-status" data-r="msg"></p>
      <div class="tool-bar modal-actions">
        <button type="button" class="btn ghost" data-r="pick">📁 Choisir une image</button>
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

  let img = null;              // image en cours de recadrage
  let base = 1;                // échelle pour que l'image couvre tout le carré
  let ox = 0, oy = 0;          // position du coin haut-gauche de l'image dans le carré
  let busy = false;

  function setMsg(text, kind = "") {
    $m('[data-r="msg"]').textContent = text;
    $m('[data-r="msg"]').className = `tool-status ${kind}`;
  }

  function clamp() {
    const s = base * Number(zoom.value);
    const w = img.width * s, h = img.height * s;
    ox = Math.min(0, Math.max(IMG_OUT - w, ox));
    oy = Math.min(0, Math.max(IMG_OUT - h, oy));
  }

  function draw() {
    ctx.fillStyle = "#1f2142";
    ctx.fillRect(0, 0, IMG_OUT, IMG_OUT);
    if (!img) return;
    const s = base * Number(zoom.value);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, ox, oy, img.width * s, img.height * s);
  }

  // Aperçu de l'image actuelle
  if (current) {
    const preview = new Image();
    preview.onload = () => { ctx.drawImage(preview, 0, 0, IMG_OUT, IMG_OUT); $m(".cropper-empty").hidden = true; };
    preview.src = current;
  } else {
    draw();
  }

  function loadFile(file) {
    if (!file || !file.type.startsWith("image/")) { setMsg("Ce fichier n'est pas une image.", "err"); return; }
    const url = URL.createObjectURL(file);
    const pic = new Image();
    pic.onload = () => {
      img = pic;
      base = Math.max(IMG_OUT / img.width, IMG_OUT / img.height);
      zoom.value = 1;
      ox = (IMG_OUT - img.width * base) / 2;
      oy = (IMG_OUT - img.height * base) / 2;
      $m(".cropper-empty").hidden = true;
      $m(".cropper-zoom").hidden = false;
      $m(".cropper-hint").hidden = false;
      $m('[data-r="save"]').disabled = false;
      setMsg("");
      draw();
    };
    pic.onerror = () => setMsg("Impossible de lire cette image.", "err");
    pic.src = url;
  }

  // Zoom autour du centre du carré
  let lastZoom = 1;
  zoom.addEventListener("input", () => {
    if (!img) return;
    const k = Number(zoom.value) / lastZoom;
    ox = IMG_OUT / 2 - (IMG_OUT / 2 - ox) * k;
    oy = IMG_OUT / 2 - (IMG_OUT / 2 - oy) * k;
    lastZoom = Number(zoom.value);
    clamp();
    draw();
  });

  // Glisser pour déplacer (souris et tactile)
  let drag = null;
  canvas.addEventListener("pointerdown", (e) => {
    if (!img) return;
    drag = { x: e.clientX, y: e.clientY, ox, oy, ratio: IMG_OUT / canvas.getBoundingClientRect().width };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    ox = drag.ox + (e.clientX - drag.x) * drag.ratio;
    oy = drag.oy + (e.clientY - drag.y) * drag.ratio;
    clamp();
    draw();
  });
  canvas.addEventListener("pointerup", () => { drag = null; });
  canvas.addEventListener("pointercancel", () => { drag = null; });

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
  $m('[data-r="save"]').addEventListener("click", async () => {
    if (!img || busy) return;
    busy = true;
    overlay.querySelectorAll("button").forEach((b) => (b.disabled = true));
    setMsg("Envoi de l'image sur GitHub…");
    try {
      const base64 = canvas.toDataURL("image/jpeg", 0.88).split(",")[1];
      await onSave(base64);
      close();
    } catch (err) {
      busy = false;
      overlay.querySelectorAll("button").forEach((b) => (b.disabled = false));
      setMsg(err.message, "err");
    }
  });

  return { loadFile, close }; // exposé pour les tests
}
