// Explorador do Universo — registra o service worker (app instalável e offline).
// Só funciona com o site servido por http(s), como no GitHub Pages.
if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // Sem service worker o site continua funcionando, só não offline.
    });
  });
}
