// ---------------------------------------------------------------------------
// Explorador do Universo — Comparador.
// Dois astros lado a lado, na mesma escala, com os números que ajudam a
// entender a diferença: tamanho, massa, gravidade, rotação, translação,
// distância, temperatura e luas. Vai de Ceres até a Galáxia de Andrômeda,
// passando pelo Sistema Solar inteiro e por dois buracos negros.
// Escolha pela URL: comparar.html?a=terra&b=jupiter
// ---------------------------------------------------------------------------

import * as THREE from "three";
import * as astro from "./explorador/astronomia.js";
import {
  SOL, PLANETAS, CINTURAO, GALAXIA, COMPARAVEIS, categoriaDoAstro as categoria, raioParaComparar as raioKm, corDaEstrela
} from "./explorador/catalogo.js";
import { criarAstro, definirAnisotropia, texturaDeBrilho } from "./explorador/astros3d.js";
import { criarViaLactea, criarGalaxiaEspiral, ajustarMateriais } from "./explorador/galaxias3d.js";

const $ = (id) => document.getElementById(id);
const movimentoReduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const G_TERRA = 9.8;
const RAD = Math.PI / 180;

// ---------- Astros que dá para comparar ----------
// Uma lista só, em ordem crescente (de Ceres até Andrômeda). O raio de um
// buraco negro é o do horizonte de eventos; o de uma galáxia, metade do
// diâmetro; o do Sistema Solar, a distância de Netuno ao Sol.

const ITENS = COMPARAVEIS;
const ehEstrela = (o) => o.id === "sol" || Boolean(o.espectro);
const porId = (id) => ITENS.find((o) => o.id === id);
const PADRAO = { a: "terra", b: "jupiter" };

const NOMES = { andromeda: "Andrômeda" };
const nome = (o) => NOMES[o.id] || o.nomeComparador || o.nome;

// Artigos e plurais para frases naturais ("do Sol", "na Terra", "1.321 Terras").
const ARTIGOS = { sol: "o", terra: "a", lua: "a", "via-lactea": "a", "sistema-solar": "o" };
const PLURAIS = {
  sol: "Sóis", mercurio: "Mercúrios", venus: "Vênus", terra: "Terras", lua: "Luas", marte: "Martes",
  jupiter: "Júpiteres", saturno: "Saturnos", urano: "Uranos", netuno: "Netunos", ceres: "Ceres", plutao: "Plutões"
};
const com = (o) => (ARTIGOS[o.id] ? `${ARTIGOS[o.id]} ${nome(o)}` : nome(o));
const de = (o) => (ARTIGOS[o.id] ? `d${ARTIGOS[o.id]} ${nome(o)}` : `de ${nome(o)}`);
const em = (o) => (ARTIGOS[o.id] ? `n${ARTIGOS[o.id]} ${nome(o)}` : `em ${nome(o)}`);
const plural = (o) => PLURAIS[o.id] || `estrelas como ${nome(o)}`;
const maiuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

const numero = (valor, casas = 0) => valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const casasPara = (v) => (v < 10 ? 1 : 0);

/** Inteiro; acima de 10 mil, com 3 algarismos significativos (fica legível). */
function redondo(v) {
  if (v < 10_000) return Math.round(v);
  const base = 10 ** (Math.floor(Math.log10(v)) - 2);
  return Math.round(v / base) * base;
}

/** "1.321", "1,3 milhão de" (pronto para vir antes de um substantivo). */
function quantidade(v) {
  const texto = astro.formatarGrande(v < 10 ? Math.round(v * 10) / 10 : redondo(v));
  return /(lhão|lhões)$/.test(texto) ? `${texto} de` : texto;
}

/** "1,5 vez", "11 vezes", "16 mil vezes", "4,6 trilhões de vezes". */
function vezes(r) {
  if (r < 2) return `${numero(r, 1)} vez`;
  return `${quantidade(r)} vezes`;
}

/** Distâncias enormes: além de trilhões vêm quatrilhões e quintilhões. */
function textoKm(km) {
  if (km < 1e6) return `${numero(Math.round(km))} km`;
  if (km < 1e15) return astro.formatarKm(km);
  const [base, singular, pluralTexto] = km >= 1e18 ? [1e18, "quintilhão", "quintilhões"] : [1e15, "quatrilhão", "quatrilhões"];
  const n = km / base;
  return `${numero(n, n < 10 ? 1 : 0)} ${n < 2 ? singular : pluralTexto} de km`;
}

