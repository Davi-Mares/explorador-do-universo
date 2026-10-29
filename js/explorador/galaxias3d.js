// ---------------------------------------------------------------------------
// Explorador do Universo — galáxias, nebulosas e aglomerados em 3D.
// Tudo é feito de pontos: estrelas (pontinhos) e gás (manchas grandes e
// suaves que, somadas, parecem nuvens). As formas e as cores seguem as fotos
// de cada objeto e os tamanhos seguem as medidas publicadas (NASA, ESA).
// Tudo é gerado com semente fixa: a cena sai igual em toda visita.
// Usado pelo Explorador (cenas.js) e pelo Comparador (comparar.js).
// ---------------------------------------------------------------------------

import * as THREE from "three";
import * as astro from "./astronomia.js";
import { GALAXIA } from "./catalogo.js";

const EIXO_Y = new THREE.Vector3(0, 1, 0);
const DOIS_PI = Math.PI * 2;

// ---------- Utilidades ----------

/** Gerador pseudoaleatório com semente. */
export function aleatorioComSemente(semente) {
  let s = semente >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function gaussiana(aleatorio) {
  let u = 0, v = 0;
  while (u === 0) u = aleatorio();
  while (v === 0) v = aleatorio();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(DOIS_PI * v);
}

export function corRgb(hex) {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}

const misturar = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const limitar = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const degrau = (a, b, v) => { const t = limitar((v - a) / (b - a)); return t * t * (3 - 2 * t); };

/** Ruído 3D suave (value noise em oitavas), resultado entre 0 e 1. */
function criarRuido(semente) {
  const aleatorio = aleatorioComSemente(semente);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const tabela = new Uint8Array(512);
  for (let i = 0; i < 512; i++) tabela[i] = p[i & 255];
  const valores = Float32Array.from({ length: 256 }, () => aleatorio());
  const v = (x, y, z) => valores[tabela[(tabela[(tabela[x & 255] + y) & 255] + z) & 255]];
  const s = (t) => t * t * (3 - 2 * t);
  const m = (a, b, t) => a + (b - a) * t;
  function ruido(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = s(x - xi), yf = s(y - yi), zf = s(z - zi);
    return m(
      m(m(v(xi, yi, zi), v(xi + 1, yi, zi), xf), m(v(xi, yi + 1, zi), v(xi + 1, yi + 1, zi), xf), yf),
      m(m(v(xi, yi, zi + 1), v(xi + 1, yi, zi + 1), xf), m(v(xi, yi + 1, zi + 1), v(xi + 1, yi + 1, zi + 1), xf), yf),
      zf);
  }
  return (x, y, z, oitavas = 4) => {
    let total = 0, amplitude = 1, f = 1, soma = 0;
    for (let i = 0; i < oitavas; i++) {
      total += ruido(x * f + i * 17.1, y * f, z * f) * amplitude;
      soma += amplitude;
      amplitude *= 0.5;
      f *= 2.07;
    }
    return total / soma;
  };
}

// ---------- Materiais ----------

const TRECHO_PROFUNDIDADE_V = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>`;

/**
 * Pontos com cor, tamanho e brilho próprios (estrelas). Com "atenuar", o
 * tamanho é em unidades da cena (cresce ao se aproximar); sem, é em pixels.
 * "escalaTamanho" permite reaproveitar a mesma nuvem em outra escala.
 */
export function materialDePontos({ atenuar = false } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      escalaPixel: { value: 1 },
      escalaProjecao: { value: 800 },
      escalaTamanho: { value: 1 },
      atenuar: { value: atenuar ? 1 : 0 },
      extincao: { value: 0 }
    },
    vertexShader: /* glsl */ `
      attribute float tamanho;
      attribute float brilho;
      attribute vec3 cor;
      uniform float escalaPixel;
      uniform float escalaProjecao;
      uniform float escalaTamanho;
      uniform float atenuar;
      uniform float extincao;   // poeira: a luz de longe se apaga (1 / distância)
      varying vec3 vCor;
      varying float vBrilho;
      ${TRECHO_PROFUNDIDADE_V}
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float px = atenuar > 0.5 ? tamanho * escalaTamanho * escalaProjecao / max(-mv.z, 1e-9) : tamanho;
        float limitado = clamp(px, 1.0, 64.0);
        float fator = 1.0;
        if (atenuar > 0.5) {
          // Pontos grandes na tela ficam mais transparentes; e um ponto que
          // representa uma nuvem de estrelas some quando a nave entra nele
          // (de dentro do disco a faixa da galáxia não "estoura" de brilho).
          float dentro = smoothstep(1.5, 6.0, -mv.z / max(tamanho * escalaTamanho, 1e-12));
          fator = min(1.0, px) * pow(min(1.0, 18.0 / limitado), 1.3) * dentro;
        }
        fator *= exp(-extincao * length(mv.xyz));
        vBrilho = brilho * fator;
        vCor = cor;
        gl_PointSize = limitado * escalaPixel;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCor;
      varying float vBrilho;
      #include <common>
      #include <logdepthbuf_pars_fragment>
      void main() {
        #include <logdepthbuf_fragment>
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c) * 2.0;
        if (d > 1.0) discard;
        float a = (exp(-d * d * 5.5) + exp(-d * 3.0) * 0.35) * vBrilho;
        gl_FragColor = vec4(vCor, min(a, 1.0));
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

/**
 * Gás: manchas grandes e bem suaves somadas (brilho aditivo). Quando a
 * câmera chega perto e cada mancha cresce na tela, ela fica mais
 * transparente, para a nuvem não "estourar" de brilho.
 */
export function materialDeGas({ escuro = false } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      escalaPixel: { value: 1 },
      escalaProjecao: { value: 800 },
      escalaTamanho: { value: 1 },
      atenuar: { value: 1 }
    },
    vertexShader: /* glsl */ `
      attribute float tamanho;
      attribute float brilho;
      attribute vec3 cor;
      uniform float escalaPixel;
      uniform float escalaProjecao;
      uniform float escalaTamanho;
      varying vec3 vCor;
      varying float vBrilho;
      ${TRECHO_PROFUNDIDADE_V}
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float px = tamanho * escalaTamanho * escalaProjecao / max(-mv.z, 1e-9);
        float limitado = clamp(px, 1.0, 200.0);
        vBrilho = brilho * min(1.0, px * 0.5) * min(1.0, pow(36.0 / limitado, 0.75));
        vCor = cor;
        gl_PointSize = limitado * escalaPixel;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCor;
      varying float vBrilho;
      #include <common>
      #include <logdepthbuf_pars_fragment>
      void main() {
        #include <logdepthbuf_fragment>
        vec2 c = gl_PointCoord - 0.5;
        float d2 = dot(c, c) * 4.0;
        if (d2 > 1.0) discard;
        float a = exp(-d2 * 3.2) * (1.0 - d2) * vBrilho;
        gl_FragColor = vec4(vCor, ${escuro ? "min(a, 0.8)" : "a"});
      }`,
    transparent: true,
    depthWrite: false,
    blending: escuro ? THREE.NormalBlending : THREE.AdditiveBlending
  });
}

