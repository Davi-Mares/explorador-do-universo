// ---------------------------------------------------------------------------
// Explorador do Universo — astros em 3D (Sol, planetas, Lua e estrelas).
// Usado pelo Explorador (cenas.js) e pelo Comparador (comparar.js).
//
// Superfícies com mapas reais (projeção equirretangular, img/texturas/):
//   Sol, planetas, Lua e anéis — Solar System Scope (CC BY 4.0), feitos com
//   dados da NASA; Terra de dia e à noite — NASA Blue Marble e Earth at
//   Night (domínio público). As nuvens da Terra são ilustrativas (geradas
//   por código), porque as nuvens de verdade mudam o tempo todo.
//
// Atmosfera, anéis e o Sol usam shaders próprios. A luz é calculada no
// espaço local de cada astro (em raios do próprio astro), o que evita erros
// de precisão: as distâncias da cena são as reais.
// ---------------------------------------------------------------------------

import * as THREE from "three";
import * as astro from "./astronomia.js";

const PASTA = new URL("../../img/texturas/", import.meta.url);
const carregador = new THREE.TextureLoader();
let anisotropia = 4;

/** Filtro anisotrópico (nitidez das texturas vistas de lado). */
export function definirAnisotropia(valor) {
  anisotropia = Math.max(1, Math.min(8, valor || 1));
}

const texturas = new Map();

/** Carrega uma textura uma única vez; resolve null se falhar (fica a cor lisa). */
function textura(arquivo, { cor = true } = {}) {
  if (!texturas.has(arquivo)) {
    texturas.set(arquivo, new Promise((resolver) => {
      carregador.load(new URL(arquivo, PASTA).href, (t) => {
        t.colorSpace = cor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.anisotropy = anisotropia;
        resolver(t);
      }, undefined, () => resolver(null));
    }));
  }
  return texturas.get(arquivo);
}

/** Brilho circular suave (estrelas, o Sol e objetos distantes). */
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

// ---------- Aparência de cada astro ----------
// atmosfera: espessura e escala de altura em raios do astro (exageradas para
// aparecer na tela; a da Terra de verdade tem ≈ 0,1% do raio).

const APARENCIAS = {
  sol: { mapa: "sol.webp" },
  mercurio: { mapa: "mercurio.webp", relevo: 1.4 },
  venus: { mapa: "venus.webp", atmosfera: { cor: "#ffe2a6", espessura: 0.06, altura: 0.012, forca: 0.08 } },
  terra: {
    mapa: "terra.webp", noite: "terra-noite.webp", nuvens: "terra-nuvens.webp", oceano: "terra-oceano.webp",
    atmosfera: { cor: "#4f8dff", espessura: 0.045, altura: 0.0075, forca: 0.055, porDoSol: true }
  },
  lua: { mapa: "lua.webp", relevo: 1.4 },
  marte: { mapa: "marte.webp", relevo: 0.8, atmosfera: { cor: "#f2b48a", espessura: 0.025, altura: 0.005, forca: 0.018 } },
  jupiter: { mapa: "jupiter.webp", atmosfera: { cor: "#f4e2c4", espessura: 0.025, altura: 0.005, forca: 0.025 } },
  saturno: { mapa: "saturno.webp", aneis: "saturno-aneis.png", atmosfera: { cor: "#f6e6c0", espessura: 0.025, altura: 0.005, forca: 0.025 } },
  urano: { mapa: "urano.webp", atmosfera: { cor: "#a6ecff", espessura: 0.03, altura: 0.007, forca: 0.07 } },
  netuno: { mapa: "netuno.webp", atmosfera: { cor: "#6f95ff", espessura: 0.03, altura: 0.007, forca: 0.07 } }
};

/** A textura dos anéis vai do raio 1,168 ao 2,346 de Saturno (anel C até depois do anel A). */
const ANEIS_TEXTURA = { interno: 1.168, externo: 2.346 };

const geometrias = new Map();
function esfera(raio, segmentos) {
  const chave = `${raio}:${segmentos}`;
  if (!geometrias.has(chave)) geometrias.set(chave, new THREE.SphereGeometry(raio, segmentos, Math.round(segmentos / 2)));
  return geometrias.get(chave);
}

// ---------- Shaders ----------

const VERTICE_LOCAL = /* glsl */ `
  varying vec3 vLocal;
  varying vec2 vUv;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    vLocal = position;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }`;

/**
 * Atmosfera: para cada pixel, o raio de visão atravessa a casca de ar.
 * Se acerta o planeta, o caminho cresce perto da borda (1/μ); se passa
 * rente, a densidade cai exponencialmente com a altura mínima do raio.
 * Só brilha o lado iluminado, com um tom de pôr do sol no terminador.
 */