/** "4,2 anos-luz", "27 mil anos-luz", "2,5 milhões de anos-luz". */
function textoAnosLuz(v) {
  if (v < 10_000) return `${numero(v, v < 10 ? 1 : 0)} anos-luz`;
  return `${quantidade(v)} anos-luz`;
}

const ficha = (o, campo) => o.ficha?.find(([c]) => c === campo)?.[1] || null;

// ---------- Linhas da tabela ----------

function diametro(o) {
  const km = 2 * raioKm(o);
  switch (categoria(o)) {
    case "galáxia":
      return `${astro.formatarGrande(o.diametroAnosLuz)} anos-luz (≈ ${textoKm(km)})`;
    case "sistema planetário":
      return `${textoKm(km)} (${numero(km / astro.KM_POR_UA)} UA), a órbita de Netuno de ponta a ponta`;
    case "buraco negro": {
      const ua = km / astro.KM_POR_UA;
      const comparacao = ua >= 10
        ? `≈ ${numero(ua >= 1000 ? Math.round(ua / 100) * 100 : Math.round(ua))} vezes a distância da Terra ao Sol`
        : `${vezes(raioKm(o) / SOL.raioKm)} o Sol`;
      return `${textoKm(km)} no horizonte de eventos (${comparacao})`;
    }
    case "estrela":
      if (o.id === "sol") return textoKm(km);
      return `${textoKm(km)} (${numero(o.raioSolar, o.raioSolar < 10 ? 1 : 0)} × o Sol)`;
    default: {
      if (o.id === "terra") return textoKm(km);
      const terras = raioKm(o) / 6371;
      return `${textoKm(km)} (${numero(terras, terras < 10 ? 2 : 0)} × a Terra)`;
    }
  }
}

function massa(o) {
  if (o.massaSolar) return `${quantidade(o.massaSolar)} vezes a do Sol`;
  if (o.id === "sol") return "333 mil vezes a da Terra";
  if (o.id === "sistema-solar") return "99,8% dela está no Sol";
  return "—";
}

function gravidade(o) {
  if (!o.gravidade) return "—";
  const texto = `${numero(o.gravidade, o.gravidade < 100 ? 1 : 0)} m/s²`;
  return o.id === "terra" ? texto : `${texto} (${numero(o.gravidade / G_TERRA, 2)} × a da Terra)`;
}

function rotacao(o) {
  if (o.id === "via-lactea") return "≈ 230 milhões de anos (uma volta, na altura do Sol)";
  const horas = o.rotacao?.horas;
  if (!horas) return "—";
  const texto = astro.formatarDuracao(Math.abs(horas) * 3600);
  // Eixo inclinado mais de 90°: gira "ao contrário" em relação à órbita.
  if (o.rotacao.inclinacao > 90) return `${texto} (gira ao contrário)`;
  if (o.id === "sol") return `${texto} (no equador)`;
  if (o.id === "lua") return `${texto} (sempre a mesma face para a Terra)`;
  return texto;
}

function translacao(o) {
  if (o.id === "sol") return "≈ 230 milhões de anos (em volta da galáxia)";
  if (o.id === "sistema-solar") return "≈ 230 milhões de anos (o Sistema Solar inteiro gira em volta da galáxia)";
  if (o.id === "lua") return `${numero(o.periodoDias, 1)} dias (em volta da Terra)`;
  if (!o.periodoAnos) return "—";
  if (o.periodoAnos < 1.5) return `${numero(o.periodoAnos * 365.25)} dias`;
  return `${numero(o.periodoAnos, o.periodoAnos < 100 ? 1 : 0)} anos`;
}

