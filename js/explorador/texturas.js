// ---------------------------------------------------------------------------
// Explorador do Universo — texturas geradas por código.
// Em vez de fotos, cada astro ganha uma textura procedural (ruído 3D sobre a
// esfera, sem emenda): fica leve, funciona offline e deixa claro que a cena é
// uma representação. As cores seguem a aparência real de cada astro.
// ---------------------------------------------------------------------------

import * as THREE from "three";

// ---------- Ruído 3D (value noise) ----------

function criarRuido(semente) {
  const tabela = new Uint8Array(512);
  let s = semente >>> 0 || 1;
  const aleatorio = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const base = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  for (let i = 0; i < 512; i++) tabela[i] = base[i & 255];
  const valores = Float32Array.from({ length: 256 }, () => aleatorio());

  const valor = (x, y, z) => valores[tabela[(tabela[(tabela[x & 255] + y) & 255] + z) & 255]];
  const suave = (t) => t * t * (3 - 2 * t);
  const misturar = (a, b, t) => a + (b - a) * t;

  function ruido(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = suave(x - xi), yf = suave(y - yi), zf = suave(z - zi);
    const x00 = misturar(valor(xi, yi, zi), valor(xi + 1, yi, zi), xf);
    const x10 = misturar(valor(xi, yi + 1, zi), valor(xi + 1, yi + 1, zi), xf);
    const x01 = misturar(valor(xi, yi, zi + 1), valor(xi + 1, yi, zi + 1), xf);
    const x11 = misturar(valor(xi, yi + 1, zi + 1), valor(xi + 1, yi + 1, zi + 1), xf);
    return misturar(misturar(x00, x10, yf), misturar(x01, x11, yf), zf);
  }

  /** Ruído fractal (várias oitavas), resultado entre 0 e 1. */
  return function fractal(x, y, z, oitavas = 5) {
    let total = 0, amplitude = 1, frequencia = 1, soma = 0;
    for (let i = 0; i < oitavas; i++) {
      total += ruido(x * frequencia, y * frequencia, z * frequencia) * amplitude;
      soma += amplitude;
      amplitude *= 0.5;
      frequencia *= 2;
    }
    return total / soma;
  };
}

const ruidos = new Map();
/** Gerador de ruído para uma semente (reaproveitado entre texturas). */
function ruidoComSemente(semente) {
  if (!ruidos.has(semente)) ruidos.set(semente, criarRuido(semente));
  return ruidos.get(semente);
}

const hex = (cor) => {
  const n = parseInt(cor.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const mistura = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const limitar = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));

/**
 * Pinta uma textura equirretangular chamando pintar(lat, lon, x, y, z) para
 * cada pixel; (x, y, z) é o ponto na esfera unitária (sem emenda).
 */
function texturaEsferica(largura, pintar) {
  const altura = largura / 2;
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const contexto = canvas.getContext("2d");
  const imagem = contexto.createImageData(largura, altura);
  const dados = imagem.data;
  for (let j = 0; j < altura; j++) {
    const lat = (0.5 - (j + 0.5) / altura) * Math.PI;
    const cosLat = Math.cos(lat), y = Math.sin(lat);
    for (let i = 0; i < largura; i++) {
      const lon = ((i + 0.5) / largura) * Math.PI * 2;
      const x = cosLat * Math.cos(lon), z = cosLat * Math.sin(lon);
      const [r, g, b] = pintar(lat, lon, x, y, z);
      const k = (j * largura + i) * 4;
      dados[k] = r; dados[k + 1] = g; dados[k + 2] = b; dados[k + 3] = 255;
    }
  }
  contexto.putImageData(imagem, 0, 0);
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 4;
  return textura;
}

// ---------- Receitas por astro ----------

function rochoso(semente, clara, escura, { crateras = 0.6, escala = 3 } = {}) {
  const ruido = ruidoComSemente(semente);
  const c1 = hex(clara), c2 = hex(escura);
  return (lat, lon, x, y, z) => {
    const n = ruido(x * escala, y * escala, z * escala);
    const detalhe = ruido(x * 18 + 7, y * 18, z * 18, 3);
    // "Crateras": manchas pequenas de detalhe alto, mais escuras.
    const cratera = limitar((detalhe - 0.62) * 6) * crateras;
    return mistura(c1, c2, limitar(n * 1.2 - 0.1 + cratera * 0.5));
  };
}


function faixas(semente, cores, { turbulencia = 0.08, faixasPorPolo = 7, mancha = null } = {}) {
  const ruido = ruidoComSemente(semente);
  const paleta = cores.map(hex);
  return (lat, lon, x, y, z) => {
    const distorcao = (ruido(x * 4, y * 4, z * 4) - 0.5) * turbulencia * 4;
    let t = (Math.sin((y + distorcao) * faixasPorPolo * Math.PI) + 1) / 2;
    t = limitar(t + (ruido(x * 10, y * 30, z * 10, 3) - 0.5) * 0.35);
    const posicao = t * (paleta.length - 1);
    const i = Math.min(paleta.length - 2, Math.floor(posicao));
    let cor = mistura(paleta[i], paleta[i + 1], posicao - i);
    if (mancha) {
      const dLat = (lat - mancha.lat) / mancha.altura;
      const dLon = Math.atan2(Math.sin(lon - mancha.lon), Math.cos(lon - mancha.lon)) / mancha.largura;
      const d = dLat * dLat + dLon * dLon;
      if (d < 1) cor = mistura(cor, hex(mancha.cor), (1 - d) * 0.85);
    }
    return cor;
  };
}

