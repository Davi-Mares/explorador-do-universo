// ---------------------------------------------------------------------------
// Explorador do Universo — montagem das três cenas (níveis de escala).
//
//   Sistema Solar      1 unidade = 1 UA          (planetas nas posições de hoje)
//   Estrelas vizinhas  1 unidade = 1 ano-luz     (posições reais, brilho real)
//   Via Láctea         1 unidade = 1.000 anos-luz
//
// Cada nível devolve: a cena, a lista de "corpos" (o que pode ser descoberto),
// referências (rótulos sem interação) e uma função atualizar(data, camera).
// Escalas separadas evitam problemas de precisão numérica e também são uma
// escolha didática: cada salto de nível é uma "potência de dez".
// ---------------------------------------------------------------------------

import * as THREE from "three";
import * as astro from "./astronomia.js";
import {
  SOL, PLANETAS, LUA, LUAS, VOYAGER, PLANETAS_ANOES, CINTURAO, ESTRELAS, SOL_MAGNITUDE_ABSOLUTA,
  GALAXIA, OBJETOS_GALAXIA, corDaEstrela
} from "./catalogo.js";
import { criarAstro, orientarPelaIau, texturaDeBrilho } from "./astros3d.js";
import {
  corRgb, materialDePontos, pontos, criarViaLactea, criarNebulosaDeOrion, criarNebulosaDaAguia, criarNebulosaDeCarina,
  criarNebulosaDoCaranguejo, criarPleiades, criarAglomeradoGlobular, criarNucleoGalactico
} from "./galaxias3d.js";
import { CRIAR_VIZINHA, orientacaoNaCena } from "./vizinhas3d.js";
import { criarCinturao } from "./cinturao3d.js";
import {
  criarFaixaDaViaLactea, criarEstrelasDoCatalogo, matrizCenaEclipticaParaGalactica, matrizCenaGalacticaParaGalactica
} from "./ceu3d.js";

export { materialDePontos };

const EIXO_Y = new THREE.Vector3(0, 1, 0);

function vetor(objeto) {
  const p = astro.paraCena(objeto);
  return new THREE.Vector3(p.x, p.y, p.z);
}

const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

/**
 * Quanto afastar a posição inicial da nave conforme o formato da tela. Numa
 * tela larga (16:9 ou mais) é 1; numa tela em pé o campo de visão horizontal
 * encolhe, então a nave começa mais longe (até "maximo" vezes).
 */
const afastamentoPelaTela = (aspecto, maximo) => limitar(1.5 / Math.max(aspecto, 0.1), 1, maximo);

/** Tamanho (px) e brilho de um ponto a partir da magnitude aparente. */
export function aparenciaPorMagnitude(m) {
  const x = 6.5 - m; // > 0: visível a olho nu
  return [limitar(1.4 + x * 1.15, 1.2, 40), limitar(0.22 + x * 0.13, 0.07, 1.6)];
}

/**
 * Linha de órbita que some aos poucos quando vista de lado (de dentro do
 * plano das órbitas, todas virariam riscos atravessando o céu) e perto da
 * nave (a órbita do planeta não corta o planeta na frente da câmera).
 */
function linhaDeOrbita(pontosDaOrbita, cor, opacidade) {
  const geometria = new THREE.BufferGeometry().setFromPoints(pontosDaOrbita);
  const normal = new THREE.Vector3().crossVectors(pontosDaOrbita[0], pontosDaOrbita[Math.floor(pontosDaOrbita.length / 4)]).normalize();
  const raio = pontosDaOrbita.reduce((soma, p) => soma + p.length(), 0) / pontosDaOrbita.length;
  const n = parseInt(cor.replace("#", ""), 16);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      cor: { value: new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255) },
      opacidade: { value: opacidade },
      normalOrbita: { value: normal },
      raio: { value: raio }
    },
    vertexShader: /* glsl */ `
      uniform float opacidade;
      uniform vec3 normalOrbita;
      uniform float raio;
      varying float vAlfa;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main() {
        vec4 mundo = modelMatrix * vec4(position, 1.0);
        vec3 paraPonto = mundo.xyz - cameraPosition;
        float d = length(paraPonto);
        float deLado = smoothstep(0.01, 0.14, abs(dot(paraPonto / max(d, 1e-12), normalOrbita)));
        float perto = smoothstep(0.004 * raio, 0.06 * raio, d);
        vAlfa = opacidade * mix(0.16, 1.0, deLado) * perto;
        gl_Position = projectionMatrix * viewMatrix * mundo;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 cor;
      varying float vAlfa;
      #include <common>
      #include <logdepthbuf_pars_fragment>
      void main() {
        #include <logdepthbuf_fragment>
        gl_FragColor = vec4(cor, vAlfa);
      }`,
    transparent: true,
    depthWrite: false
  });
  const linha = new THREE.LineLoop(geometria, material);
  linha.frustumCulled = false;
  return linha;
}

function brilhoSprite(cor, escala, { atenuar = true, opacidade = 1 } = {}) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texturaDeBrilho(), color: cor, transparent: true, opacity: opacidade,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: atenuar
  }));
  sprite.scale.setScalar(escala);
  sprite.frustumCulled = false;
  return sprite;
}

function criarCorpo(objeto, extras = {}) {
  return {
    id: objeto.id,
    objeto,
    nome: objeto.nome,
    cor: objeto.cor || "#ffffff",
    posicao: new THREE.Vector3(),
    raioExibido: 0,
    raioDescoberta: 0,
    distanciaChegada: 0,
    ...extras
  };
}