/** Distância média: { km } dentro do Sistema Solar ou { anosLuz } fora dele. */
function distancia(o) {
  if (o.id === "sol") return { km: astro.KM_POR_UA, de: "da Terra" };
  if (o.id === "lua") return { km: o.distanciaMediaKm, de: "da Terra" };
  if (o.orbita) return { km: o.orbita.elementos.a * astro.KM_POR_UA, de: "do Sol" };
  if (o.anosLuz) return { anosLuz: o.anosLuz, de: "do Sol" };
  if (o.id === "sgr-a") return { anosLuz: GALAXIA.distanciaSolCentroKly * 1000, de: "do Sol, no centro da Via Láctea", aprox: true };
  if (o.d) return { anosLuz: o.d * 1000, de: "do Sol", aprox: true };   // d em mil anos-luz
  return null;
}

function textoDistancia(o) {
  if (o.id === "via-lactea") return "Estamos dentro dela: o Sol fica a ≈ 27 mil anos-luz do centro";
  if (o.id === "sistema-solar") return "Estamos dentro dele: a Terra é o 3º planeta";
  if (o.anosLuzViagem) return "Bilhões de anos-luz, num universo que se expande";
  const d = distancia(o);
  if (!d) return "—";
  if (d.anosLuz) return `${d.aprox ? "≈ " : ""}${textoAnosLuz(d.anosLuz)} ${d.de}`;
  return `${astro.formatarKm(d.km)} ${d.de}`;
}

function textoLuz(o) {
  if (o.id === "via-lactea") return "100 mil anos para atravessar de ponta a ponta";
  if (o.id === "sistema-solar") return `${astro.formatarDuracao((2 * raioKm(o)) / astro.VELOCIDADE_LUZ_KM_S)} para atravessar a órbita de Netuno de ponta a ponta`;
  if (o.anosLuzViagem) return `≈ ${numero(o.anosLuzViagem / 1e9, 1)} bilhões de anos (a luz que vemos hoje saiu de lá nessa época)`;
  const d = distancia(o);
  if (!d) return "—";
  if (d.anosLuz) return `${d.aprox ? "≈ " : ""}${textoAnosLuz(d.anosLuz).replace("anos-luz", "anos")} até nós`;
  const quem = o.id === "sol" || o.id === "lua" ? "até a Terra" : "vindo do Sol";
  return `${astro.formatarDuracao(d.km / astro.VELOCIDADE_LUZ_KM_S)} ${quem}`;
}

function temperatura(o) {
  if (o.temperaturaK && o.id !== "sol") {
    return `${numero(o.temperaturaK)} K na superfície (≈ ${numero(Math.round((o.temperaturaK - 273) / 10) * 10)} °C)`;
  }
  return ficha(o, "Temperatura") || "—";
}

function inclinacao(o) {
  const graus = o.rotacao?.inclinacao;
  if (graus === undefined) return "—";
  const nota = graus >= 150 ? " (quase de cabeça para baixo)" : graus >= 60 ? " (gira quase deitado)" : "";
  return `${numero(graus, 1)}°${nota}`;
}

const LINHAS = [
  ["Tipo", (o) => o.tipo || "—"],
  ["Diâmetro", diametro],
  ["Massa", massa],
  ["Gravidade", gravidade],
  ["Rotação (volta em si)", rotacao],
  ["Translação (volta em órbita)", translacao],
  ["Distância", textoDistancia],
  ["A luz leva", textoLuz],
  ["Temperatura", temperatura],
  ["Luas", (o) => ficha(o, "Luas") || "—"],
  ["Inclinação do eixo", inclinacao]
];

