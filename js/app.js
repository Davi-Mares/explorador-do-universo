// ---------------------------------------------------------------------------
// Wiki do Universo — comportamento compartilhado por todas as páginas.
// Monta navbar e rodapé, os cards e o Sistema Solar animado da página
// inicial, a foto do dia da NASA, a navegação e a ficha técnica dos planetas,
// a busca, o botão de voltar ao topo, o som ambiente e o formulário.
// Os dados usados aqui ficam em dados.js.
// ---------------------------------------------------------------------------

const PAGINA_ATUAL = window.location.pathname.split("/").pop() || "index.html";

// ---------------------------------------------------------------------------
// Navbar e rodapé — montados aqui para não repetir o mesmo HTML em 15 páginas.
// ---------------------------------------------------------------------------

function montarNavbar() {
  const alvo = document.getElementById("app-navbar");
  if (!alvo) return;

  const itens = NAVEGACAO_PRINCIPAL.map((item) => {
    const ativo = item.paginas.includes(PAGINA_ATUAL);

    if (item.submenu) {
      const subitens = item.submenu.map((sub) => {
        const atual = sub.pagina === PAGINA_ATUAL;
        return `<li><a class="dropdown-item${atual ? " active" : ""}" href="${sub.pagina}"${atual ? ' aria-current="page"' : ""}>${sub.nome}</a></li>`;
      }).join("");

      return `
      <li class="nav-item dropdown">
        <button type="button" class="nav-link dropdown-toggle${ativo ? " active" : ""}" data-bs-toggle="dropdown" aria-expanded="false">${item.rotulo}</button>
        <ul class="dropdown-menu dropdown-menu-end">${subitens}</ul>
      </li>`;
    }

    return `
      <li class="nav-item">
        <a class="nav-link${ativo ? " active" : ""}" href="${item.href}"${ativo ? ' aria-current="page"' : ""}>${item.rotulo}</a>
      </li>`;
  }).join("");

  alvo.outerHTML = `
    <a href="#conteudo" class="skip-link">Pular para o conteúdo principal</a>
    <header class="site-header sticky-top">
      <nav class="navbar navbar-expand-lg" aria-label="Navegação principal">
        <div class="container-fluid">
          <a class="navbar-brand logo-rgb" href="index.html">🌌 Wiki do Universo</a>
          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#menu-principal"
                  aria-controls="menu-principal" aria-expanded="false" aria-label="Alternar navegação">
            <span class="navbar-toggler-icon"></span>
          </button>
          <div class="collapse navbar-collapse" id="menu-principal">
            <ul class="navbar-nav ms-auto">
              ${itens}
              <li class="nav-item">
                <button type="button" class="nav-link botao-busca" data-abrir-busca aria-label="Buscar no site (atalho: /)">
                  <span aria-hidden="true">🔍</span><span class="botao-busca-rotulo">Buscar</span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      </nav>
    </header>
  `;
}

function montarRodape() {
  const alvo = document.getElementById("app-footer");
  if (!alvo) return;

  alvo.outerHTML = `
    <footer class="site-footer">
      <p>Projeto de Desenvolvimento Web — UNEMAT</p>
    </footer>
  `;
}

// ---------------------------------------------------------------------------
// Cards da página inicial — cada elemento [data-cards="grupo"] recebe os
// cards do grupo correspondente em GRUPOS_DE_CARDS.
// ---------------------------------------------------------------------------

function criarCard(item) {
  const foto = item.imagem
    ? `<div class="planeta-foto-wrap"><img src="${item.imagem}" alt="" loading="lazy" class="planeta-foto"></div>`
    : "";

  return `
    <div class="col-12 col-sm-6 col-lg-4">
      <a href="${item.pagina}" class="card h-100">
        <div class="card-body">
          ${foto}
          <h3 class="card-title">${item.nome}</h3>
          <p class="card-text">${item.descricao}</p>
        </div>
      </a>
    </div>
  `;
}