/** Junta os pontos numa geometria. */
export function pontos(posicoes, cores, tamanhos, brilhos, material) {
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.Float32BufferAttribute(posicoes, 3));
  geometria.setAttribute("cor", new THREE.Float32BufferAttribute(cores, 3));
  geometria.setAttribute("tamanho", new THREE.Float32BufferAttribute(tamanhos, 1));
  geometria.setAttribute("brilho", new THREE.Float32BufferAttribute(brilhos, 1));
  const objeto = new THREE.Points(geometria, material);
  objeto.frustumCulled = false;
  return objeto;
}

/** Acumula pontos e cria o objeto 3D no fim. */
class Lote {
  constructor() { this.p = []; this.c = []; this.t = []; this.b = []; }
  add(x, y, z, cor, tamanho, brilho) {
    this.p.push(x, y, z);
    this.c.push(cor[0], cor[1], cor[2]);
    this.t.push(tamanho);
    this.b.push(brilho);
  }
  get vazio() { return this.t.length === 0; }
  criar(material, materiais) {
    materiais?.push(material);
    return pontos(this.p, this.c, this.t, this.b, material);
  }
}

/** Direção aleatória uniforme na esfera. */
function direcao(aleatorio) {
  const z = aleatorio() * 2 - 1, fi = aleatorio() * DOIS_PI, r = Math.sqrt(1 - z * z);
  return [r * Math.cos(fi), z, r * Math.sin(fi)];
}

/** Raio de uma distribuição de Plummer (aglomerados), cortado em "maximo". */
function raioPlummer(aleatorio, escala, maximo) {
  for (;;) {
    const u = Math.max(aleatorio(), 1e-6);
    const r = escala / Math.sqrt(u ** (-2 / 3) - 1);
    if (r <= maximo) return r;
  }
}

// ===========================================================================
// Via Láctea (unidade: mil anos-luz; "escala" muda o tamanho todo)
// Os braços são uma representação esquemática (espiral logarítmica com
// inclinação de 12°, ajustada aos raios medidos dos braços na direção do Sol).
// ===========================================================================