function escapar(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- Textos de destaque ----------

// Órbitas dos planetas (UA), para dizer até onde um astro gigante chegaria se
// estivesse no lugar do Sol.
const ORBITAS = PLANETAS.map((p) => ({ id: p.id, nome: p.nome, ua: p.orbita.elementos.a }));
const listaComE = (itens) => (itens.length < 2 ? itens.join("") : `${itens.slice(0, -1).join(", ")} e ${itens.at(-1)}`);

function noLugarDoSol(o) {
  const raioUA = raioKm(o) / astro.KM_POR_UA;
  const inicio = `Se ${com(o)} estivesse no lugar do Sol, ${o.categoria === "buraco negro" ? "o horizonte de eventos" : "a superfície dela"}`;
  if (raioUA < ORBITAS[0].ua) return `${inicio} ficaria dentro da órbita de Mercúrio.`;
  const netuno = ORBITAS.at(-1);
  if (raioUA > netuno.ua) return `${inicio} engoliria o Sistema Solar inteiro: o raio seria ${vezes(raioUA / netuno.ua)} a distância de Netuno ao Sol.`;
  const engolidas = ORBITAS.filter((p) => p.ua < raioUA).map((p) => (p.id === "terra" ? "da Terra" : `de ${p.nome}`));
  let frase = `${inicio} engoliria ${engolidas.length > 1 ? "as órbitas" : "a órbita"} ${listaComE(engolidas)}`;
  if (raioUA > CINTURAO.raioExternoUA) frase += " e passaria do Cinturão de Asteroides";
  else if (raioUA > CINTURAO.raioInternoUA) frase += " e chegaria ao Cinturão de Asteroides";
  return `${frase}.`;
}

/** Estrelas gigantes e buracos negros, comparados com o Sol ou com o Sistema Solar. */
function cabeNoSistemaSolar(o) {
  if (o.categoria === "buraco negro") return true;
  return ehEstrela(o) && raioKm(o) / astro.KM_POR_UA >= 0.1;
}

function destaques(a, b) {
  const frases = [];
  if (a === b) {
    frases.push(["🪞", `Você escolheu ${com(a)} duas vezes. Troque um dos dois para comparar.`]);
    return frases;
  }
  const [maior, menor] = raioKm(a) >= raioKm(b) ? [a, b] : [b, a];
  const razao = raioKm(maior) / raioKm(menor);
  if (razao < 1.05) {
    frases.push(["📏", `${maiuscula(com(a))} e ${com(b)} têm quase o mesmo tamanho.`]);
  } else {
    frases.push(["📏", `O diâmetro ${de(maior)} é ${vezes(razao)} o ${de(menor)}.`]);
    // "Quantos cabem dentro" só faz sentido entre corpos sólidos ou gasosos.
    const corpos = ![a, b].some((o) => o.categoria);
    const volume = razao ** 3;
    if (corpos && volume >= 1.5) frases.push(["🫙", `Dentro ${de(maior)} caberiam ${quantidade(volume)} ${plural(menor)}.`]);
  }
  if (a.gravidade && b.gravidade) {
    const [forte, fraco] = a.gravidade >= b.gravidade ? [a, b] : [b, a];
    const q = forte.gravidade / fraco.gravidade;
    frases.push(["🪐", q < 1.1
      ? `A gravidade é quase igual ${em(a)} e ${em(b)}.`
      : `A gravidade ${em(forte)} é ${numero(q, casasPara(q))} vezes a ${de(fraco)}.`]);
  } else if (ehEstrela(a) && ehEstrela(b) && a.temperaturaK && b.temperaturaK) {
    const [quente, fria] = a.temperaturaK >= b.temperaturaK ? [a, b] : [b, a];
    frases.push(["🌡️", `${maiuscula(com(quente))} é mais quente (${numero(quente.temperaturaK)} K) que ${com(fria)} (${numero(fria.temperaturaK)} K): por isso a cor é diferente.`]);
  }
  const referencia = [a, b].find((o) => o.id === "sol" || o.id === "sistema-solar");
  const outro = referencia && (referencia === a ? b : a);
  if (outro && outro !== referencia && cabeNoSistemaSolar(outro)) frases.push(["🌞", noLugarDoSol(outro)]);
  for (const o of [a, b]) {
    if (o.categoria === "buraco negro") {
      frases.push(["🕳️", `${maiuscula(com(o))} tem ${quantidade(o.massaSolar)} vezes a massa do Sol espremida numa bola de ${textoKm(2 * raioKm(o))}: a gravidade é tão forte que nem a luz escapa.`]);
    } else if (o.id === "via-lactea") {
      frases.push(["🌌", "A luz leva uns 100 mil anos para atravessar a Via Láctea. O Sol é só uma das centenas de bilhões de estrelas dela."]);
    } else if (o.id === "andromeda") {
      frases.push(["🔭", "A luz de Andrômeda que chega hoje aos nossos olhos saiu de lá há uns 2,5 milhões de anos."]);
    }
  }
  return frases;
}

// ---------- Interface ----------

const selecaoA = $("astro-a"), selecaoB = $("astro-b");

function preencherSelecao(selecao) {
  selecao.innerHTML = ITENS.map((o) => `<option value="${o.id}">${escapar(nome(o))} — ${escapar(categoria(o))}</option>`).join("");
}
preencherSelecao(selecaoA);
preencherSelecao(selecaoB);

function atualizarTextos(a, b) {
  // Linhas sem dado para nenhum dos dois ficam de fora.
  const linhas = LINHAS.map(([rotulo, valor]) => [rotulo, valor(a), valor(b)]).filter(([, va, vb]) => va !== "—" || vb !== "—");
  $("tabela").innerHTML = `
    <thead><tr><th scope="col"><span class="visualmente-oculto">Dado</span></th><th scope="col">${escapar(nome(a))}</th><th scope="col">${escapar(nome(b))}</th></tr></thead>
    <tbody>${linhas.map(([rotulo, va, vb]) => `<tr><th scope="row">${escapar(rotulo)}</th><td>${escapar(va)}</td><td>${escapar(vb)}</td></tr>`).join("")}</tbody>`;

  $("destaques").innerHTML = destaques(a, b)
    .map(([icone, texto]) => `<p class="destaque"><span aria-hidden="true">${icone}</span> ${escapar(texto)}</p>`).join("");
  atualizarPesos(a, b);
  document.title = `${nome(a)} × ${nome(b)} | Comparar | Explorador do Universo`;
}

function atualizarPesos(a = porId(selecaoA.value), b = porId(selecaoB.value)) {
  const comGravidade = [a, b].filter((o, i, lista) => o.gravidade && lista.indexOf(o) === i);
  $("bloco-peso").hidden = !comGravidade.length;
  const kg = Math.max(0, Number($("peso").value) || 0);
  $("pesos").innerHTML = comGravidade.map((o) => {
    const valor = kg * (o.gravidade / G_TERRA);
    const observacao = o.id === "sol" ? "só para comparar: ninguém chegaria perto!"
      : o.tipo?.startsWith("Gigante") ? "no topo das nuvens: lá não existe chão"
      : "";
    return `<div class="peso-astro"><span class="peso-nome">${escapar(maiuscula(em(o)))}</span>
      <strong>${numero(valor, valor < 10 ? 1 : 0)} kg</strong>${observacao ? `<small>${escapar(observacao)}</small>` : ""}</div>`;
  }).join("");
}
$("peso").addEventListener("input", () => atualizarPesos());

function escolher(idA, idB, { historico = true } = {}) {
  const a = porId(idA) || porId(PADRAO.a);
  const b = porId(idB) || porId(PADRAO.b);
  selecaoA.value = a.id;
  selecaoB.value = b.id;
  atualizarTextos(a, b);
  montarCena(a, b);
  if (historico) {
    const url = new URL(window.location.href);
    url.searchParams.set("a", a.id);
    url.searchParams.set("b", b.id);
    window.history.replaceState(null, "", url);
  }
}

selecaoA.addEventListener("change", () => escolher(selecaoA.value, selecaoB.value));
selecaoB.addEventListener("change", () => escolher(selecaoA.value, selecaoB.value));
$("trocar").addEventListener("click", () => escolher(selecaoB.value, selecaoA.value));

// ---------- Cena 3D ----------

const canvas = $("tela-comparar");
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  definirAnisotropia(renderer.capabilities.getMaxAnisotropy());
} catch {
  renderer = null;
  canvas.hidden = true;
  $("sem-3d").hidden = false;
}