function gerarCards() {
  document.querySelectorAll("[data-cards]").forEach((container) => {
    const itens = GRUPOS_DE_CARDS[container.dataset.cards] || [];
    container.innerHTML = itens.map(criarCard).join("");
  });
}

// ---------------------------------------------------------------------------
// Citação do dia — mostra uma citação aleatória e troca ao clicar no botão,
// sem repetir a que já está na tela.
// ---------------------------------------------------------------------------

function iniciarCitacoes() {
  const texto = document.getElementById("citacao");
  const botao = document.getElementById("botao-citacao");
  if (!texto) return;

  let indiceAtual = -1;

  function trocarCitacao() {
    let novoIndice;
    do {
      novoIndice = Math.floor(Math.random() * CITACOES.length);
    } while (novoIndice === indiceAtual && CITACOES.length > 1);

    indiceAtual = novoIndice;
    texto.textContent = CITACOES[indiceAtual];
  }

  trocarCitacao();
  botao?.addEventListener("click", trocarCitacao);
}

// ---------------------------------------------------------------------------
// Navegação entre planetas (sequência + anterior/próximo), inserida logo
// depois do cabeçalho de cada página de planeta.
// ---------------------------------------------------------------------------

function criarNavegacaoPlanetaria() {
  const cabecalho = document.querySelector(".page-header");
  const indiceAtual = CORPOS_CELESTES.findIndex((corpo) => corpo.pagina === PAGINA_ATUAL);
  if (!cabecalho || indiceAtual === -1) return;

  const anterior = CORPOS_CELESTES[indiceAtual - 1];
  const proximo = CORPOS_CELESTES[indiceAtual + 1];

  const itens = CORPOS_CELESTES.map((corpo, indice) => {
    const atual = indice === indiceAtual;
    return `<li${atual ? ' class="atual"' : ""}><a href="${corpo.pagina}"${atual ? ' aria-current="page"' : ""}>${corpo.nome}</a></li>`;
  }).join("");

  const navegacao = document.createElement("nav");
  navegacao.className = "navegacao-planetaria";
  navegacao.setAttribute("aria-label", "Navegação entre planetas");
  navegacao.innerHTML = `
    <span class="sequencia-titulo">Sequência a partir do Sol</span>
    <ol class="sequencia-planetas">${itens}</ol>
    <div class="controles-planetas">
      ${anterior ? `<a href="${anterior.pagina}">⬅️ ${anterior.nome}</a>` : "<span></span>"}
      ${proximo ? `<a href="${proximo.pagina}">${proximo.nome} ➡️</a>` : "<span></span>"}
    </div>
  `;

  cabecalho.insertAdjacentElement("afterend", navegacao);
}

// ---------------------------------------------------------------------------
// Botão de voltar ao topo — aparece depois de rolar 400px.
// ---------------------------------------------------------------------------

function criarBotaoTopo() {
  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "botao-flutuante btn-topo";
  botao.setAttribute("aria-label", "Voltar ao topo da página");
  botao.textContent = "⬆️";
  botao.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  document.body.appendChild(botao);

  const atualizar = () => botao.classList.toggle("visivel", window.scrollY > 400);
  window.addEventListener("scroll", atualizar, { passive: true });
  atualizar();
}

// ---------------------------------------------------------------------------
// Som ambiente — a preferência é lembrada entre páginas via localStorage.
// Navegadores podem bloquear a retomada automática do áudio sem interação
// recente; nesse caso o botão volta ao estado pausado e basta um clique.
// ---------------------------------------------------------------------------

const CHAVE_SOM_AMBIENTE = "wikiUniverso:somAtivo";

function lerPreferenciaSom() {
  try {
    return localStorage.getItem(CHAVE_SOM_AMBIENTE) === "1";
  } catch {
    return false;
  }
}

function salvarPreferenciaSom(ativo) {
  try {
    localStorage.setItem(CHAVE_SOM_AMBIENTE, ativo ? "1" : "0");
  } catch {
    // Sem armazenamento disponível (ex.: modo privado): só não lembra.
  }
}