const FRAGMENTO_ATMOSFERA = /* glsl */ `
  uniform vec3 camLocal;
  uniform vec3 solLocal;
  uniform vec3 cor;
  uniform float raioAtm;
  uniform float altura;
  uniform float forca;
  uniform float porDoSol;
  varying vec3 vLocal;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  void main() {
    #include <logdepthbuf_fragment>
    vec3 P = normalize(vLocal) * raioAtm;
    vec3 D = normalize(P - camLocal);
    float pd = dot(P, D);
    float d2 = max(dot(P, P) - pd * pd, 0.0);
    float rasante = sqrt(6.2832 / altura);
    float caminho;
    vec3 Q;
    bool acerta = d2 < 1.0 && pd < 0.0;
    if (acerta) {
      Q = P + D * (-pd - sqrt(1.0 - d2));
      float mu = max(dot(normalize(Q), -D), 1e-3);
      caminho = min(1.0 / mu, rasante);
    } else {
      Q = P + D * max(-pd, 0.0);
      caminho = rasante * exp(-max(sqrt(d2) - 1.0, 0.0) / altura);
    }
    float nl = dot(normalize(Q), solLocal);
    float luz = smoothstep(-0.15, 0.25, nl);
    float b = (1.0 - exp(-forca * caminho)) * luz;
    b *= 1.0 + 0.8 * pow(max(dot(D, solLocal), 0.0), 8.0);
    vec3 c = cor;
    if (porDoSol > 0.5 && !acerta) c = mix(c, vec3(1.0, 0.42, 0.16), (1.0 - smoothstep(-0.06, 0.14, nl)) * 0.7);
    gl_FragColor = vec4(c * b, b * 0.8);
    #include <colorspace_fragment>
  }`;

/** Anéis: textura radial, sombra do planeta e lado de trás mais escuro. */
const FRAGMENTO_ANEIS = /* glsl */ `
  uniform sampler2D mapa;
  uniform float temMapa;
  uniform vec3 camLocal;
  uniform vec3 solLocal;
  varying vec3 vLocal;
  varying vec2 vUv;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  void main() {
    #include <logdepthbuf_fragment>
    vec4 t = temMapa > 0.5 ? texture2D(mapa, vec2(vUv.x, 0.5)) : vec4(0.45, 0.4, 0.33, 0.6);
    float b = dot(vLocal, solLocal);
    float disco = b * b - (dot(vLocal, vLocal) - 1.0);
    float sombra = b < 0.0 ? smoothstep(-0.02, 0.02, disco) : 0.0;
    float mesmoLado = step(0.0, solLocal.y * (camLocal.y - vLocal.y));
    float luz = (1.0 - 0.93 * sombra) * mix(0.3 + 0.5 * (1.0 - t.a), 1.0, mesmoLado);
    vec3 c = t.rgb * vec3(1.12, 1.02, 0.86) * 2.0 * luz;
    gl_FragColor = vec4(c * t.a, t.a);
    #include <colorspace_fragment>
  }`;