const cena = new THREE.Scene();
cena.add(new THREE.AmbientLight(0xffffff, 0.05));
const luz = new THREE.DirectionalLight(0xffffff, 3);
luz.position.set(-1, 0.4, 0.9);
cena.add(luz);
const DIRECAO_DO_SOL = luz.position.clone().normalize();

const camera = new THREE.PerspectiveCamera(26, 1, 0.01, 200);
const ELEVACAO_CAMERA = 14 * RAD;  // olhar um pouco de cima (os anéis aparecem abertos)
const INCLINACAO_PARA_CAMERA = 8 * RAD;
const ESPACO = 0.32;               // distância entre os dois, em raios do maior

let lados = [];                    // [{ objeto, astro, brilho, x, escala, raioVisual }]
let tamanhoTela = { largura: 1, altura: 1 };

/**
 * Galáxia em 3D (milhares de pontos), com raio 1 e o disco inclinado para a
 * câmera. Mesma "interface" de criarAstro: { grupo, raioVisual, ... }.
 */
function criarGalaxia3d(objeto) {
  const materiais = [];
  const modelo = objeto.id === "via-lactea"
    ? criarViaLactea({ escala: 1 / GALAXIA.raioDiscoKly, materiais })
    : criarGalaxiaEspiral({ raio: 1, semente: 31, quantidade: 60000, anel: 0.3, companheiras: true, materiais });
  const plano = new THREE.Group();
  plano.rotation.x = 0.85;          // disco visto de lado, um pouco de cima
  plano.add(modelo);
  const grupo = new THREE.Group();
  grupo.add(plano);
  return {
    grupo, modelo, materiais, planoContorno: plano,
    dirSol: new THREE.Vector3(1, 0, 0),
    raioVisual: 1.05,
    contorno: 1.05,
    carregar: () => Promise.resolve()
  };
}

