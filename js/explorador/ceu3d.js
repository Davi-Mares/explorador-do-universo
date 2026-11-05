// ---------------------------------------------------------------------------
// Explorador do Universo — o céu de verdade ao fundo.
//
// • A faixa da Via Láctea é a foto panorâmica do céu inteiro da ESO
//   (S. Brunier, "GigaGalaxy Zoom", eso0932a, CC BY 4.0), em coordenadas
//   galácticas. As estrelas mais brilhantes foram tiradas da foto: elas são
//   desenhadas pelo programa, nas posições do catálogo.
// • As estrelas vêm do catálogo HYG v4.0 (Hipparcos, Yale Bright Star e
//   Gliese; CC BY-SA 4.0), em dados/estrelas.json: as 9 mil visíveis a olho
//   nu e todas a menos de 25 anos-luz, com posição, distância, brilho e cor.
// ---------------------------------------------------------------------------

import * as THREE from "three";
import * as astro from "./astronomia.js";

const RAD = Math.PI / 180;
const ANOS_LUZ_POR_PARSEC = 3.261563777;

// ---------- Matrizes entre os referenciais ----------

/** Equatorial J2000 → galáctico (matriz do Hipparcos). */
const EQUATORIAL_PARA_GALACTICA = new THREE.Matrix3().set(
  -0.0548755604, -0.8734370902, -0.4838350155,
  0.4941094279, -0.4448296300, 0.7469822445,
  -0.8676661490, -0.1980763734, 0.4559837762
);

/** Cena (eixos de paraCena) → referencial astronômico de origem (inverso de paraCena). */
const CENA_PARA_ASTRONOMICO = new THREE.Matrix3().set(1, 0, 0, 0, 0, -1, 0, 1, 0);

/** Nas cenas do Sistema Solar e das estrelas: direção na cena → galáctica. */
export function matrizCenaEclipticaParaGalactica() {
  const e = astro.OBLIQUIDADE_GRAUS * RAD;
  // eclíptica → equatorial (rotação de −ε em torno do eixo x)
  const eclipticaParaEquatorial = new THREE.Matrix3().set(1, 0, 0, 0, Math.cos(e), -Math.sin(e), 0, Math.sin(e), Math.cos(e));
  return new THREE.Matrix3().multiplyMatrices(EQUATORIAL_PARA_GALACTICA, eclipticaParaEquatorial).multiply(CENA_PARA_ASTRONOMICO);
}

/** Na cena da Via Láctea (eixos galactocêntricos): direção na cena → galáctica. */
export function matrizCenaGalacticaParaGalactica() {
  return CENA_PARA_ASTRONOMICO.clone();
}

// ---------- Faixa da Via Láctea (foto da ESO) ----------

/**
 * Esfera do céu presa à câmera, desenhada antes de tudo. A foto é lida em
 * coordenadas galácticas: a direção de cada pixel na cena vira (l, b).
 */
/** Foto grande (4096 px) no computador; no celular, a de 2048 px (menos memória). */
const CEU_GRANDE = typeof window !== "undefined" && !window.matchMedia?.("(pointer: coarse)").matches;

export function criarFaixaDaViaLactea({ raio, matriz, intensidade = 0.8, grande = CEU_GRANDE }) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      mapa: { value: null },
      paraGalactica: { value: matriz.clone() },
      intensidade: { value: 0 }
    },
    vertexShader: /* glsl */ `
      varying vec3 vDirecao;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main() {
        vDirecao = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D mapa;
      uniform mat3 paraGalactica;
      uniform float intensidade;
      varying vec3 vDirecao;
      #include <common>
      #include <logdepthbuf_pars_fragment>
      void main() {
        #include <logdepthbuf_fragment>
        vec3 g = normalize(paraGalactica * vDirecao);
        float l = atan(g.y, g.x);
        float b = asin(clamp(g.z, -1.0, 1.0));
        // Foto com l = 0 (centro da galáxia) no meio, l crescendo para a esquerda.
        vec2 uv = vec2(0.5 - l / (2.0 * PI), 0.5 + b / PI);
        gl_FragColor = vec4(texture2D(mapa, uv).rgb * intensidade, 1.0);
      }`,
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false
  });
  const esfera = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), material);
  esfera.scale.setScalar(raio);
  esfera.renderOrder = -1000;
  esfera.frustumCulled = false;
  esfera.visible = false;

  // A foto chega depois (sem travar o início); o céu aparece suavemente.
  new THREE.TextureLoader().load(`img/ceu/via-lactea-${grande ? 4096 : 2048}.webp`, (textura) => {
    textura.wrapS = THREE.RepeatWrapping;
    textura.generateMipmaps = false;        // sem "costura" no meridiano de l = 180°
    textura.minFilter = THREE.LinearFilter;
    textura.magFilter = THREE.LinearFilter;
    material.uniforms.mapa.value = textura;
    esfera.visible = true;
    const inicio = performance.now();
    const surgir = () => {
      const t = Math.min(1, (performance.now() - inicio) / 900);
      material.uniforms.intensidade.value = intensidade * t * esfera.userData.opacidade;
      if (t < 1) requestAnimationFrame(surgir);
    };
    surgir();
  });
  esfera.userData.opacidade = 1;
  esfera.userData.intensidade = intensidade;

  return {
    objeto: esfera,
    /** Mantém a esfera em volta da câmera; "opacidade" apaga a foto aos poucos. */
    atualizar(camera, opacidade = 1) {
      esfera.position.copy(camera.position);
      esfera.userData.opacidade = opacidade;
      if (material.uniforms.mapa.value) material.uniforms.intensidade.value = intensidade * opacidade;
      esfera.visible = Boolean(material.uniforms.mapa.value) && opacidade > 0.002;
    },
    /** Na Via Láctea a matriz muda com o giro do disco. */
    definirMatriz(nova) {
      material.uniforms.paraGalactica.value.copy(nova);
    }
  };
}

