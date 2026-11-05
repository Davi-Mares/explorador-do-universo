// ---------------------------------------------------------------------------
// PDF feito no próprio navegador, sem bibliotecas: páginas A4, textos com as
// fontes padrão de todo leitor de PDF (Helvetica), retângulos, círculos,
// linhas, imagens JPEG e links. Usado para baixar o Diário de bordo.
// Coordenadas em pontos (1/72 de polegada), com o y contado de cima para baixo.
// ---------------------------------------------------------------------------

export const A4 = { largura: 595.28, altura: 841.89 };

// Larguras das letras (em milésimos do tamanho da fonte) para os códigos
// 32 a 255 da codificação WinAnsi: métricas oficiais das fontes Helvetica.
const LARGURAS = {
  normal: [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,761,556,0,222,556,333,1000,556,556,333,1000,667,333,1000,0,611,0,0,222,222,333,333,350,556,1000,333,1000,500,333,944,0,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500],
  negrito: [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,761,556,0,278,556,500,1000,556,556,333,1000,667,333,1000,0,611,0,0,278,278,500,500,350,556,1000,333,1000,556,333,944,0,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556]
};
LARGURAS.italico = LARGURAS.normal;

const FONTES = { normal: "F1", negrito: "F2", italico: "F3" };

// Caracteres do Windows-1252 entre 0x80 e 0x9F (os outros coincidem com o Unicode).
const ESPECIAIS = {
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87, "ˆ": 0x88, "‰": 0x89, "Š": 0x8a,
  "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97,
  "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f
};