export function criarViaLactea({ escala = 1, materiais } = {}) {
  const aleatorio = aleatorioComSemente(2026);
  const { distanciaSolCentroKly: r0, bracos, barra, inclinacaoEspiralGraus } = GALAXIA;
  const k = Math.tan((inclinacaoEspiralGraus * Math.PI) / 180);
  const lote = new Lote();
  const braco = corRgb("#cfe0ff"), quente = corRgb("#ffd7a0"), rosa = corRgb("#ff8fb8"), disco = corRgb("#dfe6ff");
  const adicionar = (x, y, z, cor, tamanho, brilho) => {
    const p = astro.paraCena({ x, y, z });
    lote.add(p.x * escala, p.y * escala, p.z * escala, cor, tamanho * escala, brilho);
  };

  // Braços espirais: r = r_sol · e^{k(θ − π)} (o Sol está no azimute π).
  for (const { raioNoSol } of bracos) {
    const thetaMin = Math.PI + Math.log(12 / raioNoSol) / k;
    const thetaMax = Math.PI + Math.log(52 / raioNoSol) / k;
    for (let i = 0; i < 11000; i++) {
      const theta = thetaMin + aleatorio() * (thetaMax - thetaMin);
      const r = raioNoSol * Math.exp(k * (theta - Math.PI));
      const largura = 0.9 + r * 0.035;
      const rr = r + gaussiana(aleatorio) * largura;
      const t = theta + gaussiana(aleatorio) * 0.02;
      const z = gaussiana(aleatorio) * 0.25;
      const regiaoHii = aleatorio() < 0.035;
      adicionar(rr * Math.cos(t), rr * Math.sin(t), z, regiaoHii ? rosa : braco,
        regiaoHii ? 0.5 : 0.32 + aleatorio() * 0.3, (regiaoHii ? 0.5 : 0.22) * (1.15 - r / 60));
    }
  }
  // Esporão (braço) de Órion, onde o Sol está.
  for (let i = 0; i < 2000; i++) {
    const theta = Math.PI + (aleatorio() * 2 - 1) * 0.24;
    const r = r0 * Math.exp(0.176 * (theta - Math.PI)) + gaussiana(aleatorio) * 1.0;
    adicionar(r * Math.cos(theta), r * Math.sin(theta), gaussiana(aleatorio) * 0.2, braco, 0.3, 0.11);
  }
  // Disco difuso (estrelas fora dos braços).
  for (let i = 0; i < 16000; i++) {
    const r = -10 * Math.log(1 - aleatorio() * 0.99);
    if (r > 55) continue;
    const t = aleatorio() * DOIS_PI;
    adicionar(r * Math.cos(t), r * Math.sin(t), gaussiana(aleatorio) * 0.5, disco, 0.4, 0.07);
  }
  // Barra central (≈ 27° da linha Sol–centro) e bojo.
  const angulo = Math.PI - (barra.anguloGraus * Math.PI) / 180;
  const ux = Math.cos(angulo), uy = Math.sin(angulo);
  for (let i = 0; i < 9000; i++) {
    const s = gaussiana(aleatorio) * barra.meioComprimentoKly * 0.45;
    const lateral = gaussiana(aleatorio) * 2.6;
    adicionar(s * ux - lateral * uy, s * uy + lateral * ux, gaussiana(aleatorio) * 1.1, quente, 0.45, 0.13);
  }
  for (let i = 0; i < 9000; i++) {
    const r = Math.abs(gaussiana(aleatorio)) * 3.2;
    const [dx, dy, dz] = direcao(aleatorio);
    adicionar(r * dx, r * dz, r * dy * 0.6, quente, 0.5, 0.16);
  }
  return lote.criar(materialDePontos({ atenuar: true }), materiais);
}

// ===========================================================================
// Galáxia espiral genérica (Andrômeda), disco no plano XZ (normal +Y).
// Bojo amarelado, braços azulados com faixas de poeira do lado de dentro,
// regiões cor-de-rosa de formação de estrelas e, em Andrômeda, o "anel" de
// formação estelar a uns 10 kpc do centro e as galáxias-satélite M32 e M110.
// ===========================================================================

