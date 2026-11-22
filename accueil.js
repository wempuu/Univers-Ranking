// ---------- Pages plein écran : scroller fait apparaître la page suivante ----------
// Chaque .fp-panel occupe l'écran. Molette, glissé tactile ou clavier : quand on est
// en bas d'une page on passe à la suivante (et en haut, à la précédente).
(function () {
  const panels = [...document.querySelectorAll(".fp-panel")];
  const dots = [...document.querySelectorAll("#fp-dots [data-go]")];
  if (!panels.length) return;
  const DURATION = 1100;
  let current = 0;
  let lockedUntil = 0;

  const scroller = (i) => panels[i].querySelector(".fp-scroll");
  const atTop = (el) => el.scrollTop <= 1;
  const atBottom = (el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 2;

  function render(instant) {
    if (instant) document.body.classList.add("fp-instant");
    panels.forEach((p, k) => {
      p.classList.toggle("is-active", k === current);
      p.classList.toggle("is-above", k < current);
      p.classList.toggle("is-below", k > current);
      p.inert = k !== current;
    });
    dots.forEach((d) => d.classList.toggle("on", Number(d.dataset.go) === current));
    if (instant) requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove("fp-instant")));
  }

  function goTo(i, instant) {
    if (i < 0 || i >= panels.length || i === current) return;
    current = i;
    lockedUntil = Date.now() + (instant ? 0 : DURATION + 200);
    const el = scroller(i);
    if (el) el.scrollTop = 0;
    render(instant);
    const hash = i === 0 ? "" : "#" + panels[i].id;
    if (location.hash !== hash) history.replaceState(null, "", location.pathname + location.search + hash);
  }

  const locked = () => Date.now() < lockedUntil;
  // Après un défilement interne, on attend un peu avant de changer de page
  // (sinon l'inertie du trackpad enchaîne directement sur la page suivante).
  let lastInnerScroll = 0;
  panels.forEach((p, k) => {
    const el = scroller(k);
    if (el) el.addEventListener("scroll", () => { lastInnerScroll = Date.now(); }, { passive: true });
  });

  function tryMove(dir) {
    if (locked() || Date.now() - lastInnerScroll < 350) return;
    const el = scroller(current);
    if (dir > 0 && (!el || atBottom(el))) goTo(current + 1);
    if (dir < 0 && (!el || atTop(el))) goTo(current - 1);
  }

  window.addEventListener("wheel", (e) => {
    if (e.ctrlKey || Math.abs(e.deltaY) < 4 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (locked()) { e.preventDefault(); return; }
    tryMove(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });

  let touchY = null, touchEdgeTop = false, touchEdgeBottom = false;
  window.addEventListener("touchstart", (e) => {
    const el = scroller(current);
    touchY = e.touches[0].clientY;
    touchEdgeTop = !el || atTop(el);
    touchEdgeBottom = !el || atBottom(el);
  }, { passive: true });
  window.addEventListener("touchend", (e) => {
    if (touchY === null) return;
    const dy = touchY - e.changedTouches[0].clientY;
    touchY = null;
    if (locked() || Math.abs(dy) < 60) return;
    if (dy > 0 && touchEdgeBottom) goTo(current + 1);
    if (dy < 0 && touchEdgeTop) goTo(current - 1);
  }, { passive: true });

  window.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea, select, [contenteditable]")) return;
    const down = ["ArrowDown", "PageDown", " "].includes(e.key);
    const up = ["ArrowUp", "PageUp"].includes(e.key);
    if (!down && !up) return;
    const el = scroller(current);
    if (down && el && !atBottom(el)) return; // laisse défiler la page
    if (up && el && !atTop(el)) return;
    e.preventDefault();
    tryMove(down ? 1 : -1);
  });

  document.querySelectorAll("[data-go]").forEach((b) => {
    b.addEventListener("click", () => goTo(Number(b.dataset.go)));
  });

  function fromHash(instant) {
    const i = panels.findIndex((p) => "#" + p.id === location.hash);
    goTo(i > 0 ? i : 0, instant);
  }
  window.addEventListener("hashchange", () => fromHash(false));
  render(true);
  fromHash(true);
  // Le navigateur peut faire défiler vers l'ancre #undercover au chargement : on repart du haut.
  window.addEventListener("load", () => { const el = scroller(current); if (el) el.scrollTop = 0; });
})();
