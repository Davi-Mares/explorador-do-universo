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
  SOL, PLANETAS, LUA, VOYAGER, REFERENCIAS_SOLAR, ESTRELAS, SOL_MAGNITUDE_ABSOLUTA,
  DIRECAO_CENTRO_GALAXIA, GALAXIA, OBJETOS_GALAXIA, corDaEstrela
} from "./catalogo.js";
import { texturaDoAstro, texturaDosAneis, texturaDeBrilho } from "./texturas.js";

const EIXO_Y = new THREE.Vector3(0, 1, 0);

function vetor(objeto) {
  const p = astro.paraCena(objeto);
  return new THREE.Vector3(p.x, p.y, p.z);
}

/** Gerador pseudoaleatório com semente (a cena sai igual em toda visita). */
function aleatorioComSemente(semente) {
  let s = semente >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function gaussiana(aleatorio) {
  let u = 0, v = 0;
  while (u === 0) u = aleatorio();
  while (v === 0) v = aleatorio();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

/** Tamanho (px) e brilho de um ponto a partir da magnitude aparente. */
export function aparenciaPorMagnitude(m) {
  const x = 6.5 - m; // > 0: visível a olho nu
  return [limitar(1.4 + x * 1.15, 1.2, 40), limitar(0.22 + x * 0.13, 0.07, 1.6)];
}

// ---------- Material de pontos (estrelas, galáxia) ----------

/**
 * Pontos com cor, tamanho e brilho próprios. Com "atenuar", o tamanho é em
 * unidades da cena (cresce ao se aproximar); sem, é em pixels.
 * Inclui os trechos de profundidade logarítmica usados pelo renderizador.
 */
export function materialDePontos({ atenuar = false } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      escalaPixel: { value: 1 },
      escalaProjecao: { value: 800 },
      atenuar: { value: atenuar ? 1 : 0 }
    },
    vertexShader: /* glsl */ `
      attribute float tamanho;
      attribute float brilho;
      attribute vec3 cor;
      uniform float escalaPixel;
      uniform float escalaProjecao;
      uniform float atenuar;
      varying vec3 vCor;
      varying float vBrilho;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float px = atenuar > 0.5 ? tamanho * escalaProjecao / max(-mv.z, 1e-9) : tamanho;
        float limitado = clamp(px, 1.0, 64.0);
        float fator = atenuar > 0.5 ? min(1.0, px) * min(1.0, 18.0 / limitado) : 1.0;
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

function pontos(posicoes, cores, tamanhos, brilhos, material) {
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.Float32BufferAttribute(posicoes, 3));
  geometria.setAttribute("cor", new THREE.Float32BufferAttribute(cores, 3));
  geometria.setAttribute("tamanho", new THREE.Float32BufferAttribute(tamanhos, 1));
  geometria.setAttribute("brilho", new THREE.Float32BufferAttribute(brilhos, 1));
  const objeto = new THREE.Points(geometria, material);
  objeto.frustumCulled = false;
  return objeto;
}

function corRgb(hex) {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
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

function circulo(raio, cor, opacidade, { tracejado = false, segmentos = 256 } = {}) {
  const pontosDoCirculo = [];
  for (let i = 0; i <= segmentos; i++) {
    const a = (i / segmentos) * Math.PI * 2;
    pontosDoCirculo.push(new THREE.Vector3(Math.cos(a) * raio, 0, Math.sin(a) * raio));
  }
  const geometria = new THREE.BufferGeometry().setFromPoints(pontosDoCirculo);
  const material = tracejado
    ? new THREE.LineDashedMaterial({ color: cor, transparent: true, opacity: opacidade, dashSize: raio * 0.02, gapSize: raio * 0.015, depthWrite: false })
    : new THREE.LineBasicMaterial({ color: cor, transparent: true, opacity: opacidade, depthWrite: false });
  const linha = new THREE.Line(geometria, material);
  if (tracejado) linha.computeLineDistances();
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

export function criarNivelSolar(dataInicial) {
  const cena = new THREE.Scene();
  const materiaisDePontos = [];
  const ua = astro.KM_POR_UA;

  cena.add(new THREE.AmbientLight(0xffffff, 0.05));
  const luz = new THREE.PointLight(0xffffff, 2.6, 0, 0);
  cena.add(luz);

  const geometriaEsfera = new THREE.SphereGeometry(1, 64, 32);

  /** Grupo orientado pelo eixo do astro; a malha gira dentro dele. */
  function montarAstro(objeto, { basico = false } = {}) {
    const grupo = new THREE.Group();
    const material = basico
      ? new THREE.MeshBasicMaterial({ map: texturaDoAstro(objeto.id) })
      : new THREE.MeshStandardMaterial({ map: texturaDoAstro(objeto.id), roughness: 1, metalness: 0 });
    const malha = new THREE.Mesh(geometriaEsfera, material);
    grupo.add(malha);
    if (objeto.rotacao) {
      const polo = vetor(astro.equatorialParaEcliptica(objeto.rotacao.poloAr, objeto.rotacao.poloDec, 1)).normalize();
      grupo.quaternion.setFromUnitVectors(EIXO_Y, polo);
    }
    cena.add(grupo);
    return { grupo, malha };
  }

  // --- Sol ---
  const sol = criarCorpo(SOL, { raioReal: SOL.raioKm / ua });
  const astroSol = montarAstro({ ...SOL, rotacao: { poloAr: 286.13, poloDec: 63.87, horas: 609.12 } }, { basico: true });
  sol.malha = astroSol.grupo;
  sol.girar = astroSol.malha;
  sol.rotacaoHoras = 609.12;
  const brilhoPerto = brilhoSprite("#ffd9a0", 1);
  const brilhoLonge = brilhoSprite("#fff1d6", 0.045, { atenuar: false });
  cena.add(brilhoPerto, brilhoLonge);

  // --- Planetas ---
  const planetas = PLANETAS.map((planeta) => {
    const corpo = criarCorpo(planeta, { raioReal: planeta.raioKm / ua, rotacaoHoras: planeta.rotacao.horas });
    const { grupo, malha } = montarAstro(planeta);
    corpo.malha = grupo;
    corpo.girar = malha;

    if (planeta.aneis) {
      const geometria = new THREE.RingGeometry(planeta.aneis.interno, planeta.aneis.externo, 160, 1);
      const posicao = geometria.attributes.position, uv = geometria.attributes.uv;
      for (let i = 0; i < posicao.count; i++) {
        const r = Math.hypot(posicao.getX(i), posicao.getY(i));
        uv.setXY(i, (r - planeta.aneis.interno) / (planeta.aneis.externo - planeta.aneis.interno), 0.5);
      }
      geometria.rotateX(-Math.PI / 2); // do plano XY para o plano do equador (normal = eixo do planeta)
      const aneis = new THREE.Mesh(geometria, new THREE.MeshStandardMaterial({
        map: texturaDosAneis(), transparent: true, side: THREE.DoubleSide, roughness: 1, depthWrite: false
      }));
      grupo.add(aneis);
    }

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
  const lua = criarCorpo(LUA, { raioReal: LUA.raioKm / ua, pai: "terra" });
  const astroLua = montarAstro(LUA);
  lua.malha = astroLua.grupo;

  // --- Voyager 1 e a fronteira do vento solar ---
  const voyager = criarCorpo(VOYAGER, { raioReal: 0, raioExibido: 1e-9, raioDescoberta: 2, distanciaChegada: 0.01 });
  const marcaVoyager = brilhoSprite("#f4f1e8", 0.008, { atenuar: false, opacidade: 0.9 });
  cena.add(marcaVoyager);
  const trajeto = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)]),
    new THREE.LineDashedMaterial({ color: "#f4f1e8", transparent: true, opacity: 0.25, dashSize: 2, gapSize: 2, depthWrite: false })
  );
  cena.add(trajeto);

  const heliopausa = circulo(REFERENCIAS_SOLAR.heliopausaUA, "#7fd6ff", 0.28, { tracejado: true, segmentos: 512 });
  cena.add(heliopausa);

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

  const corpos = [sol, ...planetas, lua, voyager];
  const referencias = [
    { id: "heliopausa", nome: "Heliopausa · fim do vento solar (~120 UA)", posicao: new THREE.Vector3() }
  ];

  let modoTamanho = "real";
  function aplicarTamanho(modo) {
    modoTamanho = modo;
    const fatorPlanetas = modo === "ampliado" ? AMPLIACAO.planetas : 1;
    const fatorSol = modo === "ampliado" ? AMPLIACAO.sol : 1;
    for (const corpo of [sol, ...planetas, lua]) {
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
    brilhoPerto.scale.setScalar(sol.raioExibido * 9);
  }
  aplicarTamanho("real");

  const J2000 = Date.UTC(2000, 0, 1, 12);

  function atualizar(data) {
    for (const corpo of planetas) corpo.posicao.copy(vetor(astro.posicaoHeliocentrica(corpo.objeto, data)));
    const geo = astro.posicaoLuaGeocentrica(data);
    lua.posicao.copy(terra.posicao).add(vetor({ x: geo.x / ua, y: geo.y / ua, z: geo.z / ua }));
    voyager.posicao.copy(vetor(astro.posicaoSondaHeliocentrica(VOYAGER, data)));

    const horas = (data.getTime() - J2000) / 3_600_000;
    for (const corpo of [sol, ...planetas]) {
      corpo.malha.position.copy(corpo.posicao);
      if (corpo.girar && corpo.rotacaoHoras) {
        corpo.girar.rotation.y = ((horas / corpo.rotacaoHoras) % 1) * Math.PI * 2;
      }
    }
    lua.malha.position.copy(lua.posicao);
    // A Lua mostra sempre a mesma face para a Terra.
    lua.malha.lookAt(terra.posicao);
    marcaVoyager.position.copy(voyager.posicao);
    trajeto.geometry.attributes.position.setXYZ(1, voyager.posicao.x, voyager.posicao.y, voyager.posicao.z);
    trajeto.geometry.attributes.position.needsUpdate = true;
    trajeto.computeLineDistances();

    const direcaoVoyager = new THREE.Vector3(voyager.posicao.x, 0, voyager.posicao.z).normalize();
    referencias[0].posicao.copy(direcaoVoyager).multiplyScalar(REFERENCIAS_SOLAR.heliopausaUA);
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
    referencias,
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
    /** De onde ver um astro ao saltar até ele: do lado iluminado. */
    pontoDeVista(corpo) {
      if (corpo === sol || corpo === voyager) return null;
      return sol.posicao.clone().sub(corpo.posicao).normalize().applyAxisAngle(EIXO_Y, 0.35).add(new THREE.Vector3(0, 0.25, 0)).normalize();
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

  // Linhas até o plano da eclíptica: ajudam a perceber a profundidade.
  {
    const vertices = [];
    for (const e of estrelas) {
      if (e.id === "sol" || e.objeto.anosLuz > 120) continue;
      vertices.push(e.posicao.x, e.posicao.y, e.posicao.z, e.posicao.x, 0, e.posicao.z);
    }
    const geometria = new THREE.BufferGeometry();
    geometria.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    cena.add(new THREE.LineSegments(geometria, new THREE.LineBasicMaterial({ color: "#7fb8ff", transparent: true, opacity: 0.16, depthWrite: false })));
  }

  // Anéis de distância no plano da eclíptica.
  const referencias = [];
  for (const raio of [5, 10, 20, 50]) {
    cena.add(circulo(raio, "#63e6d4", raio <= 10 ? 0.22 : 0.14));
    const angulo = Math.PI * 0.25;
    referencias.push({ id: `anel-${raio}`, nome: `${raio} anos-luz`, posicao: new THREE.Vector3(Math.cos(angulo) * raio, 0, Math.sin(angulo) * raio), classe: "regua" });
  }

  // Nuvem de Oort: casca de cometas que envolve o Sistema Solar (estimada).
  {
    const aleatorio = aleatorioComSemente(31);
    const posicoes = [], rgb = [], tamanhos = [], brilhos = [];
    for (let i = 0; i < 2600; i++) {
      const z = aleatorio() * 2 - 1, fi = aleatorio() * Math.PI * 2, r = Math.sqrt(1 - z * z);
      const raio = 0.05 + Math.pow(aleatorio(), 0.6) * 1.5;
      posicoes.push(r * Math.cos(fi) * raio, z * raio, r * Math.sin(fi) * raio);
      rgb.push(0.6, 0.75, 1);
      tamanhos.push(1.3);
      brilhos.push(0.09);
    }
    const materialOort = materialDePontos();
    materiaisDePontos.push(materialOort);
    cena.add(pontos(posicoes, rgb, tamanhos, brilhos, materialOort));
    referencias.push({ id: "oort", nome: "Nuvem de Oort (estimada, até ~1,5 ano-luz)", posicao: new THREE.Vector3(0, 1.2, 0), classe: "regua" });
  }

  // Direção do centro da Via Láctea.
  {
    const direcao = vetor(astro.equatorialParaEcliptica(
      astro.arParaGraus(DIRECAO_CENTRO_GALAXIA.ar), astro.decParaGraus(DIRECAO_CENTRO_GALAXIA.dec), 1
    )).normalize();
    const linha = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([direcao.clone().multiplyScalar(2), direcao.clone().multiplyScalar(90)]),
      new THREE.LineDashedMaterial({ color: "#ffb36b", transparent: true, opacity: 0.4, dashSize: 1.5, gapSize: 1.2, depthWrite: false })
    );
    linha.computeLineDistances();
    cena.add(linha);
    referencias.push({ id: "rumo-centro", nome: "Rumo ao centro da Via Láctea · 26.670 anos-luz", posicao: direcao.clone().multiplyScalar(90), classe: "rumo" });
  }

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
    referencias,
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
// Os braços são uma representação esquemática (espiral logarítmica com
// inclinação de 12°, ajustada aos raios medidos dos braços na direção do Sol).
// As posições do Sol, do centro e dos objetos marcados são as reais.
// ===========================================================================

function gerarGalaxia(materiaisDePontos) {
  const aleatorio = aleatorioComSemente(2026);
  const { distanciaSolCentroKly: r0, bracos, barra, inclinacaoEspiralGraus } = GALAXIA;
  const k = Math.tan((inclinacaoEspiralGraus * Math.PI) / 180);
  const posicoes = [], rgb = [], tamanhos = [], brilhos = [];
  const braco = corRgb("#cfe0ff"), quente = corRgb("#ffd7a0"), rosa = corRgb("#ff8fb8"), disco = corRgb("#dfe6ff");

  function adicionar(x, y, z, cor, tamanho, brilho) {
    const p = astro.paraCena({ x, y, z });
    posicoes.push(p.x, p.y, p.z);
    rgb.push(...cor);
    tamanhos.push(tamanho);
    brilhos.push(brilho);
  }

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
  for (let i = 0; i < 2600; i++) {
    const theta = Math.PI + (aleatorio() * 2 - 1) * 0.24;
    const r = r0 * Math.exp(0.176 * (theta - Math.PI)) + gaussiana(aleatorio) * 0.7;
    adicionar(r * Math.cos(theta), r * Math.sin(theta), gaussiana(aleatorio) * 0.2, braco, 0.3, 0.16);
  }

  // Disco difuso (estrelas fora dos braços).
  for (let i = 0; i < 16000; i++) {
    const r = -10 * Math.log(1 - aleatorio() * 0.99);
    if (r > 55) continue;
    const t = aleatorio() * Math.PI * 2;
    adicionar(r * Math.cos(t), r * Math.sin(t), gaussiana(aleatorio) * 0.5, disco, 0.4, 0.07);
  }

  // Barra central (≈ 27° da linha Sol–centro, ponta próxima em l > 0) e bojo.
  const angulo = Math.PI - (barra.anguloGraus * Math.PI) / 180;
  const ux = Math.cos(angulo), uy = Math.sin(angulo);
  for (let i = 0; i < 9000; i++) {
    const s = gaussiana(aleatorio) * barra.meioComprimentoKly * 0.45;
    const lateral = gaussiana(aleatorio) * 2.6;
    adicionar(s * ux - lateral * uy, s * uy + lateral * ux, gaussiana(aleatorio) * 1.1, quente, 0.45, 0.13);
  }
  for (let i = 0; i < 9000; i++) {
    const r = Math.abs(gaussiana(aleatorio)) * 3.2;
    const z = aleatorio() * 2 - 1, fi = aleatorio() * Math.PI * 2, s = Math.sqrt(1 - z * z);
    adicionar(r * s * Math.cos(fi), r * s * Math.sin(fi), r * z * 0.6, quente, 0.5, 0.16);
  }

  const material = materialDePontos({ atenuar: true });
  materiaisDePontos.push(material);
  return pontos(posicoes, rgb, tamanhos, brilhos, material);
}

/** Nuvem de pontos irregular (galáxias anãs) ou em disco (Andrômeda). */
function nuvemDeGalaxia(centro, raio, quantidade, cor, semente, materiaisDePontos, { disco = false, normal = null } = {}) {
  const aleatorio = aleatorioComSemente(semente);
  const posicoes = [], rgb = [], tamanhos = [], brilhos = [];
  const base = corRgb(cor);
  const orientacao = new THREE.Quaternion().setFromUnitVectors(EIXO_Y, (normal || EIXO_Y).clone().normalize());
  const p = new THREE.Vector3();
  for (let i = 0; i < quantidade; i++) {
    if (disco) {
      const r = -raio * 0.28 * Math.log(1 - aleatorio() * 0.98);
      const bracoEspiral = Math.floor(aleatorio() * 2) * Math.PI;
      const t = bracoEspiral + Math.log(Math.max(r, 0.5) / 5) / 0.3 + gaussiana(aleatorio) * 0.35;
      p.set(r * Math.cos(t), gaussiana(aleatorio) * raio * 0.012, r * Math.sin(t)).applyQuaternion(orientacao);
    } else {
      p.set(gaussiana(aleatorio) * raio * 0.5, gaussiana(aleatorio) * raio * 0.25, gaussiana(aleatorio) * raio * 0.4);
    }
    p.add(centro);
    posicoes.push(p.x, p.y, p.z);
    rgb.push(...base);
    tamanhos.push(raio * 0.03);
    brilhos.push(disco ? 0.2 : 0.16);
  }
  const material = materialDePontos({ atenuar: true });
  materiaisDePontos.push(material);
  return pontos(posicoes, rgb, tamanhos, brilhos, material);
}

const RAIOS_GALAXIA = {
  "sol-galaxia": { descoberta: 1, chegada: 0.35 },
  "sgr-a": { descoberta: 3, chegada: 0.8 },
  pleiades: { descoberta: 0.8, chegada: 0.15 },
  "orion-nebula": { descoberta: 0.8, chegada: 0.15 },
  crab: { descoberta: 0.8, chegada: 0.15 },
  eagle: { descoberta: 0.8, chegada: 0.15 },
  carina: { descoberta: 1, chegada: 0.2 },
  "omega-centauri": { descoberta: 1.5, chegada: 0.4 },
  lmc: { descoberta: 30, chegada: 14 },
  smc: { descoberta: 22, chegada: 9 },
  andromeda: { descoberta: 420, chegada: 230 }
};

export function criarNivelGalaxia() {
  const cena = new THREE.Scene();
  const materiaisDePontos = [];
  const r0 = GALAXIA.distanciaSolCentroKly;

  cena.add(gerarGalaxia(materiaisDePontos));

  const corpos = OBJETOS_GALAXIA.map((objeto) => {
    const posicao = objeto.centro
      ? new THREE.Vector3()
      : vetor(astro.galacticaParaGalactocentrica(objeto.l, objeto.b, objeto.d, r0));
    const raios = RAIOS_GALAXIA[objeto.id];
    const corpo = criarCorpo(objeto, { raioExibido: 0.01, raioDescoberta: raios.descoberta, distanciaChegada: raios.chegada });
    corpo.posicao.copy(posicao);
    return corpo;
  });
  const porId = (id) => corpos.find((c) => c.id === id);

  // Marcas visuais de cada objeto.
  for (const corpo of corpos) {
    const tamanho = { "sgr-a": 1.6, lmc: 9, smc: 6, andromeda: 60, "sol-galaxia": 0.25 }[corpo.id] || 0.35;
    const sprite = brilhoSprite(corpo.cor, tamanho, { opacidade: corpo.id === "sol-galaxia" ? 1 : 0.85 });
    sprite.position.copy(corpo.posicao);
    cena.add(sprite);
  }
  cena.add(brilhoSprite("#ffd27a", 0.012, { atenuar: false }).translateX(porId("sol-galaxia").posicao.x));

  cena.add(nuvemDeGalaxia(porId("lmc").posicao, 16, 3500, "#cfd8ff", 41, materiaisDePontos));
  cena.add(nuvemDeGalaxia(porId("smc").posicao, 9.5, 1800, "#c4ccff", 42, materiaisDePontos));
  {
    // Andrômeda: disco inclinado ≈ 77° em relação a nós.
    const andromeda = porId("andromeda").posicao;
    const linhaDeVisada = andromeda.clone().sub(porId("sol-galaxia").posicao).normalize();
    const normal = linhaDeVisada.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), (77 * Math.PI) / 180);
    cena.add(nuvemDeGalaxia(andromeda, 110, 14000, "#e6dcff", 43, materiaisDePontos, { disco: true, normal }));
  }

  // Réguas: anéis em volta do centro e a "bolha" das estrelas vizinhas.
  const referencias = [];
  for (const raio of [10, 20, 30, 40, 50]) {
    cena.add(circulo(raio, "#63e6d4", 0.09));
  }
  referencias.push({ id: "regua-50", nome: "50 mil anos-luz do centro", posicao: new THREE.Vector3(0, 0, 50), classe: "regua" });
  const sol = porId("sol-galaxia");
  const bolha = circulo(1, "#ffd27a", 0.7);
  bolha.position.copy(sol.posicao);
  cena.add(bolha);
  referencias.push({ id: "bolha", nome: "Estrelas vizinhas (~1.000 anos-luz)", posicao: sol.posicao.clone().add(new THREE.Vector3(0, 0, 1.3)), classe: "regua" });
  for (const { nome, raioNoSol } of GALAXIA.bracos.slice(1, 3)) {
    referencias.push({ id: `braco-${raioNoSol}`, nome, posicao: new THREE.Vector3(-raioNoSol, 0.3, 0), classe: "braco" });
  }

  function inicio() {
    return { posicao: new THREE.Vector3(-44, 46, 52), olharPara: new THREE.Vector3(-10, -2, 0) };
  }

  return {
    id: "galaxia",
    cena,
    corpos,
    referencias,
    materiaisDePontos,
    near: 1e-5,
    far: 2e5,
    temTempo: false,
    temTamanho: false,
    unidadeKm: astro.KM_POR_ANO_LUZ * 1000,
    sol,
    descobrirAoEntrar: ["sol-galaxia"],
    atualizar() {},
    inicio,
    pontoDeVista: () => null
  };
}