export function criarGalaxiaEspiral({
  raio, semente = 31, quantidade = 40000, bracos = 2, passo = 0.22, anel = 0.6, companheiras = false, materiais
}) {
  const aleatorio = aleatorioComSemente(semente);
  const ruido = criarRuido(semente + 7);
  const lote = new Lote();
  const corBojo = corRgb("#ffe0ad"), corNucleo = corRgb("#fff3d6"), corDisco = corRgb("#dfe3f5");
  const corBraco = corRgb("#b9ccff"), corRosa = corRgb("#ff8fb8"), corVelha = corRgb("#ffd9a8");
  const tamanho = raio * 0.0075;

  // Bojo: concentrado e achatado.
  const nBojo = Math.round(quantidade * 0.24);
  for (let i = 0; i < nBojo; i++) {
    const r = raio * 0.11 * Math.pow(-Math.log(1 - aleatorio() * 0.995), 1.5) * 0.55;
    const [dx, dy, dz] = direcao(aleatorio);
    const perto = r < raio * 0.02;
    lote.add(dx * r, dy * r * 0.62, dz * r, perto ? corNucleo : corBojo, tamanho * (perto ? 1.3 : 1.1), perto ? 0.34 : 0.22);
  }

  // Disco com braços.
  const raioInicio = raio * 0.12;
  let feitos = 0, tentativas = 0;
  const nDisco = quantidade - nBojo;
  while (feitos < nDisco && tentativas < nDisco * 20) {
    tentativas++;
    const r = -raio * 0.3 * Math.log(1 - aleatorio() * 0.99);
    if (r > raio || r < raio * 0.03) continue;
    const t = aleatorio() * DOIS_PI;
    const fase = Math.log(Math.max(r, raioInicio) / raioInicio) / passo;
    let menor = Infinity, sinal = 0;
    for (let j = 0; j < bracos; j++) {
      let d = t - fase - (DOIS_PI * j) / bracos;
      d = ((d % DOIS_PI) + DOIS_PI * 1.5) % DOIS_PI - Math.PI;
      if (Math.abs(d) < Math.abs(menor)) { menor = d; sinal = Math.sign(d); }
    }
    const noBraco = Math.exp(-((menor / 0.42) ** 2));
    const poeira = Math.exp(-(((menor + 0.24) / 0.08) ** 2));   // faixa escura do lado de dentro
    const pesoAnel = anel ? 0.9 * Math.exp(-(((r / raio - anel) / 0.05) ** 2)) : 0;
    const textura = 0.65 + 0.7 * ruido(r / raio * 6, t * 1.3, 0.5, 3);
    let chance = (0.18 + 0.82 * noBraco + pesoAnel) * textura * (1 - 0.8 * poeira);
    if (aleatorio() > Math.min(1, chance)) continue;
    const altura = gaussiana(aleatorio) * raio * 0.01 * (1 + 1.5 * r / raio);
    const regiaoRosa = (noBraco > 0.5 || pesoAnel > 0.4) && aleatorio() < 0.05;
    const cor = regiaoRosa ? corRosa : noBraco > 0.55 || pesoAnel > 0.4 ? corBraco : r < raio * 0.25 ? corVelha : corDisco;
    const brilho = regiaoRosa ? 0.42 : 0.12 + 0.14 * noBraco + 0.1 * pesoAnel;
    lote.add(r * Math.cos(t), altura, r * Math.sin(t), cor, tamanho * (regiaoRosa ? 1.4 : 0.7 + aleatorio() * 0.6), brilho);
    feitos++;
  }

  if (companheiras) {
    // M32: pequena e compacta, perto do centro. M110: maior e difusa, mais longe.
    const satelite = (cx, cy, cz, escalaRaio, n, achatamento) => {
      for (let i = 0; i < n; i++) {
        const r = raioPlummer(aleatorio, escalaRaio, escalaRaio * 6);
        const [dx, dy, dz] = direcao(aleatorio);
        lote.add(cx + dx * r, cy + dy * r * achatamento, cz + dz * r, corBojo, tamanho * 0.9, 0.2);
      }
    };
    satelite(raio * 0.12, raio * 0.05, raio * 0.06, raio * 0.006, 900, 0.8);
    satelite(-raio * 0.16, raio * 0.18, -raio * 0.16, raio * 0.02, 1400, 0.55);
  }
  return lote.criar(materialDePontos({ atenuar: true }), materiais);
}

// ===========================================================================
// Galáxia irregular (Nuvens de Magalhães): barra, disco manchado e
// regiões de formação de estrelas (na Grande Nuvem, a Nebulosa da Tarântula).
// ===========================================================================

export function criarGalaxiaIrregular({ raio, semente, quantidade = 12000, alongamento = 1, tarantula = false, materiais }) {
  const aleatorio = aleatorioComSemente(semente);
  const ruido = criarRuido(semente + 3);
  const lote = new Lote();
  const corBarra = corRgb("#ffe7c2"), corDisco = corRgb("#d6e0ff"), corRosa = corRgb("#ff86b6");
  const tamanho = raio * 0.012;
  const nBarra = Math.round(quantidade * 0.3);
  for (let i = 0; i < nBarra; i++) {
    lote.add(gaussiana(aleatorio) * raio * 0.32 * alongamento, gaussiana(aleatorio) * raio * 0.07,
      gaussiana(aleatorio) * raio * 0.09, corBarra, tamanho, 0.32);
  }
  let feitos = 0, tentativas = 0;
  const nDisco = Math.round(quantidade * 0.62);
  while (feitos < nDisco && tentativas < nDisco * 12) {
    tentativas++;
    const x = gaussiana(aleatorio) * raio * 0.45 * alongamento, z = gaussiana(aleatorio) * raio * 0.38;
    const y = gaussiana(aleatorio) * raio * 0.06;
    const n = ruido(x / raio * 3 + 5, y / raio * 3, z / raio * 3, 4);
    if (aleatorio() > degrau(0.3, 0.7, n)) continue;
    lote.add(x, y, z, corDisco, tamanho * (0.7 + aleatorio() * 0.6), 0.24);
    feitos++;
  }
  // Regiões de formação de estrelas (rosas).
  const nucleos = tarantula ? [[raio * 0.28, raio * 0.02, -raio * 0.18, 0.05, 1.4]] : [];
  for (let i = 0; i < 6; i++) nucleos.push([gaussiana(aleatorio) * raio * 0.35, 0, gaussiana(aleatorio) * raio * 0.3, 0.025, 0.7]);
  const nRosa = quantidade - nBarra - nDisco;
  for (let i = 0; i < nRosa; i++) {
    const [cx, cy, cz, sigma, peso] = nucleos[Math.min(nucleos.length - 1, Math.floor(aleatorio() ** (tarantula ? 2.2 : 1) * nucleos.length))];
    lote.add(cx + gaussiana(aleatorio) * raio * sigma, cy + gaussiana(aleatorio) * raio * sigma * 0.5, cz + gaussiana(aleatorio) * raio * sigma,
      corRosa, tamanho * 1.2, 0.42 * peso);
  }
  return lote.criar(materialDePontos({ atenuar: true }), materiais);
}