const VERTICE_ESTRELA = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vVista;
  varying vec3 vLocal;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    vUv = uv;
    vLocal = position;
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vVista = -mv.xyz;
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }`;

/** Estrela: granulação animada e escurecimento do limbo (a borda é mais escura e avermelhada). */
const FRAGMENTO_ESTRELA = /* glsl */ `
  uniform sampler2D mapa;
  uniform float temMapa;
  uniform vec3 cor;
  uniform float tempo;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vVista;
  varying vec3 vLocal;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  float h(float n) { return fract(sin(n) * 43758.5453); }
  float ruido(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n = dot(i, vec3(1.0, 57.0, 113.0));
    return mix(mix(mix(h(n), h(n + 1.0), f.x), mix(h(n + 57.0), h(n + 58.0), f.x), f.y),
               mix(mix(h(n + 113.0), h(n + 114.0), f.x), mix(h(n + 170.0), h(n + 171.0), f.x), f.y), f.z);
  }
  void main() {
    #include <logdepthbuf_fragment>
    float mu = clamp(dot(normalize(vNormal), normalize(vVista)), 0.0, 1.0);
    float lum = temMapa > 0.5 ? dot(texture2D(mapa, vUv).rgb, vec3(0.3, 0.59, 0.11)) : 0.45;
    float g = 0.6 * ruido(vLocal * 34.0 + vec3(0.0, tempo * 0.06, 0.0)) + 0.4 * ruido(vLocal * 80.0 - vec3(tempo * 0.09));
    float limbo = 1.0 - 0.62 * (1.0 - mu) - 0.12 * pow(1.0 - mu, 2.0);
    // Com mapa (o Sol): o brilho da textura modula a cor. Sem mapa (outras
    // estrelas): a cor da classe espectral, sem estourar para o branco.
    float intensidade = temMapa > 0.5 ? (0.75 + 0.9 * lum) * 1.45 : 1.0;
    vec3 c = cor * intensidade * (0.88 + 0.24 * g) * limbo * vec3(1.0, 0.82 + 0.18 * mu, 0.62 + 0.38 * mu);
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }`;

// ---------- Auxiliares de orientação ----------

const auxQ = new THREE.Quaternion();
const auxM = new THREE.Matrix4();
const eixoX = new THREE.Vector3(), eixoY = new THREE.Vector3(), eixoZ = new THREE.Vector3();

/** Orienta um objeto pelo modelo da IAU (polo e meridiano principal na data). */
export function orientarPelaIau(objeto3d, rotacao, data) {
  const o = astro.orientacaoIau(rotacao, data);
  const m = astro.paraCena(o.meridiano), p = astro.paraCena(o.polo), e = astro.paraCena(o.leste);
  // Na esfera do Three.js a longitude 0° fica em +X, o norte em +Y e a longitude 90° L em −Z.
  eixoX.set(m.x, m.y, m.z);
  eixoY.set(p.x, p.y, p.z);
  eixoZ.set(-e.x, -e.y, -e.z);
  objeto3d.quaternion.setFromRotationMatrix(auxM.makeBasis(eixoX, eixoY, eixoZ));
}

/** Posição da câmera e direção do Sol no espaço local de um objeto. */
function paraLocal(objeto3d, camera, dirSolMundo, uniformes) {
  uniformes.camLocal.value.setFromMatrixPosition(camera.matrixWorld);
  objeto3d.worldToLocal(uniformes.camLocal.value);
  objeto3d.getWorldQuaternion(auxQ).invert();
  uniformes.solLocal.value.copy(dirSolMundo).applyQuaternion(auxQ).normalize();
}

// ---------- Construção ----------

/**
 * Cria um astro. Devolve { grupo, superficie, carregar(), ... }.
 * O grupo fica com escala 1 = raio do astro: quem usa posiciona, escala
 * (raio exibido) e orienta o grupo. "dirSol" é a direção, no mundo, do
 * astro para o Sol (quem usa atualiza a cada quadro).
 */
export function criarAstro(objeto, { segmentos = 96 } = {}) {
  const ehEstrela = objeto.id === "sol" || Boolean(objeto.espectro);
  return ehEstrela ? criarEstrela(objeto, segmentos) : criarPlaneta(objeto, segmentos);
}

function criarEstrela(objeto, segmentos) {
  const aparencia = APARENCIAS[objeto.id] || {};
  const grupo = new THREE.Group();
  const uniformes = {
    mapa: { value: null },
    temMapa: { value: 0 },
    cor: { value: new THREE.Color(objeto.id === "sol" ? "#ffdfa3" : objeto.corEstrela || objeto.cor || "#fff4ea") },
    tempo: { value: 0 }
  };
  const material = new THREE.ShaderMaterial({ uniforms: uniformes, vertexShader: VERTICE_ESTRELA, fragmentShader: FRAGMENTO_ESTRELA });
  const superficie = new THREE.Mesh(esfera(1, segmentos), material);
  superficie.onBeforeRender = () => { uniformes.tempo.value = performance.now() / 1000; };
  grupo.add(superficie);

  let pedido = null;
  return {
    grupo,
    superficie,
    dirSol: new THREE.Vector3(1, 0, 0),
    raioVisual: 1,
    carregar() {
      if (!pedido) {
        pedido = aparencia.mapa
          ? textura(aparencia.mapa).then((t) => { if (t) { uniformes.mapa.value = t; uniformes.temMapa.value = 1; } })
          : Promise.resolve();
      }
      return pedido;
    },
    get pedido() { return Boolean(pedido); }
  };
}

function criarPlaneta(objeto, segmentos) {
  const aparencia = APARENCIAS[objeto.id] || {};
  const grupo = new THREE.Group();
  const dirSol = new THREE.Vector3(1, 0, 0);
  const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(objeto.cor || "#999999"), roughness: 1, metalness: 0 });
  const superficie = new THREE.Mesh(esfera(1, segmentos), material);
  grupo.add(superficie);

  // Terra: luzes das cidades só no lado da noite.
  const dirSolVista = { value: new THREE.Vector3(1, 0, 0) };
  if (aparencia.noite) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.dirSolVista = dirSolVista;
      shader.fragmentShader = "uniform vec3 dirSolVista;\n" + shader.fragmentShader.replace(
        "vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;",
        "float noite = smoothstep(0.06, -0.2, dot(normal, dirSolVista));\n" +
        "vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance * noite;"
      );
    };
    material.customProgramCacheKey = () => "terra-noite";
    superficie.onBeforeRender = (_r, _c, camera) => {
      dirSolVista.value.copy(dirSol).transformDirection(camera.matrixWorldInverse);
    };
  }

  // Nuvens (camada um pouco acima da superfície).
  let nuvens = null;
  if (aparencia.nuvens) {
    nuvens = new THREE.Mesh(esfera(1.006, segmentos), new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 1, metalness: 0, transparent: true, depthWrite: false
    }));
    nuvens.visible = false;
    nuvens.renderOrder = 1;
    superficie.add(nuvens);
  }

  // Atmosfera.
  let atmosfera = null;
  if (aparencia.atmosfera) {
    const a = aparencia.atmosfera;
    const raioAtm = 1 + a.espessura;
    const uniformes = {
      camLocal: { value: new THREE.Vector3() },
      solLocal: { value: new THREE.Vector3(1, 0, 0) },
      cor: { value: new THREE.Color(a.cor) },
      raioAtm: { value: raioAtm },
      altura: { value: a.altura },
      forca: { value: a.forca },
      porDoSol: { value: a.porDoSol ? 1 : 0 }
    };
    atmosfera = new THREE.Mesh(esfera(raioAtm, segmentos), new THREE.ShaderMaterial({
      uniforms: uniformes, vertexShader: VERTICE_LOCAL, fragmentShader: FRAGMENTO_ATMOSFERA,
      transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor
    }));
    atmosfera.renderOrder = 2;
    atmosfera.onBeforeRender = (_r, _c, camera) => paraLocal(atmosfera, camera, dirSol, uniformes);
    grupo.add(atmosfera);
  }

  // Anéis (Saturno), no plano do equador.
  let aneis = null;
  let uniformesAneis = null;
  if (aparencia.aneis) {
    const { interno, externo } = ANEIS_TEXTURA;
    const geometria = new THREE.RingGeometry(interno, externo, 256, 1);
    const posicao = geometria.attributes.position, uv = geometria.attributes.uv;
    for (let i = 0; i < posicao.count; i++) {
      uv.setXY(i, (Math.hypot(posicao.getX(i), posicao.getY(i)) - interno) / (externo - interno), 0.5);
    }
    geometria.rotateX(-Math.PI / 2);
    uniformesAneis = {
      mapa: { value: null },
      temMapa: { value: 0 },
      camLocal: { value: new THREE.Vector3() },
      solLocal: { value: new THREE.Vector3(1, 0, 0) }
    };
    aneis = new THREE.Mesh(geometria, new THREE.ShaderMaterial({
      uniforms: uniformesAneis, vertexShader: VERTICE_LOCAL, fragmentShader: FRAGMENTO_ANEIS,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor
    }));
    aneis.renderOrder = 3;
    aneis.onBeforeRender = (_r, _c, camera) => paraLocal(aneis, camera, dirSol, uniformesAneis);
    grupo.add(aneis);
  }

  let pedido = null;
  function carregar() {
    if (pedido) return pedido;
    const tarefas = [];
    if (aparencia.mapa) {
      tarefas.push(textura(aparencia.mapa).then((t) => {
        if (!t) return;
        material.map = t;
        material.color.set(0xffffff);
        if (aparencia.relevo) {
          material.bumpMap = t;
          material.bumpScale = aparencia.relevo;
        }
        material.needsUpdate = true;
      }));
    }
    if (aparencia.oceano) {
      tarefas.push(textura(aparencia.oceano, { cor: false }).then((t) => {
        if (!t) return;
        material.roughnessMap = t;
        material.needsUpdate = true;
      }));
    }
    if (aparencia.noite) {
      tarefas.push(textura(aparencia.noite).then((t) => {
        if (!t) return;
        material.emissiveMap = t;
        material.emissive.set("#ffd9a0");
        material.emissiveIntensity = 1.6;
        material.needsUpdate = true;
      }));
    }
    if (nuvens) {
      tarefas.push(textura(aparencia.nuvens, { cor: false }).then((t) => {
        if (!t) return;
        nuvens.material.alphaMap = t;
        nuvens.material.needsUpdate = true;
        nuvens.visible = true;
      }));
    }
    if (aneis) {
      tarefas.push(textura(aparencia.aneis).then((t) => {
        if (!t) return;
        uniformesAneis.mapa.value = t;
        uniformesAneis.temMapa.value = 1;
      }));
    }
    pedido = Promise.all(tarefas);
    return pedido;
  }

  return {
    grupo,
    superficie,
    nuvens,
    atmosfera,
    aneis,
    dirSol,
    raioVisual: aneis ? ANEIS_TEXTURA.externo : atmosfera ? 1 + aparencia.atmosfera.espessura : 1,
    carregar,
    get pedido() { return Boolean(pedido); }
  };
}