function criarPlayerAmbiente() {
  const audio = new Audio("audio/som-ambiente-interestelar.mp3");
  audio.loop = true;
  audio.preload = "none";
  audio.volume = 0.35;

  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "botao-flutuante player-ambiente";
  botao.setAttribute("aria-pressed", "false");
  botao.innerHTML = '<span class="icone" aria-hidden="true">🔈</span><span class="rotulo">Som ambiente</span>';
  document.body.appendChild(botao);

  const icone = botao.querySelector(".icone");
  const rotulo = botao.querySelector(".rotulo");

  function atualizarBotao(tocando) {
    botao.setAttribute("aria-pressed", String(tocando));
    icone.textContent = tocando ? "🔊" : "🔈";
    rotulo.textContent = tocando ? "Pausar som" : "Som ambiente";
  }

  function tocar() {
    audio.play()
      .then(() => {
        salvarPreferenciaSom(true);
        atualizarBotao(true);
      })
      .catch(() => atualizarBotao(false));
  }

  botao.addEventListener("click", () => {
    if (audio.paused) {
      tocar();
    } else {
      audio.pause();
      salvarPreferenciaSom(false);
      atualizarBotao(false);
    }
  });

  if (lerPreferenciaSom()) tocar();
}

// ---------------------------------------------------------------------------
// Formulário de contato — validação no padrão do Bootstrap
// (.needs-validation) e envio por e-mail pelo FormSubmit.
// ---------------------------------------------------------------------------

function iniciarValidacaoFormularios() {
  document.querySelectorAll("form.needs-validation").forEach((formulario) => {
    formulario.addEventListener("submit", (evento) => {
      if (!formulario.checkValidity()) {
        evento.preventDefault();
        evento.stopPropagation();
      }
      formulario.classList.add("was-validated");
    });
  });
}

// Depois do envio, o FormSubmit volta para esta página com ?enviado=1.
function iniciarFormularioContato() {
  const formulario = document.getElementById("formulario-contato");
  if (!formulario) return;

  const destino = new URL(window.location.href);
  destino.search = "?enviado=1";
  destino.hash = "contato";
  formulario.querySelector('[name="_next"]').value = destino.href;

  if (new URLSearchParams(window.location.search).get("enviado") === "1") {
    document.getElementById("aviso-enviado").hidden = false;
  }
}

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

// Escapa texto vindo de fora (ex.: API da NASA) antes de pôr no HTML.
function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto ?? "";
  return div.innerHTML;
}

// "Saturno" e "saturno" e "satúrno" viram a mesma coisa para a busca.
function normalizar(texto) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// ---------------------------------------------------------------------------
// Ficha técnica — inserida logo depois da primeira imagem de cada página
// de astro, com os dados de CORPOS_CELESTES (dados.js).
// ---------------------------------------------------------------------------

function criarFichaTecnica() {
  const corpo = CORPOS_CELESTES.find((item) => item.pagina === PAGINA_ATUAL);
  const artigo = document.querySelector(".artigo");
  if (!corpo?.ficha || !artigo) return;

  const linhas = corpo.ficha
    .map(([rotulo, valor]) => `<div class="ficha-item"><dt>${rotulo}</dt><dd>${valor}</dd></div>`)
    .join("");

  const ficha = document.createElement("section");
  ficha.className = "ficha-tecnica";
  ficha.setAttribute("aria-labelledby", "titulo-ficha");
  ficha.innerHTML = `
    <h2 id="titulo-ficha">📋 Ficha técnica — ${corpo.nome}</h2>
    <dl class="ficha-grade">${linhas}</dl>
  `;

  const referencia = artigo.querySelector(".planet-img") || artigo.firstElementChild;
  referencia.insertAdjacentElement("afterend", ficha);
}

// ---------------------------------------------------------------------------
// Sistema Solar animado (página inicial) — cada planeta gira na sua órbita;
// passar o mouse ou focar um planeta pausa tudo e mostra o nome.
// ---------------------------------------------------------------------------

