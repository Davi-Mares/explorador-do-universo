// ---------------------------------------------------------------------------
// Explorador do Universo — Comparador.
// Dois astros lado a lado, na mesma escala, com os números que ajudam a
// entender a diferença: tamanho, gravidade, rotação, translação, distância,
// temperatura e luas. Escolha pela URL: comparar.html?a=terra&b=jupiter
// ---------------------------------------------------------------------------

import * as THREE from "three";
import * as astro from "./explorador/astronomia.js";
import { SOL, PLANETAS, LUA, ESTRELAS, corDaEstrela } from "./explorador/catalogo.js";
import { criarAstro, definirAnisotropia, texturaDeBrilho } from "./explorador/astros3d.js";

const $ = (id) => document.getElementById(id);
const movimentoReduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const G_TERRA = 9.8;
const RAD = Math.PI / 180;

// ---------- Astros que dá para comparar ----------

const GRUPOS = [
  { rotulo: "Sistema Solar", itens: [SOL, ...PLANETAS, LUA] },
  { rotulo: "Estrelas", itens: ESTRELAS.filter((e) => e.raioSolar) }
];
const ITENS = GRUPOS.flatMap((g) => g.itens);
const porId = (id) => ITENS.find((o) => o.id === id);
const PADRAO = { a: "terra", b: "jupiter" };

const nome = (o) => o.nomeComparador || o.nome;
const raioKm = (o) => o.raioKm || o.raioSolar * SOL.raioKm;
const ehEstrela = (o) => o.id === "sol" || Boolean(o.espectro);

// Artigos e plurais para frases naturais ("do Sol", "na Terra", "1.321 Terras").
const ARTIGOS = { sol: "o", terra: "a", lua: "a" };
const PLURAIS = {
  sol: "Sóis", mercurio: "Mercúrios", venus: "Vênus", terra: "Terras", lua: "Luas", marte: "Martes",
  jupiter: "Júpiteres", saturno: "Saturnos", urano: "Uranos", netuno: "Netunos"
};
const com = (o) => (ARTIGOS[o.id] ? `${ARTIGOS[o.id]} ${nome(o)}` : nome(o));
const de = (o) => (ARTIGOS[o.id] ? `d${ARTIGOS[o.id]} ${nome(o)}` : `de ${nome(o)}`);
const em = (o) => (ARTIGOS[o.id] ? `n${ARTIGOS[o.id]} ${nome(o)}` : `em ${nome(o)}`);
const plural = (o) => PLURAIS[o.id] || `estrelas como ${nome(o)}`;
const maiuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

const numero = (valor, casas = 0) => valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const casasPara = (v) => (v < 10 ? 1 : 0);

/** "1.321", "1,3 milhão de" (pronto para vir antes de um substantivo). */
function quantidade(v) {
  const texto = astro.formatarGrande(v < 10 ? Math.round(v * 10) / 10 : Math.round(v));
  return /(lhão|lhões)$/.test(texto) ? `${texto} de` : texto;
}

const ficha = (o, campo) => o.ficha?.find(([c]) => c === campo)?.[1] || null;

// ---------- Linhas da tabela ----------

function diametro(o) {
  const km = 2 * raioKm(o);
  const texto = km < 1e6 ? `${numero(Math.round(km))} km` : astro.formatarKm(km);
  if (o.id === "terra" || o.id === "sol") return texto;
  if (ehEstrela(o)) return `${texto} (${numero(o.raioSolar, o.raioSolar < 10 ? 1 : 0)} × o Sol)`;
  const terras = raioKm(o) / 6371;
  return `${texto} (${numero(terras, terras < 10 ? 2 : 0)} × a Terra)`;
}

function gravidade(o) {
  if (!o.gravidade) return "—";
  const texto = `${numero(o.gravidade, o.gravidade < 100 ? 1 : 0)} m/s²`;
  return o.id === "terra" ? texto : `${texto} (${numero(o.gravidade / G_TERRA, 2)} × a da Terra)`;
}

