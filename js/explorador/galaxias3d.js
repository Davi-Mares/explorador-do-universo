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

export const misturar = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const limitar = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
export const degrau = (a, b, v) => { const t = limitar((v - a) / (b - a)); return t * t * (3 - 2 * t); };

/** Ruído 3D suave (value noise em oitavas), resultado entre 0 e 1. */
export function criarRuido(semente) {
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
      extincao: { value: 0 },
      intensidade: { value: 1 }
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
      uniform float intensidade;
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
        fator *= exp(-extincao * length(mv.xyz)) * intensidade;
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
      atenuar: { value: 1 },
      extincao: { value: 0 },
      intensidade: { value: 1 }
    },
    vertexShader: /* glsl */ `
      attribute float tamanho;
      attribute float brilho;
      attribute vec3 cor;
      uniform float escalaPixel;
      uniform float escalaProjecao;
      uniform float escalaTamanho;
      uniform float extincao;
      uniform float intensidade;
      varying vec3 vCor;
      varying float vBrilho;
      ${TRECHO_PROFUNDIDADE_V}
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float px = tamanho * escalaTamanho * escalaProjecao / max(-mv.z, 1e-9);
        float limitado = clamp(px, 1.0, 200.0);
        // Uma mancha some quando a nave entra nela (não vira um borrão na tela).
        float dentro = smoothstep(0.6, 2.5, -mv.z / max(tamanho * escalaTamanho, 1e-12));
        vBrilho = brilho * min(1.0, px * 0.5) * min(1.0, pow(36.0 / limitado, 0.75)) * dentro
          * exp(-extincao * length(mv.xyz)) * intensidade${escuro ? " * min(1.0, pow(30.0 / limitado, 0.6))" : ""};
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
export class Lote {
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
export function direcao(aleatorio) {
  const z = aleatorio() * 2 - 1, fi = aleatorio() * DOIS_PI, r = Math.sqrt(1 - z * z);
  return [r * Math.cos(fi), z, r * Math.sin(fi)];
}

/** Raio de uma distribuição de Plummer (aglomerados), cortado em "maximo". */
export function raioPlummer(aleatorio, escala, maximo) {
  for (;;) {
    const u = Math.max(aleatorio(), 1e-6);
    const r = escala / Math.sqrt(u ** (-2 / 3) - 1);
    if (r <= maximo) return r;
  }
}

// ===========================================================================
// Via Láctea (unidade: mil anos-luz; "escala" muda o tamanho todo)
// Braços espirais medidos (Reid et al., 2019), barra longa (Wegg et al., 2015)
// e disco exponencial (Bland-Hawthorn e Gerhard, 2016). Ninguém fotografou a
// galáxia de fora: é uma ilustração montada com essas medidas. Do outro lado
// do centro quase não há medidas, e ali os braços seguem a continuação
// provável (mais fraca). As camadas:
//   1. o brilho do disco visto de frente: uma imagem calculada aqui mesmo,
//      a partir do mesmo modelo (some quando o disco é visto de lado);
//   2. estrelas, aglomerados jovens e nebulosas cor-de-rosa (pontos);
//   3. faixas de poeira escura do lado de dentro dos braços;
//   4. luz em volume (disco grosso, barra e bojo) e a faixa de poeira do meio
//      do disco, que aparecem quando a galáxia é vista de lado;
//   5. o halo: aglomerados globulares e estrelas velhas em volta do disco.
// ===========================================================================

const KLY_POR_KPC = 3.26156;
const RAD = Math.PI / 180;

/** Raio do braço (mil anos-luz) no azimute β (graus): ln(R/R_kink) = −(β − β_kink)·tan ψ. */
export function raioDoBraco(braco, beta) {
  const psi = (beta < braco.betaKink ? braco.psiAntes : braco.psiDepois) * RAD;
  return braco.rKinkKpc * KLY_POR_KPC * Math.exp(-(beta - braco.betaKink) * RAD * Math.tan(psi));
}

/** Largura (1σ) do braço: cresce 42 pc a cada kpc para fora (Reid et al., 2014). */
function larguraDoBraco(braco, raio) {
  return Math.max(0.3, (braco.larguraKpc + 0.042 * (raio / KLY_POR_KPC - braco.rKinkKpc)) * KLY_POR_KPC);
}

/** Do azimute β (0° = direção do Sol, no sentido da rotação) para x, y galactocêntricos. */
function noPlano(raio, beta) {
  const fi = Math.PI - beta * RAD;
  return [raio * Math.cos(fi), raio * Math.sin(fi)];
}

/** Trecho desenhado de um braço: o medido ("desenho") e, quando há, a continuação provável. */
const trechoDoBraco = (braco) => braco.provavel ?? braco.desenho;

/** Força da continuação provável (onde não há medidas), em relação ao trecho medido. */
const FORCA_PROVAVEL = 0.5;

/**
 * Peso do braço no azimute β: 1 no trecho medido e menor na continuação
 * provável; as pontas somem aos poucos (15°).
 */
function pesoDoBraco(braco, beta) {
  const [a, b] = trechoDoBraco(braco);
  const [ma, mb] = braco.desenho;
  const pontas = degrau(a, a + 15, beta) * (1 - degrau(b - 15, b, beta));
  const medido = degrau(ma - 20, ma, beta) * (1 - degrau(mb, mb + 20, beta));
  return pontas * (FORCA_PROVAVEL + (1 - FORCA_PROVAVEL) * medido);
}

/** Comprimento do braço em graus, contando a continuação provável pelo peso dela. */
function comprimentoEfetivo(braco) {
  const [a, b] = trechoDoBraco(braco);
  let soma = 0;
  for (let beta = a; beta <= b; beta += 1) soma += pesoDoBraco(braco, beta);
  return soma;
}

/** Ruído 2D rápido (tabela de 256 × 256, interpolação suave), em oitavas; resultado entre 0 e 1. */
function criarRuido2D(semente) {
  const aleatorio = aleatorioComSemente(semente);
  const tabela = Float32Array.from({ length: 65536 }, () => aleatorio());
  const s = (t) => t * t * (3 - 2 * t);
  function base(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = s(x - xi), fy = s(y - yi);
    const x0 = xi & 255, x1 = (xi + 1) & 255, y0 = (yi & 255) << 8, y1 = ((yi + 1) & 255) << 8;
    const a = tabela[y0 | x0], b = tabela[y0 | x1], c = tabela[y1 | x0], d = tabela[y1 | x1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  return (x, y, oitavas = 3) => {
    let total = 0, amplitude = 1, f = 1, soma = 0;
    for (let i = 0; i < oitavas; i++) {
      total += base(x * f + i * 31.7, y * f + i * 11.3) * amplitude;
      soma += amplitude;
      amplitude *= 0.5;
      f *= 2.03;
    }
    return total / soma;
  };
}

/**
 * Imagem do disco visto de frente (RGB), calculada pelo modelo: disco velho
 * amarelado (também entre os braços), barra e bojo dourados, braços azulados
 * com aglomerados jovens e nebulosas cor-de-rosa, e a poeira: a faixa do lado
 * de dentro de cada braço, as duas faixas da barra e fiapos entre os braços.
 */
function imagemDoDisco(lado, extensao) {
  const { bracos, barra, disco } = GALAXIA;
  const ruido = criarRuido2D(77);
  // Tabela de cada braço a cada meio grau: raio, largura e peso.
  const PASSO = 0.5;
  const tabelas = bracos.map((braco) => {
    const [a, b] = trechoDoBraco(braco);
    const n = Math.floor((b - a) / PASSO) + 1;
    const raio = new Float32Array(n), largura = new Float32Array(n), peso = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      const beta = a + k * PASSO;
      raio[k] = raioDoBraco(braco, beta);
      largura[k] = larguraDoBraco(braco, raio[k]);
      peso[k] = pesoDoBraco(braco, beta) * braco.forca;
    }
    return { a, b, n, raio, largura, peso };
  });
  const anguloBarra = Math.PI - barra.anguloGraus * RAD; // a ponta mais próxima do Sol, no 1º quadrante
  const cb = Math.cos(anguloBarra), sb = Math.sin(anguloBarra);
  const dados = new Uint8Array(lado * lado * 4);
  const passo = (2 * extensao) / lado;
  const tom = (v) => Math.round(255 * (1 - Math.exp(-v * 1.35)));
  for (let j = 0; j < lado; j++) {
    const y = -extensao + (j + 0.5) * passo;
    for (let i = 0; i < lado; i++) {
      const x = -extensao + (i + 0.5) * passo;
      const k4 = (j * lado + i) * 4;
      dados[k4 + 3] = 255;
      const r = Math.hypot(x, y);
      if (r > extensao) continue;
      let beta0 = 180 - Math.atan2(y, x) / RAD;          // φ = π − β
      beta0 = ((beta0 + 180) % 360 + 360) % 360 - 180;
      let somaBracos = 0, somaPoeira = 0;
      for (const t of tabelas) {
        for (let volta = -1; volta <= 1; volta++) {
          const beta = beta0 + 360 * volta;
          if (beta < t.a || beta > t.b) continue;
          const k = Math.min(t.n - 1, Math.round((beta - t.a) / PASSO));
          const w = t.largura[k], dr = r - t.raio[k];
          if (dr > 4 * w || dr < -3.5 * w) continue;
          // Do lado de dentro o braço acaba de repente (é onde fica a poeira); para fora, some aos poucos.
          const sigma = dr < 0 ? 0.8 * w : 1.25 * w;
          somaBracos += t.peso[k] * Math.exp(-(dr * dr) / (2 * sigma * sigma));
          const dp = dr + 0.95 * w;
          somaPoeira += t.peso[k] * Math.exp(-(dp * dp) / (2 * 0.2 * w * w));
        }
      }
      const borda = r < 44 ? 1 : Math.exp(-(r - 44) / 4.5);
      // Estrelas velhas: o disco exponencial e uma parte mais estendida, que dá o brilho entre os braços.
      const velho = (Math.exp(-r / disco.escalaKly) + 0.16 * Math.exp(-r / 22)) * borda;
      const xb = x * cb + y * sb, yb = -x * sb + y * cb;
      const naBarra = Math.exp(-Math.pow(Math.abs(xb) / 13.8, 3) - (yb / 2.4) ** 2);
      const bojo = Math.exp(-((xb / 3.4) ** 2 + (yb / 2.2) ** 2));
      const manchas = ruido(x * 0.2 + 3, y * 0.2, 3);            // nuvens de milhares de anos-luz
      const detalhe = ruido(x * 0.85 + 40, y * 0.85 + 9, 3);     // ≈ mil anos-luz
      const textura = 0.25 + 1.2 * degrau(0.32, 0.68, manchas);
      let jovens = 0, aglomerados = 0, nebulosas = 0;
      if (somaBracos > 0.01) {
        jovens = somaBracos * textura * (0.65 + 0.7 * detalhe) * borda;
        aglomerados = somaBracos * degrau(0.58, 0.76, ruido(x * 2.7 + 7, y * 2.7 + 90, 2)) * degrau(0.42, 0.62, detalhe) * borda;
        nebulosas = somaBracos * degrau(0.6, 0.76, ruido(x * 2.3 + 300, y * 2.3 + 50, 2)) * degrau(0.4, 0.6, manchas) * borda;
      }
      // Poeira: nas barras de outras galáxias ela forma duas faixas retas, uma de cada lado do centro.
      const desvio = yb + 0.75 * Math.sign(xb) * (1 - Math.exp(-Math.abs(xb) / 2.5));
      const faixaDaBarra = Math.exp(-(desvio * desvio) / 0.18) * Math.exp(-Math.pow(Math.abs(xb) / 12.5, 4)) * degrau(1.2, 3.5, Math.abs(xb));
      const fiapos = r > 6 ? degrau(0.5, 0.72, ruido(x * 0.55 + 9, y * 0.55 + 77, 3)) * Math.exp(-r / 30) * degrau(6, 14, r) : 0;
      const tau = 1.5 * Math.min(1.2, somaPoeira * (0.4 + 1.1 * detalhe)) + 0.7 * faixaDaBarra + 0.3 * fiapos;
      const vr = velho * 1.08 + naBarra * 0.9 + bojo * 2.2 + jovens * 0.42 + aglomerados * 0.5 + nebulosas * 0.85;
      const vg = velho * 0.92 + naBarra * 0.74 + bojo * 1.68 + jovens * 0.52 + aglomerados * 0.56 + nebulosas * 0.26;
      const vb = velho * 0.74 + naBarra * 0.52 + bojo * 1.08 + jovens * 0.78 + aglomerados * 0.7 + nebulosas * 0.42;
      // A poeira apaga mais o azul que o vermelho.
      dados[k4] = tom(vr * Math.exp(-0.75 * tau));
      dados[k4 + 1] = tom(vg * Math.exp(-tau));
      dados[k4 + 2] = tom(vb * Math.exp(-1.25 * tau));
    }
  }
  return dados;
}

/** Plano com a imagem do disco; some quando visto de lado ou de dentro do disco. */
function brilhoDoDisco(escala) {
  const lado = 1024, extensao = 58;
  const textura = new THREE.DataTexture(imagemDoDisco(lado, extensao), lado, lado, THREE.RGBAFormat);
  textura.magFilter = THREE.LinearFilter;
  textura.minFilter = THREE.LinearMipmapLinearFilter;
  textura.generateMipmaps = true;
  textura.needsUpdate = true;
  const material = new THREE.ShaderMaterial({
    uniforms: { mapa: { value: textura }, opacidade: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vMundo;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main() {
        vUv = uv;
        vec4 mundo = modelMatrix * vec4(position, 1.0);
        vMundo = mundo.xyz;
        gl_Position = projectionMatrix * viewMatrix * mundo;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D mapa;
      uniform float opacidade;
      varying vec2 vUv;
      varying vec3 vMundo;
      #include <common>
      #include <logdepthbuf_pars_fragment>
      void main() {
        #include <logdepthbuf_fragment>
        vec3 olhar = normalize(vMundo - cameraPosition);
        // De lado (raso) ou com a câmera dentro do disco, o plano some aos poucos.
        float raso = smoothstep(0.06, 0.32, abs(olhar.y));
        gl_FragColor = vec4(texture2D(mapa, vUv).rgb * raso * opacidade, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    // Soma a luz sem mexer na transparência da tela (o Comparador tem fundo próprio).
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor
  });
  const plano = new THREE.Mesh(new THREE.PlaneGeometry(2 * extensao * escala, 2 * extensao * escala), material);
  // Plano XY local → disco da cena (XZ): x galactocêntrico = x; y galactocêntrico = −z da cena.
  plano.rotation.x = -Math.PI / 2;
  plano.renderOrder = -10;
  plano.frustumCulled = false;
  return plano;
}

export function criarViaLactea({ escala = 1, materiais } = {}) {
  const aleatorio = aleatorioComSemente(2026);
  const ruido = criarRuido(2027);
  const { bracos, barra, disco } = GALAXIA;
  const estrelas = new Lote(), gas = new Lote(), poeira = new Lote(), volume = new Lote(), faixa = new Lote();
  const azul = corRgb("#cfdcff"), branca = corRgb("#f2f0ff"), rosa = corRgb("#ff7aa6"), dourada = corRgb("#ffd9a3");
  const velha = corRgb("#ffe6c7"), escura = corRgb("#140b06"), globular = corRgb("#ffe9c9");
  const adicionar = (lote, x, y, z, cor, tamanho, brilho) => {
    const p = astro.paraCena({ x, y, z });
    lote.add(p.x * escala, p.y * escala, p.z * escala, cor, tamanho * escala, brilho);
  };

  // Braços: metade das estrelas jovens fica em "complexos" (aglomerados e
  // associações de estrelas recém-nascidas, com nebulosas cor-de-rosa no
  // meio e poeira do lado de dentro); a outra metade, espalhada pelo braço.
  bracos.forEach((braco, indice) => {
    const [inicio, fim] = trechoDoBraco(braco);
    const fator = braco.forca * comprimentoEfetivo(braco) / 200;
    const sortearNoBraco = () => {
      for (;;) {
        const beta = inicio + aleatorio() * (fim - inicio);
        const rb = raioDoBraco(braco, beta);
        if (rb < 7 || rb > 56) continue;
        const peso = pesoDoBraco(braco, beta) * Math.min(1, rb / 30 + 0.3);
        if (aleatorio() < peso) return { beta, rb, w: larguraDoBraco(braco, rb) };
      }
    };
    // Complexos de formação de estrelas.
    const complexos = Math.round(70 * fator);
    for (let c = 0; c < complexos; c++) {
      const { beta, rb, w } = sortearNoBraco();
      const [cx, cy] = noPlano(rb + gaussiana(aleatorio) * w * 0.5, beta);
      const raioComplexo = 0.35 + aleatorio() * 0.75;
      const quantidade = 30 + Math.floor(aleatorio() * 90);
      for (let i = 0; i < quantidade; i++) {
        const [dx, dy, dz] = direcao(aleatorio);
        const r = Math.abs(gaussiana(aleatorio)) * raioComplexo;
        adicionar(estrelas, cx + dx * r, cy + dy * r, dz * r * 0.35, aleatorio() < 0.7 ? azul : branca, 0.2 + aleatorio() * 0.22, 0.1 + 0.1 * aleatorio());
      }
      for (let i = 0; i < 3 + aleatorio() * 6; i++) {
        adicionar(gas, cx + gaussiana(aleatorio) * raioComplexo * 0.5, cy + gaussiana(aleatorio) * raioComplexo * 0.5,
          gaussiana(aleatorio) * 0.1, rosa, 0.3 + aleatorio() * 0.4, 0.14 + aleatorio() * 0.12);
      }
      const [px, py] = noPlano(rb - 0.95 * w, beta);
      for (let i = 0; i < 6 + aleatorio() * 10; i++) {
        adicionar(poeira, px + gaussiana(aleatorio) * raioComplexo, py + gaussiana(aleatorio) * raioComplexo,
          gaussiana(aleatorio) * 0.1, escura, 0.7 + aleatorio() * 0.9, 0.14);
      }
    }
    // Estrelas espalhadas e a faixa de poeira contínua do lado de dentro.
    const espalhadas = Math.round(2600 * fator);
    for (let n = 0; n < espalhadas; n++) {
      const { beta, rb, w } = sortearNoBraco();
      const textura = degrau(0.3, 0.75, ruido(beta * 0.11, indice * 7.3, 0.5, 3));
      if (aleatorio() > 0.35 + 0.65 * textura) continue;
      const r = rb + gaussiana(aleatorio) * w;
      const b = beta + (gaussiana(aleatorio) * w * 0.6 / rb) / RAD;
      const [x, y] = noPlano(r, b);
      if (aleatorio() < 0.22) {
        const [xd, yd] = noPlano(rb - 0.95 * w + gaussiana(aleatorio) * w * 0.3, b);
        adicionar(poeira, xd, yd, gaussiana(aleatorio) * 0.1, escura, 0.7 + aleatorio() * 0.8, 0.12);
      } else {
        adicionar(estrelas, x, y, gaussiana(aleatorio) * 0.28, aleatorio() < 0.5 ? azul : branca, 0.22 + aleatorio() * 0.25, 0.07 + 0.07 * aleatorio());
      }
    }
  });

  // Disco velho: exponencial (2,6 kpc), mais grosso (300 pc).
  for (let i = 0; i < 14000; i++) {
    const r = -disco.escalaKly * Math.log(1 - aleatorio() * 0.998);
    if (r > 54) continue;
    const t = aleatorio() * DOIS_PI;
    adicionar(estrelas, r * Math.cos(t), r * Math.sin(t), gaussiana(aleatorio) * disco.alturaKly, velha, 0.35, 0.06);
  }

  // Barra longa e bojo em forma de amendoim, de estrelas velhas.
  const angulo = Math.PI - barra.anguloGraus * RAD;
  const ux = Math.cos(angulo), uy = Math.sin(angulo);
  for (let i = 0; i < 7000; i++) {
    const s = (aleatorio() * 2 - 1) * barra.meioComprimentoKly * Math.pow(aleatorio(), 0.35);
    const lateral = gaussiana(aleatorio) * 1.9;
    adicionar(estrelas, s * ux - lateral * uy, s * uy + lateral * ux, gaussiana(aleatorio) * 0.7, dourada, 0.42, 0.1);
  }
  for (let i = 0; i < 7000; i++) {
    const r = Math.abs(gaussiana(aleatorio)) * 3.1;
    const [dx, dy, dz] = direcao(aleatorio);
    const ao = r * dx * 1.35, lado = r * dz * 0.85;
    adicionar(estrelas, ao * ux - lado * uy, ao * uy + lado * ux, r * dy * 0.7, dourada, 0.48, 0.13);
  }

  // Luz em volume: manchas grandes e suaves com o disco grosso de estrelas
  // velhas, a barra e o bojo. Vista de lado, é ela que dá corpo à galáxia (o
  // plano com a imagem some); de frente, entra bem fraca.
  for (let i = 0; i < 2400; i++) {
    const r = -disco.escalaKly * 1.2 * Math.log(1 - aleatorio() * 0.995);
    if (r > 50) continue;
    const t = aleatorio() * DOIS_PI;
    adicionar(volume, r * Math.cos(t), r * Math.sin(t), gaussiana(aleatorio) * 1.3, velha, 3 + aleatorio() * 3, 0.03 + 0.02 * aleatorio());
  }
  // Disco fino: de lado, uma faixa de luz quente dos dois lados da poeira.
  for (let i = 0; i < 2200; i++) {
    const r = 6 + 44 * Math.pow(aleatorio(), 1.5);
    const t = aleatorio() * DOIS_PI;
    adicionar(volume, r * Math.cos(t), r * Math.sin(t), gaussiana(aleatorio) * 0.5, velha, 1.6 + aleatorio() * 1.6, (0.08 + 0.04 * aleatorio()) * Math.exp(-r / 34));
  }
  for (let i = 0; i < 500; i++) {
    const s = (aleatorio() * 2 - 1) * barra.meioComprimentoKly * Math.sqrt(aleatorio());
    const lateral = gaussiana(aleatorio) * 1.6;
    const altura = gaussiana(aleatorio) * 1.1 * (1 - 0.45 * Math.abs(s) / barra.meioComprimentoKly);
    adicionar(volume, s * ux - lateral * uy, s * uy + lateral * ux, altura, dourada, 2.5 + aleatorio() * 2.5, 0.02 + 0.012 * aleatorio());
  }
  for (let i = 0; i < 450; i++) {
    // Bojo: de lado ele sobressai do disco, mais alto no meio.
    const ao = gaussiana(aleatorio) * 3.6, lateral = gaussiana(aleatorio) * 2.6;
    adicionar(volume, ao * ux - lateral * uy, ao * uy + lateral * ux, gaussiana(aleatorio) * 1.9, dourada, 3.5 + aleatorio() * 2.5, 0.028 + 0.014 * aleatorio());
  }
  // Faixa de poeira no meio do disco: de lado, ela corta a galáxia com uma
  // linha escura, como nas espirais que vemos de perfil.
  // (Muitas manchas pequenas e fracas: somadas, viram uma faixa contínua.)
  for (let i = 0; i < 4200; i++) {
    const r = 9 + 38 * Math.pow(aleatorio(), 0.7);
    const t = aleatorio() * DOIS_PI;
    adicionar(faixa, r * Math.cos(t), r * Math.sin(t), gaussiana(aleatorio) * 0.07, escura, 0.55 + aleatorio() * 0.5, 0.3 * Math.exp(-r / 45));
  }
  // Halo: aglomerados globulares (a galáxia tem mais de 150 conhecidos; aqui
  // as posições são sorteadas, mais juntas perto do centro, e o tamanho é
  // aumentado para aparecerem) e estrelas velhas soltas.
  for (let i = 0; i < 150; i++) {
    const r = 1.5 + 90 * Math.pow(aleatorio(), 3);
    const [dx, dy, dz] = direcao(aleatorio);
    adicionar(estrelas, r * dx, r * dz, r * dy * 0.85, globular, 0.6, 0.45);
  }
  for (let i = 0; i < 2600; i++) {
    const r = 1 + Math.abs(gaussiana(aleatorio)) * 20;
    const [dx, dy, dz] = direcao(aleatorio);
    adicionar(estrelas, r * dx, r * dz, r * dy * 0.8, velha, 0.3, 0.025);
  }

  const grupo = new THREE.Group();
  const brilho = brilhoDoDisco(escala);
  grupo.add(brilho);
  const pontosEstrelas = estrelas.criar(materialDePontos({ atenuar: true }), materiais);
  const pontosPoeira = poeira.criar(materialDeGas({ escuro: true }), materiais);
  const pontosGas = gas.criar(materialDeGas(), materiais);
  const pontosVolume = volume.criar(materialDeGas(), materiais);
  const pontosFaixa = faixa.criar(materialDeGas({ escuro: true }), materiais);
  pontosVolume.renderOrder = -5;
  pontosFaixa.renderOrder = 1;
  pontosPoeira.renderOrder = 1;
  pontosGas.renderOrder = 2;
  grupo.add(pontosVolume, pontosEstrelas, pontosFaixa, pontosPoeira, pontosGas);
  const todos = [pontosEstrelas, pontosGas, pontosPoeira, pontosVolume, pontosFaixa];
  let intensidade = 1, deLado = 0;
  const aplicar = () => {
    for (const pontos of todos) {
      // De lado, a poeira do disco esconde quase todas as nebulosas cor-de-rosa.
      const propria = pontos === pontosVolume ? 0.12 + 0.88 * deLado : pontos === pontosFaixa ? deLado : pontos === pontosGas ? 1 - 0.8 * deLado : 1;
      pontos.material.uniforms.intensidade.value = intensidade * propria;
      pontos.visible = intensidade * propria > 0.002;
    }
  };
  aplicar();
  grupo.userData = {
    estrelas: pontosEstrelas,
    brilho,
    /** Dentro do disco a poeira apaga a luz de longe (extinção, por unidade de distância). */
    definirExtincao(valor) {
      for (const pontos of todos) pontos.material.uniforms.extincao.value = valor;
    },
    /** 0 a 1: o modelo todo some aos poucos (perto do Sol, o céu de verdade aparece no lugar). */
    definirIntensidade(valor) {
      intensidade = valor;
      aplicar();
    },
    /** 0 a 1: o quanto a galáxia é vista de lado (acende a luz em volume e a faixa de poeira do meio). */
    definirVistaDeLado(valor) {
      deLado = valor;
      aplicar();
    },
    /** 0 a 1: o brilho de frente some quando a nave está dentro do disco. */
    definirOpacidadeDoBrilho(valor) {
      brilho.material.uniforms.opacidade.value = valor;
      brilho.visible = valor > 0.002;
    }
  };
  return grupo;
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
  const pilares = [[-0.1, -0.44, 0.05, 0.14], [0.04, -0.4, 0.07, 0.12], [0.15, -0.42, 0.04, 0.09]];
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
    poeira.add(x, y, raio * 0.08 + gaussiana(aleatorio) * raio * 0.03, corRgb("#2a160f"), raio * 0.06, 0.13);
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

/**
 * Aglomerado globular (Ômega Centauri): milhões de estrelas velhas numa bola.
 * "raio" = até onde vão as estrelas mais afastadas (≈ 225 anos-luz, NASA);
 * a maior parte fica num miolo bem menor (distribuição de Plummer).
 */
export function criarAglomeradoGlobular({ raio, quantidade = 26000, semente = 5139, materiais }) {
  const aleatorio = aleatorioComSemente(semente);
  const lote = new Lote();
  const amarela = corRgb("#fff0d2"), gigante = corRgb("#ffb27a"), azul = corRgb("#bccdff");
  const miolo = raio * 0.055;
  for (let i = 0; i < quantidade; i++) {
    const r = raioPlummer(aleatorio, miolo, raio);
    const [dx, dy, dz] = direcao(aleatorio);
    const sorteio = aleatorio();
    const tipo = sorteio < 0.07 ? 1 : sorteio < 0.13 ? 2 : 0;
    lote.add(dx * r, dy * r * 0.92, dz * r, tipo === 1 ? gigante : tipo === 2 ? azul : amarela,
      miolo * (tipo === 1 ? 0.085 : 0.05), tipo === 1 ? 0.7 : 0.22 + aleatorio() * 0.16);
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