// ===========================================================================
// Nível 1 — Sistema Solar
// ===========================================================================

const AMPLIACAO = { planetas: 500, sol: 10 };
/** Deriva das nuvens em relação ao chão (ventos de oeste): ≈ 8° por dia. */
const DERIVA_NUVENS_RAD_POR_DIA = (8 * Math.PI) / 180;
/** Tamanho aparente (raio/distância) a partir do qual as texturas são carregadas. */
const TAMANHO_PARA_TEXTURA = 0.0015;
/** Bem de perto (o planeta ocupa boa parte da tela), os mapas de 4096 px — só no computador. */
const TAMANHO_PARA_HD = 0.25;
const PODE_HD = typeof window !== "undefined" && !window.matchMedia?.("(pointer: coarse)").matches
  && (navigator.deviceMemory ?? 8) >= 4;

export function criarNivelSolar(dataInicial) {
  const cena = new THREE.Scene();
  const materiaisDePontos = [];
  const ua = astro.KM_POR_UA;

  cena.add(new THREE.AmbientLight(0xffffff, 0.04));
  const luz = new THREE.PointLight(0xffffff, 3, 0, 0);
  cena.add(luz);

  /** Astro 3D (superfície, atmosfera, anéis) de um corpo. */
  function montar(corpo, segmentos = 96) {
    corpo.astro = criarAstro(corpo.objeto, { segmentos });
    corpo.malha = corpo.astro.grupo;
    cena.add(corpo.malha);
    return corpo;
  }

  // --- Sol ---
  const sol = montar(criarCorpo(SOL, { raioReal: SOL.raioKm / ua }));
  sol.astro.carregar();
  const brilhoPerto = brilhoSprite("#ffe2b0", 1, { opacidade: 0.75 });
  const brilhoLonge = brilhoSprite("#fff1d6", 0.045, { atenuar: false });
  cena.add(brilhoPerto, brilhoLonge);

  // --- Planetas ---
  const planetas = PLANETAS.map((planeta) => {
    const corpo = montar(criarCorpo(planeta, { raioReal: planeta.raioKm / ua }));
    // Órbita (elipse real calculada pelos elementos keplerianos).
    cena.add(linhaDeOrbita(astro.pontosDaOrbita(planeta, dataInicial, 360).map(vetor), planeta.cor, 0.42));
    return corpo;
  });
  const terra = planetas.find((p) => p.id === "terra");

  // --- Lua ---
  const lua = montar(criarCorpo(LUA, { raioReal: LUA.raioKm / ua, pai: "terra" }), 64);
  // A face visível (longitude 0°) fica em +Z, que o lookAt aponta para a Terra.
  lua.astro.superficie.rotation.y = -Math.PI / 2;

  // --- Planetas anões (Ceres e Plutão), com órbita ---
  const anoes = PLANETAS_ANOES.map((planeta) => {
    const corpo = montar(criarCorpo(planeta, { raioReal: planeta.raioKm / ua }), 64);
    cena.add(linhaDeOrbita(astro.pontosDaOrbita(planeta, dataInicial, 360).map(vetor), planeta.cor, 0.3));
    return corpo;
  });

  // --- Cinturão de Asteroides (milhares de órbitas de Kepler) e troianos ---
  const jupiterJ2000 = PLANETAS.find((p) => p.id === "jupiter").orbita.elementos;
  const asteroides = criarCinturao({ jupiter: jupiterJ2000 });
  materiaisDePontos.push(asteroides.material);
  cena.add(asteroides.objeto);
  // O "destino" Cinturão é o ponto do anel (≈ 2,7 UA) mais perto da nave.
  const raioMedioCinturao = (CINTURAO.raioInternoUA + CINTURAO.raioExternoUA) / 2;
  const cinturao = criarCorpo(CINTURAO, {
    raioExibido: 0, raioDescoberta: (CINTURAO.raioExternoUA - CINTURAO.raioInternoUA) / 2, distanciaChegada: 0.03, regiao: true
  });
  cinturao.posicao.set(raioMedioCinturao, 0, 0);
  // Ao chegar, olhar ao longo do anel (25° à frente): os asteroides aparecem em fila.
  cinturao.pontoDeOlhar = () => cinturao.posicao.clone().applyAxisAngle(EIXO_Y, (25 * Math.PI) / 180);

  // --- Voyager 1 e a fronteira do vento solar ---
  const voyager = criarCorpo(VOYAGER, { raioReal: 0, raioExibido: 1e-9, raioDescoberta: 2, distanciaChegada: 0.01, sonda: true });
  const marcaVoyager = brilhoSprite("#f4f1e8", 0.008, { atenuar: false, opacidade: 0.9 });
  cena.add(marcaVoyager);
  // --- Céu de verdade: a faixa da Via Láctea (foto da ESO) e as 9 mil
  // estrelas visíveis a olho nu (catálogo Hipparcos), vistas daqui. ---
  const faixa = criarFaixaDaViaLactea({ raio: 5e8, matriz: matrizCenaEclipticaParaGalactica(), intensidade: 0.85 });
  cena.add(faixa.objeto);
  const estrelasDoCeu = criarEstrelasDoCatalogo({ infinito: true, raio: 4e8 });
  materiaisDePontos.push(estrelasDoCeu.material);
  cena.add(estrelasDoCeu.objeto);

  // --- Luas principais: órbitas médias do JPL, sempre a mesma face para o planeta ---
  const luas = LUAS.map((objeto) => {
    const corpo = montar(criarCorpo(objeto, { raioReal: objeto.raioKm / ua, pai: objeto.pai }), 48);
    // Longitude 0° em +Z: o lookAt deixa essa face virada para o planeta.
    corpo.astro.superficie.rotation.y = -Math.PI / 2;
    return corpo;
  });
  const porId = new Map([...planetas, ...anoes].map((corpo) => [corpo.id, corpo]));
  const caronte = luas.find((l) => l.id === "caronte");
  const plutao = porId.get("plutao");
  /** Plutão e Caronte giram em volta do centro de massa (fora de Plutão): massa de Caronte / Plutão = 0,122 (JPL). */
  const FRACAO_PLUTAO = 0.122 / 1.122;
  const poloAux = new THREE.Vector3();

  // Ordem dos destinos: cada lua logo depois do seu planeta.
  const luasDe = (id) => luas.filter((l) => l.pai === id);
  const corpos = [sol];
  for (const planeta of planetas) corpos.push(planeta, ...(planeta === terra ? [lua] : []), ...luasDe(planeta.id));
  for (const anao of anoes) corpos.push(anao, ...luasDe(anao.id));
  corpos.push(cinturao, voyager);

  let modoTamanho = "real";
  function aplicarTamanho(modo) {
    modoTamanho = modo;
    const fatorPlanetas = modo === "ampliado" ? AMPLIACAO.planetas : 1;
    const fatorSol = modo === "ampliado" ? AMPLIACAO.sol : 1;
    for (const corpo of [sol, ...planetas, lua, ...luas, ...anoes]) {
      const fator = corpo === sol ? fatorSol : fatorPlanetas;
      corpo.raioExibido = corpo.raioReal * fator;
      corpo.malha.scale.setScalar(corpo.raioExibido);
      corpo.raioDescoberta = Math.max(corpo.raioReal * 100, corpo.raioExibido * 6, 1e-4);
      corpo.distanciaChegada = Math.max(corpo.raioExibido * 5, 2e-6);
    }
    sol.raioDescoberta = 0.25;
    // No modo ampliado as luas ficariam dentro dos planetas ampliados: somem.
    for (const corpo of [lua, ...luas]) {
      corpo.malha.visible = modo !== "ampliado";
      corpo.oculto = modo === "ampliado";
    }
    brilhoPerto.scale.setScalar(sol.raioExibido * 6);
  }
  aplicarTamanho("real");

  const J2000 = Date.UTC(2000, 0, 1, 12);

  function atualizar(data, camera) {
    for (const corpo of [...planetas, ...anoes]) corpo.posicao.copy(vetor(astro.posicaoHeliocentrica(corpo.objeto, data)));
    const geo = astro.posicaoLuaGeocentrica(data);
    lua.posicao.copy(terra.posicao).add(vetor({ x: geo.x / ua, y: geo.y / ua, z: geo.z / ua }));
    voyager.posicao.copy(vetor(astro.posicaoSondaHeliocentrica(VOYAGER, data)));
    for (const corpo of luas) {
      const pai = porId.get(corpo.pai);
      const p = astro.posicaoDaLua(corpo.objeto, pai.objeto.rotacao, data);
      corpo.posicao.copy(pai.posicao).add(vetor({ x: p.x / ua, y: p.y / ua, z: p.z / ua }));
    }
    // A posição calculada de Plutão é a do centro de massa do par Plutão–Caronte.
    if (caronte && plutao) {
      const relativa = caronte.posicao.clone().sub(plutao.posicao);
      plutao.posicao.addScaledVector(relativa, -FRACAO_PLUTAO);
      caronte.posicao.addScaledVector(relativa, -FRACAO_PLUTAO);
    }

    // Eixos e rotação pelo modelo da IAU: o lado da Terra virado para o Sol
    // é o que está de dia agora (na data simulada).
    for (const corpo of [sol, ...planetas, ...anoes]) {
      corpo.malha.position.copy(corpo.posicao);
      orientarPelaIau(corpo.malha, corpo.objeto.rotacao, data);
    }
    lua.malha.position.copy(lua.posicao);
    // A Lua mostra sempre a mesma face para a Terra.
    lua.malha.lookAt(terra.posicao);
    for (const corpo of luas) {
      const pai = porId.get(corpo.pai);
      corpo.malha.position.copy(corpo.posicao);
      // O polo da lua acompanha o do planeta (a órbita fica no equador dele).
      corpo.malha.up.copy(poloAux.set(0, 1, 0).applyQuaternion(pai.malha.quaternion));
      corpo.malha.lookAt(pai.posicao);
    }
    const dias = (data.getTime() - J2000) / 86_400_000;
    if (terra.astro.nuvens) terra.astro.nuvens.rotation.y = (dias * DERIVA_NUVENS_RAD_POR_DIA) % (Math.PI * 2);

    asteroides.atualizar(dias);
    if (camera) {
      // Ponto do cinturão na direção da nave (projetada no plano da eclíptica).
      const x = camera.position.x, z = camera.position.z;
      const r = Math.hypot(x, z);
      if (r > 1e-9) cinturao.posicao.set((x / r) * raioMedioCinturao, 0, (z / r) * raioMedioCinturao);
    }

    for (const corpo of [...planetas, lua, ...luas, ...anoes]) {
      corpo.astro.dirSol.copy(corpo.posicao).negate().normalize();
      // Texturas só quando o astro aparece maior que um pontinho (economiza memória).
      if (!camera || corpo.oculto) continue;
      const tamanho = corpo.raioExibido / Math.max(camera.position.distanceTo(corpo.posicao), 1e-12);
      if (!corpo.astro.pedido && tamanho > TAMANHO_PARA_TEXTURA) corpo.astro.carregar();
      if (PODE_HD && corpo.astro.temHD && !corpo.astro.pedidoHD && tamanho > TAMANHO_PARA_HD) corpo.astro.carregarHD();
    }
    marcaVoyager.position.copy(voyager.posicao);
    if (camera) faixa.atualizar(camera);
  }
  atualizar(dataInicial);

  /** Começa perto da Terra, entre ela e o Sol, olhando para a Terra iluminada. */
  function inicio() {
    const paraOSol = sol.posicao.clone().sub(terra.posicao).normalize();
    const lado = new THREE.Vector3().crossVectors(paraOSol, EIXO_Y).normalize();
    const deslocamento = paraOSol.clone().multiplyScalar(0.0005).addScaledVector(lado, 0.00028).addScaledVector(EIXO_Y, 0.00016);
    const posicao = terra.posicao.clone().add(deslocamento);
    return { posicao, olharPara: terra.posicao.clone() };
  }

  return {
    id: "solar",
    cena,
    corpos,
    materiaisDePontos,
    near: 1e-9,
    far: 1e9,
    temTempo: true,
    temTamanho: true,
    unidadeKm: ua,
    sol,
    aplicarTamanho,
    get modoTamanho() { return modoTamanho; },
    atualizar,
    inicio,
    /** Órbita em volta do Sol (sem entrar no brilho) e da Voyager (um pontinho). */
    limitesDaOrbita(corpo) {
      if (corpo === sol) return { minimo: sol.raioExibido * 1.2, maximo: 0.75, superficie: sol.raioExibido };
      if (corpo === voyager) return { minimo: 1e-6, maximo: 2, superficie: 0 };
      return null;
    },
    /**
     * De onde ver um astro ao saltar até ele: do lado iluminado, um pouco
     * acima do equador no hemisfério virado para o Sol (em Saturno, assim
     * se vê a face dos anéis que está recebendo luz).
     */
    pontoDeVista(corpo) {
      if (corpo === sol || corpo === voyager || !corpo.malha) return null;
      const paraOSol = sol.posicao.clone().sub(corpo.posicao).normalize();
      const polo = EIXO_Y.clone().applyQuaternion(corpo.malha.quaternion);
      const lado = Math.sign(paraOSol.dot(polo)) || 1;
      return paraOSol.applyAxisAngle(EIXO_Y, 0.35).addScaledVector(polo, 0.3 * lado).normalize();
    }
  };
}

