// ---------------------------------------------------------------------------
// Wiki do Universo — efeitos extras.
//
// Imagens e som só são carregados quando um efeito aparece, então o site não
// fica mais lento. Os estilos ficam em css/extras.css (classes "ee-").
//
// Para adicionar um efeito novo:
//   1. escreva a função que mostra o efeito (veja as seções abaixo);
//   2. registre-a em SEGREDOS com um id, um nome e essa função;
//   3. ligue o gatilho em iniciarExtras() chamando revelar("seu-id").
// ---------------------------------------------------------------------------

// Tudo fica dentro desta função para não misturar nomes com o app.js.
(() => {
  // -------------------------------------------------------------------------
  // Configurações — troque imagens, frases e tempos aqui.
  // -------------------------------------------------------------------------

  // Alguns textos ficam em base64 só para não aparecerem de cara no código.
  const decodificar = (base64) =>
    new TextDecoder().decode(Uint8Array.from(atob(base64), (letra) => letra.charCodeAt(0)));

  const CONFIG = {
    simbolo: {
      // SVG ou PNG com fundo transparente (o brilho contorna o desenho).
      imagem: "img/extras/brilho.png",
      termo: decodificar("MzY5"),
      duracao: 5000
    },
    foto: {
      // Se a foto não existir, aparece um astronauta no lugar.
      imagem: "img/extras/eu.jpg",
      frase: "Psiu! Você me achou 👀",
      toques: 7,
      duracao: 6000
    },
    melodia: {
      palavra: decodificar("b2NhcmluYQ==")
    },
    contagem: {
      minimoSegundos: 30,
      maximoSegundos: 120,
      segundos: 10,
      titulo: "🌠 Mensagem secreta",
      mensagem: "O cálcio dos seus ossos e o ferro do seu sangue foram forjados dentro de estrelas que explodiram há bilhões de anos. Você é, literalmente, poeira de estrelas."
    }
  };

  // Cada segredo: nome (aparece no aviso "Segredo encontrado") e a função
  // que mostra a surpresa.
  const SEGREDOS = {
    simbolo: { nome: decodificar("TyBzw61tYm9sbyBkbyAzNjk="), mostrar: mostrarSimbolo },
    foto: { nome: "O criador escondido", mostrar: mostrarFoto },
    melodia: { nome: decodificar("QSBjYW7Dp8OjbyBkYSBvY2FyaW5h"), mostrar: alternarMelodia },
    contagem: { nome: "A contagem misteriosa", mostrar: surpresaDaContagem }
  };

  const CHAVE_ENCONTRADOS = "wikiUniverso:extras";       // localStorage
  const CHAVE_HORA_CONTAGEM = "wikiUniverso:contagemEm"; // sessionStorage
  const CHAVE_CONTAGEM_FEITA = "wikiUniverso:contagemFeita";

  // -------------------------------------------------------------------------
  // Utilitários
  // -------------------------------------------------------------------------

  const movimentoReduzido = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function criarElemento(tag, classe, html = "") {
    const elemento = document.createElement(tag);
    elemento.className = classe;
    elemento.innerHTML = html;
    return elemento;
  }

  // Põe na página e, no quadro seguinte, liga a classe que anima a entrada.
  function mostrarElemento(elemento) {
    document.body.appendChild(elemento);
    elemento.getBoundingClientRect(); // força desenhar o estado inicial antes da transição
    elemento.classList.add("ee-visivel");
  }

  // Tira a classe de entrada, deixa a transição de saída rodar e remove.
  function removerComTransicao(elemento, tempo = 700) {
    if (!elemento.isConnected || elemento.classList.contains("ee-saindo")) return;
    elemento.classList.remove("ee-visivel");
    elemento.classList.add("ee-saindo");
    setTimeout(() => elemento.remove(), tempo);
  }

  // Algum efeito está na tela? (para a contagem não aparecer por cima)
  const algoNaTela = () =>
    Boolean(document.querySelector(".ee-camada, .ee-foto, .ee-mensagem, dialog[open]"));

  // localStorage/sessionStorage podem não existir (modo privado, bloqueio):
  // nesse caso o site funciona igual, só não lembra.
  function ler(armazenamento, chave) {
    try {
      return window[armazenamento].getItem(chave);
    } catch {
      return null;
    }
  }

  function gravar(armazenamento, chave, valor) {
    try {
      window[armazenamento].setItem(chave, valor);
    } catch {
      // Sem armazenamento: só não lembra.
    }
  }

  // -------------------------------------------------------------------------
  // Progresso — quais segredos a pessoa já encontrou.
  // -------------------------------------------------------------------------

  function lerEncontrados() {
    try {
      const lista = JSON.parse(ler("localStorage", CHAVE_ENCONTRADOS));
      return Array.isArray(lista) ? lista.filter((id) => id in SEGREDOS) : [];
    } catch {
      return [];
    }
  }

  function registrarAchado(id) {
    const encontrados = lerEncontrados();
    if (encontrados.includes(id)) return;

    encontrados.push(id);
    gravar("localStorage", CHAVE_ENCONTRADOS, JSON.stringify(encontrados));

    const total = Object.keys(SEGREDOS).length;
    // Espera a surpresa aparecer antes de mostrar o aviso.
    setTimeout(() => {
      if (encontrados.length === total) {
        avisar(`🏆 Você encontrou ${total}/${total} segredos! Explorador(a) de verdade.`, true);
        if (!movimentoReduzido()) soltarConfete();
      } else {
        avisar(`🔍 Segredo encontrado: ${SEGREDOS[id].nome} (${encontrados.length}/${total})`);
      }
    }, 900);
  }

  // Mostra a surpresa e conta o segredo como encontrado.
  function revelar(id) {
    const segredo = SEGREDOS[id];
    if (!segredo) return;
    segredo.mostrar();
    registrarAchado(id);
  }

  // Aviso no topo da tela. A região fica sempre na página (vazia) para os
  // leitores de tela anunciarem o texto quando ele muda.
  let regiaoAvisos = null;
  let timerAviso = 0;

  function avisar(texto, especial = false) {
    if (!regiaoAvisos) return;
    regiaoAvisos.classList.toggle("ee-aviso-especial", especial);
    regiaoAvisos.textContent = texto;
    regiaoAvisos.getBoundingClientRect(); // a região vazia fica escondida; desenha antes de animar
    regiaoAvisos.classList.add("ee-visivel");
    clearTimeout(timerAviso);
    timerAviso = setTimeout(() => regiaoAvisos.classList.remove("ee-visivel"), especial ? 6500 : 4000);
  }

  // -------------------------------------------------------------------------
  // 1. Símbolo brilhando no centro da tela por alguns segundos.
  // Gatilho: um termo exato na busca (a busca fecha e o símbolo aparece).
  // -------------------------------------------------------------------------

  function mostrarSimbolo() {
    if (document.querySelector(".ee-simbolo")) return;

    // Faíscas saindo do centro em todas as direções (só com movimento).
    const particulas = movimentoReduzido() ? "" : Array.from({ length: 24 }, (_, i) => {
      const angulo = (360 / 24) * i + Math.random() * 12;
      const distancia = 110 + Math.random() * 130;
      const atraso = Math.random() * 2.4;
      return `<span class="ee-particula" style="--angulo: ${angulo}deg; --distancia: ${distancia}px; --atraso: ${atraso.toFixed(2)}s"></span>`;
    }).join("");

    const camada = criarElemento("div", "ee-camada ee-simbolo", `
      <div class="ee-simbolo-luz"></div>
      ${particulas}
      <div class="ee-simbolo-desenho">
        <img src="${CONFIG.simbolo.imagem}" alt="Símbolo brilhando">
      </div>
    `);

    mostrarElemento(camada);
    setTimeout(() => removerComTransicao(camada, 1300), CONFIG.simbolo.duracao);
  }

  function ligarBusca() {
    // O campo é criado pelo app.js (criarBusca), que roda antes deste script.
    const campo = document.getElementById("campo-busca");
    if (!campo) return;

    campo.addEventListener("input", () => {
      if (campo.value.trim() !== CONFIG.simbolo.termo) return;
      campo.closest("dialog")?.close();
      revelar("simbolo");
    });
  }

  // -------------------------------------------------------------------------
  // 2. Foto escondida — "espia" pela borda direita da tela com um balão de
  // fala. Some sozinha depois de alguns segundos, com um toque ou com Esc.
  // Gatilhos: toques seguidos no texto do rodapé ou uma sequência de teclas.
  // -------------------------------------------------------------------------

  async function mostrarFoto() {
    if (document.querySelector(".ee-foto")) return;

    // Carrega a foto antes de animar, para ela não aparecer pela metade.
    const imagem = new Image();
    imagem.src = CONFIG.foto.imagem;
    imagem.alt = "";
    imagem.className = "ee-foto-imagem";
    const carregou = await imagem.decode().then(() => true, () => false);

    const foto = criarElemento("button", "ee-foto", '<span class="ee-foto-balao"></span>');
    foto.type = "button";
    foto.setAttribute("aria-label", `${CONFIG.foto.frase} (toque para fechar)`);
    foto.querySelector(".ee-foto-balao").textContent = CONFIG.foto.frase;
    foto.append(carregou ? imagem : criarElemento("span", "ee-foto-imagem ee-foto-reserva", "🧑‍🚀"));

    const fechar = () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", fecharComEsc);
      removerComTransicao(foto, 600);
    };
    const fecharComEsc = (evento) => {
      if (evento.key === "Escape") fechar();
    };
    const timer = setTimeout(fechar, CONFIG.foto.duracao);

    foto.addEventListener("click", fechar);
    document.addEventListener("keydown", fecharComEsc);
    mostrarElemento(foto);
  }

  function ligarToquesNoRodape() {
    const texto = document.querySelector(".site-footer p");
    if (!texto) return;

    let toques = 0;
    let ultimoToque = 0;

    texto.addEventListener("click", (evento) => {
      if (evento.target.closest(".ee-nota-rodape")) return; // a nota tem outro efeito

      const agora = Date.now();
      toques = agora - ultimoToque < 800 ? toques + 1 : 1;
      ultimoToque = agora;

      // Cliques rápidos selecionam o texto; limpa para não ficar marcado.
      if (toques > 1) window.getSelection()?.removeAllRanges();

      if (toques >= CONFIG.foto.toques) {
        toques = 0;
        revelar("foto");
      }
    });
  }

  // -------------------------------------------------------------------------
  // 3. Melodia original sintetizada com a Web Audio API (não precisa baixar
  // nenhum arquivo). Mostra notas flutuando e um botão de parar enquanto toca.
  // Gatilhos: a notinha ♪ do rodapé ou uma palavra digitada. Os dois são
  // ações da pessoa, então os navegadores deixam tocar (regra de autoplay).
  // -------------------------------------------------------------------------

  // [nota, duração em segundos] — escala pentatônica de lá menor.
  const MELODIA = [
    ["A4", 0.36], ["C5", 0.36], ["E5", 0.72],
    ["D5", 0.36], ["C5", 0.36], ["D5", 0.72],
    ["E5", 0.36], ["G5", 0.36], ["A5", 0.9],
    ["G5", 0.24], ["E5", 0.24], ["D5", 0.48],
    ["C5", 0.36], ["D5", 0.36], ["A4", 1.4]
  ];

  // "A4" → 440 Hz, "C5" → 523,25 Hz...
  function frequencia(nota) {
    const semitons = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const [, letra, sustenido, oitava] = nota.match(/^([A-G])(#?)(\d)$/);
    const midi = 12 * (Number(oitava) + 1) + semitons[letra] + (sustenido ? 1 : 0);
    return 440 * 2 ** ((midi - 69) / 12);
  }

  // Um segundo de chiado, usado como "sopro" no começo de cada nota.
  function criarRuido(contexto) {
    const buffer = contexto.createBuffer(1, contexto.sampleRate, contexto.sampleRate);
    const dados = buffer.getChannelData(0);
    for (let i = 0; i < dados.length; i++) dados[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // O som é quase uma onda senoidal pura: base + um pouco do
  // segundo harmônico, vibrato que entra devagar e um sopro no ataque.
  function tocarNota(contexto, destinos, ruido, nota, inicio, duracao) {
    const f = frequencia(nota);
    const fim = inicio + duracao;

    const envelope = contexto.createGain();
    envelope.gain.setValueAtTime(0, inicio);
    envelope.gain.linearRampToValueAtTime(0.3, inicio + 0.05);
    envelope.gain.linearRampToValueAtTime(0.24, fim - 0.06);
    envelope.gain.linearRampToValueAtTime(0, fim + 0.04);
    destinos.forEach((destino) => envelope.connect(destino));

    const base = contexto.createOscillator();
    base.frequency.value = f;
    base.connect(envelope);

    const harmonico = contexto.createOscillator();
    harmonico.frequency.value = f * 2;
    const volumeHarmonico = contexto.createGain();
    volumeHarmonico.gain.value = 0.07;
    harmonico.connect(volumeHarmonico).connect(envelope);

    const vibrato = contexto.createOscillator();
    vibrato.frequency.value = 5.2;
    const intensidade = contexto.createGain();
    intensidade.gain.setValueAtTime(0, inicio);
    intensidade.gain.linearRampToValueAtTime(f * 0.007, inicio + Math.min(0.35, duracao));
    vibrato.connect(intensidade);
    intensidade.connect(base.frequency);
    intensidade.connect(harmonico.frequency);

    const sopro = contexto.createBufferSource();
    sopro.buffer = ruido;
    const filtro = contexto.createBiquadFilter();
    filtro.type = "bandpass";
    filtro.frequency.value = f * 2;
    filtro.Q.value = 1.2;
    const volumeSopro = contexto.createGain();
    volumeSopro.gain.setValueAtTime(0.06, inicio);
    volumeSopro.gain.exponentialRampToValueAtTime(0.001, inicio + 0.14);
    sopro.connect(filtro).connect(volumeSopro).connect(destinos[0]);

    [base, harmonico, vibrato].forEach((oscilador) => {
      oscilador.start(inicio);
      oscilador.stop(fim + 0.1);
    });
    sopro.start(inicio);
    sopro.stop(inicio + 0.15);
  }

  let melodiaAtual = null; // { parar } enquanto toca

  function alternarMelodia() {
    if (melodiaAtual) {
      melodiaAtual.parar();
      return;
    }

    const Contexto = window.AudioContext || window.webkitAudioContext;
    if (!Contexto) return;

    const contexto = new Contexto();
    contexto.resume?.();

    const saida = contexto.createGain();
    saida.connect(contexto.destination);

    // Eco curto, para soar como se tocasse num lugar amplo.
    const eco = contexto.createDelay();
    eco.delayTime.value = 0.22;
    const retorno = contexto.createGain();
    retorno.gain.value = 0.28;
    const volumeEco = contexto.createGain();
    volumeEco.gain.value = 0.25;
    eco.connect(retorno).connect(eco);
    eco.connect(volumeEco).connect(saida);

    const ruido = criarRuido(contexto);
    const painel = criarPainelMelodia();
    const timers = [];

    let tempo = contexto.currentTime + 0.08;
    for (const [nota, duracao] of MELODIA) {
      tocarNota(contexto, [saida, eco], ruido, nota, tempo, duracao);
      const quando = (tempo - contexto.currentTime) * 1000;
      timers.push(setTimeout(() => soltarNotaFlutuante(painel), quando));
      tempo += duracao;
    }
    // +1 s para o eco terminar.
    timers.push(setTimeout(parar, (tempo - contexto.currentTime + 1) * 1000));

    function parar() {
      if (melodiaAtual !== controle) return;
      melodiaAtual = null;
      timers.forEach(clearTimeout);
      saida.gain.setTargetAtTime(0, contexto.currentTime, 0.05);
      setTimeout(() => contexto.close(), 300);
      removerComTransicao(painel, 400);
    }

    const controle = { parar };
    melodiaAtual = controle;
    painel.querySelector(".ee-melodia-parar").addEventListener("click", parar);
  }

  function criarPainelMelodia() {
    const painel = criarElemento("div", "ee-melodia", `
      <div class="ee-notas" aria-hidden="true"></div>
      <span class="ee-melodia-icone" aria-hidden="true">🎵</span>
      <span class="ee-melodia-texto"></span>
      <button type="button" class="ee-melodia-parar">⏹ Parar</button>
    `);
    painel.querySelector(".ee-melodia-texto").textContent = decodificar("T2NhcmluYSB0b2NhbmRv4oCm");
    painel.setAttribute("role", "status");
    mostrarElemento(painel);
    return painel;
  }

  function soltarNotaFlutuante(painel) {
    if (movimentoReduzido()) return;

    const cores = ["var(--cor-destaque)", "var(--cor-ciano)", "var(--cor-roxo)", "var(--cor-coral)"];
    const nota = criarElemento("span", "ee-nota-flutuante", ["♪", "♫", "♬"][Math.floor(Math.random() * 3)]);
    nota.style.setProperty("--x", `${15 + Math.random() * 70}%`);
    nota.style.setProperty("--desvio", `${Math.round(Math.random() * 40 - 20)}px`);
    nota.style.setProperty("--giro", `${Math.round(Math.random() * 40 - 20)}deg`);
    nota.style.setProperty("--cor", cores[Math.floor(Math.random() * cores.length)]);

    painel.querySelector(".ee-notas").appendChild(nota);
    setTimeout(() => nota.remove(), 1900);
  }

  // A notinha discreta, no fim do texto do rodapé.
  function criarNotaDoRodape() {
    const texto = document.querySelector(".site-footer p");
    if (!texto) return;

    const nota = criarElemento("button", "ee-nota-rodape", "♪");
    nota.type = "button";
    nota.setAttribute("aria-label", "Tocar uma melodia");
    nota.addEventListener("click", () => revelar("melodia"));
    texto.append(" ", nota);
  }

  // -------------------------------------------------------------------------
  // 4. Contagem regressiva — num momento aleatório da visita aparece uma
  // contagem no canto da tela. No zero, a pessoa clica para receber: chuva
  // de confete e uma mensagem.
  // A hora sorteada fica no sessionStorage: se a pessoa trocar de página,
  // a contagem continua valendo a partir da primeira página aberta, e
  // aparece só uma vez por visita (aba).
  // -------------------------------------------------------------------------

  function agendarContagem() {
    if (ler("sessionStorage", CHAVE_CONTAGEM_FEITA)) return;

    let hora = Number(ler("sessionStorage", CHAVE_HORA_CONTAGEM));
    if (!hora) {
      const { minimoSegundos, maximoSegundos } = CONFIG.contagem;
      const segundos = minimoSegundos + Math.random() * (maximoSegundos - minimoSegundos);
      hora = Date.now() + segundos * 1000;
      gravar("sessionStorage", CHAVE_HORA_CONTAGEM, String(hora));
    }

    // Se a hora já passou durante a troca de página, espera um pouco na página nova.
    setTimeout(tentarIniciarContagem, Math.max(5000, hora - Date.now()));
  }

  // Só começa com a aba visível e sem outro efeito (ou a busca) na tela.
  function tentarIniciarContagem() {
    if (document.hidden) {
      document.addEventListener("visibilitychange", tentarIniciarContagem, { once: true });
    } else if (algoNaTela()) {
      setTimeout(tentarIniciarContagem, 4000);
    } else {
      iniciarContagem();
    }
  }

  function iniciarContagem() {
    if (document.querySelector(".ee-contagem")) return;
    gravar("sessionStorage", CHAVE_CONTAGEM_FEITA, "1");

    let restante = CONFIG.contagem.segundos;
    const caixa = criarElemento("div", "ee-contagem", `
      <span>👁️ Veja em <strong class="ee-contagem-numero">${restante}</strong> <span class="ee-contagem-unidade">segundos</span>…</span>
      <button type="button" class="ee-contagem-fechar" aria-label="Dispensar">×</button>
    `);
    caixa.setAttribute("role", "status");

    const numero = caixa.querySelector(".ee-contagem-numero");
    const unidade = caixa.querySelector(".ee-contagem-unidade");

    const intervalo = setInterval(() => {
      // Depois do primeiro anúncio, o leitor de tela não precisa ler cada número.
      caixa.setAttribute("aria-live", "off");
      restante -= 1;

      if (restante <= 0) {
        clearInterval(intervalo);
        mostrarBotaoDaContagem(caixa);
        return;
      }

      numero.textContent = restante;
      unidade.textContent = restante === 1 ? "segundo" : "segundos";
      // Reinicia a animação de "pulso" do número.
      numero.classList.remove("ee-pulsar");
      void numero.offsetWidth;
      numero.classList.add("ee-pulsar");
    }, 1000);

    caixa.querySelector(".ee-contagem-fechar").addEventListener("click", () => {
      clearInterval(intervalo);
      removerComTransicao(caixa, 400);
    });

    mostrarElemento(caixa);
  }

  // No zero, a surpresa só aparece quando a pessoa clica para receber.
  function mostrarBotaoDaContagem(caixa) {
    const botao = criarElemento("button", "ee-contagem-receber", "🎁 Clique para receber");
    botao.type = "button";
    botao.addEventListener("click", () => {
      removerComTransicao(caixa, 400);
      revelar("contagem");
    });
    caixa.firstElementChild.replaceWith(botao);
    caixa.setAttribute("aria-live", "polite");
    botao.focus({ preventScroll: true });
  }

  function surpresaDaContagem() {
    if (!movimentoReduzido()) soltarConfete();
    mostrarMensagemSecreta();
  }

  function soltarConfete() {
    if (document.querySelector(".ee-confete")) return; // já está chovendo
    const cores = ["#49d6ff", "#8a5dff", "#63e6d4", "#ff9b71", "#c3f4ff", "#ffe27a"];

    const pedacos = Array.from({ length: 90 }, () => {
      const estrela = Math.random() < 0.3;
      const estilo = [
        `--x: ${(Math.random() * 100).toFixed(1)}vw`,
        `--cor: ${cores[Math.floor(Math.random() * cores.length)]}`,
        `--atraso: ${(Math.random() * 1).toFixed(2)}s`,
        `--duracao: ${(2.6 + Math.random() * 1.6).toFixed(2)}s`,
        `--giro: ${Math.round(Math.random() * 720 - 360)}deg`,
        `--balanco: ${Math.round(Math.random() * 120 - 60)}px`
      ].join("; ");
      return estrela
        ? `<span class="ee-papel ee-papel-estrela" style="${estilo}">★</span>`
        : `<span class="ee-papel" style="${estilo}"></span>`;
    }).join("");

    const chuva = criarElemento("div", "ee-camada ee-confete", pedacos);
    chuva.setAttribute("aria-hidden", "true");
    document.body.appendChild(chuva);
    setTimeout(() => chuva.remove(), 5500);
  }

  function mostrarMensagemSecreta() {
    const caixa = criarElemento("div", "ee-mensagem", `
      <h2></h2>
      <p></p>
      <button type="button" class="btn botao-coral">Fechar ✨</button>
    `);
    caixa.setAttribute("role", "status");
    caixa.querySelector("h2").textContent = CONFIG.contagem.titulo;
    caixa.querySelector("p").textContent = CONFIG.contagem.mensagem;

    const fechar = () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", fecharComEsc);
      removerComTransicao(caixa, 500);
    };
    const fecharComEsc = (evento) => {
      if (evento.key === "Escape") fechar();
    };
    const timer = setTimeout(fechar, 12000);

    caixa.addEventListener("click", fechar);
    document.addEventListener("keydown", fecharComEsc);
    mostrarElemento(caixa);
  }

  // -------------------------------------------------------------------------
  // Atalhos de teclado — guarda as últimas teclas apertadas fora de campos
  // de texto e confere se alguma sequência foi completada.
  // Para um atalho novo, basta acrescentar { teclas, segredo } aqui.
  // -------------------------------------------------------------------------

  const SEQUENCIAS_DE_TECLAS = [
    {
      teclas: decodificar("YXJyb3d1cCxhcnJvd3VwLGFycm93ZG93bixhcnJvd2Rvd24sYXJyb3dsZWZ0LGFycm93cmlnaHQsYXJyb3dsZWZ0LGFycm93cmlnaHQsYixh").split(","),
      segredo: "foto"
    },
    { teclas: [...CONFIG.melodia.palavra], segredo: "melodia" }
  ];

  function ligarTeclado() {
    const tamanhoMaximo = Math.max(...SEQUENCIAS_DE_TECLAS.map((s) => s.teclas.length));
    let digitadas = [];

    document.addEventListener("keydown", (evento) => {
      // O preenchimento automático do navegador dispara keydown sem tecla.
      if (!evento.key || evento.ctrlKey || evento.metaKey || evento.altKey) return;
      if (evento.target.closest?.("input, textarea, select, [contenteditable]")) return;

      digitadas = [...digitadas, evento.key.toLowerCase()].slice(-tamanhoMaximo);

      const completa = SEQUENCIAS_DE_TECLAS.find(({ teclas }) =>
        teclas.every((tecla, i) => digitadas[digitadas.length - teclas.length + i] === tecla)
      );
      if (completa) {
        digitadas = [];
        revelar(completa.segredo);
      }
    });
  }

  // -------------------------------------------------------------------------
  // Inicialização — roda depois do app.js, que monta rodapé e busca.
  // -------------------------------------------------------------------------

  function iniciarExtras() {
    regiaoAvisos = criarElemento("div", "ee-aviso");
    regiaoAvisos.setAttribute("role", "status");
    document.body.appendChild(regiaoAvisos);

    ligarBusca();
    criarNotaDoRodape();
    ligarToquesNoRodape();
    ligarTeclado();
    agendarContagem();

    // Atalhos para testar pelo console.
    window.wikiExtras = {
      mostrar: (id) => (id === "contagem" ? iniciarContagem() : revelar(id)),
      resetar: () => {
        gravar("localStorage", CHAVE_ENCONTRADOS, "[]");
        return "Progresso apagado.";
      }
    };
  }

  document.addEventListener("DOMContentLoaded", iniciarExtras);
})();