function criarSistemaAnimado() {
  const area = document.querySelector("[data-sistema-animado]");
  if (!area) return;

  const criarAstro = (corpo, classe = "") => `
    <a class="astro ${classe}" href="${corpo.pagina}" style="--tamanho: ${corpo.orbita.tamanho}">
      <img src="${corpo.orbita.imagem || corpo.imagem}" alt="" loading="lazy">
      <span class="astro-nome">${corpo.nome}</span>
    </a>`;

  const [sol, ...planetas] = CORPOS_CELESTES;

  const orbitas = planetas.map((planeta) => {
    const { diametro, periodo, angulo, aneis } = planeta.orbita;
    // Atraso negativo = a animação já começa "no meio", em ângulos diferentes.
    const atraso = -(angulo / 360) * periodo;
    return `
      <div class="orbita" style="--diametro: ${diametro}%; --periodo: ${periodo}s; --atraso: ${atraso.toFixed(2)}s; --angulo: ${angulo}deg">
        ${criarAstro(planeta, aneis ? "com-aneis" : "")}
      </div>`;
  }).join("");

  area.innerHTML = criarAstro(sol, "astro-sol") + orbitas;
}

// ---------------------------------------------------------------------------
// Foto do dia da NASA (APOD — Astronomy Picture of the Day).
// A resposta fica guardada no navegador até o dia seguinte, para não gastar
// pedidos à API a cada visita. Se a API falhar, tenta de novo e depois usa a
// última foto guardada.
// ---------------------------------------------------------------------------

// Chave gratuita: https://api.nasa.gov — a DEMO_KEY funciona, mas tem um
// limite baixo de pedidos por hora. Troque pela sua para não ter surpresas.
const NASA_API_KEY = "DEMO_KEY";
const CHAVE_CACHE_APOD = "wikiUniverso:apod";