// ===========================================================================
// Nível 2 — Estrelas vizinhas (unidade: ano-luz)
// ===========================================================================

/** Texto numa textura (para os rótulos da régua). */
function spriteDeTexto(texto, { cor = "#9fbfff", altura = 1 } = {}) {
  const canvas = document.createElement("canvas");
  const contexto = canvas.getContext("2d");
  const fonte = "600 44px system-ui, -apple-system, Segoe UI, sans-serif";
  contexto.font = fonte;
  canvas.width = Math.ceil(contexto.measureText(texto).width) + 24;
  canvas.height = 64;
  contexto.font = fonte;
  contexto.fillStyle = cor;
  contexto.textBaseline = "middle";
  contexto.fillText(texto, 12, 33);
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: textura, transparent: true, opacity: 0.75, depthWrite: false }));
  sprite.scale.set(altura * (canvas.width / canvas.height), altura, 1);
  return sprite;
}

/**
 * Posição na cena das Estrelas vizinhas, em coordenadas galácticas: o plano
 * da galáxia fica "deitado" (a faixa da Via Láctea na horizontal) e o eixo
 * para cima aponta o polo norte galáctico.
 */
function naGalaxia(arGraus, decGraus, distancia) {
  const { l, b } = astro.equatorialParaGalactica(arGraus, decGraus);
  const lr = (l * Math.PI) / 180, br = (b * Math.PI) / 180;
  return vetor({ x: distancia * Math.cos(br) * Math.cos(lr), y: distancia * Math.cos(br) * Math.sin(lr), z: distancia * Math.sin(br) });
}