// ---------- Estrelas do catálogo ----------

let pedidoDoCatalogo = null;

/** Carrega dados/estrelas.json uma vez só (as duas cenas usam). */
export function carregarCatalogoDeEstrelas() {
  if (!pedidoDoCatalogo) {
    pedidoDoCatalogo = fetch("dados/estrelas.json")
      .then((resposta) => (resposta.ok ? resposta.json() : Promise.reject(new Error(resposta.statusText))))
      .then(({ estrelas }) => {
        const lista = [];
        for (let i = 0; i < estrelas.length; i += 5) {
          lista.push({ ar: estrelas[i], dec: estrelas[i + 1], anosLuz: estrelas[i + 2], mag: estrelas[i + 3], bv: estrelas[i + 4] });
        }
        return lista;
      })
      .catch(() => []);
  }
  return pedidoDoCatalogo;
}

/** Temperatura pela cor B−V (Ballesteros, 2012) e cor de corpo negro, um pouco esbranquiçada como a vemos. */
export function corPorIndiceBV(bv) {
  const t = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
  const u = Math.min(400, Math.max(10, t / 100));
  const r = u <= 66 ? 255 : 329.698727446 * Math.pow(u - 60, -0.1332047592);
  const g = u <= 66 ? 99.4708025861 * Math.log(u) - 161.1195681661 : 288.1221695283 * Math.pow(u - 60, -0.0755148492);
  const b = u >= 66 ? 255 : u <= 19 ? 0 : 138.5177312231 * Math.log(u - 10) - 305.0447927307;
  const canal = (v) => Math.min(1, Math.max(0, v / 255));
  const mistura = 0.6; // estrelas parecem mais brancas a olho nu
  return [canal(r), canal(g), canal(b)].map((c) => 1 - mistura + mistura * c);
}

/**
 * Estrelas com o brilho calculado na hora pela distância até a câmera
 * (magnitude aparente = absoluta + 5·log10(d/10 pc)). No modo "infinito"
 * (Sistema Solar) elas ficam numa esfera e o brilho é o visto da Terra.
 */
export function materialDeEstrelas({ infinito = false } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      escalaPixel: { value: 1 },
      escalaProjecao: { value: 800 },
      brilhoGeral: { value: 1 }
    },
    vertexShader: /* glsl */ `
      attribute float magnitude;   // absoluta (3D) ou aparente (infinito)
      attribute vec3 cor;
      uniform float escalaPixel;
      uniform float brilhoGeral;
      varying vec3 vCor;
      varying float vBrilho;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float m = magnitude;
        ${infinito ? "" : "m = magnitude + 5.0 * log(max(length(mv.xyz), 1e-6) / " + ANOS_LUZ_POR_PARSEC.toFixed(6) + ") / log(10.0) - 5.0;"}
        float x = 6.5 - m;
        float tamanho = clamp(1.3 + x * 1.05, 1.1, 34.0);
        vBrilho = clamp(0.2 + x * 0.13, 0.0, 1.5) * smoothstep(-1.2, 0.4, x) * brilhoGeral;
        vCor = cor;
        gl_PointSize = tamanho * escalaPixel;
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
        float a = (exp(-d * d * 6.0) + exp(-d * 3.2) * 0.3) * vBrilho;
        gl_FragColor = vec4(vCor, min(a, 1.0));
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

/**
 * Nuvem de estrelas do catálogo. Em "infinito", numa esfera de raio fixo,
 * com a direção do catálogo; senão, na posição 3D real (anos-luz).
 * "pular(estrela)" tira as que a cena já desenha de outro jeito.
 */
export function criarEstrelasDoCatalogo({ infinito = false, raio = 1, pular = () => false, paraCena }) {
  const material = materialDeEstrelas({ infinito });
  const geometria = new THREE.BufferGeometry();
  const objeto = new THREE.Points(geometria, material);
  objeto.frustumCulled = false;
  objeto.renderOrder = -900;

  carregarCatalogoDeEstrelas().then((lista) => {
    const posicoes = [], cores = [], magnitudes = [];
    for (const estrela of lista) {
      if (pular(estrela)) continue;
      // Sem distância medida: fica bem longe (2 mil anos-luz), com o brilho visto daqui.
      const anosLuz = estrela.anosLuz > 0 ? estrela.anosLuz : 2000;
      const p = paraCena(astro.equatorialParaEcliptica(estrela.ar, estrela.dec, infinito ? raio : anosLuz));
      posicoes.push(p.x, p.y, p.z);
      cores.push(...corPorIndiceBV(estrela.bv));
      magnitudes.push(infinito ? estrela.mag : astro.magnitudeAbsoluta(estrela.mag, anosLuz));
    }
    geometria.setAttribute("position", new THREE.Float32BufferAttribute(posicoes, 3));
    geometria.setAttribute("cor", new THREE.Float32BufferAttribute(cores, 3));
    geometria.setAttribute("magnitude", new THREE.Float32BufferAttribute(magnitudes, 1));
  });
  return { objeto, material };
}
