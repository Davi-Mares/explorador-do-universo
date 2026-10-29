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
  SOL, PLANETAS, LUA, VOYAGER, PLANETAS_ANOES, CINTURAO, ESTRELAS, SOL_MAGNITUDE_ABSOLUTA,
  DIRECAO_CENTRO_GALAXIA, GALAXIA, OBJETOS_GALAXIA, corDaEstrela
} from "./catalogo.js";
import { criarAstro, orientarPelaIau, texturaDeBrilho } from "./astros3d.js";
import {
  aleatorioComSemente, gaussiana, corRgb, materialDePontos, pontos, criarViaLactea, criarGalaxiaEspiral,
  criarGalaxiaIrregular, criarNebulosaDeOrion, criarNebulosaDaAguia, criarNebulosaDeCarina,
  criarNebulosaDoCaranguejo, criarPleiades, criarAglomeradoGlobular, criarNucleoGalactico
} from "./galaxias3d.js";
import { criarCinturao } from "./cinturao3d.js";

export { materialDePontos };

const EIXO_Y = new THREE.Vector3(0, 1, 0);

function vetor(objeto) {
  const p = astro.paraCena(objeto);
  return new THREE.Vector3(p.x, p.y, p.z);
}

const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

/** Tamanho (px) e brilho de um ponto a partir da magnitude aparente. */
export function aparenciaPorMagnitude(m) {
  const x = 6.5 - m; // > 0: visível a olho nu
  return [limitar(1.4 + x * 1.15, 1.2, 40), limitar(0.22 + x * 0.13, 0.07, 1.6)];
}

// ---------- Céu de fundo com a faixa da Via Láctea ----------

/**
 * Estrelas de fundo ilustrativas, numa esfera de raio fixo. Metade delas se
 * concentra no plano da galáxia, formando a faixa da Via Láctea no lugar
 * certo do céu (calculado a partir do polo e do centro galácticos).
 */