/** Círculos de distância em volta do Sol, no plano da galáxia, com rótulos. */
function criarReguaDeDistancias(raios) {
  const grupo = new THREE.Group();
  // Polo norte galáctico (para cima), centro da galáxia (x) e longitude 90° (−z).
  const polo = new THREE.Vector3(0, 1, 0);
  const eixoX = new THREE.Vector3(1, 0, 0);
  const eixoY = new THREE.Vector3(0, 0, -1);
  // Os rótulos ficam na direção de longitude galáctica 60° (entre Águia e Cisne).
  const lRotulo = (60 * Math.PI) / 180;
  const direcaoRotulo = eixoX.clone().multiplyScalar(Math.cos(lRotulo)).addScaledVector(eixoY, Math.sin(lRotulo));
  const partes = [];
  for (const raio of raios) {
    const pontosDoCirculo = [];
    for (let i = 0; i < 256; i++) {
      const a = (i / 256) * Math.PI * 2;
      pontosDoCirculo.push(eixoX.clone().multiplyScalar(Math.cos(a) * raio).addScaledVector(eixoY, Math.sin(a) * raio));
    }
    const circulo = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(pontosDoCirculo),
      new THREE.LineBasicMaterial({ color: "#6f93d8", transparent: true, opacity: 0, depthWrite: false })
    );
    const rotulo = spriteDeTexto(`${raio} anos-luz`, { altura: 0.26 + raio * 0.02 });
    rotulo.position.copy(direcaoRotulo).multiplyScalar(raio);
    grupo.add(circulo, rotulo);
    partes.push([circulo.material, raio % 10 === 0 ? 0.24 : 0.15], [rotulo.material, 0.75]);
  }
  /** Vistos de lado (a nave perto do plano), os círculos viram riscos: somem aos poucos. */
  grupo.userData.atualizar = (camera) => {
    const distancia = camera.position.length();
    const elevacao = distancia > 1e-9 ? Math.abs(camera.position.dot(polo)) / distancia : 1;
    const fator = THREE.MathUtils.smoothstep(elevacao, 0.12, 0.4) * THREE.MathUtils.smoothstep(distancia, 2, 6);
    for (const [material, base] of partes) material.opacity = base * fator;
    grupo.visible = fator > 0.01;
  };
  return grupo;
}

