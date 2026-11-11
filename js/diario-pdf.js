// ---------------------------------------------------------------------------
// Diário de bordo em PDF: capa com o resumo, um cartão por astro descoberto
// (imagem, resumo, curiosidade, distância real, ficha técnica e desafio) e
// as missões. Tudo é montado no navegador (js/pdf.js), sem enviar nada.
// ---------------------------------------------------------------------------

import { A4, DocumentoPdf, carregarJpeg, medir, quebrarLinhas } from "./pdf.js";
import * as astro from "./explorador/astronomia.js";
import { NIVEIS, MISSOES, PERGUNTAS, perguntaDoObjeto, corDaEstrela, fontesDoObjeto, objetoPorId } from "./explorador/catalogo.js";
import * as progresso from "./explorador/progresso.js";

const COR = {
  tinta: "#14213d", suave: "#56627c", apagado: "#8a93a8", acento: "#2563eb", ouro: "#b7791f",
  cartao: "#f5f7fc", borda: "#dfe5f1", espaco: "#000000", certo: "#15803d", errado: "#c0392b"
};
const COR_NIVEL = { solar: "#f59e0b", estrelas: "#6366f1", galaxia: "#a855f7" };
const MARGEM = 46;
const LARGURA = A4.largura - 2 * MARGEM;
const TOPO = 66;                       // onde o conteúdo começa (abaixo do cabeçalho)
const FUNDO = A4.altura - 52;          // onde o conteúdo termina (acima do rodapé)
const SITE = "davi-mares.github.io/explorador-do-universo";

const formatoData = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" });
const formatoDataCurta = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

function misturar(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const canal = (deslocamento) => Math.round(((pa >> deslocamento) & 255) * (1 - t) + ((pb >> deslocamento) & 255) * t);
  return `#${[16, 8, 0].map((d) => canal(d).toString(16).padStart(2, "0")).join("")}`;
}

