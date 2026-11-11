// ---------------------------------------------------------------------------
// Explorador do Universo — as galáxias vizinhas em 3D, em escala real (unidade:
// mil anos-luz): Andrômeda (M31) com as satélites M32 e M110, a Galáxia do
// Triângulo (M33), a Grande e a Pequena Nuvem de Magalhães e a Ponte de
// Magalhães entre elas.
//
// Cada disco é montado no plano XZ do próprio modelo (eixo maior em +X, eixo
// de giro em +Y) com os braços "arrastados" para trás do giro, como nas
// galáxias de verdade, e é virado como de verdade pela geometria medida
// (catalogo.js → astronomia.geometriaDoDisco). Os lugares com nome (NGC 206,
// NGC 604, a Tarântula...) entram no ponto do disco que fica atrás da posição
// deles no céu. Tudo é gerado com semente fixa: sai igual em toda visita.
//
// Três camadas, como na Via Láctea (galaxias3d.js):
//   1. o brilho do disco visto de frente: uma imagem calculada aqui mesmo;
//   2. estrelas, aglomerados e nebulosas cor-de-rosa (pontos);
//   3. poeira escura no disco e o que tem volume (bojo, satélites), em duas
//      metades: a de trás do disco é desenhada antes da poeira e a da frente
//      depois, para a poeira cobrir o bojo só do lado certo.
// Usado pelo Explorador (cenas.js) e pelo Comparador (comparar.js).
// ---------------------------------------------------------------------------

import * as THREE from "three";
import * as astro from "./astronomia.js";
import { objetoPorId } from "./catalogo.js";
import {
  aleatorioComSemente, gaussiana, corRgb, materialDePontos, materialDeGas, Lote, criarRuido, direcao, raioPlummer, degrau
} from "./galaxias3d.js";

const RAD = Math.PI / 180;
const DOIS_PI = Math.PI * 2;
const KLY_POR_KPC = 3.26156;

/** Ângulo entre −π e π. */
const embrulhar = (a) => ((a % DOIS_PI) + DOIS_PI * 1.5) % DOIS_PI - Math.PI;
const regiao = (objeto, id) => objeto.regioes.find((r) => r.id === id);

// ---------- Geometria (do céu para o modelo) ----------

function medir(objeto) {
  const ar = astro.arParaGraus(objeto.ar), dec = astro.decParaGraus(objeto.dec);
  let base;
  if (objeto.disco) {
    base = astro.geometriaDoDisco({ ar, dec, ...objeto.disco });
  } else {
    // Sem disco (Pequena Nuvem): x = leste, y = norte, z = para longe da Terra.
    const ceu = astro.direcoesNoCeu(ar, dec);
    const n = astro.vetorEquatorial(ar, dec);
    base = { n, m: ceu.leste, giro: ceu.norte, lateral: n, ceu };
  }
  const D = objeto.d;
  const graus = (texto) => astro.arParaGraus(texto);
  const decGraus = (texto) => astro.decParaGraus(texto);
  /** Direção do céu a "afastamento" graus de (ar, dec), no ângulo de posição pa. */
  const desviar = (arTexto, decTexto, pa, afastamento) => {
    const a = graus(arTexto), d = decGraus(decTexto);
    const n = astro.vetorEquatorial(a, d), u = astro.direcoesNoCeu(a, d).angulo(pa);
    const t = afastamento * RAD;
    return n.map((v, i) => v * Math.cos(t) + u[i] * Math.sin(t));
  };
  return {
    base, D,
    klyPorGrau: D * RAD,
    /** Ponto do disco atrás de um ponto do céu. */
    noDisco: (arTexto, decTexto) => astro.noPlanoDoDisco(base, D, graus(arTexto), decGraus(decTexto)),
    /** Ponto do disco atrás de um ponto do céu deslocado. */
    noDiscoDesviado: (arTexto, decTexto, pa, afastamento) => astro.noPlanoDoDiscoNaDirecao(base, D, desviar(arTexto, decTexto, pa, afastamento)),
    /** Ponto do céu a uma distância própria (fora do disco). */
    noEspaco: (arTexto, decTexto, distancia) => astro.noEspacoDaGalaxia(base, D, graus(arTexto), decGraus(decTexto), distancia),
    /** Uma direção do céu (vetor equatorial) no referencial do modelo. */
    direcao: (v) => astro.noReferencialDoDisco(base, v)
  };
}

/** Do vetor equatorial para a cena 3D (galáctico, com y para o polo norte galáctico). */
function paraCena(v) {
  const g = astro.equatorialParaGalacticoVetor(v);
  const p = astro.paraCena({ x: g[0], y: g[1], z: g[2] });
  return new THREE.Vector3(p.x, p.y, p.z);
}

/** Rotação que leva o modelo (eixo maior em +X, giro em +Y) para a orientação real na cena. */
export function orientacaoNaCena(objeto) {
  const { base } = medir(objeto);
  const matriz = new THREE.Matrix4().makeBasis(paraCena(base.m), paraCena(base.giro), paraCena(base.lateral));
  return new THREE.Quaternion().setFromRotationMatrix(matriz);
}

// ---------- Sorteios ----------