function criarCeuDeFundo(raio, quantidade, semente) {
  const aleatorio = aleatorioComSemente(semente);
  const eq = (ar, dec) => astro.equatorialParaEcliptica(ar, dec, 1);
  const centro = vetor(eq(astro.arParaGraus(DIRECAO_CENTRO_GALAXIA.ar), astro.decParaGraus(DIRECAO_CENTRO_GALAXIA.dec)));
  const poloNorte = vetor(eq(192.85948, 27.12825));
  const eixoX = centro.clone().sub(poloNorte.clone().multiplyScalar(centro.dot(poloNorte))).normalize();
  const eixoY = new THREE.Vector3().crossVectors(poloNorte, eixoX);

  const cores = ["#9bb0ff", "#cad7ff", "#f8f7ff", "#fff4ea", "#ffd2a1", "#ffcc6f"].map(corRgb);
  const posicoes = [], rgb = [], tamanhos = [], brilhos = [];
  const direcao = new THREE.Vector3();

  for (let i = 0; i < quantidade; i++) {
    const naFaixa = i % 2 === 0;
    let magnitude;
    if (naFaixa) {
      // Longitude galáctica com mais estrelas perto do centro; latitude estreita.
      const l = (aleatorio() < 0.45 ? gaussiana(aleatorio) * 0.6 : (aleatorio() * 2 - 1) * Math.PI);
      const b = gaussiana(aleatorio) * (0.07 + 0.05 * aleatorio());
      direcao.copy(eixoX).multiplyScalar(Math.cos(b) * Math.cos(l))
        .addScaledVector(eixoY, Math.cos(b) * Math.sin(l))
        .addScaledVector(poloNorte, Math.sin(b));
      magnitude = 6.3 + aleatorio() * 1.6;
    } else {
      const z = aleatorio() * 2 - 1, fi = aleatorio() * Math.PI * 2, r = Math.sqrt(1 - z * z);
      direcao.set(r * Math.cos(fi), z, r * Math.sin(fi));
      magnitude = 7 - 3.4 * Math.pow(aleatorio(), 2.5);
    }
    direcao.normalize().multiplyScalar(raio);
    posicoes.push(direcao.x, direcao.y, direcao.z);
    rgb.push(...cores[Math.floor(aleatorio() * cores.length)]);
    const [tamanho, brilho] = aparenciaPorMagnitude(magnitude);
    tamanhos.push(tamanho);
    brilhos.push(brilho * (naFaixa ? 0.75 : 1));
  }
  const material = materialDePontos();
  return { objeto: pontos(posicoes, rgb, tamanhos, brilhos, material), material };
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
    const pontosDaOrbita = astro.pontosDaOrbita(planeta, dataInicial, 360).map(vetor);
    const orbita = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(pontosDaOrbita),
      new THREE.LineBasicMaterial({ color: planeta.cor, transparent: true, opacity: 0.38, depthWrite: false })
    );
    cena.add(orbita);
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
    const orbita = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(astro.pontosDaOrbita(planeta, dataInicial, 360).map(vetor)),
      new THREE.LineBasicMaterial({ color: planeta.cor, transparent: true, opacity: 0.28, depthWrite: false })
    );
    cena.add(orbita);
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
  const voyager = criarCorpo(VOYAGER, { raioReal: 0, raioExibido: 1e-9, raioDescoberta: 2, distanciaChegada: 0.01 });
  const marcaVoyager = brilhoSprite("#f4f1e8", 0.008, { atenuar: false, opacidade: 0.9 });
  cena.add(marcaVoyager);
  // --- Estrelas (posições reais em UA, bem longe) e céu de fundo ---
  {
    const posicoes = [], rgb = [], tamanhos = [], brilhos = [];
    for (const estrela of ESTRELAS) {
      const p = vetor(astro.equatorialParaEcliptica(astro.arParaGraus(estrela.ar), astro.decParaGraus(estrela.dec), estrela.anosLuz * astro.UA_POR_ANO_LUZ));
      posicoes.push(p.x, p.y, p.z);
      rgb.push(...corRgb(corDaEstrela(estrela)));
      const [tamanho, brilho] = aparenciaPorMagnitude(estrela.mag);
      tamanhos.push(tamanho);
      brilhos.push(brilho);
    }
    const material = materialDePontos();
    materiaisDePontos.push(material);
    cena.add(pontos(posicoes, rgb, tamanhos, brilhos, material));
    const ceu = criarCeuDeFundo(4e7, 9000, 7);
    materiaisDePontos.push(ceu.material);
    cena.add(ceu.objeto);
  }

  const corpos = [sol, ...planetas, lua, ...anoes, cinturao, voyager];

  let modoTamanho = "real";
  function aplicarTamanho(modo) {
    modoTamanho = modo;
    const fatorPlanetas = modo === "ampliado" ? AMPLIACAO.planetas : 1;
    const fatorSol = modo === "ampliado" ? AMPLIACAO.sol : 1;
    for (const corpo of [sol, ...planetas, lua, ...anoes]) {
      const fator = corpo === sol ? fatorSol : fatorPlanetas;
      corpo.raioExibido = corpo.raioReal * fator;
      corpo.malha.scale.setScalar(corpo.raioExibido);
      corpo.raioDescoberta = Math.max(corpo.raioReal * 100, corpo.raioExibido * 6, 1e-4);
      corpo.distanciaChegada = Math.max(corpo.raioExibido * 5, 2e-6);
    }
    sol.raioDescoberta = 0.25;
    // No modo ampliado a Lua ficaria dentro da Terra ampliada: ela some.
    lua.malha.visible = modo !== "ampliado";
    lua.oculto = modo === "ampliado";
    brilhoPerto.scale.setScalar(sol.raioExibido * 6);
  }
  aplicarTamanho("real");

  const J2000 = Date.UTC(2000, 0, 1, 12);

  function atualizar(data, camera) {
    for (const corpo of [...planetas, ...anoes]) corpo.posicao.copy(vetor(astro.posicaoHeliocentrica(corpo.objeto, data)));
    const geo = astro.posicaoLuaGeocentrica(data);
    lua.posicao.copy(terra.posicao).add(vetor({ x: geo.x / ua, y: geo.y / ua, z: geo.z / ua }));
    voyager.posicao.copy(vetor(astro.posicaoSondaHeliocentrica(VOYAGER, data)));

    // Eixos e rotação pelo modelo da IAU: o lado da Terra virado para o Sol
    // é o que está de dia agora (na data simulada).
    for (const corpo of [sol, ...planetas, ...anoes]) {
      corpo.malha.position.copy(corpo.posicao);
      orientarPelaIau(corpo.malha, corpo.objeto.rotacao, data);
    }
    lua.malha.position.copy(lua.posicao);
    // A Lua mostra sempre a mesma face para a Terra.
    lua.malha.lookAt(terra.posicao);
    const dias = (data.getTime() - J2000) / 86_400_000;
    if (terra.astro.nuvens) terra.astro.nuvens.rotation.y = (dias * DERIVA_NUVENS_RAD_POR_DIA) % (Math.PI * 2);

    asteroides.atualizar(dias);
    if (camera) {
      // Ponto do cinturão na direção da nave (projetada no plano da eclíptica).
      const x = camera.position.x, z = camera.position.z;
      const r = Math.hypot(x, z);
      if (r > 1e-9) cinturao.posicao.set((x / r) * raioMedioCinturao, 0, (z / r) * raioMedioCinturao);
    }

    for (const corpo of [...planetas, lua, ...anoes]) {
      corpo.astro.dirSol.copy(corpo.posicao).negate().normalize();
      // Texturas só quando o astro aparece maior que um pontinho (economiza memória).
      if (camera && !corpo.astro.pedido && !corpo.oculto
        && corpo.raioExibido / Math.max(camera.position.distanceTo(corpo.posicao), 1e-12) > TAMANHO_PARA_TEXTURA) {
        corpo.astro.carregar();
      }
    }
    marcaVoyager.position.copy(voyager.posicao);
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

export function criarNivelEstrelas() {
  const cena = new THREE.Scene();
  const materiaisDePontos = [];

  const solEstrela = { ...SOL, magnitudeAbsoluta: SOL_MAGNITUDE_ABSOLUTA, espectro: "G2 V" };
  const estrelas = [solEstrela, ...ESTRELAS].map((estrela) => {
    const ehSol = estrela.id === "sol";
    const posicao = ehSol
      ? new THREE.Vector3()
      : vetor(astro.equatorialParaEcliptica(astro.arParaGraus(estrela.ar), astro.decParaGraus(estrela.dec), estrela.anosLuz));
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

  const ceu = criarCeuDeFundo(9000, 9000, 9);
  materiaisDePontos.push(ceu.material);
  cena.add(ceu.objeto);

  const atributoTamanho = nuvem.geometry.attributes.tamanho;
  const atributoBrilho = nuvem.geometry.attributes.brilho;

  function atualizar(_data, camera) {
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

  function inicio() {
    const alfa = estrelas.find((e) => e.id === "alfa-centauri").posicao.clone().normalize();
    const posicao = alfa.clone().multiplyScalar(-1.1).add(new THREE.Vector3(0, 0.45, 0)).applyAxisAngle(EIXO_Y, 0.12);
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
  "sgr-a": { descoberta: 3, chegada: 0.12 },
  pleiades: { descoberta: 0.8, chegada: 0.07 },
  "orion-nebula": { descoberta: 0.8, chegada: 0.04 },
  crab: { descoberta: 0.8, chegada: 0.011 },
  eagle: { descoberta: 0.8, chegada: 0.11 },
  carina: { descoberta: 1, chegada: 0.45 },
  "omega-centauri": { descoberta: 1.5, chegada: 0.2 },
  lmc: { descoberta: 60, chegada: 45 },
  smc: { descoberta: 40, chegada: 28 },
  andromeda: { descoberta: 420, chegada: 230 }
};

/**
 * Rotação da galáxia, muito acelerada: uma volta em 3 minutos (de verdade, o
 * Sol leva ≈ 230 milhões de anos). Tudo gira junto, como um disco rígido —
 * uma simplificação: na galáxia real cada estrela gira no próprio ritmo.
 */
export const GIRO_GALAXIA = { segundosPorVolta: 180, anosPorVolta: 230e6 };
const GIRO_RAD_POR_SEGUNDO = (2 * Math.PI) / GIRO_GALAXIA.segundosPorVolta;
/** Fora do disco (não giram com ele): as Nuvens de Magalhães e Andrômeda. */
const FORA_DO_DISCO = new Set(["lmc", "smc", "andromeda"]);

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
    lmc: () => criarGalaxiaIrregular({ raio: 16, semente: 41, quantidade: 18000, alongamento: 1.25, tarantula: true, materiais: materiaisDePontos }),
    smc: () => criarGalaxiaIrregular({ raio: 9.5, semente: 42, quantidade: 7000, alongamento: 1.7, materiais: materiaisDePontos }),
    andromeda: () => criarGalaxiaEspiral({ raio: 110, semente: 31, quantidade: 50000, anel: 0.3, companheiras: true, materiais: materiaisDePontos })
  };
  const TAMANHO_MODELO = { "sgr-a": 0.03, pleiades: 0.025, "orion-nebula": 0.012, crab: 0.003, eagle: 0.035, carina: 0.15, "omega-centauri": 0.225, lmc: 16, smc: 9.5, andromeda: 110 };

  const marcas = [];
  for (const corpo of corpos) {
    const pai = corpo.gira ? disco : cena;
    if (MODELOS[corpo.id]) {
      const modelo = MODELOS[corpo.id]();
      modelo.position.copy(corpo.posicaoNoDisco);
      if (corpo.id === "andromeda") {
        // Disco inclinado ≈ 77° em relação à nossa linha de visada.
        const linhaDeVisada = corpo.posicaoNoDisco.clone().sub(posicaoDoSol).normalize();
        const normal = linhaDeVisada.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), (77 * Math.PI) / 180);
        modelo.quaternion.setFromUnitVectors(EIXO_Y, normal.normalize());
      } else if (corpo.id === "lmc" || corpo.id === "smc") {
        // As Nuvens aparecem quase de frente para nós.
        const paraOSol = posicaoDoSol.clone().sub(corpo.posicaoNoDisco).normalize();
        modelo.quaternion.setFromUnitVectors(EIXO_Y, paraOSol.applyAxisAngle(new THREE.Vector3(0, 0, 1), 0.5).normalize());
      } else if (corpo.id !== "pleiades") {
        // Nebulosas: o lado que vemos da Terra fica virado para o Sol.
        modelo.lookAt(posicaoDoSol);
      }
      pai.add(modelo);
    }
    // Brilho que marca o objeto de longe e some quando a nave chega perto.
    const tamanho = { "sgr-a": 1.6, lmc: 9, smc: 6, andromeda: 60, "sol-galaxia": 0.25 }[corpo.id] || 0.35;
    const opacidade = corpo.id === "sol-galaxia" ? 1 : 0.85;
    const sprite = brilhoSprite(corpo.cor, tamanho, { opacidade });
    sprite.position.copy(corpo.posicaoNoDisco);
    pai.add(sprite);
    if (TAMANHO_MODELO[corpo.id]) marcas.push({ corpo, sprite, opacidade, tamanho: Math.max(TAMANHO_MODELO[corpo.id], tamanho * 0.5) });
  }
  disco.add(brilhoSprite("#ffd27a", 0.012, { atenuar: false }).translateX(posicaoDoSol.x));

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
      viaLactea.material.uniforms.extincao.value = noDisco / 7;
      for (const { corpo, sprite, opacidade, tamanho } of marcas) {
        const d = camera.position.distanceTo(corpo.posicao);
        const t = Math.min(1, Math.max(0, (d - tamanho * 1.5) / (tamanho * 4.5)));
        sprite.material.opacity = opacidade * t * t * (3 - 2 * t);
      }
    }
  }

  function inicio() {
    return { posicao: new THREE.Vector3(-44, 46, 52), olharPara: new THREE.Vector3(-10, -2, 0) };
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
    descobrirAoEntrar: ["sol-galaxia"],
    atualizar,
    inicio,
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