function rotacao(o) {
  const horas = o.rotacao?.horas;
  if (!horas) return "—";
  const texto = astro.formatarDuracao(Math.abs(horas) * 3600);
  if (horas < 0) return `${texto} (gira ao contrário)`;
  if (o.id === "sol") return `${texto} (no equador)`;
  if (o.id === "lua") return `${texto} (sempre a mesma face para a Terra)`;
  return texto;
}

function translacao(o) {
  if (o.id === "sol") return "≈ 230 milhões de anos (em volta da galáxia)";
  if (o.id === "lua") return `${numero(o.periodoDias, 1)} dias (em volta da Terra)`;
  if (!o.periodoAnos) return "—";
  if (o.periodoAnos < 1.5) return `${numero(o.periodoAnos * 365.25)} dias`;
  return `${numero(o.periodoAnos, o.periodoAnos < 100 ? 1 : 0)} anos`;
}

/** Distância média (km) e de onde ela é medida. */
function distancia(o) {
  if (o.id === "sol") return { km: astro.KM_POR_UA, de: "da Terra" };
  if (o.id === "lua") return { km: o.distanciaMediaKm, de: "da Terra" };
  if (o.orbita) return { km: o.orbita.elementos.a * astro.KM_POR_UA, de: "do Sol" };
  if (o.anosLuz) return { km: o.anosLuz * astro.KM_POR_ANO_LUZ, de: "do Sol" };
  return null;
}

function textoDistancia(o) {
  const d = distancia(o);
  if (!d) return "—";
  if (o.anosLuz) return `${numero(o.anosLuz, o.anosLuz < 10 ? 1 : 0)} anos-luz ${d.de}`;
  return `${astro.formatarKm(d.km)} ${d.de}`;
}

function textoLuz(o) {
  const d = distancia(o);
  if (!d) return "—";
  if (o.anosLuz) return `${numero(o.anosLuz, o.anosLuz < 10 ? 1 : 0)} anos até nós`;
  const quem = o.id === "sol" ? "até a Terra" : o.id === "lua" ? "até a Terra" : "vindo do Sol";
  return `${astro.formatarDuracao(d.km / astro.VELOCIDADE_LUZ_KM_S)} ${quem}`;
}

function temperatura(o) {
  if (o.temperaturaK && o.id !== "sol") {
    return `${numero(o.temperaturaK)} K na superfície (≈ ${numero(Math.round((o.temperaturaK - 273) / 10) * 10)} °C)`;
  }
  return ficha(o, "Temperatura") || "—";
}

const LINHAS = [
  ["Tipo", (o) => o.tipo || "—"],
  ["Diâmetro", diametro],
  ["Gravidade", gravidade],
  ["Rotação (volta em si)", rotacao],
  ["Translação (volta em órbita)", translacao],
  ["Distância média", textoDistancia],
  ["A luz leva", textoLuz],
  ["Temperatura", temperatura],
  ["Luas", (o) => ficha(o, "Luas") || "—"],
  ["Inclinação do eixo", (o) => (o.rotacao?.inclinacao !== undefined ? `${numero(o.rotacao.inclinacao, 1)}°` : "—")]
];

