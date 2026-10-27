// ---------------------------------------------------------------------------
// Wiki do Universo — service worker (PWA).
// Carregado pelo sw.js da raiz (veja o comentário lá). Guarda as páginas,
// estilos, scripts e imagens para o site funcionar offline e abrir mais
// rápido. Os caminhos "./" abaixo são relativos à raiz do site. Ao publicar mudanças, aumente VERSAO para que os
// visitantes recebam os arquivos novos (o cache antigo é apagado).
// ---------------------------------------------------------------------------

const VERSAO = "v2";
const CACHE = `wiki-do-universo-${VERSAO}`;

// Arquivos baixados já na instalação (o som ambiente fica de fora: é grande
// e só é baixado se a pessoa ligar o som).
const ARQUIVOS_ESSENCIAIS = [
  "./",
  "./constelacoes.html",
  "./curiosidades.html",
  "./index.html",
  "./jupiter.html",
  "./linha-do-tempo.html",
  "./marte.html",
  "./mercurio.html",
  "./netuno.html",
  "./pagina-de-contato.html",
  "./saturno.html",
  "./sobre.html",
  "./sol.html",
  "./terra.html",
  "./universo.html",
  "./urano.html",
  "./venus.html",
  "./via-lactea.html",
  "./viagem-da-luz.html",
  "./pwa/manifest.webmanifest",
  "./css/base.css",
  "./css/componentes.css",
  "./css/extras.css",
  "./css/layout.css",
  "./css/paginas.css",
  "./js/app.js",
  "./js/constelacoes.js",
  "./js/dados.js",
  "./js/extras.js",
  "./js/estrelas.js",
  "./js/viagem-da-luz.js",
  "./img/extras/brilho.png",
  "./img/extras/eu.jpg",
  "./img/icones/apple-touch-icon.png",
  "./img/icones/favicon.svg",
  "./img/icones/icone-192.png",
  "./img/icones/icone-512.png",
  "./img/icones/icone-maskable-512.png",
  "./img/planetas/jupiter-mancha-vermelha.webp",
  "./img/planetas/jupiter.webp",
  "./img/planetas/marte-monte-olimpo.webp",
  "./img/planetas/marte.webp",
  "./img/planetas/mercurio-e-lua.webp",
  "./img/planetas/mercurio.webp",
  "./img/planetas/netuno-aneis.webp",
  "./img/planetas/netuno.webp",
  "./img/planetas/saturno-sem-aneis.webp",
  "./img/planetas/saturno-tita.webp",
  "./img/planetas/saturno.webp",
  "./img/planetas/sol-e-terra.webp",
  "./img/planetas/sol.webp",
  "./img/planetas/terra-paisagem.webp",
  "./img/planetas/terra.webp",
  "./img/planetas/urano-aneis.webp",
  "./img/planetas/urano.webp",
  "./img/planetas/venus-e-terra.webp",
  "./img/planetas/venus.webp",
  "./img/site/faixa-brilho.webp",
  "./img/site/fundo-cabecalho.webp",
  "./img/site/terra-vista-do-espaco.webp",
  "./img/universo/andromeda.webp",
  "./img/universo/buraco-negro-gargantua.webp",
  "./img/universo/ceu-estrelado.webp",
  "./img/universo/planetas-do-sistema-solar.webp",
  "./img/universo/velocidade-da-luz.webp",
  "./img/universo/via-lactea.webp",
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css",
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"
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
  const doBootstrap = url.hostname === "cdn.jsdelivr.net";

  // API da NASA, FormSubmit, áudio etc.: vão direto para a rede.
  if ((!doProprioSite && !doBootstrap) || request.destination === "audio") return;

  // Imagens e Bootstrap quase nunca mudam: saem direto do cache (rápido).
  if (request.destination === "image" || doBootstrap) {
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