/**
 * Sistema Solar em 3D: as órbitas reais dos 8 planetas (raio 1 = Netuno),
 * com o Sol e os planetas como pontos nas posições de hoje. Os pontos são
 * muito maiores que os astros de verdade, que seriam invisíveis.
 */
function criarSistemaSolar3d() {
  const plano = new THREE.Group();
  plano.rotation.x = 0.85;          // plano das órbitas visto um pouco de cima
  const grupo = new THREE.Group();
  grupo.add(plano);
  const netuno = ORBITAS.at(-1).ua;
  const hoje = new Date();
  const paraModelo = ({ x, y, z }) => new THREE.Vector3(x / netuno, z / netuno, -y / netuno);
  const ponto = (cor, tamanho) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texturaDeBrilho(), color: cor, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    sprite.scale.setScalar(tamanho);
    return sprite;
  };
  for (const planeta of PLANETAS) {
    const linha = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(astro.pontosDaOrbita(planeta, hoje, 256).map(paraModelo)),
      new THREE.LineBasicMaterial({ color: planeta.cor, transparent: true, opacity: 0.8 })
    );
    plano.add(linha);
    const marca = ponto(planeta.cor, 0.045);
    marca.position.copy(paraModelo(astro.posicaoHeliocentrica(planeta, hoje)));
    plano.add(marca);
  }
  // Cinturão de Asteroides: um anel bem fraco entre Marte e Júpiter.
  const anel = new THREE.Mesh(
    new THREE.RingGeometry(CINTURAO.raioInternoUA / netuno, CINTURAO.raioExternoUA / netuno, 96),
    new THREE.MeshBasicMaterial({ color: CINTURAO.cor, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
  );
  anel.rotation.x = -Math.PI / 2;
  plano.add(anel);
  plano.add(ponto("#ffd9a0", 0.11));
  return {
    grupo, planoContorno: plano, pontos: true,
    dirSol: new THREE.Vector3(1, 0, 0),
    raioVisual: 1.03,
    contorno: 1.0,
    carregar: () => Promise.resolve()
  };
}

function descartar(lado) {
  cena.remove(lado.astro.grupo);
  lado.astro.grupo.traverse((o) => {
    if (o.material && o.material !== lado.brilho?.material) o.material.dispose();
    if (o.isPoints || o.isLine) o.geometry.dispose();
  });
  if (lado.brilho) {
    cena.remove(lado.brilho);
    lado.brilho.material.dispose();
  }
}

function montarCena(a, b) {
  if (!renderer) return;
  lados.forEach(descartar);
  lados = [a, b].map((objeto) => {
    const estrela = ehEstrela(objeto);
    const astro3d = objeto.categoria === "galáxia" ? criarGalaxia3d(objeto)
      : objeto.categoria === "sistema planetário" ? criarSistemaSolar3d()
      : criarAstro(estrela && objeto.id !== "sol" ? { ...objeto, corEstrela: corDaEstrela(objeto) } : objeto, { segmentos: 128 });
    astro3d.dirSol.copy(DIRECAO_DO_SOL);
    astro3d.carregar();
    cena.add(astro3d.grupo);
    let brilho = null;
    if (estrela) {
      brilho = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texturaDeBrilho(), color: objeto.id === "sol" ? "#ffd9a0" : corDaEstrela(objeto),
        transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending
      }));
      cena.add(brilho);
    }
    return { objeto, astro: astro3d, brilho };
  });
  arrumar();
}