/** Gama(k) (Marsaglia e Tsang), para o raio de um perfil de Sérsic. */
function gama(aleatorio, k) {
  if (k < 1) return gama(aleatorio, k + 1) * Math.pow(aleatorio(), 1 / k);
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x, v;
    do { x = gaussiana(aleatorio); v = 1 + c * x; } while (v <= 0);
    v = v * v * v;
    const u = aleatorio();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/** Raio de um perfil de Sérsic (índice n, raio de meia-luz re). */
function raioSersic(aleatorio, re, n) {
  const b = 2 * n - 1 / 3 + 0.009876 / n;
  return re * Math.pow(gama(aleatorio, 2 * n) / b, n);
}

/**
 * Tabela 2D de um campo suave (ruído), calculada uma vez e lida com
 * interpolação bilinear: bem mais rápida que calcular o ruído em cada ponto.
 */
function tabela2D(lado, u0, u1, v0, v1, funcao) {
  const valores = new Float32Array(lado * lado);
  for (let j = 0; j < lado; j++) {
    const v = v0 + ((v1 - v0) * j) / (lado - 1);
    for (let i = 0; i < lado; i++) valores[j * lado + i] = funcao(u0 + ((u1 - u0) * i) / (lado - 1), v);
  }
  const ku = (lado - 1) / (u1 - u0), kv = (lado - 1) / (v1 - v0), maximo = lado - 1.0001;
  return (u, v) => {
    const x = Math.min(maximo, Math.max(0, (u - u0) * ku)), y = Math.min(maximo, Math.max(0, (v - v0) * kv));
    const i = x | 0, j = y | 0, fx = x - i, fy = y - j, k = j * lado + i;
    return (valores[k] * (1 - fx) + valores[k + 1] * fx) * (1 - fy) + (valores[k + lado] * (1 - fx) + valores[k + lado + 1] * fx) * fy;
  };
}

/** Pontos e imagens: menos no celular (memória e processador menores). */
const LEVE = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
const QUANTIDADE = LEVE ? 0.6 : 1;
const quantos = (n) => Math.round(n * QUANTIDADE);

// ---------- Imagem do disco visto de frente ----------

const tom = (v) => Math.round(255 * (1 - Math.exp(-Math.max(0, v) * 1.2)));

/**
 * O "campo" de uma galáxia (luz das estrelas velhas, das jovens, poeira...)
 * calculado uma vez numa grade que cobre o disco. Serve para pintar a imagem
 * e para sortear as estrelas e nebulosas no mesmo lugar da luz, sem refazer a
 * conta. A linha j = 0 da grade é a borda +z (o plano XY é deitado em XZ).
 */
function gradeDoCampo({ lado, extensao, medirCampo, campos }) {
  const passo = (2 * extensao) / lado;
  const grades = campos.map(() => new Float32Array(lado * lado));
  for (let j = 0; j < lado; j++) {
    const z = extensao - (j + 0.5) * passo;
    for (let i = 0; i < lado; i++) {
      const x = -extensao + (i + 0.5) * passo;
      const r = Math.hypot(x, z);
      if (r > extensao) continue;
      const c = medirCampo(x, z);
      const k = j * lado + i;
      const borda = 1 - degrau(0.8 * extensao, extensao, r);   // sem "beirada" quando o disco é cortado
      for (let n = 0; n < campos.length; n++) grades[n][k] = c[campos[n]] * borda;
    }
  }
  const valores = Object.fromEntries(campos.map((nome) => [nome, 0]));
  return {
    lado, grades,
    /** Valores do campo em (x, z) (o ponto da grade mais próximo); fora dela, zero. */
    em(x, z) {
      const i = Math.floor((x + extensao) / passo), j = Math.floor((extensao - z) / passo);
      const dentro = i >= 0 && j >= 0 && i < lado && j < lado;
      for (let n = 0; n < campos.length; n++) valores[campos[n]] = dentro ? grades[n][j * lado + i] : 0;
      return valores;
    }
  };
}

/**
 * Plano com a imagem do disco, pintada pixel a pixel por "pintar(k, cor)" (k =
 * índice na grade do campo). De lado, o plano some aos poucos (as estrelas em
 * volume ficam); inclinado, fica um pouco mais brilhante, como um disco
 * transparente visto de viés.
 */
function planoDeBrilho({ lado, extensao, escala, pintar }) {
  const dados = new Uint8Array(lado * lado * 4);
  const cor = [0, 0, 0];
  for (let k = 0; k < lado * lado; k++) {
    pintar(k, cor);
    dados[k * 4] = tom(cor[0]);
    dados[k * 4 + 1] = tom(cor[1]);
    dados[k * 4 + 2] = tom(cor[2]);
    dados[k * 4 + 3] = 255;
  }
  const textura = new THREE.DataTexture(dados, lado, lado, THREE.RGBAFormat);
  textura.magFilter = THREE.LinearFilter;
  textura.minFilter = THREE.LinearMipmapLinearFilter;
  textura.generateMipmaps = true;
  textura.needsUpdate = true;
  const material = new THREE.ShaderMaterial({
    uniforms: { mapa: { value: textura }, opacidade: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vMundo;
      varying vec3 vNormal;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main() {
        vUv = uv;
        vec4 mundo = modelMatrix * vec4(position, 1.0);
        vMundo = mundo.xyz;
        vNormal = mat3(modelMatrix) * vec3(0.0, 0.0, 1.0);
        gl_Position = projectionMatrix * viewMatrix * mundo;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D mapa;
      uniform float opacidade;
      varying vec2 vUv;
      varying vec3 vMundo;
      varying vec3 vNormal;
      #include <common>
      #include <logdepthbuf_pars_fragment>
      void main() {
        #include <logdepthbuf_fragment>
        float c = abs(dot(normalize(vMundo - cameraPosition), normalize(vNormal)));
        float luz = smoothstep(0.015, 0.09, c) * (1.0 + 0.4 * (1.0 - c)) * opacidade;
        gl_FragColor = vec4(texture2D(mapa, vUv).rgb * luz, 1.0);
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
  plano.rotation.x = -Math.PI / 2;
  plano.frustumCulled = false;
  return plano;
}

// ---------- Montagem ----------

const ORDEM = { atras: 3, plano: 4, estrelas: 5, gas: 6, poeira: 7, frente: 8 };

/** Junta os pontos de uma galáxia (já na escala pedida) e monta o grupo 3D. */
class Montagem {
  constructor(escala) {
    this.escala = escala;
    this.estrelas = new Lote();
    this.gas = new Lote();
    this.poeira = new Lote();
    // Volume dos dois lados do disco: +Y ("cima") e −Y ("baixo").
    this.cima = { estrelas: new Lote(), gas: new Lote() };
    this.baixo = { estrelas: new Lote(), gas: new Lote() };
  }

  #por(lote, x, y, z, cor, tamanho, brilho) {
    const e = this.escala;
    lote.add(x * e, y * e, z * e, cor, tamanho * e, brilho);
  }

  estrela(x, y, z, cor, tamanho, brilho) { this.#por(this.estrelas, x, y, z, cor, tamanho, brilho); }
  nuvem(x, y, z, cor, tamanho, brilho) { this.#por(this.gas, x, y, z, cor, tamanho, brilho); }
  escuro(x, y, z, cor, tamanho, brilho) { this.#por(this.poeira, x, y, z, cor, tamanho, brilho); }
  /** Estrela ou mancha suave com volume: vai para a metade do lado dela. */
  noVolume(tipo, x, y, z, cor, tamanho, brilho) {
    const lado = y >= 0 ? this.cima : this.baixo;
    this.#por(lado[tipo], x, y, z, cor, tamanho, brilho);
  }

  criar({ plano = null, materiais }) {
    const grupo = new THREE.Group();
    const todos = [], cima = [], baixo = [];
    const juntar = (lote, material, ordem, lista) => {
      if (lote.vazio) return;
      const p = lote.criar(material, materiais);
      p.renderOrder = ordem;
      grupo.add(p);
      todos.push(p);
      lista?.push(p);
    };
    if (plano) {
      plano.renderOrder = ORDEM.plano;
      grupo.add(plano);
    }
    juntar(this.baixo.gas, materialDeGas(), ORDEM.atras, baixo);
    juntar(this.baixo.estrelas, materialDePontos({ atenuar: true }), ORDEM.atras, baixo);
    juntar(this.estrelas, materialDePontos({ atenuar: true }), ORDEM.estrelas);
    juntar(this.gas, materialDeGas(), ORDEM.gas);
    juntar(this.poeira, materialDeGas({ escuro: true }), ORDEM.poeira);
    juntar(this.cima.gas, materialDeGas(), ORDEM.frente, cima);
    juntar(this.cima.estrelas, materialDePontos({ atenuar: true }), ORDEM.frente, cima);
    const local = new THREE.Vector3();
    grupo.userData = {
      plano,
      /** O modelo gira em volta de +Y (no Comparador): +1 = sentido do giro de verdade. */
      giro: 1,
      /** 0 a 1: o modelo todo some aos poucos (perto do Sol, quem aparece é a foto do céu). */
      definirIntensidade(valor) {
        for (const p of todos) {
          p.material.uniforms.intensidade.value = valor;
          p.visible = valor > 0.002;
        }
        if (plano) {
          plano.material.uniforms.opacidade.value = valor;
          plano.visible = valor > 0.002;
        }
      },
      /** A metade do volume que está do lado da câmera é desenhada por último. */
      atualizar(camera) {
        grupo.updateMatrixWorld();
        grupo.worldToLocal(local.copy(camera.position));
        const deCima = local.y >= 0;
        for (const p of cima) p.renderOrder = deCima ? ORDEM.frente : ORDEM.atras;
        for (const p of baixo) p.renderOrder = deCima ? ORDEM.atras : ORDEM.frente;
      }
    };
    return grupo;
  }
}

/** Galáxia elíptica pequena (satélite): manchas suaves e estrelas num elipsoide de Plummer. */
function satelite(montagem, aleatorio, { centro, eixos, raio, cor, nuvens, estrelas, brilho = 1 }) {
  const [u, v, w] = eixos;   // cada um: { vetor: {x,y,z}, fator }
  const ponto = (r) => {
    const [dx, dy, dz] = direcao(aleatorio);
    const a = dx * r * u.fator, b = dy * r * v.fator, c = dz * r * w.fator;
    return [
      centro.x + u.vetor.x * a + v.vetor.x * b + w.vetor.x * c,
      centro.y + u.vetor.y * a + v.vetor.y * b + w.vetor.y * c,
      centro.z + u.vetor.z * a + v.vetor.z * b + w.vetor.z * c
    ];
  };
  for (let i = 0; i < nuvens; i++) {
    const r = raioPlummer(aleatorio, raio, raio * 6);
    const [x, y, z] = ponto(r);
    montagem.noVolume("gas", x, y, z, cor, raio * (0.35 + 0.5 * Math.min(2, r / raio)), 0.07 * brilho);
  }
  for (let i = 0; i < estrelas; i++) {
    const r = raioPlummer(aleatorio, raio, raio * 6);
    const [x, y, z] = ponto(r);
    montagem.noVolume("estrelas", x, y, z, cor, raio * 0.12, (0.12 + 0.12 * aleatorio()) * brilho);
  }
}

/** Eixos de um elipsoide visto no céu: eixo maior no ângulo pa, achatamento ε. */
function eixosNoCeu(M, centroAr, centroDec, pa, elipticidade) {
  const ceu = astro.direcoesNoCeu(astro.arParaGraus(centroAr), astro.decParaGraus(centroDec));
  const q = 1 - elipticidade;
  return [
    { vetor: M.direcao(ceu.angulo(pa)), fator: 1 },
    { vetor: M.direcao(ceu.angulo(pa + 90)), fator: q },
    // Ao longo da linha de visada: igual ao eixo menor (não dá para medir).
    { vetor: M.direcao(astro.vetorEquatorial(astro.arParaGraus(centroAr), astro.decParaGraus(centroDec))), fator: q }
  ];
}

// Cores (as mesmas das fotos: estrelas velhas douradas, jovens azuis,
// hidrogênio brilhando cor-de-rosa e poeira marrom-escura).
const COR = {
  velha: corRgb("#ffdcae"), dourada: corRgb("#ffcf94"), nucleo: corRgb("#fff1d6"),
  azul: corRgb("#c4d6ff"), branca: corRgb("#f2f0ff"), rosa: corRgb("#ff7aa6"), vermelha: corRgb("#ff6b80"),
  poeira: corRgb("#1a0e08"), poeiraClara: corRgb("#2c1a10")
};

/** Tabela 1D (interpolação linear) de uma função suave. */
function tabela1D(lado, u0, u1, funcao) {
  const valores = Float32Array.from({ length: lado }, (_, i) => funcao(u0 + ((u1 - u0) * i) / (lado - 1)));
  const k = (lado - 1) / (u1 - u0), maximo = lado - 1.0001;
  return (u) => {
    const x = Math.min(maximo, Math.max(0, (u - u0) * k)), i = x | 0, f = x - i;
    return valores[i] * (1 - f) + valores[i + 1] * f;
  };
}

// ===========================================================================
// Andrômeda (M31)
// Disco exponencial de 5,3 kpc e bojo de Sérsic (n = 2,2; Re = 1,0 kpc;
// Courteau et al., 2011), barra de 4 kpc (Blaña Díaz et al., 2017), dois braços
// logarítmicos de 9° e 9,5° defasados 166° e o anel de formação de estrelas de
// 43′ de raio, partido do lado de M32 (Gordon et al., 2006; Block et al., 2006).
// ===========================================================================

export function criarAndromeda({ escala = 1, materiais, limite = Infinity } = {}) {
  const objeto = objetoPorId("andromeda");
  const M = medir(objeto);
  const minuto = M.klyPorGrau / 60;                   // ≈ 0,72 mil anos-luz por minuto de arco
  const aleatorio = aleatorioComSemente(3101);
  const ruido = criarRuido(3102);
  const montagem = new Montagem(escala);

  const Rd = 5.3 * KLY_POR_KPC, Re = 1.0 * KLY_POR_KPC;
  const raioAnel = 43 * minuto;                       // ≈ 31 mil anos-luz
  const raioMax = Math.min(112, limite);              // disco visível: mais de 200 mil anos-luz de diâmetro (NASA)
  const meiaBarra = 4.0 * KLY_POR_KPC;
  const barra = astro.direcaoNoDisco(M.base, 55.7);   // vista a 55,7° no céu
  const fiBarra = Math.atan2(barra.z, barra.x);
  const lnMin = Math.log(0.7), lnMax = Math.log(90 / meiaBarra);
  // Os braços saem das pontas da barra e se enrolam para trás do giro; são feitos de pedaços.
  const bracos = [[fiBarra, 9], [fiBarra + 166 * RAD, 9.5]].map(([fi0, psi], k) => ({
    fi0, tan: Math.tan(psi * RAD), sen: Math.sin(psi * RAD),
    pedacos: tabela1D(256, lnMin, lnMax, (u) => degrau(0.3, 0.62, ruido(u * 4 + k * 7.7, 3.3 + k * 5.1, 0.7, 3)))
  }));
  const manchasT = tabela2D(256, -116, 116, -116, 116, (x, z) => ruido(x * 0.11 + 4, z * 0.11, 2.2, 3));
  const buracosT = tabela2D(256, -116, 116, -116, 116, (x, z) => ruido(x * 0.17 - 9, z * 0.17, 5.7, 3));
  const m32 = regiao(objeto, "m32"), m110 = regiao(objeto, "m110"), ngc206 = regiao(objeto, "ngc206");
  const p32 = M.noDisco(m32.ar, m32.dec);             // onde a linha de visada de M32 cruza o disco
  const fiBuraco = Math.atan2(p32.z, p32.x);
  const p206 = M.noDisco(ngc206.ar, ngc206.dec);

  const campo = { velho: 0, barra: 0, jovens: 0, poeira: 0 };
  function medirCampo(x, z) {
    const r = Math.hypot(x, z), fi = Math.atan2(z, x);
    campo.velho = Math.exp(-r / Rd) * (1 - degrau(80, 112, r));
    const xb = x * barra.x + z * barra.z, zb = -x * barra.z + z * barra.x;
    campo.barra = Math.exp(-((Math.abs(xb) / meiaBarra) ** 3) - (zb / (0.3 * meiaBarra)) ** 2);
    const manchas = 0.3 + 0.95 * degrau(0.3, 0.72, manchasT(x, z));
    let somaBracos = 0, poeiraBracos = 0;
    if (r > 0.7 * meiaBarra && r < 90) {
      const lr = Math.log(r / meiaBarra);
      for (const b of bracos) {
        const delta = embrulhar(fi - (b.fi0 + lr / b.tan));
        const d = r * delta * b.sen;                  // distância até o braço (+ = lado de dentro)
        const w = 1.2 + 0.025 * r;
        const peso = degrau(0.7 * meiaBarra, 1.2 * meiaBarra, r) * (1 - 0.5 * degrau(40, 60, r)) * (1 - degrau(70, 90, r)) * (0.15 + 0.85 * b.pedacos(lr));
        somaBracos += peso * Math.exp(-(d * d) / (2 * w * w));
        const dp = d - 0.9 * w;
        poeiraBracos += peso * Math.exp(-(dp * dp) / (0.6 * w * w));
      }
    }
    // Anel de 10 kpc: do lado de M32 ele se parte em dois ramos.
    const parte = Math.exp(-((embrulhar(fi - fiBuraco) / 0.42) ** 2));
    const wA = 2.0 * (1 - 0.35 * parte);
    const a1 = r - raioAnel * (1 - 0.09 * parte), a2 = r - raioAnel * (1 + 0.09 * parte);
    const anel = Math.max(Math.exp(-(a1 * a1) / (2 * wA * wA)), Math.exp(-(a2 * a2) / (2 * wA * wA))) * (1 - 0.35 * parte);
    const d206 = Math.hypot(x - p206.x, z - p206.z);
    const discoAzul = 0.18 * degrau(25, 40, r) * (1 - degrau(75, 105, r)) * manchas;   // disco de fora, mais azul
    campo.jovens = (somaBracos * 0.6 + anel) * manchas + discoAzul + 1.6 * Math.exp(-(d206 * d206) / 2.4);
    // A poeira fica em pedaços, mais forte do lado de dentro dos braços.
    const pedacos = degrau(0.36, 0.6, buracosT(x, z));
    campo.poeira = Math.min(1.2, (poeiraBracos * 1.05 + anel * 0.3) * pedacos * (0.55 + 0.6 * manchas));
    return campo;
  }

  const lado = LEVE ? 384 : 512;
  const G = gradeDoCampo({ lado, extensao: raioMax, medirCampo, campos: ["velho", "barra", "jovens", "poeira"] });
  const [gVelho, gBarra, gJovens, gPoeira] = G.grades;
  const plano = planoDeBrilho({
    lado, extensao: raioMax, escala,
    pintar(k, cor) {
      const v = gVelho[k] * 0.85, b = gBarra[k] * 0.32, j = gJovens[k] * 0.34;
      const p = Math.min(1, gPoeira[k]);
      cor[0] = (v * 1.0 + b * 1.0 + j * 0.5) * (1 - 0.48 * p);
      cor[1] = (v * 0.78 + b * 0.8 + j * 0.64) * (1 - 0.55 * p);
      cor[2] = (v * 0.55 + b * 0.58 + j * 1.0) * (1 - 0.62 * p);
    }
  });

  // Estrelas e aglomerados do disco, sorteados pela mesma luz da imagem.
  for (let n = 0, feitas = 0, total = quantos(24000); n < total * 4 && feitas < total; n++) {
    const r = aleatorio() < 0.7 ? -Rd * 1.3 * Math.log(1 - aleatorio() * 0.995) : raioMax * Math.sqrt(aleatorio());
    if (r > raioMax || r < 2) continue;
    const fi = aleatorio() * DOIS_PI;
    const x = r * Math.cos(fi), z = r * Math.sin(fi);
    const c = G.em(x, z);
    if (aleatorio() > Math.min(1, c.jovens * 0.75 + c.velho * 0.5 + c.barra * 0.3)) continue;
    feitas++;
    if (c.jovens > c.velho * 1.4) {
      montagem.estrela(x, gaussiana(aleatorio) * 0.25, z, aleatorio() < 0.75 ? COR.azul : COR.branca, 0.3 + aleatorio() * 0.4, 0.09 + 0.08 * aleatorio());
    } else {
      montagem.estrela(x, gaussiana(aleatorio) * 0.7, z, COR.velha, 0.4 + aleatorio() * 0.4, 0.045 + 0.03 * aleatorio());
    }
  }
  // Nebulosas cor-de-rosa (regiões H II) no anel e nos braços, e a poeira.
  for (let n = 0, feitas = 0, total = quantos(800); n < 80000 && feitas < total; n++) {
    const r = 8 + aleatorio() * 75, fi = aleatorio() * DOIS_PI;
    const x = r * Math.cos(fi), z = r * Math.sin(fi);
    if (aleatorio() > (G.em(x, z).jovens - 0.45) * 1.4) continue;
    feitas++;
    montagem.nuvem(x, gaussiana(aleatorio) * 0.12, z, aleatorio() < 0.75 ? COR.rosa : COR.vermelha, 0.35 + aleatorio() * 0.6, 0.11 + 0.08 * aleatorio());
  }
  for (let n = 0, feitas = 0, total = quantos(3000); n < 120000 && feitas < total; n++) {
    const r = 2 + aleatorio() * 60, fi = aleatorio() * DOIS_PI;
    const x = r * Math.cos(fi), z = r * Math.sin(fi);
    if (aleatorio() > (G.em(x, z).poeira - 0.3) * 1.3) continue;
    feitas++;
    montagem.escuro(x, gaussiana(aleatorio) * 0.12, z, aleatorio() < 0.6 ? COR.poeira : COR.poeiraClara, 0.9 + aleatorio() * 1.5, 0.13 + 0.05 * aleatorio());
  }
  // NGC 206: a maior nuvem de estrelas jovens de Andrômeda (≈ 4 mil anos-luz).
  for (let i = 0; i < 480; i++) {
    const r = Math.abs(gaussiana(aleatorio)) * ngc206.raioKly * 0.45, fi = aleatorio() * DOIS_PI;
    montagem.estrela(p206.x + r * Math.cos(fi), gaussiana(aleatorio) * 0.1, p206.z + r * Math.sin(fi),
      aleatorio() < 0.8 ? COR.azul : COR.branca, 0.12 + aleatorio() * 0.15, 0.18 + 0.16 * aleatorio());
  }

  // Bojo (Sérsic n = 2,2), mais achatado na vertical, e a barra em forma de caixa.
  for (let i = 0, total = quantos(1500); i < total; i++) {
    const r = Math.min(30, raioSersic(aleatorio, Re, 2.2));
    const [dx, dy, dz] = direcao(aleatorio);
    montagem.noVolume("gas", dx * r, dy * r * 0.6, dz * r, COR.dourada, 0.5 + 0.35 * r, 0.06);
  }
  for (let i = 0, total = quantos(5000); i < total; i++) {
    const r = Math.min(30, raioSersic(aleatorio, Re, 2.2));
    const [dx, dy, dz] = direcao(aleatorio);
    montagem.noVolume("estrelas", dx * r, dy * r * 0.6, dz * r, i % 5 ? COR.velha : COR.nucleo, 0.18 + 0.05 * r, 0.1 + 0.06 * aleatorio());
  }
  for (let i = 0, total = quantos(700); i < total; i++) {
    const s = (aleatorio() * 2 - 1) * meiaBarra * 0.85, t = gaussiana(aleatorio) * meiaBarra * 0.22;
    montagem.noVolume("gas", s * barra.x - t * barra.z, gaussiana(aleatorio) * meiaBarra * 0.16, s * barra.z + t * barra.x,
      COR.dourada, 0.9 + aleatorio() * 0.8, 0.045);
  }
  // Núcleo: um aglomerado de estrelas muito compacto e brilhante.
  for (let i = 0; i < 50; i++) {
    const [dx, dy, dz] = direcao(aleatorio);
    const r = Math.abs(gaussiana(aleatorio)) * 0.05;
    montagem.noVolume("estrelas", dx * r, dy * r, dz * r, COR.nucleo, 0.08, 0.9);
  }

  // Satélites: M32 (compacta, na frente do disco) e M110 (maior e difusa, atrás).
  // Com o disco cortado (Comparador), só entra quem fica perto dele.
  for (const [s, nuvens, estrelas] of [[m32, 420, 900], [m110, 700, 1700]]) {
    const centro = M.noEspaco(s.ar, s.dec, M.D + s.atrasKly);
    if (Math.hypot(centro.x, centro.y, centro.z) > 0.5 * limite) continue;
    satelite(montagem, aleatorio, {
      centro, raio: s.raioMeiaLuzKly, eixos: eixosNoCeu(M, s.ar, s.dec, s.pa, s.elipticidade),
      cor: COR.velha, nuvens: quantos(nuvens), estrelas: quantos(estrelas), brilho: s.id === "m32" ? 1.6 : 0.75
    });
    if (s.id === "m32") {
      // Miolo muito denso: de longe, M32 aparece como um ponto bem brilhante (magnitude 8,1; NASA).
      for (let i = 0; i < 40; i++) {
        const [dx, dy, dz] = direcao(aleatorio);
        const r = Math.abs(gaussiana(aleatorio)) * 0.08;
        montagem.noVolume("estrelas", centro.x + dx * r, centro.y + dy * r, centro.z + dz * r, COR.nucleo, 0.5, 0.7);
      }
    }
    if (s.id === "m110") {
      // No centro de M110: manchas de poeira e estrelas jovens azuis (NASA).
      for (let i = 0; i < 26; i++) {
        montagem.escuro(centro.x + gaussiana(aleatorio) * 0.25, centro.y + gaussiana(aleatorio) * 0.25, centro.z + gaussiana(aleatorio) * 0.25,
          COR.poeira, 0.15 + aleatorio() * 0.2, 0.12);
      }
      for (let i = 0; i < 40; i++) {
        montagem.noVolume("estrelas", centro.x + gaussiana(aleatorio) * 0.2, centro.y + gaussiana(aleatorio) * 0.2, centro.z + gaussiana(aleatorio) * 0.2,
          COR.azul, 0.05, 0.4);
      }
    }
  }
  return montagem.criar({ plano, materiais });
}

// ===========================================================================
// Galáxia do Triângulo (M33): disco de 1,6 kpc (Kam et al., 2017), sem bojo,
// dois braços principais bem abertos (≈ 42°; Seigar et al., 2008) e muitos
// pedaços de braço ("floculenta"), cheia de nebulosas; NGC 604 no nordeste.
// ===========================================================================

export function criarTriangulo({ escala = 1, materiais, limite = Infinity } = {}) {
  const objeto = objetoPorId("triangulo");
  const M = medir(objeto);
  const minuto = M.klyPorGrau / 60;                   // ≈ 0,8 mil anos-luz por minuto de arco
  const aleatorio = aleatorioComSemente(3301);
  const ruido = criarRuido(3302);
  const montagem = new Montagem(escala);

  const Rd = 1.6 * KLY_POR_KPC;
  const R25 = 35.4 * minuto;                          // ≈ 28 mil anos-luz (Kam et al., 2017)
  const raioMax = Math.min(36, limite);
  const ngc604 = regiao(objeto, "ngc604");
  const p604 = M.noDisco(ngc604.ar, ngc604.dec);
  const r0 = 1.2, tanPsi = Math.tan(42 * RAD), senPsi = Math.sin(42 * RAD);
  // Fase dos braços: um deles passa por NGC 604, no nordeste.
  const fi0 = Math.atan2(p604.z, p604.x) - Math.log(Math.hypot(p604.x, p604.z) / r0) / tanPsi;
  const tanFlocos = Math.tan(36 * RAD);
  const lnMin = Math.log(0.3), lnMax = Math.log(38);
  const pedacos = [0, 1].map((k) => tabela1D(256, lnMin, lnMax, (u) => degrau(0.3, 0.6, ruido(u * 5 + k * 9, 1.7, 0.4, 3))));
  const flocosT = tabela2D(320, -Math.PI, Math.PI, lnMin, lnMax, (v, s) => ruido(Math.cos(v) * 4.2, Math.sin(v) * 4.2, s * 4.6, 3));
  const manchasT = tabela2D(256, -38, 38, -38, 38, (x, z) => ruido(x * 0.6 + 7, z * 0.6, 1.3, 3));

  const campo = { velho: 0, nucleo: 0, jovens: 0, poeira: 0 };
  function medirCampo(x, z) {
    const r = Math.hypot(x, z), fi = Math.atan2(z, x);
    const fora = 1 - degrau(R25 * 0.95, 36, r);
    campo.velho = Math.exp(-r / Rd) * fora;
    campo.nucleo = Math.exp(-(r * r) / 0.08);
    let bracos = 0, poeira = 0;
    if (r > r0) {
      const lr = Math.log(r / r0);
      for (let k = 0; k < 2; k++) {
        const delta = embrulhar(fi - (fi0 + Math.PI * k + lr / tanPsi));
        const d = r * delta * senPsi;
        const w = 0.6 + 0.07 * r;
        const peso = degrau(r0, 2.5 * r0, r) * (1 - degrau(R25 * 0.8, R25 * 1.1, r)) * (0.25 + 0.75 * pedacos[k](Math.log(r)));
        bracos += peso * Math.exp(-(d * d) / (2 * w * w));
        const dp = d - 0.8 * w;
        poeira += peso * Math.exp(-(dp * dp) / (0.5 * w * w));
      }
    }
    // Pedaços de braço: manchas um pouco esticadas ao longo de espirais de 36°.
    const s = Math.log(Math.max(r, 0.3));
    const flocos = degrau(0.53, 0.78, flocosT(embrulhar(fi - s / tanFlocos), s)) * degrau(1, 3, r);
    const manchas = 0.4 + 0.8 * degrau(0.3, 0.72, manchasT(x, z));
    const d604 = Math.hypot(x - p604.x, z - p604.z);
    campo.jovens = (bracos * 0.95 + flocos * 0.4) * manchas * fora + 1.8 * Math.exp(-(d604 * d604) / 0.5);
    campo.poeira = Math.min(1, poeira * 0.4 + flocos * 0.05);
    return campo;
  }

  const lado = LEVE ? 288 : 384;
  const G = gradeDoCampo({ lado, extensao: raioMax, medirCampo, campos: ["velho", "nucleo", "jovens", "poeira"] });
  const [gVelho, gNucleo, gJovens, gPoeira] = G.grades;
  const plano = planoDeBrilho({
    lado, extensao: raioMax, escala,
    pintar(k, cor) {
      const v = gVelho[k] * 1.15 + gNucleo[k] * 1.6, j = gJovens[k] * 0.42;
      const p = Math.min(1, gPoeira[k]);
      cor[0] = (v * 1.0 + j * 0.5) * (1 - 0.45 * p);
      cor[1] = (v * 0.86 + j * 0.68) * (1 - 0.5 * p);
      cor[2] = (v * 0.7 + j * 1.05) * (1 - 0.55 * p);
    }
  });

  for (let n = 0, feitas = 0, total = quantos(22000); n < total * 4 && feitas < total; n++) {
    const r = aleatorio() < 0.7 ? -Rd * 1.4 * Math.log(1 - aleatorio() * 0.995) : raioMax * Math.sqrt(aleatorio());
    if (r > raioMax || r < 0.3) continue;
    const fi = aleatorio() * DOIS_PI;
    const x = r * Math.cos(fi), z = r * Math.sin(fi);
    const c = G.em(x, z);
    if (aleatorio() > Math.min(1, c.jovens * 0.8 + c.velho * 0.45)) continue;
    feitas++;
    const jovem = c.jovens > c.velho * 1.2;
    montagem.estrela(x, gaussiana(aleatorio) * (jovem ? 0.12 : 0.35), z, jovem ? (aleatorio() < 0.7 ? COR.azul : COR.branca) : COR.velha,
      0.12 + aleatorio() * 0.16, jovem ? 0.12 + 0.12 * aleatorio() : 0.05 + 0.03 * aleatorio());
  }
  // Muitas nebulosas cor-de-rosa: a Triângulo forma estrelas bem mais depressa que Andrômeda (NASA).
  for (let n = 0, feitas = 0, total = quantos(1400); n < 90000 && feitas < total; n++) {
    const r = 1 + aleatorio() * (raioMax - 6), fi = aleatorio() * DOIS_PI;
    const x = r * Math.cos(fi), z = r * Math.sin(fi);
    if (aleatorio() > (G.em(x, z).jovens - 0.35) * 1.3) continue;
    feitas++;
    montagem.nuvem(x, gaussiana(aleatorio) * 0.06, z, aleatorio() < 0.7 ? COR.rosa : COR.vermelha, 0.14 + aleatorio() * 0.32, 0.18 + 0.12 * aleatorio());
  }
  for (let n = 0, feitas = 0, total = quantos(900); n < 60000 && feitas < total; n++) {
    const r = 1 + aleatorio() * 24, fi = aleatorio() * DOIS_PI;
    const x = r * Math.cos(fi), z = r * Math.sin(fi);
    if (aleatorio() > (G.em(x, z).poeira - 0.25) * 1.2) continue;
    feitas++;
    montagem.escuro(x, gaussiana(aleatorio) * 0.06, z, COR.poeiraClara, 0.35 + aleatorio() * 0.5, 0.1);
  }
  // NGC 604: uns 1.300 anos-luz de gás brilhante em volta de mais de 200 estrelas quentes (NASA, Webb, 2024).
  for (let i = 0; i < 120; i++) {
    const [dx, dy, dz] = direcao(aleatorio);
    const r = Math.pow(aleatorio(), 0.6) * ngc604.raioKly;
    montagem.nuvem(p604.x + dx * r, dy * r * 0.5, p604.z + dz * r, i % 3 ? COR.rosa : COR.vermelha, 0.12 + aleatorio() * 0.22, 0.17);
  }
  for (let i = 0; i < 220; i++) {
    const r = Math.abs(gaussiana(aleatorio)) * ngc604.raioKly * 0.35, fi = aleatorio() * DOIS_PI;
    montagem.estrela(p604.x + r * Math.cos(fi), gaussiana(aleatorio) * 0.05, p604.z + r * Math.sin(fi), COR.azul, 0.04, 0.35 + 0.3 * aleatorio());
  }
  // Núcleo: um aglomerado de estrelas compacto (não há bojo).
  for (let i = 0; i < 40; i++) {
    const [dx, dy, dz] = direcao(aleatorio);
    const r = Math.abs(gaussiana(aleatorio)) * 0.03;
    montagem.noVolume("estrelas", dx * r, dy * r, dz * r, COR.nucleo, 0.05, 0.8);
  }
  return montagem.criar({ plano, materiais });
}

// ===========================================================================
// Grande Nuvem de Magalhães: disco de 1,44° de escala (van der Marel, 2001)
// com a barra fora do centro, um só braço espiral ao norte (Ruiz-Lara et al.,
// 2020), a Nebulosa da Tarântula (mais de 1.000 anos-luz; ESO) e outras
// nebulosas grandes (N11, N44) nos lugares de verdade.
// ===========================================================================

/**
 * O braço da Grande Nuvem, do oeste da barra para o leste, passando ao norte
 * (perto de N11 e de Constellation III): [ângulo no disco (graus), raio (mil
 * anos-luz)], medidos a partir do centro de rotação, a partir das posições
 * desses lugares no céu.
 */
const BRACO_DA_GRANDE_NUVEM = [[160, 3.0], [172, 5.2], [186, 8.0], [205, 9.4], [228, 9.8], [252, 9.1], [272, 8.0]];

export function criarGrandeNuvem({ escala = 1, materiais, limite = Infinity } = {}) {
  const objeto = objetoPorId("lmc");
  const M = medir(objeto);
  const grau = M.klyPorGrau;                          // ≈ 2,8 mil anos-luz por grau
  const aleatorio = aleatorioComSemente(4101);
  const ruido = criarRuido(4102);
  const montagem = new Montagem(escala);

  const escalaDisco = objeto.disco.escalaGraus * grau; // ≈ 4 mil anos-luz
  const raioMax = Math.min(22, limite);
  const cd = M.noDisco(objeto.centroDoDisco.ar, objeto.centroDoDisco.dec);
  const { barra } = objeto;
  const cb = M.noDisco(barra.ar, barra.dec);
  const pontaLeste = M.noDiscoDesviado(barra.ar, barra.dec, barra.pa, barra.meioComprimentoGraus);
  const pontaOeste = M.noDiscoDesviado(barra.ar, barra.dec, barra.pa + 180, barra.meioComprimentoGraus);
  const eixoBarra = { x: pontaLeste.x - pontaOeste.x, z: pontaLeste.z - pontaOeste.z };
  const meiaBarra = Math.hypot(eixoBarra.x, eixoBarra.z) / 2;
  eixoBarra.x /= 2 * meiaBarra;
  eixoBarra.z /= 2 * meiaBarra;
  const larguraBarra = meiaBarra * barra.razao;
  const regioes = objeto.regioes.map((r) => ({ ...r, p: M.noDisco(r.ar, r.dec) }));
  const braco = BRACO_DA_GRANDE_NUVEM.map(([fi, r]) => [fi * RAD, r]);
  const pedacos = tabela1D(256, 0, 1, (u) => degrau(0.32, 0.65, ruido(u * 6, 2.1, 5.5, 3)));
  const manchasT = tabela2D(256, -23, 23, -23, 23, (x, z) => ruido(x * 0.45 + 2, z * 0.45, 0.9, 3));
  const poeiraT = tabela2D(256, -23, 23, -23, 23, (x, z) => ruido(x * 0.6, z * 0.6, 3.3, 3));

  /** Raio do braço no ângulo fi (relativo ao centro do disco), ou null fora do trecho. */
  function raioDoBraco(fi) {
    let a = fi;
    while (a < braco[0][0]) a += DOIS_PI;
    if (a > braco.at(-1)[0]) return null;
    for (let i = 1; i < braco.length; i++) {
      if (a <= braco[i][0]) {
        const t = (a - braco[i - 1][0]) / (braco[i][0] - braco[i - 1][0]);
        return { r: braco[i - 1][1] + (braco[i][1] - braco[i - 1][1]) * t, ao: (a - braco[0][0]) / (braco.at(-1)[0] - braco[0][0]) };
      }
    }
    return null;
  }

  const campo = { velho: 0, barra: 0, jovens: 0, poeira: 0 };
  function medirCampo(x, z) {
    const xd = x - cd.x, zd = z - cd.z;
    const rd = Math.hypot(xd, zd), fi = Math.atan2(zd, xd);
    campo.velho = Math.exp(-rd / escalaDisco) * (1 - degrau(15, 22, rd));
    const xb = x - cb.x, zb = z - cb.z;
    const s = xb * eixoBarra.x + zb * eixoBarra.z, t = -xb * eixoBarra.z + zb * eixoBarra.x;
    campo.barra = Math.exp(-((Math.abs(s) / meiaBarra) ** 4) - (t / larguraBarra) ** 2);
    let noBraco = 0;
    const b = raioDoBraco(fi);
    if (b) {
      const w = 1.2 + 0.4 * Math.sin(b.ao * Math.PI);
      noBraco = Math.exp(-((rd - b.r) ** 2) / (2 * w * w)) * degrau(0, 0.12, b.ao) * (1 - degrau(0.85, 1, b.ao)) * (0.3 + 0.7 * pedacos(b.ao));
    }
    // Estrelas novas também nascem espalhadas pelo disco, em manchas.
    const manchas = degrau(0.55, 0.8, manchasT(x, z)) * campo.velho;
    let nebulosas = 0;
    for (const r of regioes) {
      const d2 = (x - r.p.x) ** 2 + (z - r.p.z) ** 2;
      nebulosas += (r.id === "tarantula" ? 2.6 : 0.9) * Math.exp(-d2 / (2 * r.raioKly * r.raioKly));
    }
    campo.jovens = noBraco * 0.9 + manchas * 0.8 + nebulosas;
    campo.poeira = 0.35 * degrau(0.62, 0.8, poeiraT(x, z)) * Math.min(1, campo.velho * 2);
    return campo;
  }

  const lado = LEVE ? 288 : 384;
  const G = gradeDoCampo({ lado, extensao: raioMax, medirCampo, campos: ["velho", "barra", "jovens", "poeira"] });
  const [gVelho, gBarra, gJovens, gPoeira] = G.grades;
  const plano = planoDeBrilho({
    lado, extensao: raioMax, escala,
    pintar(k, cor) {
      const v = gVelho[k] * 0.6, b = gBarra[k] * 0.85, j = gJovens[k] * 0.4;
      const p = Math.min(1, gPoeira[k]);
      cor[0] = (v * 1.0 + b * 1.0 + j * 0.62) * (1 - 0.45 * p);
      cor[1] = (v * 0.9 + b * 0.88 + j * 0.72) * (1 - 0.5 * p);
      cor[2] = (v * 0.8 + b * 0.72 + j * 1.0) * (1 - 0.55 * p);
    }
  });

  for (let n = 0, feitas = 0, total = quantos(18000); n < total * 4 && feitas < total; n++) {
    const x = cd.x + gaussiana(aleatorio) * 7, z = cd.z + gaussiana(aleatorio) * 7;
    if (x * x + z * z > raioMax * raioMax) continue;
    const c = G.em(x, z);
    if (aleatorio() > Math.min(1, c.jovens * 0.7 + c.velho * 0.6 + c.barra * 0.8)) continue;
    feitas++;
    const naBarra = c.barra > 0.4 && c.barra > c.jovens;
    const jovem = !naBarra && c.jovens > c.velho * 0.8;
    const altura = naBarra ? 0.45 : jovem ? 0.1 : 0.3;
    montagem.estrela(x, gaussiana(aleatorio) * altura, z, jovem ? (aleatorio() < 0.7 ? COR.azul : COR.branca) : COR.velha,
      0.06 + aleatorio() * 0.08, jovem ? 0.11 + 0.09 * aleatorio() : 0.06 + 0.04 * aleatorio());
  }
  for (let n = 0, feitas = 0, total = quantos(480); n < 60000 && feitas < total; n++) {
    const x = cd.x + gaussiana(aleatorio) * 6, z = cd.z + gaussiana(aleatorio) * 6;
    if (aleatorio() > (G.em(x, z).jovens - 0.4) * 1.2) continue;
    feitas++;
    montagem.nuvem(x, gaussiana(aleatorio) * 0.05, z, aleatorio() < 0.7 ? COR.rosa : COR.vermelha, 0.08 + aleatorio() * 0.16, 0.1 + 0.08 * aleatorio());
  }
  for (let n = 0, feitas = 0, total = quantos(380); n < 60000 && feitas < total; n++) {
    const x = cd.x + gaussiana(aleatorio) * 6, z = cd.z + gaussiana(aleatorio) * 6;
    if (aleatorio() > (G.em(x, z).poeira - 0.15) * 2) continue;
    feitas++;
    montagem.escuro(x, gaussiana(aleatorio) * 0.05, z, COR.poeiraClara, 0.2 + aleatorio() * 0.3, 0.1);
  }
  // Nebulosas com nome: gás em camadas e filamentos, com o aglomerado no meio.
  for (const r of regioes) {
    const tarantula = r.id === "tarantula";
    for (let i = 0, total = tarantula ? 260 : 60; i < total; i++) {
      const [dx, dy, dz] = direcao(aleatorio);
      const d = Math.pow(aleatorio(), 0.55) * r.raioKly;
      const cor = tarantula && i % 4 === 0 ? corRgb("#ffb28a") : i % 3 ? COR.rosa : COR.vermelha;
      montagem.nuvem(r.p.x + dx * d, dy * d * 0.5, r.p.z + dz * d, cor, r.raioKly * (0.12 + aleatorio() * 0.25), tarantula ? 0.16 : 0.13);
    }
    for (let i = 0, total = tarantula ? 220 : 40; i < total; i++) {
      const d = Math.abs(gaussiana(aleatorio)) * r.raioKly * 0.3, fi = aleatorio() * DOIS_PI;
      montagem.estrela(r.p.x + d * Math.cos(fi), gaussiana(aleatorio) * 0.03, r.p.z + d * Math.sin(fi), COR.azul, 0.02, 0.3 + 0.3 * aleatorio());
    }
  }
  // R136, o aglomerado no coração da Tarântula: algumas das estrelas mais pesadas que se conhecem (ESO).
  const tarantula = regioes.find((r) => r.id === "tarantula");
  for (let i = 0; i < 60; i++) {
    const [dx, dy, dz] = direcao(aleatorio);
    const d = Math.abs(gaussiana(aleatorio)) * 0.008;
    montagem.estrela(tarantula.p.x + dx * d, dy * d, tarantula.p.z + dz * d, COR.branca, 0.012, 1.1);
  }
  return montagem.criar({ plano, materiais });
}

// ===========================================================================
// Pequena Nuvem de Magalhães: não é um disco. As estrelas velhas formam um
// corpo arredondado que se estica ≈ 7 kpc na direção da Terra (Graczyk et al.,
// 2020); as jovens, uma "barra" de nordeste a sudoeste, com o nordeste mais
// perto de nós, e a "Asa" a leste, na direção da Grande Nuvem (Zaritsky et
// al., 2000; Ripepi et al., 2017). Referencial: x = leste, y = norte, z = para
// longe da Terra. Com "ponte", inclui a Ponte de Magalhães até a Grande Nuvem.
// ===========================================================================

export function criarPequenaNuvem({ escala = 1, materiais, ponte = false } = {}) {
  const objeto = objetoPorId("smc");
  const M = medir(objeto);
  const aleatorio = aleatorioComSemente(4201);
  const montagem = new Montagem(escala);
  const { profundidadeKly, paBarra, inclinacaoDoEixo } = objeto.corpo;

  const ceu = M.base.ceu;
  const ne = M.direcao(ceu.angulo(paBarra));          // nordeste, no céu
  const se = M.direcao(ceu.angulo(paBarra + 90));     // sudeste, no céu
  const t = inclinacaoDoEixo * RAD;
  // Eixo longo: aponta para o nordeste e para a Terra (z negativo).
  const longo = { x: ne.x * Math.cos(t), y: ne.y * Math.cos(t), z: -Math.sin(t) };
  const terceiro = {                                  // longo × sudeste
    x: longo.y * se.z - longo.z * se.y, y: longo.z * se.x - longo.x * se.z, z: longo.x * se.y - longo.y * se.x
  };
  const sigmaLongo = profundidadeKly / 4 / Math.sin(t);
  const combinar = (a, b, c) => ({
    x: longo.x * a + se.x * b + terceiro.x * c, y: longo.y * a + se.y * b + terceiro.y * c, z: longo.z * a + se.z * b + terceiro.z * c
  });

  // Corpo de estrelas velhas (luz mais fraca e amarelada).
  const branca = corRgb("#fff0dc");
  for (let i = 0, total = quantos(4500); i < total; i++) {
    const p = combinar(gaussiana(aleatorio) * sigmaLongo, gaussiana(aleatorio) * 1.7, gaussiana(aleatorio) * 1.5);
    montagem.estrela(p.x, p.y, p.z, branca, 0.08 + aleatorio() * 0.08, 0.035 + 0.025 * aleatorio());
  }
  for (let i = 0, total = quantos(700); i < total; i++) {
    const p = combinar(gaussiana(aleatorio) * sigmaLongo * 0.8, gaussiana(aleatorio) * 1.3, gaussiana(aleatorio) * 1.2);
    montagem.nuvem(p.x, p.y, p.z, corRgb("#ffe9cf"), 0.9 + aleatorio() * 1.2, 0.016);
  }
  // Barra de estrelas jovens (a maior parte da luz que vemos), de sudoeste
  // (mais longe) a nordeste (mais perto).
  const meiaBarra = 12;
  for (let i = 0, total = quantos(5200); i < total; i++) {
    const s = (aleatorio() * 2 - 1) * meiaBarra * Math.sqrt(aleatorio());
    const p = combinar(s + gaussiana(aleatorio) * 0.8, gaussiana(aleatorio) * 0.9, gaussiana(aleatorio) * 0.8);
    montagem.estrela(p.x, p.y, p.z, aleatorio() < 0.75 ? COR.azul : COR.branca, 0.05 + aleatorio() * 0.06, 0.14 + 0.12 * aleatorio());
  }
  for (let i = 0, total = quantos(500); i < total; i++) {
    const s = (aleatorio() * 2 - 1) * meiaBarra * Math.sqrt(aleatorio());
    const p = combinar(s, gaussiana(aleatorio) * 0.9, gaussiana(aleatorio) * 0.8);
    montagem.nuvem(p.x, p.y, p.z, corRgb("#dfe8ff"), 0.5 + aleatorio() * 0.7, 0.045);
  }
  for (let i = 0, total = quantos(200); i < total; i++) {
    const s = (aleatorio() * 2 - 1) * meiaBarra;
    const p = combinar(s, gaussiana(aleatorio) * 0.7, gaussiana(aleatorio) * 0.6);
    montagem.nuvem(p.x, p.y, p.z, aleatorio() < 0.7 ? COR.rosa : COR.vermelha, 0.1 + aleatorio() * 0.2, 0.09);
  }
  // A Asa: estrelas jovens a leste, mais perto de nós, na direção da Grande Nuvem.
  const inicioAsa = M.noEspaco("01 02 00", "-72 55 00", M.D - 4);
  const fimAsa = M.noEspaco("01 24 00", "-73 25 00", M.D - 9);
  for (let i = 0, total = quantos(1500); i < total; i++) {
    const u = aleatorio();
    montagem.estrela(inicioAsa.x + (fimAsa.x - inicioAsa.x) * u + gaussiana(aleatorio) * 0.9,
      inicioAsa.y + (fimAsa.y - inicioAsa.y) * u + gaussiana(aleatorio) * 0.7,
      inicioAsa.z + (fimAsa.z - inicioAsa.z) * u + gaussiana(aleatorio) * 1.2,
      aleatorio() < 0.8 ? COR.azul : COR.branca, 0.05 + aleatorio() * 0.05, 0.1 + 0.08 * aleatorio());
  }
  // NGC 346, a maior nebulosa da Pequena Nuvem, na ponta nordeste da barra.
  const ngc346 = regiao(objeto, "ngc346");
  const noCeu = M.noEspaco(ngc346.ar, ngc346.dec, M.D);
  const paraNordeste = noCeu.x * ne.x + noCeu.y * ne.y;
  const p346 = M.noEspaco(ngc346.ar, ngc346.dec, M.D - paraNordeste * Math.tan(t));
  for (let i = 0; i < 120; i++) {
    const [dx, dy, dz] = direcao(aleatorio);
    const d = Math.pow(aleatorio(), 0.6) * ngc346.raioKly;
    montagem.nuvem(p346.x + dx * d, p346.y + dy * d, p346.z + dz * d, i % 3 ? COR.rosa : COR.vermelha, 0.04 + aleatorio() * 0.08, 0.24);
  }
  for (let i = 0; i < 60; i++) {
    const [dx, dy, dz] = direcao(aleatorio);
    const d = Math.abs(gaussiana(aleatorio)) * 0.02;
    montagem.estrela(p346.x + dx * d, p346.y + dy * d, p346.z + dz * d, COR.azul, 0.01, 0.6);
  }

  if (ponte) {
    // Ponte de Magalhães: estrelas jovens espalhadas no gás que liga as duas
    // Nuvens (o gás, de hidrogênio frio, quase não brilha em luz visível).
    const a = M.noEspaco("01 40 00", "-73 45 00", M.D - 12);
    const b = M.noEspaco("02 45 00", "-74 30 00", 180);
    const c = M.noEspaco("03 55 00", "-73 00 00", 168);
    for (let i = 0, total = quantos(1100); i < total; i++) {
      const u = aleatorio(), v = 1 - u;
      montagem.estrela(
        v * v * a.x + 2 * u * v * b.x + u * u * c.x + gaussiana(aleatorio) * 2,
        v * v * a.y + 2 * u * v * b.y + u * u * c.y + gaussiana(aleatorio) * 1.5,
        v * v * a.z + 2 * u * v * b.z + u * u * c.z + gaussiana(aleatorio) * 2,
        aleatorio() < 0.8 ? COR.azul : COR.branca, 0.08 + aleatorio() * 0.06, 0.05 + 0.04 * aleatorio());
    }
  }
  const grupo = montagem.criar({ materiais });
  grupo.userData.semDisco = true;
  return grupo;
}

/** Monta a galáxia vizinha pelo id do catálogo. */
export const CRIAR_VIZINHA = {
  andromeda: criarAndromeda,
  triangulo: criarTriangulo,
  lmc: criarGrandeNuvem,
  smc: criarPequenaNuvem
};