// ===========================================================================
// Nebulosas (unidade: a da cena; "raio" dá o tamanho real)
// ===========================================================================

/** Grupo com gás (aditivo), poeira (escurece) e estrelas. */
function montarNebulosa(gas, poeira, estrelas, materiais) {
  const grupo = new THREE.Group();
  if (!gas.vazio) grupo.add(gas.criar(materialDeGas(), materiais));
  if (!poeira.vazio) {
    const escura = poeira.criar(materialDeGas({ escuro: true }), materiais);
    escura.renderOrder = 2;
    grupo.add(escura);
  }
  if (!estrelas.vazio) {
    const brilhantes = estrelas.criar(materialDePontos({ atenuar: true }), materiais);
    brilhantes.renderOrder = 3;
    grupo.add(brilhantes);
  }
  return grupo;
}

/**
 * Nebulosa de Órion (M42): uma "concha" brilhante aberta para o nosso lado,
 * iluminada pelas quatro estrelas do Trapézio; centro esverdeado (oxigênio),
 * bordas cor-de-rosa (hidrogênio) e a pequena M43 ao lado. Abertura: +Z local.
 */
export function criarNebulosaDeOrion({ raio, semente = 42, materiais }) {
  const aleatorio = aleatorioComSemente(semente);
  const ruido = criarRuido(semente);
  const gas = new Lote(), poeira = new Lote(), estrelas = new Lote();
  const centro = corRgb("#a8f7e0"), verde = corRgb("#7fe8c8"), rosa = corRgb("#ff6f93"), laranja = corRgb("#ff9a72");
  let feitos = 0;
  while (feitos < 3600) {
    const rr = raio * Math.min(1, Math.sqrt(-Math.log(Math.max(aleatorio(), 1e-6))) * 0.42);
    const a = aleatorio() * DOIS_PI;
    const x = rr * Math.cos(a), y = rr * Math.sin(a) * 0.85;
    const z = -0.55 * (rr * rr) / raio + gaussiana(aleatorio) * raio * 0.05;
    const n = ruido(x / raio * 2.6 + 3, y / raio * 2.6, z / raio * 2.6, 5);
    if (n < 0.4 + 0.18 * (rr / raio)) continue;
    const t = rr / raio;
    let cor = t < 0.18 ? misturar(centro, verde, t / 0.18) : misturar(verde, rosa, degrau(0.18, 0.55, t));
    if (aleatorio() < 0.12) cor = laranja;
    const grande = aleatorio() < 0.7;
    gas.add(x, y, z, cor, raio * (grande ? 0.16 + aleatorio() * 0.14 : 0.05), (grande ? 0.04 : 0.09) * (0.55 + 0.45 * degrau(0, 0.3, t)));
    feitos++;
  }
  // M43, ao norte.
  for (let i = 0; i < 380; i++) {
    gas.add(raio * 0.55 + gaussiana(aleatorio) * raio * 0.08, raio * 0.55 + gaussiana(aleatorio) * raio * 0.08,
      -raio * 0.1 + gaussiana(aleatorio) * raio * 0.05, rosa, raio * 0.09, 0.12);
  }
  // Faixa escura (a "boca do peixe") entre M42 e M43.
  for (let i = 0; i < 500; i++) {
    const s = aleatorio() * 2 - 1;
    poeira.add(raio * (0.15 + s * 0.35), raio * (0.32 - s * 0.12) + gaussiana(aleatorio) * raio * 0.04, raio * 0.04,
      corRgb("#2a1418"), raio * 0.1, 0.13);
  }
  // Trapézio (4 estrelas jovens e quentes) e o aglomerado da nebulosa.
  const trapezio = [[0, 0], [0.012, 0.006], [-0.006, 0.014], [0.004, -0.012]];
  for (const [dx, dy] of trapezio) estrelas.add(dx * raio, dy * raio, raio * 0.02, corRgb("#e9f1ff"), raio * 0.05, 1.3);
  for (let i = 0; i < 320; i++) {
    const r = raioPlummer(aleatorio, raio * 0.08, raio * 0.6);
    const [dx, dy, dz] = direcao(aleatorio);
    estrelas.add(dx * r, dy * r, dz * r * 0.6 + raio * 0.05, aleatorio() < 0.5 ? corRgb("#fff1e0") : corRgb("#ffc49a"),
      raio * 0.012, 0.35 + aleatorio() * 0.4);
  }
  return montarNebulosa(gas, poeira, estrelas, materiais);
}

/**
 * Nebulosa da Águia (M16): nuvem avermelhada com uma cavidade, os
 * "Pilares da Criação" (colunas de poeira com bordas brilhantes, de 4 a 5
 * anos-luz de altura) e o aglomerado jovem NGC 6611.
 */