/** Coloca os dois lado a lado (o maior com raio visual 1) e enquadra a câmera. */
function arrumar() {
  if (!lados.length) return;
  const visual = (lado) => raioKm(lado.objeto) * lado.astro.raioVisual;
  const maior = Math.max(...lados.map(visual));
  for (const lado of lados) {
    lado.escala = raioKm(lado.objeto) / maior;
    lado.raioVisual = visual(lado) / maior;
  }
  const [a, b] = lados;
  const largura = 2 * a.raioVisual + 2 * b.raioVisual + ESPACO;
  a.x = -largura / 2 + a.raioVisual;
  b.x = largura / 2 - b.raioVisual;
  const escalaProjecao = tamanhoTela.altura / (2 * Math.tan((camera.fov * RAD) / 2));
  for (const lado of lados) {
    lado.astro.grupo.position.set(lado.x, 0, 0);
    lado.astro.grupo.scale.setScalar(lado.escala);
    orientar(lado, 30);
    if (lado.astro.materiais) {
      // Pontos das galáxias: o tamanho acompanha a escala do grupo.
      ajustarMateriais(lado.astro.materiais, renderer.getPixelRatio(), escalaProjecao);
      for (const material of lado.astro.materiais) material.uniforms.escalaTamanho.value = lado.escala;
    }
    if (lado.brilho) {
      lado.brilho.position.set(lado.x, 0, 0);
      lado.brilho.scale.setScalar(lado.escala * 3.2);
    }
  }

  const aspecto = tamanhoTela.largura / tamanhoTela.altura;
  const tangente = Math.tan((camera.fov * RAD) / 2);
  const distancia = Math.max((largura / 2) * 1.1 / (tangente * aspecto), 1.22 / tangente) + 1;
  camera.position.set(0, Math.sin(ELEVACAO_CAMERA) * distancia, Math.cos(ELEVACAO_CAMERA) * distancia);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  posicionarRotulos(distancia);
}

const projecao = new THREE.Vector3();
function paraTela(x, y, z) {
  projecao.set(x, y, z).project(camera);
  return { x: (projecao.x + 1) / 2 * tamanhoTela.largura, y: (1 - projecao.y) / 2 * tamanhoTela.altura };
}

function posicionarRotulos(distancia) {
  const pixelsPorUnidade = tamanhoTela.altura / (2 * Math.tan((camera.fov * RAD) / 2) * distancia);
  const notas = [];
  $("rotulos").innerHTML = lados.map((lado) => {
    const diametroPx = 2 * lado.escala * pixelsPorUnidade;
    // Pequeno demais para ver (o disco de um buraco negro conta como visível).
    const pequeno = 2 * lado.raioVisual * pixelsPorUnidade < 3;
    const p = { x: paraTela(lado.x, 0, 0).x, y: baseNaTela(lado) };
    const centro = paraTela(lado.x, 0, 0);
    if (pequeno) {
      notas.push(`Na mesma escala, ${com(lado.objeto)} teria só ${numeroPequeno(diametroPx)} pixel de diâmetro nesta tela, pequeno demais para aparecer. O círculo tracejado mostra onde está.`);
    }
    return `${pequeno ? `<span class="marca-pequeno" style="left:${centro.x}px;top:${centro.y}px"></span>` : ""}
      <span class="rotulo" style="left:${(pequeno ? centro.x : p.x)}px;top:${(pequeno ? centro.y + 14 : p.y)}px">
        <strong>${escapar(nome(lado.objeto))}</strong><small>${escapar(diametroCurto(lado.objeto))}</small>
      </span>`;
  }).join("");
  if (lados.some((lado) => lado.astro.pontos) && !notas.length) {
    notas.push("No Sistema Solar, as linhas são as órbitas reais dos planetas; o Sol e os planetas aparecem como pontos bem maiores que de verdade.");
  }
  $("nota-escala").textContent = notas.join(" ");
}