/** Gerador pseudoaleatório com semente (o céu da capa sai igual sempre). */
function aleatorio(semente) {
  let s = semente >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Brilho suave (degradê radial do PDF), opcionalmente recortado num retângulo. */
function brilho(pagina, cx, cy, raio, corCentro, corFundo, recorte = null, extras = {}) {
  pagina.gradienteRadial(cx, cy, raio, corCentro, corFundo, { recorte, ...extras });
}

function marcaCerto(pagina, x, y, cor) {
  pagina.circulo(x + 5, y - 3.5, 5.5, { fundo: cor });
  pagina.linha([[x + 2.4, y - 3.6], [x + 4.4, y - 1.6], [x + 7.8, y - 5.6]], { cor: "#ffffff", espessura: 1.4, redonda: true });
}

function marcaVazia(pagina, x, y, cor) {
  pagina.circulo(x + 5, y - 3.5, 5, { borda: cor, espessura: 1 });
}

// ---------- Capa ----------

function desenharCapa(doc, { nome, resumo, estatisticas, grupos, imagemCapa }) {
  const p = doc.novaPagina();
  const alturaFaixa = 300;
  p.retangulo(0, 0, A4.largura, alturaFaixa, { fundo: COR.espaco });
  const faixa = { x: 0, y: 0, w: A4.largura, h: alturaFaixa };
  brilho(p, A4.largura * 0.34, 30, 190, "#2a1f5c", COR.espaco, faixa);
  brilho(p, A4.largura * 0.06, 280, 170, "#0f2a55", COR.espaco, faixa);
  // A Terra (foto com fundo preto, que some no preto da faixa); as estrelas
  // vêm depois, menos em cima do disco do planeta.
  const lado = 210, xTerra = A4.largura - MARGEM - lado + 14, yTerra = 46;
  const terra = { x: xTerra + lado / 2, y: yTerra + lado / 2, r: lado * 0.41 * 1.12 };
  if (imagemCapa) p.imagem(imagemCapa, xTerra, yTerra, lado, lado);
  const sorte = aleatorio(2026);
  const coresEstrelas = ["#ffffff", "#dfe8ff", "#fff1d6", "#cfe0ff", "#ffe2b8"];
  for (let i = 0; i < 300; i++) {
    const r = 0.25 + Math.pow(sorte(), 3) * 1.3;
    const x = sorte() * A4.largura, y = sorte() * alturaFaixa;
    const corEstrela = coresEstrelas[Math.floor(sorte() * coresEstrelas.length)];
    if (imagemCapa && Math.hypot(x - terra.x, y - terra.y) < terra.r) continue;
    p.circulo(x, y, r, { fundo: corEstrela });
  }

  if (imagemCapa) {
    // Crédito da foto da Terra, no pé da faixa preta.
    const { credito, link } = objetoPorId("terra").creditoImagem;
    const texto = `Terra: ${credito}`;
    const largura = p.texto(A4.largura - MARGEM, alturaFaixa - 10, texto, { tamanho: 6.5, cor: "#7d88a6", alinhar: "direita" });
    p.link(A4.largura - MARGEM - largura, alturaFaixa - 18, largura, 10, link);
  }

  p.texto(MARGEM, 96, "EXPLORADOR DO UNIVERSO", { fonte: "negrito", tamanho: 9.5, cor: "#8fb4ff", espacamento: 1.6 });
  p.texto(MARGEM, 142, "Diário de bordo", { fonte: "negrito", tamanho: 38, cor: "#ffffff" });
  p.texto(MARGEM, 168, "Astronomia em escala real", { tamanho: 13, cor: "#c7d2ee" });
  if (nome) p.texto(MARGEM, 210, `de ${nome}`, { fonte: "negrito", tamanho: 21, cor: "#ffd27a" });

  let y = alturaFaixa + 36;
  p.texto(MARGEM, y, `Gerado em ${formatoData.format(new Date())}`, { tamanho: 10, cor: COR.suave });
  y += 22;

  // Três números grandes: astros, missões e desafios.
  const cartoes = [
    [resumo.descobertos, `de ${resumo.totalObjetos} astros descobertos`, COR.acento],
    [resumo.missoes, `de ${resumo.totalMissoes} missões cumpridas`, COR.ouro],
    [resumo.acertos, `de ${PERGUNTAS.length} desafios certos`, COR.certo]
  ];
  const largura = (LARGURA - 2 * 12) / 3;
  cartoes.forEach(([valor, rotulo, cor], i) => {
    const x = MARGEM + i * (largura + 12);
    p.retangulo(x, y, largura, 78, { fundo: COR.cartao, borda: COR.borda, raio: 10 });
    p.texto(x + 16, y + 40, String(valor), { fonte: "negrito", tamanho: 28, cor });
    p.paragrafo(x + 16, y + 48, largura - 28, rotulo, { tamanho: 9.5, cor: COR.suave, entrelinha: 12 });
  });
  y += 78 + 26;

  // Viagens.
  const voado = estatisticas.kmPercorridos > 0
    ? `Você já voou ${astro.formatarDistancia(estatisticas.kmPercorridos)} pilotando a nave`
    : "Você ainda não pilotou a nave";
  const saltos = estatisticas.saltos ? ` e deu ${estatisticas.saltos} ${estatisticas.saltos === 1 ? "salto" : "saltos"}` : "";
  y += p.paragrafo(MARGEM, y, LARGURA, `${voado}${saltos}.`, { tamanho: 11, cor: COR.tinta });
  y += 8;
  y += p.paragrafo(MARGEM, y, LARGURA,
    "Este diário guarda os astros que você descobriu viajando pelo universo. As distâncias e os tamanhos são os de verdade, " +
    "por isso o espaço parece tão vazio: os astros são minúsculos perto das distâncias entre eles.",
    { tamanho: 10.5, cor: COR.suave, entrelinha: 15 });
  y += 26;

  // Índice dos níveis.
  p.texto(MARGEM, y, "NESTE DIÁRIO", { fonte: "negrito", tamanho: 8.5, cor: COR.apagado, espacamento: 1.2 });
  y += 16;
  for (const grupo of grupos) {
    const nivel = NIVEIS.find((n) => n.id === grupo.nivel);
    const feitos = grupo.objetos.filter((o) => progresso.foiDescoberto(o.id)).length;
    p.circulo(MARGEM + 5, y - 4, 4.5, { fundo: COR_NIVEL[grupo.nivel] });
    p.texto(MARGEM + 18, y, nivel.nome, { fonte: "negrito", tamanho: 11.5, cor: COR.tinta });
    p.texto(A4.largura - MARGEM, y, `${feitos} de ${grupo.objetos.length} descobertos`, { tamanho: 10, cor: COR.suave, alinhar: "direita" });
    p.linha([[MARGEM, y + 8], [A4.largura - MARGEM, y + 8]], { cor: COR.borda, espessura: 0.6 });
    y += 26;
  }
  if (!resumo.descobertos) {
    y += 10;
    p.paragrafo(MARGEM, y, LARGURA, "Seu diário ainda está vazio: abra o Explorador e chegue perto de um astro para descobri-lo!",
      { fonte: "italico", tamanho: 11, cor: COR.acento });
  }
}

// ---------- Verbetes ----------

/** Calcula o cartão de um astro: devolve a altura e a função que o desenha. */
function montarVerbete(objeto, { distancia, imagem, resposta, pergunta, corNivel }) {
  const padding = 14, lado = 86;
  const xTexto = MARGEM + padding + lado + 16;
  const larguraTexto = A4.largura - MARGEM - padding - xTexto;
  const blocos = [];
  let h = 0;
  const somar = (altura, desenhar) => { blocos.push({ y: h, desenhar }); h += altura; };

  somar(20, (p, y) => p.texto(xTexto, y + 15, objeto.nome, { fonte: "negrito", tamanho: 15, cor: COR.tinta }));
  if (objeto.tipo) somar(15, (p, y) => p.texto(xTexto, y + 10, objeto.tipo, { fonte: "italico", tamanho: 9.5, cor: corNivel }));
  h += 4;
  const linhasResumo = quebrarLinhas(objeto.resumo, "normal", 10, larguraTexto);
  somar(linhasResumo.length * 13.5, (p, y) => linhasResumo.forEach((linha, i) => p.texto(xTexto, y + 10 + i * 13.5, linha, { tamanho: 10, cor: COR.tinta })));
  if (objeto.curiosidade) {
    h += 6;
    const linhas = quebrarLinhas(objeto.curiosidade, "italico", 10, larguraTexto - 10);
    somar(12 + linhas.length * 13.5, (p, y) => {
      p.retangulo(xTexto, y, 2.4, 10 + linhas.length * 13.5, { fundo: COR.ouro });
      p.texto(xTexto + 10, y + 8, "CURIOSIDADE", { fonte: "negrito", tamanho: 7, cor: COR.ouro, espacamento: 0.9 });
      linhas.forEach((linha, i) => p.texto(xTexto + 10, y + 21 + i * 13.5, linha, { fonte: "italico", tamanho: 10, cor: COR.suave }));
    });
  }
  if (distancia) {
    h += 8;
    const texto = `Distância ${distancia.rotulo}: ${astro.formatarDistancia(distancia.km)}  ·  A luz leva ${astro.formatarDuracao(distancia.km / astro.VELOCIDADE_LUZ_KM_S)}`;
    const linhas = quebrarLinhas(texto, "normal", 9, larguraTexto);
    somar(linhas.length * 12, (p, y) => linhas.forEach((linha, i) => p.texto(xTexto, y + 9 + i * 12, linha, { tamanho: 9, cor: COR.suave })));
  }
  if (pergunta) {
    h += 7;
    somar(13, (p, y) => {
      const base = y + 10;
      if (resposta) {
        (resposta.correta ? marcaCerto : marcaVazia)(p, xTexto, base, resposta.correta ? COR.certo : COR.errado);
        p.texto(xTexto + 15, base, resposta.correta ? "Desafio: você acertou!" : "Desafio: não foi dessa vez (veja a explicação no Diário).",
          { tamanho: 9, cor: resposta.correta ? COR.certo : COR.errado });
      } else {
        marcaVazia(p, xTexto, base, COR.apagado);
        p.texto(xTexto + 15, base, "Desafio ainda não respondido.", { tamanho: 9, cor: COR.apagado });
      }
    });
  }
  const alturaTopo = Math.max(lado, h);

  // Ficha técnica: grade de três colunas logo abaixo.
  let alturaFicha = 0;
  const celulas = [];
  if (objeto.ficha?.length) {
    const colunas = 3, vao = 12;
    const larguraCelula = (LARGURA - 2 * padding - vao * (colunas - 1)) / colunas;
    let linhaY = 22;
    for (let i = 0; i < objeto.ficha.length; i += colunas) {
      let alturaLinha = 0;
      objeto.ficha.slice(i, i + colunas).forEach(([campo, valor], j) => {
        const rotulo = quebrarLinhas(campo, "negrito", 7.5, larguraCelula);
        const texto = quebrarLinhas(valor, "normal", 9.5, larguraCelula);
        const altura = rotulo.length * 9.5 + texto.length * 12 + 4;
        alturaLinha = Math.max(alturaLinha, altura);
        celulas.push({ x: MARGEM + padding + j * (larguraCelula + vao), y: linhaY, rotulo, texto });
      });
      linhaY += alturaLinha + 6;
    }
    alturaFicha = linhaY;
  }
  // Fontes da ficha, cada uma com o seu link.
  const larguraUtil = LARGURA - 2 * padding;
  const fontes = objeto.ficha?.length ? fontesDoObjeto(objeto) : [];
  const linhasFontes = fontes.length ? arrumarLinks(`${fontes.length > 1 ? "Fontes" : "Fonte"}:`, fontes, 8, larguraUtil) : [];
  if (linhasFontes.length) alturaFicha += linhasFontes.length * 11 + 2;
  // Crédito da foto no próprio cartão, junto da imagem (a licença CC BY pede isso).
  const credito = imagem && objeto.creditoImagem;
  const linhasCredito = credito
    ? quebrarLinhas(`Foto: ${credito.descricao}. ${credito.credito} (${credito.licenca}).`, "normal", 7.5, larguraUtil)
    : [];
  const alturaCredito = linhasCredito.length ? 8 + linhasCredito.length * 10 : 0;
  const altura = padding + alturaTopo + (alturaFicha ? 12 + alturaFicha : 0) + alturaCredito + padding - 2;

  function desenhar(p, y) {
    p.retangulo(MARGEM, y, LARGURA, altura, { fundo: COR.cartao, borda: COR.borda, raio: 12 });
    p.retangulo(MARGEM, y + 14, 3, 28, { fundo: corNivel, raio: 1.5 });
    const xImagem = MARGEM + padding, yImagem = y + padding;
    if (imagem) {
      p.retangulo(xImagem, yImagem, lado, lado, { fundo: "#000000", raio: 10 });
      p.imagem(imagem, xImagem, yImagem, lado, lado, { raio: 10 });
    } else {
      const fundo = "#070b18";
      p.retangulo(xImagem, yImagem, lado, lado, { fundo, raio: 10 });
      const corAstro = objeto.espectro ? corDaEstrela(objeto) : objeto.cor || "#cfe0ff";
      const centro = [xImagem + lado / 2, yImagem + lado / 2];
      brilho(p, ...centro, lado * 0.47, corAstro, fundo, { x: xImagem, y: yImagem, w: lado, h: lado, raio: 10 },
        { expoente: 0.42, nucleo: { cor: misturar(corAstro, "#ffffff", 0.85), ate: 0.13 } });
    }
    for (const bloco of blocos) bloco.desenhar(p, y + padding + bloco.y);
    if (alturaFicha) {
      const yFicha = y + padding + alturaTopo + 12;
      p.linha([[MARGEM + padding, yFicha], [A4.largura - MARGEM - padding, yFicha]], { cor: COR.borda, espessura: 0.7 });
      p.texto(MARGEM + padding, yFicha + 14, "FICHA TÉCNICA", { fonte: "negrito", tamanho: 7, cor: COR.apagado, espacamento: 0.9 });
      for (const { x, y: yCelula, rotulo, texto } of celulas) {
        let base = yFicha + yCelula + 8;
        rotulo.forEach((linha) => { p.texto(x, base, linha, { fonte: "negrito", tamanho: 7.5, cor: COR.suave }); base += 9.5; });
        base += 2;
        texto.forEach((linha) => { p.texto(x, base, linha, { tamanho: 9.5, cor: COR.tinta }); base += 12; });
      }
      linhasFontes.forEach((pedacos, i) => {
        const base = yFicha + alturaFicha - (linhasFontes.length - 1 - i) * 11 - 4;
        for (const { texto, url, x, largura } of pedacos) {
          p.texto(MARGEM + padding + x, base, texto, { tamanho: 8, cor: url ? COR.acento : COR.suave });
          if (url) p.link(MARGEM + padding + x, base - 9, largura, 12, url);
        }
      });
    }
    if (linhasCredito.length) {
      const yCredito = y + padding + alturaTopo + (alturaFicha ? 12 + alturaFicha : 0) + 8;
      linhasCredito.forEach((linha, i) => {
        const base = yCredito + 7 + i * 10;
        const largura = p.texto(MARGEM + padding, base, linha, { tamanho: 7.5, cor: COR.apagado });
        p.link(MARGEM + padding, base - 8, largura, 10, credito.link);
      });
    }
  }
  return { altura, desenhar };
}

/**
 * Arruma "Fontes: A · B · C" em linhas que cabem na largura; cada pedaço guarda
 * o x e o link. O separador fica sempre junto do item anterior. (Os espaços são
 * somados à parte, porque o texto do PDF não guarda espaço no começo nem no fim.)
 */
function arrumarLinks(prefixo, itens, tamanho, largura) {
  const medida = (texto) => medir(texto, "normal", tamanho);
  const espaco = medida("a a") - medida("aa");
  const linhas = [[{ texto: prefixo, url: null, x: 0, largura: medida(prefixo) }]];
  let x = medida(prefixo);
  itens.forEach(({ rotulo, url }, i) => {
    const separador = i < itens.length - 1 ? "·" : "";
    const w = medida(rotulo), wSeparador = separador ? espaco + medida(separador) : 0;
    if (x + espaco + w + wSeparador > largura) {
      linhas.push([]);
      x = 0;
    } else {
      x += espaco;
    }
    const linha = linhas[linhas.length - 1];
    linha.push({ texto: rotulo, url, x, largura: w });
    x += w;
    if (separador) {
      x += espaco;
      linha.push({ texto: separador, url: null, x, largura: medida(separador) });
      x += medida(separador);
    }
  });
  return linhas;
}

// ---------- Missões ----------

function montarMissoes() {
  const itens = MISSOES.map((missao) => {
    const data = progresso.obterEstado().missoes[missao.id];
    const linhas = quebrarLinhas(missao.objetivo, "normal", 9.5, LARGURA - 30);
    return { missao, data, linhas, altura: 16 + linhas.length * 12.5 + 10 };
  });
  return itens;
}

// ---------- Documento ----------

export async function gerarPdfDoDiario({ grupos, distanciaDoObjeto, nome = "" }) {
  const estado = progresso.obterEstado();
  const resumo = progresso.resumo();
  const doc = new DocumentoPdf({
    titulo: nome ? `Diário de bordo de ${nome}` : "Diário de bordo",
    autor: nome || "Explorador do Universo"
  });

  // Imagens dos astros descobertos (convertidas para JPEG no próprio navegador).
  const descobertos = grupos.flatMap((g) => g.objetos.filter((o) => progresso.foiDescoberto(o.id)));
  const imagens = new Map();
  await Promise.all(descobertos.filter((o) => o.imagem).map(async (objeto) => {
    const jpeg = await carregarJpeg(objeto.imagem, { lado: 300 });
    if (jpeg) imagens.set(objeto.id, doc.adicionarImagem(jpeg));
  }));
  // Capa: a Terra (a foto já é quadrada, com o planeta no centro).
  const jpegCapa = await carregarJpeg(objetoPorId("terra").imagem, { lado: 420, centro: [0.5, 0.5], fundo: COR.espaco, vinheta: [0.4, 0.5] });
  const imagemCapa = jpegCapa ? doc.adicionarImagem(jpegCapa) : null;

  desenharCapa(doc, { nome, resumo, estatisticas: estado.estatisticas, grupos, imagemCapa });

  let pagina = null, y = 0;
  const novaPagina = () => { pagina = doc.novaPagina(); y = TOPO; };
  const caber = (altura) => { if (!pagina || y + altura > FUNDO) novaPagina(); };

  for (const grupo of grupos) {
    const nivel = NIVEIS.find((n) => n.id === grupo.nivel);
    const corNivel = COR_NIVEL[grupo.nivel];
    const lista = grupo.objetos.filter((o) => progresso.foiDescoberto(o.id));
    const cartoes = lista.map((objeto) => {
      const pergunta = perguntaDoObjeto(objeto.id);
      return montarVerbete(objeto, {
        distancia: distanciaDoObjeto(objeto), imagem: imagens.get(objeto.id),
        pergunta, resposta: pergunta ? estado.respostas[pergunta.id] : null, corNivel
      });
    });
    // O título do nível nunca fica sozinho no fim da página.
    caber(46 + (cartoes[0]?.altura || 30));
    if (y > TOPO) y += 12;
    pagina.retangulo(MARGEM, y, 5, 24, { fundo: corNivel, raio: 2.5 });
    pagina.texto(MARGEM + 16, y + 18, nivel.nome, { fonte: "negrito", tamanho: 18, cor: COR.tinta });
    pagina.texto(A4.largura - MARGEM, y + 17, `${lista.length} de ${grupo.objetos.length} descobertos`, { tamanho: 10, cor: COR.suave, alinhar: "direita" });
    y += 40;
    cartoes.forEach((cartao) => {
      caber(cartao.altura);
      cartao.desenhar(pagina, y);
      y += cartao.altura + 12;
    });
    const faltam = grupo.objetos.length - lista.length;
    caber(24);
    pagina.texto(MARGEM, y + 10, faltam
      ? `Faltam ${faltam} ${faltam === 1 ? "astro" : "astros"} para descobrir neste nível. Continue explorando!`
      : "Você descobriu todos os astros deste nível!", { fonte: "italico", tamanho: 9.5, cor: faltam ? COR.apagado : COR.certo });
    y += 30;
  }

  // Missões.
  const itens = montarMissoes();
  caber(46 + itens[0].altura);
  if (y > TOPO) y += 12;
  pagina.retangulo(MARGEM, y, 5, 24, { fundo: COR.ouro, raio: 2.5 });
  pagina.texto(MARGEM + 16, y + 18, "Missões", { fonte: "negrito", tamanho: 18, cor: COR.tinta });
  pagina.texto(A4.largura - MARGEM, y + 17, `${resumo.missoes} de ${resumo.totalMissoes} cumpridas`, { tamanho: 10, cor: COR.suave, alinhar: "direita" });
  y += 40;
  for (const { missao, data, linhas, altura } of itens) {
    caber(altura);
    (data ? marcaCerto : marcaVazia)(pagina, MARGEM, y + 12, data ? COR.ouro : COR.apagado);
    pagina.texto(MARGEM + 18, y + 12, missao.nome, { fonte: "negrito", tamanho: 11, cor: data ? COR.tinta : COR.suave });
    if (data) pagina.texto(A4.largura - MARGEM, y + 12, `cumprida em ${formatoDataCurta.format(new Date(data))}`, { tamanho: 8.5, cor: COR.ouro, alinhar: "direita" });
    linhas.forEach((linha, i) => pagina.texto(MARGEM + 18, y + 27 + i * 12.5, linha, { tamanho: 9.5, cor: COR.suave }));
    y += altura;
  }

  // Fontes.
  const fontes = "Fontes dos dados: NASA (fichas técnicas dos planetas, da Lua e do Sol), JPL/NASA (órbitas), IAU (eixos e rotação), " +
    "SIMBAD, Hipparcos e Gaia (estrelas), ESO, ESA e NASA (nebulosas e galáxias); as fontes de cada astro estão na ficha técnica dele. " +
    "Fotos: NASA, JPL e ESA/Hubble; o crédito de cada uma está no cartão do astro.";
  const linhasFontes = quebrarLinhas(fontes, "normal", 8.5, LARGURA);
  caber(30 + linhasFontes.length * 11.5);
  y += 16;
  pagina.linha([[MARGEM, y], [A4.largura - MARGEM, y]], { cor: COR.borda, espessura: 0.6 });
  linhasFontes.forEach((linha, i) => pagina.texto(MARGEM, y + 18 + i * 11.5, linha, { tamanho: 8.5, cor: COR.apagado }));

  // Cabeçalho e rodapé (o total de páginas só é conhecido no fim).
  const total = doc.paginas.length;
  doc.paginas.forEach((p, i) => {
    if (i > 0) {
      p.texto(MARGEM, 36, nome ? `Diário de bordo de ${nome}` : "Diário de bordo", { fonte: "negrito", tamanho: 9, cor: COR.suave });
      p.texto(A4.largura - MARGEM, 36, "Explorador do Universo", { tamanho: 9, cor: COR.apagado, alinhar: "direita" });
      p.linha([[MARGEM, 44], [A4.largura - MARGEM, 44]], { cor: COR.borda, espessura: 0.6 });
    }
    const largura = p.texto(MARGEM, A4.altura - 26, SITE, { tamanho: 8, cor: i ? COR.apagado : COR.suave });
    p.link(MARGEM, A4.altura - 35, largura, 12, `https://${SITE}/`);
    p.texto(A4.largura - MARGEM, A4.altura - 26, `página ${i + 1} de ${total}`, { tamanho: 8, cor: COR.apagado, alinhar: "direita" });
  });

  return doc.gerar();
}

/** Nome do arquivo: diario-de-bordo-ana-2026-11-04.pdf */
export function nomeDoArquivo(nome = "") {
  const parte = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const hoje = new Date();
  const data = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  return `diario-de-bordo${parte ? `-${parte}` : ""}-${data}.pdf`;
}

export { medir };