export function criarNebulosaDaAguia({ raio, semente = 16, materiais }) {
  const aleatorio = aleatorioComSemente(semente);
  const ruido = criarRuido(semente);
  const gas = new Lote(), poeira = new Lote(), estrelas = new Lote();
  const vermelho = corRgb("#ff6a5a"), dourado = corRgb("#ffb46e"), verde = corRgb("#97e4c8");
  // Gás num anel grosso em volta de uma cavidade (vista de frente, +Z): a
  // borda de dentro, iluminada pelas estrelas jovens, é a mais brilhante.
  let feitos = 0;
  while (feitos < 4200) {
    const angulo = aleatorio() * DOIS_PI;
    const rho = raio * (0.34 + 0.66 * Math.pow(aleatorio(), 0.8));
    const x = Math.cos(angulo) * rho, y = Math.sin(angulo) * rho * 0.82;
    const z = gaussiana(aleatorio) * raio * 0.22;
    const n = ruido(x / raio * 2.2, y / raio * 2.2, z / raio * 2.2 + 9, 5);
    if (n < 0.45) continue;
    const borda = 1 - degrau(0.34, 0.6, rho / raio);
    const cor = borda > 0.5 && aleatorio() < 0.35 ? verde : aleatorio() < 0.4 ? dourado : vermelho;
    gas.add(x, y, z, cor, raio * (0.08 + aleatorio() * 0.14), 0.07 + 0.07 * borda);
    feitos++;
  }
  // Brilho fraco dentro da cavidade.
  for (let i = 0; i < 600; i++) {
    const r = Math.abs(gaussiana(aleatorio)) * raio * 0.22;
    const angulo = aleatorio() * DOIS_PI;
    gas.add(Math.cos(angulo) * r, Math.sin(angulo) * r * 0.82, gaussiana(aleatorio) * raio * 0.08, dourado, raio * 0.14, 0.03);
  }
  // Pilares da Criação: colunas de gás e poeira que sobem da borda de baixo
  // da cavidade (4 a 5 anos-luz de altura), escuras por dentro e com a
  // borda e a ponta iluminadas pelas estrelas jovens lá de cima.
  const pilares = [[-0.1, -0.44, 0.05, 0.17], [0.04, -0.4, 0.07, 0.125], [0.15, -0.42, 0.04, 0.09]];
  const base = corRgb("#7a3a20"), meio = corRgb("#b8693c"), borda = corRgb("#ffc58a"), escuro = corRgb("#2a170e");
  for (const [px, py, pz, h] of pilares) {
    for (let i = 0; i < 620; i++) {
      const s = aleatorio();
      const larguraLocal = raio * (0.024 * (1 - s * 0.5));
      const a = aleatorio() * DOIS_PI;
      const d = Math.sqrt(aleatorio());
      const x = px * raio + Math.cos(a) * larguraLocal * d;
      const z = pz * raio + Math.sin(a) * larguraLocal * d;
      const y = py * raio + s * h * raio;
      // Corpo do pilar (brilho fraco, mais claro para cima) e borda clara.
      gas.add(x, y, z, misturar(base, meio, s), raio * 0.03, 0.05 + 0.05 * s);
      if (d > 0.75 && Math.cos(a) > 0) gas.add(x, y, z + raio * 0.006, borda, raio * 0.016, 0.16 + 0.12 * s);
      if (i % 4 === 0) poeira.add(x - larguraLocal * 0.2, y, z + raio * 0.012, escuro, raio * 0.035, 0.05);
    }
    gas.add(px * raio, (py + h) * raio, (pz + 0.012) * raio, borda, raio * 0.035, 0.4);
  }
  // NGC 6611: estrelas jovens e azuladas acima dos pilares.
  for (let i = 0; i < 170; i++) {
    const r = raioPlummer(aleatorio, raio * 0.05, raio * 0.35);
    const [dx, dy, dz] = direcao(aleatorio);
    const forte = i < 14;
    estrelas.add(raio * 0.06 + dx * r, raio * 0.18 + dy * r, raio * 0.08 + dz * r, corRgb(forte ? "#dfe8ff" : "#f5f2ff"),
      raio * (forte ? 0.03 : 0.012), forte ? 1.0 : 0.4);
  }
  return montarNebulosa(gas, poeira, estrelas, materiais);
}

/**
 * Nebulosa de Carina: uma das maiores da galáxia. Nuvens vermelhas e
 * douradas cortadas por faixas escuras de poeira, os aglomerados Trumpler 14
 * e 16 e Eta Carinae, estrela gigante envolta na nebulosa "Homúnculo".
 */