export function criarNivelEstrelas() {
  const cena = new THREE.Scene();
  const materiaisDePontos = [];

  const solEstrela = { ...SOL, magnitudeAbsoluta: SOL_MAGNITUDE_ABSOLUTA, espectro: "G2 V" };
  const estrelas = [solEstrela, ...ESTRELAS].map((estrela) => {
    const ehSol = estrela.id === "sol";
    const posicao = ehSol
      ? new THREE.Vector3()
      : naGalaxia(astro.arParaGraus(estrela.ar), astro.decParaGraus(estrela.dec), estrela.anosLuz);
    const corpo = criarCorpo(estrela, {
      raioExibido: 1e-7,
      raioDescoberta: 0.5,
      distanciaChegada: 0.03,
      cor: corDaEstrela(estrela),
      magnitudeAbsoluta: ehSol ? SOL_MAGNITUDE_ABSOLUTA : astro.magnitudeAbsoluta(estrela.mag, estrela.anosLuz)
    });
    corpo.posicao.copy(posicao);
    return corpo;
  });

  // Pontos das estrelas: tamanho e brilho recalculados conforme a câmera anda.
  const material = materialDePontos();
  materiaisDePontos.push(material);
  const nuvem = pontos(
    estrelas.flatMap((e) => [e.posicao.x, e.posicao.y, e.posicao.z]),
    estrelas.flatMap((e) => corRgb(e.cor)),
    estrelas.map(() => 2),
    estrelas.map(() => 1),
    material
  );
  cena.add(nuvem);

  // Céu: a faixa da Via Láctea (bem mais longe que tudo aqui) e as estrelas
  // do catálogo Hipparcos nas posições 3D reais. As 30 estrelas do nível já
  // estão desenhadas acima, então ficam de fora da nuvem do catálogo.
  const faixa = criarFaixaDaViaLactea({ raio: 5e4, matriz: matrizCenaGalacticaParaGalactica(), intensidade: 0.85 });
  cena.add(faixa.objeto);
  const conhecidas = ESTRELAS.map((e) => ({
    direcao: naGalaxia(astro.arParaGraus(e.ar), astro.decParaGraus(e.dec), 1),
    anosLuz: e.anosLuz
  }));
  const LIMITE_MESMA = Math.cos((0.6 * Math.PI) / 180);
  const catalogo = criarEstrelasDoCatalogo({
    posicao: naGalaxia,
    pular: (estrela) => {
      const d = naGalaxia(estrela.ar, estrela.dec, 1);
      return conhecidas.some((c) => c.direcao.dot(d) > LIMITE_MESMA && (!estrela.anosLuz || Math.abs(estrela.anosLuz / c.anosLuz - 1) < 0.3));
    }
  });
  materiaisDePontos.push(catalogo.material);
  cena.add(catalogo.objeto);

  // Régua: círculos de 5, 10, 15 e 20 anos-luz em volta do Sol, no plano da
  // galáxia (o mesmo da faixa da Via Láctea ao fundo).
  const regua = criarReguaDeDistancias([5, 10, 15, 20]);
  cena.add(regua);

  const atributoTamanho = nuvem.geometry.attributes.tamanho;
  const atributoBrilho = nuvem.geometry.attributes.brilho;

  function atualizar(_data, camera) {
    faixa.atualizar(camera);
    regua.userData.atualizar(camera);
    estrelas.forEach((e, i) => {
      const distancia = camera.position.distanceTo(e.posicao);
      e.magnitudeVista = astro.magnitudeAparente(e.magnitudeAbsoluta, distancia);
      const [tamanho, brilho] = aparenciaPorMagnitude(e.magnitudeVista);
      const tamanhoFinal = Math.min(tamanho * 1.7, 64);
      atributoTamanho.setX(i, tamanhoFinal);
      atributoBrilho.setX(i, Math.max(brilho, 0.12));
      // Usado pelos rótulos: estrela brilhante tem o rótulo ao lado, não em cima.
      e.tamanhoPx = tamanhoFinal > 7 ? tamanhoFinal * 0.55 : 0;
    });
    atributoTamanho.needsUpdate = true;
    atributoBrilho.needsUpdate = true;
  }

  /**
   * Começa a 9 anos-luz do Sol, um pouco acima do plano da galáxia, do lado
   * oposto ao de Alfa Centauri: o Sol no meio, a vizinha logo atrás, a régua
   * de distâncias em volta e a faixa da Via Láctea ao fundo.
   */
  function inicio(aspecto = 16 / 9) {
    const alfa = estrelas.find((e) => e.id === "alfa-centauri").posicao.clone().normalize();
    const polo = new THREE.Vector3(0, 1, 0);
    const noPlano = alfa.sub(polo.clone().multiplyScalar(alfa.dot(polo))).normalize();
    const elevacao = (24 * Math.PI) / 180;
    // Em telas em pé (celular) a nave começa mais longe: a régua cabe na largura.
    const distancia = 9 * afastamentoPelaTela(aspecto, 2.2);
    const posicao = noPlano.multiplyScalar(-Math.cos(elevacao)).addScaledVector(polo, Math.sin(elevacao)).multiplyScalar(distancia);
    return { posicao, olharPara: new THREE.Vector3() };
  }

  return {
    id: "estrelas",
    cena,
    corpos: estrelas,
    materiaisDePontos,
    near: 1e-6,
    far: 1e5,
    temTempo: false,
    temTamanho: false,
    unidadeKm: astro.KM_POR_ANO_LUZ,
    sol: estrelas[0],
    atualizar,
    inicio,
    limitesDaOrbita: () => ({ minimo: 0.004, maximo: 1.25, superficie: 0 }),
    pontoDeVista: () => null
  };
}