function terra() {
  const ruido = ruidoComSemente(11);
  const oceano = hex("#1d4f9c"), oceanoRaso = hex("#2e74c2");
  const verde = hex("#3f7a3a"), deserto = hex("#b59a63"), gelo = hex("#eef4f8"), nuvem = hex("#ffffff");
  return (lat, lon, x, y, z) => {
    const continente = ruido(x * 2.2 + 3, y * 2.2, z * 2.2, 6);
    const polo = Math.abs(lat) > 1.2 + (ruido(x * 6, y * 6, z * 6, 2) - 0.5) * 0.25;
    let cor;
    if (polo) cor = gelo;
    else if (continente > 0.56) {
      const secura = limitar((ruido(x * 5 + 9, y * 5, z * 5, 3) - 0.45) * 3) * (1 - Math.abs(Math.abs(lat) - 0.4) * 1.5);
      cor = mistura(verde, deserto, limitar(secura));
    } else {
      cor = mistura(oceano, oceanoRaso, limitar((continente - 0.45) * 8));
    }
    const nuvens = limitar((ruido(x * 4 + 20, y * 6, z * 4, 5) - 0.55) * 3.2);
    return mistura(cor, nuvem, nuvens * 0.85);
  };
}

function marte() {
  const ruido = ruidoComSemente(23);
  const clara = hex("#c96a3c"), escura = hex("#7a3a22"), gelo = hex("#f1ebe4");
  return (lat, lon, x, y, z) => {
    if (lat > 1.35 || lat < -1.42) return gelo;
    const n = ruido(x * 3, y * 3, z * 3, 6);
    return mistura(clara, escura, limitar((n - 0.42) * 2.6));
  };
}

function sol() {
  const ruido = ruidoComSemente(5);
  const quente = hex("#fff3c4"), medio = hex("#ffc24a"), borda = hex("#ff8a1e");
  return (lat, lon, x, y, z) => {
    const granulos = ruido(x * 26, y * 26, z * 26, 3);
    const manchas = ruido(x * 5, y * 5, z * 5, 3);
    return mistura(mistura(quente, medio, granulos), borda, limitar((manchas - 0.6) * 2.5) * 0.6);
  };
}

const RECEITAS = {
  sol: () => sol(),
  mercurio: () => rochoso(2, "#b4aea6", "#5f5953", { crateras: 1 }),
  venus: () => faixas(3, ["#efe0b5", "#d8bf86", "#f4e7c4", "#cfb27a"], { turbulencia: 0.25, faixasPorPolo: 3 }),
  terra: () => terra(),
  lua: () => rochoso(4, "#c9c6c0", "#6d6a66", { crateras: 1.2, escala: 2.4 }),
  marte: () => marte(),
  jupiter: () => faixas(6, ["#f1e3c8", "#c99a6b", "#e8d4b0", "#a97850", "#f4ead6"], {
    turbulencia: 0.06, faixasPorPolo: 9,
    mancha: { lat: -0.39, lon: 1.2, altura: 0.075, largura: 0.17, cor: "#c0573a" }
  }),
  saturno: () => faixas(7, ["#f1e2bd", "#d9c08f", "#eadbb4", "#c9ab76"], { turbulencia: 0.04, faixasPorPolo: 8 }),
  urano: () => faixas(8, ["#b7ecee", "#9edfe3", "#c6f1f2"], { turbulencia: 0.02, faixasPorPolo: 4 }),
  netuno: () => faixas(9, ["#4d73e6", "#3a5ccc", "#6a8cf0", "#2f4fb5"], {
    turbulencia: 0.08, faixasPorPolo: 5,
    mancha: { lat: -0.35, lon: 3.6, altura: 0.08, largura: 0.16, cor: "#1d2f7a" }
  })
};

const prontas = new Map();

/** Textura de um astro (gerada só na primeira vez que for pedida). */
export function texturaDoAstro(id) {
  if (!RECEITAS[id]) return null;
  if (!prontas.has(id)) {
    const largura = id === "terra" || id === "jupiter" || id === "sol" ? 512 : 256;
    prontas.set(id, texturaEsferica(largura, RECEITAS[id]()));
  }
  return prontas.get(id);
}

/** Textura dos anéis de Saturno: faixas claras/escuras com transparência (U = raio). */
export function texturaDosAneis() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 4;
  const contexto = canvas.getContext("2d");
  const ruido = ruidoComSemente(12);
  for (let i = 0; i < 512; i++) {
    const t = i / 511;
    // Anel C (fraco) → Anel B (denso) → Divisão de Cassini (vazia) → Anel A.
    let alfa = t < 0.22 ? 0.28 : t < 0.62 ? 0.9 : t < 0.68 ? 0.06 : 0.7;
    alfa *= 0.75 + ruido(t * 60, 0.5, 0.5, 2) * 0.5;
    const brilho = 200 + Math.round(ruido(t * 30, 3, 1, 2) * 45);
    contexto.fillStyle = `rgba(${brilho}, ${brilho - 18}, ${brilho - 48}, ${limitar(alfa)})`;
    contexto.fillRect(i, 0, 1, 4);
  }
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

/** Brilho circular suave (usado para estrelas, o Sol e objetos distantes). */
let brilho = null;
export function texturaDeBrilho() {
  if (brilho) return brilho;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const contexto = canvas.getContext("2d");
  const gradiente = contexto.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradiente.addColorStop(0, "rgba(255,255,255,1)");
  gradiente.addColorStop(0.18, "rgba(255,255,255,0.75)");
  gradiente.addColorStop(0.45, "rgba(255,255,255,0.18)");
  gradiente.addColorStop(1, "rgba(255,255,255,0)");
  contexto.fillStyle = gradiente;
  contexto.fillRect(0, 0, 128, 128);
  brilho = new THREE.CanvasTexture(canvas);
  return brilho;
}