export function criarNebulosaDeCarina({ raio, semente = 72, materiais }) {
  const aleatorio = aleatorioComSemente(semente);
  const ruido = criarRuido(semente);
  const gas = new Lote(), poeira = new Lote(), estrelas = new Lote();
  const cores = ["#ff5b5b", "#ff8a57", "#ffc46b", "#ff6f8a"].map(corRgb);
  const verde = corRgb("#8fe6d2");
  const lobos = Array.from({ length: 7 }, () => [gaussiana(aleatorio) * 0.32, gaussiana(aleatorio) * 0.22, gaussiana(aleatorio) * 0.2, 0.18 + aleatorio() * 0.16]);
  let feitos = 0;
  while (feitos < 5200) {
    const [cx, cy, cz, s] = lobos[Math.floor(aleatorio() * lobos.length)];
    const x = (cx + gaussiana(aleatorio) * s) * raio, y = (cy + gaussiana(aleatorio) * s * 0.7) * raio, z = (cz + gaussiana(aleatorio) * s * 0.6) * raio;
    const n = ruido(x / raio * 2.4 + 2, y / raio * 2.4, z / raio * 2.4, 5);
    if (n < 0.43) continue;
    const perto = Math.hypot(x, y, z) / raio < 0.25;
    const cor = perto && aleatorio() < 0.3 ? verde : cores[Math.floor(aleatorio() * cores.length)];
    gas.add(x, y, z, cor, raio * (0.06 + aleatorio() * 0.1), 0.1);
    feitos++;
  }
  // Faixa de poeira em "V", manchada, cortando a nuvem (perto do Buraco da Fechadura).
  for (let i = 0; i < 2200; i++) {
    const s = aleatorio() * 2 - 1;
    const x = s * raio * 0.6;
    const y = (Math.abs(s) * 0.42 - 0.1) * raio + gaussiana(aleatorio) * raio * (0.03 + Math.abs(s) * 0.03);
    if (ruido(x / raio * 4 + 1, y / raio * 4, 3, 3) < 0.38) continue;
    poeira.add(x, y, raio * 0.08 + gaussiana(aleatorio) * raio * 0.03, corRgb("#1c0f0b"), raio * 0.05, 0.22);
  }
  // Eta Carinae e o Homúnculo (dois lóbulos).
  estrelas.add(raio * 0.05, raio * 0.04, raio * 0.1, corRgb("#fff4d8"), raio * 0.025, 1.8);
  for (let i = 0; i < 260; i++) {
    const lado = i % 2 ? 1 : -1;
    const [dx, dy, dz] = direcao(aleatorio);
    const r = raio * 0.006;
    gas.add(raio * 0.05 + dx * r * 0.6, raio * 0.04 + lado * raio * 0.007 + dy * r, raio * 0.1 + dz * r * 0.6, corRgb("#ffb86b"), raio * 0.005, 0.25);
  }
  // Trumpler 14 e 16 e estrelas espalhadas.
  const aglomerados = [[-0.16, 0.1, 0.06, 0.03, 130], [0.08, 0.02, 0.08, 0.05, 170]];
  for (const [cx, cy, cz, s, n] of aglomerados) {
    for (let i = 0; i < n; i++) {
      const forte = i < 10;
      estrelas.add((cx + gaussiana(aleatorio) * s) * raio, (cy + gaussiana(aleatorio) * s) * raio, (cz + gaussiana(aleatorio) * s) * raio,
        corRgb(forte ? "#dce6ff" : "#f2f0ff"), raio * (forte ? 0.012 : 0.006), forte ? 0.9 : 0.35);
    }
  }
  for (let i = 0; i < 420; i++) {
    const [dx, dy, dz] = direcao(aleatorio);
    const r = raio * Math.pow(aleatorio(), 0.5) * 0.9;
    estrelas.add(dx * r, dy * r * 0.7, dz * r, corRgb(aleatorio() < 0.5 ? "#fff3e6" : "#ffd2a8"), raio * 0.005, 0.3);
  }
  return montarNebulosa(gas, poeira, estrelas, materiais);
}

/**
 * Nebulosa do Caranguejo (M1): resto da supernova vista em 1054. Filamentos
 * alaranjados numa casca em forma de ovo (≈ 6 anos-luz), brilho azulado
 * por dentro e, no centro, o pulsar que gira 30 vezes por segundo.
 */
export function criarNebulosaDoCaranguejo({ raio, semente = 1054, materiais }) {
  const aleatorio = aleatorioComSemente(semente);
  const gas = new Lote(), poeira = new Lote(), estrelas = new Lote();
  const eixos = [1, 0.72, 0.78];
  const cores = ["#ff5e48", "#ff9450", "#ffcf72", "#ff7a5c"].map(corRgb);
  for (let f = 0; f < 80; f++) {
    // Cada filamento é um arco na casca, com pequenas ondulações.
    const inicio = new THREE.Vector3(...direcao(aleatorio));
    const eixo = new THREE.Vector3(...direcao(aleatorio)).cross(inicio).normalize();
    const comprimento = 0.5 + aleatorio() * 1.2;
    const raioFio = 0.82 + aleatorio() * 0.18;
    const cor = cores[Math.floor(aleatorio() * cores.length)];
    const ponto = new THREE.Vector3();
    for (let i = 0; i < 46; i++) {
      ponto.copy(inicio).applyAxisAngle(eixo, (i / 45) * comprimento);
      const ondula = 1 + Math.sin(i * 0.7 + f) * 0.03 + gaussiana(aleatorio) * 0.012;
      gas.add(ponto.x * raio * eixos[0] * raioFio * ondula, ponto.y * raio * eixos[1] * raioFio * ondula,
        ponto.z * raio * eixos[2] * raioFio * ondula, cor, raio * 0.06, 0.3);
    }
  }
  // Brilho azulado (radiação síncrotron) por dentro.
  for (let i = 0; i < 1500; i++) {
    const [dx, dy, dz] = direcao(aleatorio);
    const r = Math.abs(gaussiana(aleatorio)) * 0.38;
    if (r > 0.95) continue;
    gas.add(dx * r * raio * eixos[0], dy * r * raio * eixos[1], dz * r * raio * eixos[2], corRgb("#9fc2ff"), raio * 0.28, 0.06);
  }
  estrelas.add(0, 0, 0, corRgb("#ffffff"), raio * 0.04, 2.2);
  return montarNebulosa(gas, poeira, estrelas, materiais);
}