// ===========================================================================
// Nível 3 — Via Láctea (unidade: mil anos-luz)
// Os braços são uma representação esquemática; as posições do Sol, do
// centro e dos objetos marcados são as reais. Cada objeto marcado ganha um
// modelo 3D próprio (nebulosas, aglomerados, galáxias), no tamanho real.
// ===========================================================================

const RAIOS_GALAXIA = {
  "sol-galaxia": { descoberta: 1, chegada: 0.35 },
  "sgr-a": { descoberta: 3, chegada: 0.06 },
  pleiades: { descoberta: 0.8, chegada: 0.07 },
  "orion-nebula": { descoberta: 0.8, chegada: 0.04 },
  crab: { descoberta: 0.8, chegada: 0.011 },
  eagle: { descoberta: 0.8, chegada: 0.11 },
  carina: { descoberta: 1, chegada: 0.45 },
  "omega-centauri": { descoberta: 1.5, chegada: 0.2 },
  lmc: { descoberta: 60, chegada: 40 },
  smc: { descoberta: 40, chegada: 28 },
  andromeda: { descoberta: 420, chegada: 230 },
  triangulo: { descoberta: 150, chegada: 80 }
};

/**
 * Rotação da galáxia, muito acelerada: uma volta em 3 minutos (de verdade, o
 * Sol leva ≈ 230 milhões de anos). Tudo gira junto, como um disco rígido —
 * uma simplificação: na galáxia real cada estrela gira no próprio ritmo.
 */
export const GIRO_GALAXIA = { segundosPorVolta: 180, anosPorVolta: 230e6 };
const GIRO_RAD_POR_SEGUNDO = (2 * Math.PI) / GIRO_GALAXIA.segundosPorVolta;
/**
 * Sagitário A* em ilustração: o horizonte de verdade (≈ 12 milhões de km de
 * raio) seria invisível nesta escala, então ele é desenhado com 1,5 ano-luz
 * de raio — ampliado ≈ 1,2 milhão de vezes. O aviso aparece no painel do alvo.
 */
export const ILUSTRACAO_SGR_A = { raioHorizonteKly: 0.0015 };
/** Fora do disco (não giram com ele): as galáxias vizinhas. */
const FORA_DO_DISCO = new Set(["lmc", "smc", "andromeda", "triangulo"]);

/** Estrelas mais brilhantes das Plêiades (J2000, SIMBAD) e brilho relativo. */
const ESTRELAS_PLEIADES = [
  ["Alcyone", "03 47 29.08", "+24 06 18.5", 1],
  ["Atlas", "03 49 09.74", "+24 03 12.3", 0.75],
  ["Electra", "03 44 52.54", "+24 06 48.0", 0.72],
  ["Maia", "03 45 49.61", "+24 22 03.9", 0.65],
  ["Merope", "03 46 19.57", "+23 56 54.1", 0.62],
  ["Taygeta", "03 45 12.50", "+24 28 02.2", 0.55],
  ["Pleione", "03 49 11.22", "+24 08 12.2", 0.4],
  ["Celaeno", "03 44 48.22", "+24 17 22.1", 0.35],
  ["Asterope", "03 45 54.48", "+24 33 16.2", 0.3]
];