/** "0,3", "0,004", "0,0000001" (sem virar "0,000"). */
function numeroPequeno(v) {
  if (v >= 0.1) return numero(v, 1);
  const casas = Math.min(20, Math.ceil(-Math.log10(v)) + 1);
  return v.toLocaleString("pt-BR", { maximumSignificantDigits: 1, maximumFractionDigits: casas });
}

/** Ponto mais baixo do astro na tela (o globo, os anéis de Saturno, o disco de um buraco negro...). */
const pontoLocal = new THREE.Vector3();
function baseNaTela(lado) {
  lado.astro.grupo.updateMatrixWorld(true);
  let maisBaixo = paraTela(lado.x, -lado.escala * 1.03, 0).y;
  const raioContorno = lado.astro.aneis ? 2.27 : lado.astro.contorno || 0;
  if (raioContorno) {
    const plano = lado.astro.planoContorno || lado.astro.grupo;
    for (let i = 0; i < 72; i++) {
      const angulo = (i / 72) * Math.PI * 2;
      pontoLocal.set(Math.cos(angulo) * raioContorno, 0, Math.sin(angulo) * raioContorno).applyMatrix4(plano.matrixWorld);
      maisBaixo = Math.max(maisBaixo, paraTela(pontoLocal.x, pontoLocal.y, pontoLocal.z).y);
    }
  }
  return maisBaixo + 4;
}

function diametroCurto(o) {
  if (o.categoria === "galáxia") return `${astro.formatarGrande(o.diametroAnosLuz)} anos-luz`;
  const km = 2 * raioKm(o);
  return km < 1e6 ? `${numero(Math.round(km))} km` : textoKm(km);
}

function redimensionar() {
  if (!renderer) return;
  const largura = canvas.clientWidth || 1, altura = canvas.clientHeight || 1;
  tamanhoTela = { largura, altura };
  renderer.setSize(largura, altura, false);
  camera.aspect = largura / altura;
  camera.updateProjectionMatrix();
  arrumar();
}
new ResizeObserver(redimensionar).observe(canvas);

// Rotação: 1 segundo na tela = 1 hora de verdade, com o eixo inclinado como o real.
const qGiro = new THREE.Quaternion(), qInclina = new THREE.Quaternion(), qParaCamera = new THREE.Quaternion();
const EIXO_X = new THREE.Vector3(1, 0, 0), EIXO_Y = new THREE.Vector3(0, 1, 0), EIXO_Z = new THREE.Vector3(0, 0, 1);
qParaCamera.setFromAxisAngle(EIXO_X, INCLINACAO_PARA_CAMERA);

function orientar(lado, horas) {
  if (lado.astro.modelo) {
    // Galáxia: uma volta a cada 2 minutos (de verdade, centenas de milhões de anos).
    lado.astro.modelo.rotation.y = -(horas / 120) * Math.PI * 2;
    return;
  }
  const rot = lado.objeto.rotacao;
  if (!rot) return;
  // Polo norte da IAU para cima; quem gira ao contrário tem período negativo.
  const inclinacaoEixo = rot.horas < 0 ? 180 - rot.inclinacao : rot.inclinacao;
  qInclina.setFromAxisAngle(EIXO_Z, -inclinacaoEixo * RAD);
  qGiro.setFromAxisAngle(EIXO_Y, ((horas / rot.horas) % 1) * Math.PI * 2);
  lado.astro.grupo.quaternion.copy(qParaCamera).multiply(qInclina).multiply(qGiro);
  if (lado.astro.nuvens) lado.astro.nuvens.rotation.y = ((horas / 24) * 8 * RAD) % (Math.PI * 2);
}

const inicio = performance.now();
function quadro(agora) {
  const horas = movimentoReduzido ? 30 : (agora - inicio) / 1000 + 30;
  for (const lado of lados) orientar(lado, horas);
  renderer.render(cena, camera);
  requestAnimationFrame(quadro);
}

// ---------- Início ----------

const parametros = new URLSearchParams(window.location.search);
escolher(parametros.get("a") || PADRAO.a, parametros.get("b") || PADRAO.b, { historico: parametros.has("a") || parametros.has("b") });
if (renderer) {
  redimensionar();
  requestAnimationFrame(quadro);
}
