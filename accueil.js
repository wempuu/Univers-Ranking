// Accueil : créer un groupe (code généré) ou en rejoindre un avec un code.

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O ni 1/I/L, pour éviter les confusions

function newCode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

function savePseudo(name) {
  try { localStorage.setItem("ur-pseudo", name); } catch (e) {}
}
function loadPseudo() {
  try { return localStorage.getItem("ur-pseudo") || ""; } catch (e) { return ""; }
}

const pseudo = loadPseudo();
document.getElementById("pseudo-create").value = pseudo;
document.getElementById("pseudo-join").value = pseudo;

document.getElementById("form-create").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("pseudo-create").value.trim();
  if (!name) return;
  savePseudo(name);
  location.href = `groupe.html?code=${newCode()}&hote=1`;
});

const codeInput = document.getElementById("join-code");
codeInput.addEventListener("input", () => {
  codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
});

document.getElementById("form-join").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("pseudo-join").value.trim();
  const code = codeInput.value.trim();
  if (!name) return;
  if (code.length !== 6) { codeInput.setCustomValidity("Le code fait 6 caractères."); codeInput.reportValidity(); return; }
  codeInput.setCustomValidity("");
  savePseudo(name);
  location.href = `groupe.html?code=${code}`;
});