function dataIso(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

// A API às vezes devolve um registro genérico ("NASA Science", sem mídia):
// só aceita respostas com título e alguma imagem ou vídeo de verdade.
function apodValida(dados) {
  if (!dados?.title || !dados?.date || dados.title.trim() === "NASA Science") return false;
  if (dados.media_type === "image") return /^https:\/\//.test(dados.url || "");
  return Boolean(dados.url || dados.thumbnail_url);
}

async function pedirApod(data) {
  const url = new URL("https://api.nasa.gov/planetary/apod");
  url.searchParams.set("api_key", NASA_API_KEY);
  url.searchParams.set("thumbs", "true");
  if (data) url.searchParams.set("date", data);

  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(`APOD respondeu ${resposta.status}`);

  const dados = await resposta.json();
  if (!apodValida(dados)) throw new Error("APOD sem foto válida");
  return dados;
}

async function carregarApod() {
  const hoje = dataIso(new Date());
  const ontem = dataIso(new Date(Date.now() - 24 * 60 * 60 * 1000));

  let cache = null;
  try {
    cache = JSON.parse(localStorage.getItem(CHAVE_CACHE_APOD));
  } catch {
    // Sem armazenamento: busca sempre na API.
  }
  if (!apodValida(cache?.dados)) cache = null;
  if (cache?.salvoEm === hoje) return { dados: cache.dados };

  // A API às vezes falha por instantes: tenta hoje, de novo, e então ontem
  // (a foto "de hoje" sai no fuso dos EUA e pode ainda não existir).
  const tentativas = [() => pedirApod(), () => pedirApod(), () => pedirApod(ontem)];
  for (const tentativa of tentativas) {
    try {
      const dados = await tentativa();
      try {
        localStorage.setItem(CHAVE_CACHE_APOD, JSON.stringify({ salvoEm: hoje, dados }));
      } catch {
        // Sem armazenamento: só não guarda.
      }
      return { dados };
    } catch {
      await new Promise((esperar) => setTimeout(esperar, 1200));
    }
  }

  if (cache?.dados) return { dados: cache.dados, antiga: true };
  throw new Error("APOD indisponível");
}

function montarApod(dados, antiga) {
  const data = new Date(`${dados.date}T12:00:00`);
  const dataFormatada = data.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
  // O site antigo (apod.nasa.gov) hoje redireciona para a NASA Science.
  const paginaNasa = "https://science.nasa.gov/apod/";
  const urlSegura = (url) => (/^https:\/\//.test(url || "") ? url : "");

  let midia;
  if (dados.media_type === "image") {
    const imagem = urlSegura(dados.url);
    const grande = urlSegura(dados.hdurl) || imagem;
    midia = `<a href="${grande}" target="_blank" rel="noopener noreferrer"><img src="${imagem}" alt="${escaparHtml(dados.title)}"></a>`;
  } else if (/youtube\.com\/embed|player\.vimeo\.com/.test(dados.url || "")) {
    midia = `<div class="ratio ratio-16x9"><iframe src="${urlSegura(dados.url)}" title="${escaparHtml(dados.title)}" loading="lazy" allowfullscreen></iframe></div>`;
  } else {
    const miniatura = urlSegura(dados.thumbnail_url);
    midia = miniatura
      ? `<a href="${paginaNasa}" target="_blank" rel="noopener noreferrer"><img src="${miniatura}" alt="${escaparHtml(dados.title)}"></a>`
      : `<a class="apod-sem-imagem" href="${paginaNasa}" target="_blank" rel="noopener noreferrer">▶️ Ver a mídia de hoje no site da NASA</a>`;
  }

  return `
    <figure class="apod-midia">${midia}</figure>
    <div class="apod-texto">
      ${antiga ? '<p class="apod-aviso">A NASA não respondeu agora; mostrando a última foto carregada.</p>' : ""}
      <p class="apod-data">${dataFormatada}</p>
      <h3>${escaparHtml(dados.title)}</h3>
      ${dados.copyright ? `<p class="apod-credito">© ${escaparHtml(dados.copyright.trim())}</p>` : '<p class="apod-credito">Imagem: NASA</p>'}
      <details>
        <summary>Ler a explicação (em inglês)</summary>
        <p>${escaparHtml(dados.explanation)}</p>
      </details>
      <a class="apod-link" href="${paginaNasa}" target="_blank" rel="noopener noreferrer">Ver no site da NASA ↗</a>
    </div>
  `;
}

function iniciarFotoDoDia() {
  const area = document.querySelector("[data-foto-do-dia]");
  if (!area) return;

  carregarApod()
    .then(({ dados, antiga }) => {
      area.innerHTML = montarApod(dados, antiga);
    })
    .catch(() => {
      area.innerHTML = `
        <p class="apod-erro">
          Não foi possível falar com a NASA agora. 🛰️<br>
          Veja a foto de hoje direto no <a href="https://science.nasa.gov/apod/" target="_blank" rel="noopener noreferrer">site do APOD</a>.
        </p>`;
    })
    .finally(() => area.setAttribute("aria-busy", "false"));
}

// ---------------------------------------------------------------------------
// Busca do menu — abre com o botão 🔍, com "/" ou com Ctrl+K. Procura no nome,
// na descrição e nas palavras-chave de ITENS_DA_BUSCA (dados.js), ignorando
// acentos. Setas escolhem o resultado, Enter abre, Esc fecha.
// ---------------------------------------------------------------------------

function pontuarResultado(item, termos) {
  const nome = normalizar(item.nome);
  const resto = normalizar(`${item.descricao} ${item.palavras || ""}`);
  let pontos = 0;

  for (const termo of termos) {
    if (nome.startsWith(termo)) pontos += 3;
    else if (nome.includes(termo)) pontos += 2;
    else if (resto.includes(termo)) pontos += 1;
    else return 0; // todo termo digitado precisa aparecer em algum lugar
  }
  return pontos;
}

function criarBusca() {
  const dialogo = document.createElement("dialog");
  dialogo.className = "dialogo-busca";
  dialogo.setAttribute("aria-label", "Buscar no site");
  dialogo.innerHTML = `
    <form class="busca-form" role="search">
      <span class="busca-icone" aria-hidden="true">🔍</span>
      <label for="campo-busca" class="visually-hidden">Buscar no site</label>
      <input id="campo-busca" type="text" enterkeyhint="search" autocomplete="off" spellcheck="false"
             placeholder="Planetas, galáxias, buracos negros…"
             role="combobox" aria-expanded="true" aria-controls="resultados-busca" aria-autocomplete="list">
      <button type="button" class="busca-fechar" aria-label="Fechar busca">Esc</button>
    </form>
    <ul id="resultados-busca" class="busca-resultados" role="listbox" aria-label="Resultados"></ul>
    <p class="busca-dica"><kbd>↑</kbd> <kbd>↓</kbd> escolher · <kbd>Enter</kbd> abrir · <kbd>Esc</kbd> fechar</p>
  `;
  document.body.appendChild(dialogo);

  const campo = dialogo.querySelector("#campo-busca");
  const lista = dialogo.querySelector("#resultados-busca");
  let resultados = [];
  let ativo = 0;

  function marcarAtivo(indice) {
    const opcoes = lista.querySelectorAll('[role="option"]');
    if (!opcoes.length) {
      campo.removeAttribute("aria-activedescendant");
      return;
    }
    ativo = (indice + opcoes.length) % opcoes.length;
    opcoes.forEach((opcao, i) => opcao.setAttribute("aria-selected", String(i === ativo)));
    campo.setAttribute("aria-activedescendant", opcoes[ativo].id);
    opcoes[ativo].scrollIntoView({ block: "nearest" });
  }

  function atualizarResultados() {
    const termos = normalizar(campo.value).split(/\s+/).filter(Boolean);

    resultados = termos.length
      ? ITENS_DA_BUSCA
          .map((item) => ({ item, pontos: pontuarResultado(item, termos) }))
          .filter((r) => r.pontos > 0)
          .sort((a, b) => b.pontos - a.pontos)
          .map((r) => r.item)
      : ITENS_DA_BUSCA;

    lista.innerHTML = resultados.length
      ? resultados.map((item, i) => `
          <li id="resultado-${i}" role="option" aria-selected="false">
            <a href="${item.pagina}" tabindex="-1">
              <strong>${item.nome}</strong>
              <span>${item.descricao}</span>
            </a>
          </li>`).join("")
      : '<li class="busca-vazia">Nada encontrado. Tente "anéis", "galáxia" ou "buraco negro".</li>';

    marcarAtivo(0);
  }

  function abrir() {
    if (dialogo.open) return;
    campo.value = "";
    atualizarResultados();
    dialogo.showModal();
    campo.focus();
  }

  campo.addEventListener("input", atualizarResultados);

  campo.addEventListener("keydown", (evento) => {
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      marcarAtivo(ativo + 1);
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      marcarAtivo(ativo - 1);
    } else if (evento.key === "Escape") {
      // Num campo de busca o Esc só limparia o texto; aqui ele fecha a caixa.
      evento.preventDefault();
      dialogo.close();
    }
  });

  dialogo.querySelector("form").addEventListener("submit", (evento) => {
    evento.preventDefault();
    const escolhido = resultados[ativo];
    if (!escolhido) return;
    dialogo.close();
    window.location.href = escolhido.pagina;
  });

  // Links para âncoras da própria página (ex.: #foto-do-dia) fecham a busca.
  lista.addEventListener("click", (evento) => {
    if (evento.target.closest("a")) dialogo.close();
  });

  dialogo.querySelector(".busca-fechar").addEventListener("click", () => dialogo.close());

  // Clique fora da caixa (no fundo escurecido) fecha.
  dialogo.addEventListener("click", (evento) => {
    if (evento.target === dialogo) dialogo.close();
  });

  document.querySelectorAll("[data-abrir-busca]").forEach((botao) => botao.addEventListener("click", abrir));

  document.addEventListener("keydown", (evento) => {
    const digitando = evento.target.closest("input, textarea, select, [contenteditable]");
    const atalhoCtrlK = evento.key.toLowerCase() === "k" && (evento.ctrlKey || evento.metaKey);
    if (atalhoCtrlK || (evento.key === "/" && !digitando)) {
      evento.preventDefault();
      abrir();
    }
  });
}

// ---------------------------------------------------------------------------
// Animações ao rolar — blocos de conteúdo surgem com um leve deslize quando
// entram na tela. Quem prefere menos movimento vê tudo direto, sem efeito.
// ---------------------------------------------------------------------------

const SELETORES_ANIMADOS = [
  ".secao-cards .col-12",
  ".intro",
  ".secao-sistema",
  ".apod",
  ".categoria",
  ".ficha-tecnica",
  ".artigo > p",
  ".artigo > img",
  ".page-panel > h2",
  ".page-panel > p",
  ".page-panel > figure",
  ".marco",
  ".constelacao",
  ".viagem-painel"
].join(", ");

function iniciarAnimacoesAoRolar() {
  const movimentoReduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (movimentoReduzido || !("IntersectionObserver" in window)) return;

  const observador = new IntersectionObserver((entradas) => {
    entradas.forEach((entrada) => {
      if (!entrada.isIntersecting) return;
      entrada.target.classList.add("visivel");
      observador.unobserve(entrada.target);
    });
  }, { rootMargin: "0px 0px -8% 0px" });

  document.querySelectorAll(SELETORES_ANIMADOS).forEach((elemento) => {
    // Cards lado a lado entram um pouquinho depois do outro (efeito cascata).
    const posicao = [...elemento.parentElement.children].indexOf(elemento);
    elemento.style.setProperty("--atraso-animacao", `${(posicao % 3) * 90}ms`);
    elemento.classList.add("animar");
    observador.observe(elemento);
  });
}

// ---------------------------------------------------------------------------
// PWA — o service worker (pwa/service-worker.js, carregado pelo sw.js da
// raiz) guarda as páginas para funcionarem offline, e o botão "Instalar app"
// aparece quando o navegador permite instalar.
// Só funciona com o site servido por http(s), como no GitHub Pages.
// ---------------------------------------------------------------------------

function iniciarPwa() {
  if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // Sem service worker o site continua funcionando normalmente, só não offline.
    });
  }

  let pedidoDeInstalacao = null;
  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "btn botao-coral botao-instalar";
  botao.textContent = "📲 Instalar o app";
  botao.hidden = true;
  document.querySelector(".site-footer")?.appendChild(botao);

  window.addEventListener("beforeinstallprompt", (evento) => {
    evento.preventDefault();
    pedidoDeInstalacao = evento;
    botao.hidden = false;
  });

  botao.addEventListener("click", async () => {
    if (!pedidoDeInstalacao) return;
    pedidoDeInstalacao.prompt();
    await pedidoDeInstalacao.userChoice;
    pedidoDeInstalacao = null;
    botao.hidden = true;
  });

  window.addEventListener("appinstalled", () => {
    botao.hidden = true;
  });
}

// ---------------------------------------------------------------------------
// Inicialização
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  montarNavbar();
  montarRodape();
  gerarCards();
  iniciarCitacoes();
  criarSistemaAnimado();
  iniciarFotoDoDia();
  criarNavegacaoPlanetaria();
  criarFichaTecnica();
  criarBotaoTopo();
  criarPlayerAmbiente();
  iniciarValidacaoFormularios();
  iniciarFormularioContato();
  criarBusca();
  iniciarPwa();
});

// As páginas com script próprio (viagem da luz, constelações) também montam
// o conteúdo no DOMContentLoaded; o requestAnimationFrame espera todos
// terminarem e liga as animações antes de a tela ser desenhada.
document.addEventListener("DOMContentLoaded", () => requestAnimationFrame(iniciarAnimacoesAoRolar));