/** Texto → bytes WinAnsi. Emojis saem; "≈" vira "cerca de"; o que não existe vira "?". */
export function paraWinAnsi(texto) {
  const limpo = String(texto ?? "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/≈\s*/g, "cerca de ")
    .replace(/[−‒]/g, "-")
    .replace(/→/g, "->")
    .replace(/μ/g, "µ")
    .replace(/\s+/g, " ")
    .trim();
  const bytes = [];
  for (const letra of limpo) {
    const codigo = letra.codePointAt(0);
    if ((codigo >= 32 && codigo < 127) || (codigo >= 160 && codigo <= 255)) bytes.push(codigo);
    else if (ESPECIAIS[letra]) bytes.push(ESPECIAIS[letra]);
    else bytes.push(63);
  }
  return bytes;
}

function larguraDosBytes(bytes, fonte, tamanho) {
  const tabela = LARGURAS[fonte] || LARGURAS.normal;
  let soma = 0;
  for (const b of bytes) soma += b >= 32 ? tabela[b - 32] : 0;
  return (soma * tamanho) / 1000;
}

/** Largura do texto em pontos. */
export function medir(texto, fonte = "normal", tamanho = 11) {
  return larguraDosBytes(paraWinAnsi(texto), fonte, tamanho);
}

/** Quebra o texto em linhas que cabem na largura (palavras longas são cortadas). */
export function quebrarLinhas(texto, fonte, tamanho, largura) {
  const palavras = String(texto ?? "").split(/\s+/).filter(Boolean);
  const linhas = [];
  let atual = "";
  for (const palavra of palavras) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (medir(tentativa, fonte, tamanho) <= largura) {
      atual = tentativa;
      continue;
    }
    if (atual) linhas.push(atual);
    atual = palavra;
    while (medir(atual, fonte, tamanho) > largura && atual.length > 1) {
      let corte = atual.length - 1;
      while (corte > 1 && medir(atual.slice(0, corte), fonte, tamanho) > largura) corte--;
      linhas.push(atual.slice(0, corte));
      atual = atual.slice(corte);
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

// ---------- Utilidades de escrita ----------

const num = (v) => (Number.isFinite(v) ? v.toFixed(2).replace(/\.?0+$/, "") || "0" : "0");

function cor(hex) {
  const n = parseInt(String(hex).replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => num(c / 255)).join(" ");
}

/** String do PDF só com ASCII: acentos viram códigos octais (\351 = é). */
function stringPdf(bytes) {
  let s = "(";
  for (const b of bytes) {
    if (b === 40 || b === 41 || b === 92) s += `\\${String.fromCharCode(b)}`;
    else if (b < 32 || b > 126) s += `\\${b.toString(8).padStart(3, "0")}`;
    else s += String.fromCharCode(b);
  }
  return `${s})`;
}

/** Texto das informações do arquivo (título, autor) em UTF-16, aceito por todo leitor. */
function textoUnicode(texto) {
  let hex = "FEFF";
  for (const unidade of String(texto)) {
    for (let i = 0; i < unidade.length; i++) hex += unidade.charCodeAt(i).toString(16).padStart(4, "0").toUpperCase();
  }
  return `<${hex}>`;
}

function caminhoRetangulo(x, y, w, h, r) {
  if (!r) return `${num(x)} ${num(y)} ${num(w)} ${num(h)} re`;
  r = Math.min(r, w / 2, h / 2);
  const k = 0.5523 * r;
  return [
    `${num(x + r)} ${num(y)} m`, `${num(x + w - r)} ${num(y)} l`,
    `${num(x + w - r + k)} ${num(y)} ${num(x + w)} ${num(y + r - k)} ${num(x + w)} ${num(y + r)} c`,
    `${num(x + w)} ${num(y + h - r)} l`,
    `${num(x + w)} ${num(y + h - r + k)} ${num(x + w - r + k)} ${num(y + h)} ${num(x + w - r)} ${num(y + h)} c`,
    `${num(x + r)} ${num(y + h)} l`,
    `${num(x + r - k)} ${num(y + h)} ${num(x)} ${num(y + h - r + k)} ${num(x)} ${num(y + h - r)} c`,
    `${num(x)} ${num(y + r)} l`,
    `${num(x)} ${num(y + r - k)} ${num(x + r - k)} ${num(y)} ${num(x + r)} ${num(y)} c`, "h"
  ].join(" ");
}

function caminhoCirculo(cx, cy, r) {
  const k = 0.5523 * r;
  return [
    `${num(cx + r)} ${num(cy)} m`,
    `${num(cx + r)} ${num(cy + k)} ${num(cx + k)} ${num(cy + r)} ${num(cx)} ${num(cy + r)} c`,
    `${num(cx - k)} ${num(cy + r)} ${num(cx - r)} ${num(cy + k)} ${num(cx - r)} ${num(cy)} c`,
    `${num(cx - r)} ${num(cy - k)} ${num(cx - k)} ${num(cy - r)} ${num(cx)} ${num(cy - r)} c`,
    `${num(cx + k)} ${num(cy - r)} ${num(cx + r)} ${num(cy - k)} ${num(cx + r)} ${num(cy)} c`, "h"
  ].join(" ");
}

function pintura(fundo, borda, espessura) {
  const ops = [];
  if (fundo) ops.push(`${cor(fundo)} rg`);
  if (borda) ops.push(`${cor(borda)} RG ${num(espessura)} w`);
  return { ops, fim: fundo && borda ? "B" : fundo ? "f" : "S" };
}

// ---------- Página ----------

class Pagina {
  constructor() {
    this.ops = [];
    this.links = [];
    this.imagens = new Set();
    this.sombreamentos = [];
  }

  /**
   * Brilho com degradê radial suave (da cor do centro até a da borda).
   * "recorte" limita a pintura a um retângulo: { x, y, w, h, raio }.
   */
  gradienteRadial(cx, cy, r, corCentro, corBorda, { recorte = null, expoente = 0.55, nucleo = null } = {}) {
    const nome = `Sh${this.sombreamentos.length + 1}`;
    const yPdf = A4.altura - cy;
    const trecho = (de, ate, n) => `<< /FunctionType 2 /Domain [0 1] /C0 [${cor(de)}] /C1 [${cor(ate)}] /N ${num(n)} >>`;
    // Com "nucleo" ({ cor, ate }), o centro é um miolo claro que passa para a cor principal.
    const funcao = nucleo
      ? `<< /FunctionType 3 /Domain [0 1] /Functions [${trecho(nucleo.cor, corCentro, 1)} ${trecho(corCentro, corBorda, expoente)}] /Bounds [${num(nucleo.ate)}] /Encode [0 1 0 1] >>`
      : trecho(corCentro, corBorda, expoente);
    this.sombreamentos.push({
      nome,
      corpo: `<< /ShadingType 3 /ColorSpace /DeviceRGB /Coords [${num(cx)} ${num(yPdf)} 0 ${num(cx)} ${num(yPdf)} ${num(r)}] /Function ${funcao} /Extend [false false] >>`
    });
    this.ops.push("q");
    if (recorte) this.ops.push(`${caminhoRetangulo(recorte.x, A4.altura - recorte.y - recorte.h, recorte.w, recorte.h, recorte.raio || 0)} W n`);
    this.ops.push(`/${nome} sh`, "Q");
  }

  retangulo(x, y, w, h, { fundo, borda, espessura = 1, raio = 0 } = {}) {
    const { ops, fim } = pintura(fundo, borda, espessura);
    this.ops.push("q", ...ops, caminhoRetangulo(x, A4.altura - y - h, w, h, raio), fim, "Q");
  }

  circulo(cx, cy, r, { fundo, borda, espessura = 1 } = {}) {
    const { ops, fim } = pintura(fundo, borda, espessura);
    this.ops.push("q", ...ops, caminhoCirculo(cx, A4.altura - cy, r), fim, "Q");
  }

  /** Linha reta ou poligonal: pontos = [[x, y], ...]. */
  linha(pontos, { cor: corLinha = "#000000", espessura = 1, redonda = false } = {}) {
    const caminho = pontos.map(([x, y], i) => `${num(x)} ${num(A4.altura - y)} ${i ? "l" : "m"}`).join(" ");
    this.ops.push("q", `${cor(corLinha)} RG ${num(espessura)} w`, redonda ? "1 J 1 j" : "", caminho, "S", "Q");
  }

  /** Texto numa linha; y é a linha de base. Devolve a largura. */
  texto(x, y, conteudo, { fonte = "normal", tamanho = 11, cor: corTexto = "#000000", alinhar = "esquerda", espacamento = 0 } = {}) {
    const bytes = paraWinAnsi(conteudo);
    if (!bytes.length) return 0;
    const largura = larguraDosBytes(bytes, fonte, tamanho) + espacamento * Math.max(0, bytes.length - 1);
    const x0 = alinhar === "centro" ? x - largura / 2 : alinhar === "direita" ? x - largura : x;
    // O espaçamento entre letras (Tc) faz parte do estado gráfico: sempre definido.
    this.ops.push(`BT /${FONTES[fonte] || "F1"} ${num(tamanho)} Tf ${num(espacamento)} Tc ${cor(corTexto)} rg ${num(x0)} ${num(A4.altura - y)} Td ${stringPdf(bytes)} Tj ET`);
    return largura;
  }

  /** Parágrafo com quebra de linha. Devolve a altura ocupada. */
  paragrafo(x, y, largura, conteudo, opcoes = {}) {
    const { fonte = "normal", tamanho = 11 } = opcoes;
    const entrelinha = opcoes.entrelinha || tamanho * 1.35;
    const linhas = quebrarLinhas(conteudo, fonte, tamanho, largura);
    linhas.forEach((linha, i) => this.texto(x, y + tamanho + i * entrelinha, linha, opcoes));
    return linhas.length * entrelinha;
  }

  /** Imagem JPEG (de DocumentoPdf.adicionarImagem), opcionalmente com cantos arredondados. */
  imagem(imagem, x, y, w, h, { raio = 0 } = {}) {
    this.imagens.add(imagem);
    const base = A4.altura - y - h;
    this.ops.push("q");
    if (raio) this.ops.push(`${caminhoRetangulo(x, base, w, h, raio)} W n`);
    this.ops.push(`${num(w)} 0 0 ${num(h)} ${num(x)} ${num(base)} cm /${imagem.nome} Do`, "Q");
  }

  /** Área clicável que abre um endereço. */
  link(x, y, w, h, url) {
    this.links.push({ retangulo: [x, A4.altura - y - h, x + w, A4.altura - y], url });
  }
}

// ---------- Documento ----------

export class DocumentoPdf {
  constructor({ titulo = "", autor = "" } = {}) {
    this.titulo = titulo;
    this.autor = autor;
    this.paginas = [];
    this.imagens = [];
  }

  novaPagina() {
    const pagina = new Pagina();
    this.paginas.push(pagina);
    return pagina;
  }

  /** Registra uma imagem JPEG: { bytes: Uint8Array, largura, altura } (em pixels). */
  adicionarImagem({ bytes, largura, altura }) {
    const imagem = { nome: `Im${this.imagens.length + 1}`, bytes, largura, altura };
    this.imagens.push(imagem);
    return imagem;
  }

  /** Monta o arquivo e devolve um Blob "application/pdf". */
  gerar() {
    const codificador = new TextEncoder();
    const partes = [];
    const posicoes = [];
    let tamanho = 0;
    const escrever = (dado) => {
      const bytes = typeof dado === "string" ? codificador.encode(dado) : dado;
      partes.push(bytes);
      tamanho += bytes.length;
    };
    let total = 0;
    const novoId = () => ++total;
    const objeto = (id, corpo) => {
      posicoes[id] = tamanho;
      escrever(`${id} 0 obj\n${corpo}\nendobj\n`);
    };

    const idCatalogo = novoId(), idPaginas = novoId();
    const idFontes = { F1: novoId(), F2: novoId(), F3: novoId() };
    const idImagens = new Map(this.imagens.map((imagem) => [imagem, novoId()]));
    const ids = this.paginas.map((pagina) => ({
      pagina: novoId(), conteudo: novoId(), links: pagina.links.map(() => novoId()), sombras: pagina.sombreamentos.map(() => novoId())
    }));
    const idInfo = novoId();

    escrever("%PDF-1.4\n");
    escrever(new Uint8Array([37, 226, 227, 207, 211, 10])); // marca de arquivo binário
    objeto(idCatalogo, `<< /Type /Catalog /Pages ${idPaginas} 0 R >>`);
    objeto(idPaginas, `<< /Type /Pages /Kids [${ids.map((i) => `${i.pagina} 0 R`).join(" ")}] /Count ${ids.length} >>`);
    objeto(idFontes.F1, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    objeto(idFontes.F2, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    objeto(idFontes.F3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>");
    for (const [imagem, id] of idImagens) {
      posicoes[id] = tamanho;
      escrever(`${id} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imagem.largura} /Height ${imagem.altura} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imagem.bytes.length} >>\nstream\n`);
      escrever(imagem.bytes);
      escrever("\nendstream\nendobj\n");
    }
    const fontes = `/Font << /F1 ${idFontes.F1} 0 R /F2 ${idFontes.F2} 0 R /F3 ${idFontes.F3} 0 R >>`;
    this.paginas.forEach((pagina, i) => {
      const { pagina: idPagina, conteudo: idConteudo, links, sombras } = ids[i];
      const imagens = [...pagina.imagens].map((imagem) => `/${imagem.nome} ${idImagens.get(imagem)} 0 R`).join(" ");
      const degrades = pagina.sombreamentos.map(({ nome }, j) => `/${nome} ${sombras[j]} 0 R`).join(" ");
      const recursos = `<< ${fontes}${imagens ? ` /XObject << ${imagens} >>` : ""}${degrades ? ` /Shading << ${degrades} >>` : ""} >>`;
      const anotacoes = links.length ? ` /Annots [${links.map((id) => `${id} 0 R`).join(" ")}]` : "";
      objeto(idPagina, `<< /Type /Page /Parent ${idPaginas} 0 R /MediaBox [0 0 ${A4.largura} ${A4.altura}] /Resources ${recursos} /Contents ${idConteudo} 0 R${anotacoes} >>`);
      const conteudo = pagina.ops.filter(Boolean).join("\n");
      objeto(idConteudo, `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`);
      pagina.sombreamentos.forEach(({ corpo }, j) => objeto(sombras[j], corpo));
      pagina.links.forEach(({ retangulo, url }, j) => {
        const endereco = stringPdf([...String(url)].map((c) => c.charCodeAt(0)).filter((c) => c > 32 && c < 127));
        objeto(links[j], `<< /Type /Annot /Subtype /Link /Rect [${retangulo.map(num).join(" ")}] /Border [0 0 0] /A << /S /URI /URI ${endereco} >> >>`);
      });
    });
    const agora = new Date();
    const doisDigitos = (v) => String(v).padStart(2, "0");
    const data = `${agora.getFullYear()}${doisDigitos(agora.getMonth() + 1)}${doisDigitos(agora.getDate())}${doisDigitos(agora.getHours())}${doisDigitos(agora.getMinutes())}${doisDigitos(agora.getSeconds())}`;
    objeto(idInfo, `<< /Title ${textoUnicode(this.titulo)} /Author ${textoUnicode(this.autor)} /Creator (Explorador do Universo) /CreationDate (D:${data}) >>`);

    const inicioDaTabela = tamanho;
    let tabela = `xref\n0 ${total + 1}\n0000000000 65535 f \n`;
    for (let id = 1; id <= total; id++) tabela += `${String(posicoes[id]).padStart(10, "0")} 00000 n \n`;
    escrever(tabela);
    escrever(`trailer\n<< /Size ${total + 1} /Root ${idCatalogo} 0 R /Info ${idInfo} 0 R >>\nstartxref\n${inicioDaTabela}\n%%EOF\n`);
    return new Blob(partes, { type: "application/pdf" });
  }
}

/**
 * Carrega uma imagem do site e a converte em JPEG quadrado (fundo escuro,
 * imagem inteira centralizada), pronta para o PDF. Devolve null se falhar.
 */
export function carregarJpeg(src, { lado = 360, fundo = "#000000", qualidade = 0.86, centro = null, vinheta = null } = {}) {
  return new Promise((resolve) => {
    const imagem = new Image();
    imagem.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = lado;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = fundo;
        ctx.fillRect(0, 0, lado, lado);
        const { naturalWidth: largura, naturalHeight: altura } = imagem;
        if (centro) {
          // Recorte quadrado em volta de um ponto (frações da largura e da altura).
          const quadrado = Math.min(largura, altura);
          const sx = Math.min(largura - quadrado, Math.max(0, centro[0] * largura - quadrado / 2));
          const sy = Math.min(altura - quadrado, Math.max(0, centro[1] * altura - quadrado / 2));
          ctx.drawImage(imagem, sx, sy, quadrado, quadrado, 0, 0, lado, lado);
        } else {
          const escala = Math.min(lado / largura, lado / altura);
          const w = largura * escala, h = altura * escala;
          ctx.drawImage(imagem, (lado - w) / 2, (lado - h) / 2, w, h);
        }
        if (vinheta) {
          // Escurece as bordas até a cor do fundo (vinheta = [início, fim], frações do lado).
          const gradiente = ctx.createRadialGradient(lado / 2, lado / 2, lado * vinheta[0], lado / 2, lado / 2, lado * vinheta[1]);
          gradiente.addColorStop(0, "rgba(0, 0, 0, 0)");
          gradiente.addColorStop(1, fundo);
          ctx.fillStyle = gradiente;
          ctx.fillRect(0, 0, lado, lado);
        }
        canvas.toBlob(async (blob) => {
          resolve(blob ? { bytes: new Uint8Array(await blob.arrayBuffer()), largura: lado, altura: lado } : null);
        }, "image/jpeg", qualidade);
      } catch {
        resolve(null);
      }
    };
    imagem.onerror = () => resolve(null);
    imagem.src = src;
  });
}