/** Transição suave de 0 (em a) a 1 (em b). */
function suave(a, b, v) {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function criarNivelGalaxia() {
  const cena = new THREE.Scene();
  const materiaisDePontos = [];
  const r0 = GALAXIA.distanciaSolCentroKly;
  const disco = new THREE.Group();
  cena.add(disco);

  const viaLactea = criarViaLactea({ materiais: materiaisDePontos });
  disco.add(viaLactea);
  // Perto do Sol, o céu é o de casa: a foto da Via Láctea vista daqui (ESO).
  const faixa = criarFaixaDaViaLactea({ raio: 1e5, matriz: matrizCenaGalacticaParaGalactica(), intensidade: 0.85 });
  cena.add(faixa.objeto);
  const baseDaFaixa = matrizCenaGalacticaParaGalactica();
  const giroDaFaixa = new THREE.Matrix4();
  const matrizDaFaixa = new THREE.Matrix3();
  const matrizDoGiro = new THREE.Matrix3();

  const corpos = OBJETOS_GALAXIA.map((objeto) => {
    const posicao = objeto.centro
      ? new THREE.Vector3()
      : vetor(astro.galacticaParaGalactocentrica(objeto.l, objeto.b, objeto.d, r0));
    const raios = RAIOS_GALAXIA[objeto.id];
    const corpo = criarCorpo(objeto, { raioExibido: 0.01, raioDescoberta: raios.descoberta, distanciaChegada: raios.chegada });
    corpo.posicao.copy(posicao);
    corpo.posicaoNoDisco = posicao.clone();
    corpo.gira = !FORA_DO_DISCO.has(objeto.id);
    return corpo;
  });
  const porId = (id) => corpos.find((c) => c.id === id);
  const posicaoDoSol = porId("sol-galaxia").posicao.clone();

  // Modelos 3D de cada objeto (tamanhos em mil anos-luz).
  const pleiades = porId("pleiades");
  const estrelasPrincipais = ESTRELAS_PLEIADES.map(([, ar, dec, brilho]) => {
    const { l, b } = astro.equatorialParaGalactica(astro.arParaGraus(ar), astro.decParaGraus(dec));
    const p = vetor(astro.galacticaParaGalactocentrica(l, b, pleiades.objeto.d, r0));
    return { posicao: p.sub(pleiades.posicaoNoDisco), brilho };
  });
  const MODELOS = {
    "sgr-a": () => criarNucleoGalactico({ raio: 0.03, materiais: materiaisDePontos }),
    pleiades: () => criarPleiades({ raio: 0.025, estrelasPrincipais, materiais: materiaisDePontos }),
    "orion-nebula": () => criarNebulosaDeOrion({ raio: 0.012, materiais: materiaisDePontos }),
    crab: () => criarNebulosaDoCaranguejo({ raio: 0.003, materiais: materiaisDePontos }),
    eagle: () => criarNebulosaDaAguia({ raio: 0.035, materiais: materiaisDePontos }),
    carina: () => criarNebulosaDeCarina({ raio: 0.15, materiais: materiaisDePontos }),
    "omega-centauri": () => criarAglomeradoGlobular({ raio: 0.225, materiais: materiaisDePontos }),
  };
  const TAMANHO_MODELO = { "sgr-a": 0.03, pleiades: 0.025, "orion-nebula": 0.012, crab: 0.003, eagle: 0.035, carina: 0.15, "omega-centauri": 0.225, lmc: 12, smc: 7, andromeda: 110, triangulo: 30 };
  const vizinhas = [];
  const vizinhasPendentes = [];

  const marcas = [];
  for (const corpo of corpos) {
    const pai = corpo.gira ? disco : cena;
    if (CRIAR_VIZINHA[corpo.id]) {
      // Galáxias vizinhas (vizinhas3d.js): em escala real e viradas como de
      // verdade (eixo maior, inclinação e lado mais próximo de nós, medidos nas
      // fotos e nos mapas de velocidade). São montadas logo depois que o nível
      // aparece, uma de cada vez, para a troca de nível não travar.
      const lugar = new THREE.Group();
      lugar.position.copy(corpo.posicaoNoDisco);
      lugar.quaternion.copy(orientacaoNaCena(corpo.objeto));
      pai.add(lugar);
      vizinhasPendentes.push({ id: corpo.id, lugar });
    } else if (MODELOS[corpo.id]) {
      const modelo = MODELOS[corpo.id]();
      modelo.position.copy(corpo.posicaoNoDisco);
      if (corpo.id !== "pleiades") {
        // Nebulosas: o lado que vemos da Terra fica virado para o Sol.
        modelo.lookAt(posicaoDoSol);
      }
      pai.add(modelo);
    }
    // Brilho que marca o objeto de longe e some quando a nave chega perto.
    const tamanho = { "sgr-a": 1.6, lmc: 9, smc: 6, andromeda: 60, triangulo: 18, "sol-galaxia": 0.25 }[corpo.id] || 0.35;
    const opacidade = corpo.id === "sol-galaxia" ? 1 : 0.85;
    const sprite = brilhoSprite(corpo.cor, tamanho, { opacidade });
    sprite.position.copy(corpo.posicaoNoDisco);
    pai.add(sprite);
    if (TAMANHO_MODELO[corpo.id]) marcas.push({ corpo, sprite, opacidade, tamanho: Math.max(TAMANHO_MODELO[corpo.id], tamanho * 0.5) });
  }
  disco.add(brilhoSprite("#ffd27a", 0.012, { atenuar: false }).translateX(posicaoDoSol.x));

  // Monta as vizinhas em segundo plano (as mais próximas primeiro). Os pontos
  // novos recebem a mesma escala de tela dos que já existem.
  function montarProximaVizinha() {
    const pendente = vizinhasPendentes.shift();
    if (!pendente) return;
    const novos = [];
    const modelo = CRIAR_VIZINHA[pendente.id]({ materiais: novos, ponte: true });
    const referencia = materiaisDePontos[0]?.uniforms;
    for (const material of novos) {
      if (referencia) {
        material.uniforms.escalaPixel.value = referencia.escalaPixel.value;
        material.uniforms.escalaProjecao.value = referencia.escalaProjecao.value;
      }
      materiaisDePontos.push(material);
    }
    pendente.lugar.add(modelo);
    vizinhas.push(modelo);
    setTimeout(montarProximaVizinha, 60);
  }
  setTimeout(montarProximaVizinha, 400);

  // Buraco negro do centro, com o disco de gás no plano da galáxia (ilustração ampliada).
  const sgr = porId("sgr-a");
  const buracoNegro = criarAstro(sgr.objeto);
  buracoNegro.grupo.scale.setScalar(ILUSTRACAO_SGR_A.raioHorizonteKly);
  buracoNegro.grupo.position.copy(sgr.posicaoNoDisco);
  disco.add(buracoNegro.grupo);

  // Giro no sentido horário visto do polo norte galáctico (+Y da cena).
  let angulo = 0;
  let girando = true;
  let anosDeGiro = 0;
  let ultimoGiro = 0;
  function atualizar(_data, camera, dt = 0) {
    ultimoGiro = 0;
    if (girando && dt > 0) {
      ultimoGiro = -GIRO_RAD_POR_SEGUNDO * dt;
      angulo = (angulo + ultimoGiro) % (Math.PI * 2);
      anosDeGiro += (dt / GIRO_GALAXIA.segundosPorVolta) * GIRO_GALAXIA.anosPorVolta;
    }
    disco.rotation.y = angulo;
    for (const corpo of corpos) {
      if (corpo.gira) corpo.posicao.copy(corpo.posicaoNoDisco).applyAxisAngle(EIXO_Y, angulo);
    }
    if (camera) {
      // Dentro do disco, a poeira apaga a luz das estrelas distantes (≈ 7 mil
      // anos-luz aqui; de verdade é ainda mais): a faixa da galáxia não estoura
      // de brilho e as nebulosas aparecem. De fora do disco, sem poeira.
      const { x, y, z } = camera.position;
      const noDisco = (1 - suave(1.5, 7, Math.abs(y))) * (1 - suave(55, 70, Math.hypot(x, z)));
      viaLactea.userData.definirExtincao(noDisco / 7);
      viaLactea.userData.definirOpacidadeDoBrilho(1 - noDisco);
      // Perto do Sol, e dentro do disco na vizinhança dele, o céu é a foto de
      // verdade da Via Láctea (vista daqui, girando com o disco); de longe e
      // perto do centro da galáxia, o modelo.
      giroDaFaixa.makeRotationY(-angulo);
      faixa.definirMatriz(matrizDaFaixa.multiplyMatrices(baseDaFaixa, matrizDoGiro.setFromMatrix4(giroDaFaixa)));
      const distanciaDoSol = camera.position.distanceTo(porId("sol-galaxia").posicao);
      const ceuDeCasa = Math.max(1 - suave(2.5, 8, distanciaDoSol), noDisco * (1 - suave(9, 18, distanciaDoSol)));
      faixa.atualizar(camera, ceuDeCasa);
      viaLactea.userData.definirIntensidade(1 - ceuDeCasa);
      // As vizinhas também estão na foto do céu de casa: perto do Sol, o
      // modelo dá lugar a ela (os dois juntos ficariam com brilho dobrado).
      for (const modelo of vizinhas) {
        modelo.userData.definirIntensidade(1 - 0.9 * ceuDeCasa);
        modelo.userData.atualizar(camera);
      }
      // O buraco negro só é desenhado de perto (de longe ele some num pixel).
      buracoNegro.grupo.visible = camera.position.distanceTo(sgr.posicao) < 2.5;
      for (const { corpo, sprite, opacidade, tamanho } of marcas) {
        const d = camera.position.distanceTo(corpo.posicao);
        const t = Math.min(1, Math.max(0, (d - tamanho * 1.5) / (tamanho * 4.5)));
        sprite.material.opacity = opacidade * t * t * (3 - 2 * t);
      }
    }
  }

  function inicio(aspecto = 16 / 9) {
    // Em telas em pé (celular) a nave começa mais longe: a galáxia cabe inteira na largura.
    const olharPara = new THREE.Vector3(-10, -2, 0);
    const posicao = new THREE.Vector3(-44, 46, 52).sub(olharPara).multiplyScalar(afastamentoPelaTela(aspecto, 2.8)).add(olharPara);
    return { posicao, olharPara };
  }

  return {
    id: "galaxia",
    cena,
    corpos,
    materiaisDePontos,
    near: 1e-5,
    far: 2e5,
    temTempo: false,
    temTamanho: false,
    temGiro: true,
    get girando() { return girando; },
    definirGiro(valor) { girando = Boolean(valor); },
    get anosDeGiro() { return anosDeGiro; },
    /** Ângulo girado no último quadro (rad), para a nave acompanhar o disco. */
    get ultimoGiro() { return ultimoGiro; },
    unidadeKm: astro.KM_POR_ANO_LUZ * 1000,
    sol: porId("sol-galaxia"),
    /**
     * Distância medida de cada objeto ao Sol. Não é a da cena: o giro do disco
     * é uma ilustração (tudo gira junto) e as galáxias vizinhas ficam paradas,
     * então a distância entre os dois pontos da cena muda com o giro.
     */
    distanciaAoSol: (corpo) => corpo.posicaoNoDisco.distanceTo(posicaoDoSol),
    descobrirAoEntrar: ["sol-galaxia"],
    atualizar,
    inicio,
    /** Órbita: dá para entrar nas nebulosas e aglomerados; o buraco negro fica de fora. */
    limitesDaOrbita: (corpo) => ({
      minimo: corpo.id === "sgr-a" ? 0.03 : corpo.distanciaChegada * 0.3,
      maximo: corpo.raioDescoberta * 2.5,
      superficie: 0
    }),
    /**
     * Ao saltar até um objeto, chega do lado do Sol (um pouco acima do disco):
     * é o lado que vemos da Terra, o das fotos dos telescópios.
     */
    pontoDeVista(corpo) {
      const sol = porId("sol-galaxia");
      if (corpo === sol) return null;
      return sol.posicao.clone().sub(corpo.posicao).normalize().addScaledVector(EIXO_Y, 0.12).normalize();
    }
  };
}