function escapar(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- Textos de destaque ----------

function destaques(a, b) {
  const [maior, menor] = raioKm(a) >= raioKm(b) ? [a, b] : [b, a];
  const razao = raioKm(maior) / raioKm(menor);
  const frases = [];
  if (a === b) {
    frases.push(["🪞", `Você escolheu ${com(a)} duas vezes. Troque um dos dois para comparar.`]);
    return frases;
  }
  if (razao < 1.05) {
    frases.push(["📏", `${maiuscula(com(a))} e ${com(b)} têm quase o mesmo tamanho.`]);
  } else {
    frases.push(["📏", `O diâmetro ${de(maior)} é ${numero(razao, casasPara(razao))} ${razao < 2 ? "vez" : "vezes"} o ${de(menor)}.`]);
    const volume = razao ** 3;
    if (volume >= 1.5) frases.push(["🫙", `Dentro ${de(maior)} caberiam ${quantidade(volume)} ${plural(menor)}.`]);
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
  return frases;
}

// ---------- Interface ----------

const selecaoA = $("astro-a"), selecaoB = $("astro-b");

function preencherSelecao(selecao) {
  selecao.innerHTML = GRUPOS.map((g) => `<optgroup label="${escapar(g.rotulo)}">${g.itens
    .map((o) => `<option value="${o.id}">${escapar(nome(o))}</option>`).join("")}</optgroup>`).join("");
}
preencherSelecao(selecaoA);
preencherSelecao(selecaoB);

function atualizarTextos(a, b) {
  $("tabela").innerHTML = `
    <thead><tr><th scope="col"><span class="visualmente-oculto">Dado</span></th><th scope="col">${escapar(nome(a))}</th><th scope="col">${escapar(nome(b))}</th></tr></thead>
    <tbody>${LINHAS.map(([rotulo, valor]) => `<tr><th scope="row">${escapar(rotulo)}</th><td>${escapar(valor(a))}</td><td>${escapar(valor(b))}</td></tr>`).join("")}</tbody>`;

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

function descartar(lado) {
  cena.remove(lado.astro.grupo);
  lado.astro.grupo.traverse((o) => {
    if (o.material && o.material !== lado.brilho?.material) o.material.dispose();
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
    const astro3d = criarAstro(estrela && objeto.id !== "sol" ? { ...objeto, corEstrela: corDaEstrela(objeto) } : objeto, { segmentos: 128 });
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
  for (const lado of lados) {
    lado.astro.grupo.position.set(lado.x, 0, 0);
    lado.astro.grupo.scale.setScalar(lado.escala);
    orientar(lado, 30);
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
    const pequeno = diametroPx < 3;
    const p = { x: paraTela(lado.x, 0, 0).x, y: baseNaTela(lado) };
    const centro = paraTela(lado.x, 0, 0);
    if (pequeno) {
      notas.push(`Na mesma escala, ${com(lado.objeto)} teria só ${numero(diametroPx, diametroPx < 0.1 ? 3 : 1)} pixel de diâmetro nesta tela, pequeno demais para aparecer. O círculo tracejado mostra onde está.`);
    }
    return `${pequeno ? `<span class="marca-pequeno" style="left:${centro.x}px;top:${centro.y}px"></span>` : ""}
      <span class="rotulo" style="left:${(pequeno ? centro.x : p.x)}px;top:${(pequeno ? centro.y + 14 : p.y)}px">
        <strong>${escapar(nome(lado.objeto))}</strong><small>${escapar(diametroCurto(lado.objeto))}</small>
      </span>`;
  }).join("");
  $("nota-escala").textContent = notas.join(" ");
}

/** Ponto mais baixo do astro na tela (o globo e, em Saturno, a borda dos anéis). */
const pontoLocal = new THREE.Vector3();
function baseNaTela(lado) {
  lado.astro.grupo.updateMatrixWorld(true);
  let maisBaixo = paraTela(lado.x, -lado.escala * 1.03, 0).y;
  if (lado.astro.aneis) {
    for (let i = 0; i < 72; i++) {
      const angulo = (i / 72) * Math.PI * 2;
      pontoLocal.set(Math.cos(angulo) * 2.27, 0, Math.sin(angulo) * 2.27).applyMatrix4(lado.astro.grupo.matrixWorld);
      maisBaixo = Math.max(maisBaixo, paraTela(pontoLocal.x, pontoLocal.y, pontoLocal.z).y);
    }
  }
  return maisBaixo + 4;
}

function diametroCurto(o) {
  const km = 2 * raioKm(o);
  return km < 1e6 ? `${numero(Math.round(km))} km` : astro.formatarKm(km);
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
  const rot = lado.objeto.rotacao;
  if (!rot) return;
  // Polo norte da IAU para cima; quem gira ao contrário tem período negativo.
  const inclinacao = rot.horas < 0 ? 180 - rot.inclinacao : rot.inclinacao;
  qInclina.setFromAxisAngle(EIXO_Z, -inclinacao * RAD);
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
