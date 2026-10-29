// ---------------------------------------------------------------------------
// Explorador do Universo — service worker (PWA).
// Carregado pelo sw.js da raiz (veja o comentário lá). Guarda as páginas,
// estilos, scripts e imagens para o site funcionar offline e abrir mais
// rápido. Os caminhos "./" abaixo são relativos à raiz do site. Ao publicar mudanças, aumente VERSAO para que os
// visitantes recebam os arquivos novos (o cache antigo é apagado).
// ---------------------------------------------------------------------------

const VERSAO = "v7";
const CACHE = `explorador-do-universo-${VERSAO}`;

// Arquivos baixados já na instalação. As texturas dos outros planetas são
// guardadas na primeira vez que aparecem (veja o "fetch" abaixo).
const ARQUIVOS_ESSENCIAIS = [
  "./",
  "./index.html",
  "./explorador.html",
  "./diario.html",
  "./sobre.html",
  "./comparar.html",
  "./pwa/manifest.webmanifest",
  "./css/base.css",
  "./css/site.css",
  "./css/explorador.css",
  "./css/diario.css",
  "./css/comparar.css",
  "./js/site.js",
  "./js/diario.js",
  "./js/comparar.js",
  "./js/explorador/astronomia.js",
  "./js/explorador/catalogo.js",
  "./js/explorador/cenas.js",
  "./js/explorador/main.js",
  "./js/explorador/progresso.js",
  "./js/explorador/astros3d.js",
  "./js/explorador/galaxias3d.js",
  "./js/explorador/cinturao3d.js",
  "./img/icones/apple-touch-icon.png",
  "./img/icones/favicon.svg",
  "./img/icones/icone-192.png",
  "./img/icones/icone-512.png",
  "./img/icones/icone-maskable-512.png",
  "./img/planetas/sol.webp",
  "./img/planetas/mercurio.webp",
  "./img/planetas/venus.webp",
  "./img/planetas/terra.webp",
  "./img/planetas/marte.webp",
  "./img/planetas/jupiter.webp",
  "./img/planetas/saturno.webp",
  "./img/planetas/urano.webp",
  "./img/planetas/netuno.webp",
  "./img/planetas/lua.webp",
  "./img/texturas/sol.webp",
  "./img/texturas/terra.webp",
  "./img/texturas/terra-noite.webp",
  "./img/texturas/terra-nuvens.webp",
  "./img/texturas/terra-oceano.webp",
  "./img/universo/andromeda.webp",
  "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ARQUIVOS_ESSENCIAIS))
      .then(() => self.skipWaiting())
  );
});

// Apaga caches de versões antigas.
self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((nome) => nome !== CACHE).map((nome) => caches.delete(nome))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evento) => {
  const { request } = evento;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const doProprioSite = url.origin === self.location.origin;
  const daCdn = url.hostname === "cdn.jsdelivr.net"; // Three.js (versão fixa)

  // Outros sites vão direto para a rede.
  if (!doProprioSite && !daCdn) return;

  // Imagens e bibliotecas da CDN quase nunca mudam: saem direto do cache (rápido).
  if (request.destination === "image" || daCdn) {
    evento.respondWith(
      caches.match(request).then((salva) => salva || buscarEGuardar(request))
    );
    return;
  }

  // Páginas, estilos e scripts: tenta a rede primeiro, para sempre pegar a
  // versão mais nova do site, e usa o cache quando estiver offline.
  evento.respondWith(
    buscarEGuardar(request).catch(() =>
      caches.match(request, { ignoreSearch: true }).then((salva) => {
        if (salva) return salva;
        if (request.mode === "navigate") return caches.match("./index.html");
        return Response.error();
      })
    )
  );
});

function buscarEGuardar(request) {
  return fetch(request).then((resposta) => {
    if (resposta.ok) {
      const copia = resposta.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copia));
    }
    return resposta;
  });
}