// ===========================================================================
// Aglomerados de estrelas
// ===========================================================================

/**
 * Plêiades (M45): as estrelas mais brilhantes nas direções reais do céu
 * (o desenho da "concha" visto da Terra), mais de mil estrelas menores e
 * a névoa azulada de poeira que reflete a luz delas.
 * estrelasPrincipais: [{ posicao: THREE.Vector3 (relativa ao centro), brilho }]
 */
export function criarPleiades({ raio, estrelasPrincipais, semente = 45, materiais }) {
  const aleatorio = aleatorioComSemente(semente);
  const gas = new Lote(), poeira = new Lote(), estrelas = new Lote();
  const azul = corRgb("#dce7ff");
  for (const { posicao, brilho } of estrelasPrincipais) {
    estrelas.add(posicao.x, posicao.y, posicao.z, azul, raio * 0.04 * (0.7 + brilho * 0.4), 0.8 + brilho * 0.8);
    for (let i = 0; i < 260 * brilho; i++) {
      const r = Math.abs(gaussiana(aleatorio)) * raio * 0.07;
      const [dx, dy, dz] = direcao(aleatorio);
      gas.add(posicao.x + dx * r, posicao.y + dy * r, posicao.z + dz * r, corRgb("#7ea6ff"), raio * (0.03 + aleatorio() * 0.05), 0.07);
    }
  }
  const cores = ["#cddcff", "#f6f4ff", "#fff1d8", "#ffd2a0", "#ffb38a"].map(corRgb);
  for (let i = 0; i < 1000; i++) {
    const r = raioPlummer(aleatorio, raio * 0.2, raio);
    const [dx, dy, dz] = direcao(aleatorio);
    const cor = cores[Math.min(cores.length - 1, Math.floor(aleatorio() ** 0.8 * cores.length))];
    estrelas.add(dx * r, dy * r, dz * r, cor, raio * 0.012, 0.2 + aleatorio() * 0.3);
  }
  return montarNebulosa(gas, poeira, estrelas, materiais);
}

/** Aglomerado globular (Ômega Centauri): milhões de estrelas velhas numa bola. */
export function criarAglomeradoGlobular({ raio, quantidade = 26000, semente = 5139, materiais }) {
  const aleatorio = aleatorioComSemente(semente);
  const lote = new Lote();
  const amarela = corRgb("#fff0d2"), gigante = corRgb("#ffb27a"), azul = corRgb("#bccdff");
  for (let i = 0; i < quantidade; i++) {
    const r = raioPlummer(aleatorio, raio * 0.12, raio);
    const [dx, dy, dz] = direcao(aleatorio);
    const sorteio = aleatorio();
    const tipo = sorteio < 0.07 ? 1 : sorteio < 0.13 ? 2 : 0;
    lote.add(dx * r, dy * r * 0.92, dz * r, tipo === 1 ? gigante : tipo === 2 ? azul : amarela,
      raio * (tipo === 1 ? 0.014 : 0.008), tipo === 1 ? 0.7 : 0.22 + aleatorio() * 0.16);
  }
  return lote.criar(materialDePontos({ atenuar: true }), materiais);
}

/** Aglomerado de estrelas do centro da galáxia, em volta de Sagitário A*. */
export function criarNucleoGalactico({ raio, semente = 4, materiais }) {
  const aleatorio = aleatorioComSemente(semente);
  const lote = new Lote();
  for (let i = 0; i < 4500; i++) {
    const r = raioPlummer(aleatorio, raio * 0.15, raio);
    const [dx, dy, dz] = direcao(aleatorio);
    const azul = i < 60;
    lote.add(dx * r, dy * r * 0.8, dz * r, corRgb(azul ? "#d5e2ff" : aleatorio() < 0.6 ? "#ffd7a3" : "#fff0d8"),
      raio * (azul ? 0.02 : 0.01), azul ? 0.8 : 0.25);
  }
  return lote.criar(materialDePontos({ atenuar: true }), materiais);
}

/** Ajusta os uniforms de todos os materiais de pontos (pixels e projeção). */
export function ajustarMateriais(materiais, escalaPixel, escalaProjecao) {
  for (const material of materiais) {
    material.uniforms.escalaPixel.value = escalaPixel;
    material.uniforms.escalaProjecao.value = escalaProjecao;
  }
}

export { EIXO_Y };
