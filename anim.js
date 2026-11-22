// Animations communes à toutes les pages (chargé dans <head>, après style.css) :
// - clic sur n'importe quel bouton ou lien : petit enfoncement + balayage de couleur ;
// - bouton ou lien qui mène à une autre page du site : volet orange puis noir qui recouvre l'écran,
//   et la page suivante se dévoile en le faisant remonter (comme le passage accueil → Undercover).
(function () {
  const root = document.documentElement;
  const KEY = "ur-wipe";
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Arrivée : si la page précédente est partie avec le volet, il couvre déjà l'écran.
  let arriving = false;
  try { arriving = sessionStorage.getItem(KEY) === "1"; sessionStorage.removeItem(KEY); } catch (e) {}
  if (arriving && !reduced()) {
    root.classList.add("wipe-in");
    const go = () => {
      requestAnimationFrame(() => root.classList.add("wipe-go"));
      setTimeout(() => root.classList.remove("wipe-in", "wipe-go"), 1000);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go);
    else go();
  }

  // Départ vers une autre page avec le volet. Utilisable aussi depuis le code des pages.
  let leaving = false;
  let gone = false;
  window.addEventListener("pagehide", () => { gone = true; });
  window.leavePage = function (url) {
    if (reduced()) { location.href = url; return; }
    if (leaving) return;
    leaving = true;
    try { sessionStorage.setItem(KEY, "1"); } catch (e) {}
    root.classList.add("wipe-out");
    setTimeout(() => {
      location.href = url;
      // Départ annulé (ex. « Quitter la page ? » refusé) : on enlève le volet.
      setTimeout(() => {
        if (gone) return;
        leaving = false;
        root.classList.remove("wipe-out");
        try { sessionStorage.removeItem(KEY); } catch (e) {}
      }, 4000);
    }, 650);
  };
  // Retour arrière (page restaurée depuis le cache) : on enlève le volet.
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) { leaving = false; gone = false; root.classList.remove("wipe-out", "wipe-in", "wipe-go"); }
  });

  // Tout ce qui se clique : boutons et liens (menu, logo, cartes des mangas, persos…),
  // y compris ceux ajoutés plus tard ou créés par le JavaScript des pages (délégation sur document).
  const BUTTONS = "a[href], button, .btn, [role='button'], input[type='submit'], input[type='button']";

  function press(el, e) {
    if (reduced() || el.disabled) return;
    if (el.animate) {
      // Les grandes cartes s'enfoncent moins que les petits boutons
      const s = el.offsetWidth > 260 ? "0.975" : "0.94";
      el.animate([{ scale: "1" }, { scale: s }, { scale: "1" }], { duration: 320, easing: "cubic-bezier(.2,.7,.2,1)" });
    }
    if (el.tagName === "INPUT") return; // pas d'enfant possible
    const cs = getComputedStyle(el);
    const host = ["press-host"];
    if (cs.position === "static") host.push("press-rel");
    el.classList.add(...host);
    const wave = document.createElement("span");
    wave.className = "press-wave";
    wave.setAttribute("aria-hidden", "true");
    // Le balayage part du côté où l'on a cliqué
    const r = el.getBoundingClientRect();
    const fromRight = e && e.clientX && e.clientX > r.left + r.width / 2;
    el.appendChild(wave);
    const start = fromRight ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)";
    const anim = wave.animate([
      { clipPath: start, opacity: 0.35 },
      { clipPath: "inset(0 0 0 0)", opacity: 0.3, offset: 0.55 },
      { clipPath: "inset(0 0 0 0)", opacity: 0 },
    ], { duration: 560, easing: "cubic-bezier(.77,0,.18,1)" });
    anim.onfinish = () => { wave.remove(); if (!el.querySelector(".press-wave")) el.classList.remove("press-host", "press-rel"); };
  }

  document.addEventListener("click", (e) => {
    const el = e.target.closest(BUTTONS);
    if (!el) return;
    press(el, e);

    // Lien vers une autre page du site : on joue le volet avant de partir.
    if (el.tagName !== "A" || el.hasAttribute("download") || el.hasAttribute("data-no-wipe") || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (el.target && el.target !== "_self") return;
    const url = new URL(el.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.search === location.search) return; // simple ancre
    e.preventDefault();
    window.leavePage(url.href);
  });
})();
