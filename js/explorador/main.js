// ---------------------------------------------------------------------------
// Explorador do Universo — aplicação principal.
// Junta as cenas (cenas.js), o progresso (progresso.js) e a interface:
// voo livre, piloto automático, salto, descobertas, missões e quiz.
// ---------------------------------------------------------------------------

import * as THREE from "three";
import * as astro from "./astronomia.js";
import { NIVEIS, VELOCIDADES, MISSOES, perguntaDoObjeto } from "./catalogo.js";
import { criarNivelSolar, criarNivelEstrelas, criarNivelGalaxia } from "./cenas.js";
import { definirAnisotropia } from "./astros3d.js";
import * as progresso from "./progresso.js";

const $ = (id) => document.getElementById(id);
const EIXO_Y = new THREE.Vector3(0, 1, 0);
const CHAVE_AJUDA = "exploradorDoUniverso:ajudaVista";

const canvas = $("tela");
const movimentoReduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- Renderizador ----------

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: "high-performance" });
} catch (erro) {
  $("sem-webgl").hidden = false;
  document.body.classList.add("sem-3d");
  throw erro;
}
const PIXELS_MAXIMO = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(PIXELS_MAXIMO);
renderer.setClearColor(0x02040b, 1);
definirAnisotropia(renderer.capabilities.getMaxAnisotropy());

const camera = new THREE.PerspectiveCamera(60, 1, 1e-9, 1e9);
camera.rotation.order = "YXZ";
const olhar = { yaw: 0, pitch: 0 };

// ---------- Estado ----------

let dataSimulada = new Date();
let escalaTempo = 1;           // segundos simulados por segundo real
const niveis = {};             // criados só quando visitados
const memoriaDosNiveis = {};   // posição/velocidade de cada nível ao sair
let nivel = null;
let indiceVelocidade = 0;
let selecionado = null;
let piloto = null;             // viagem em andamento
// Em órbita de um astro (depois de chegar): a nave fica parada em relação a
// ele. { corpo, distancia, alvo, azimute, elevacao } — distância ao centro e
// direção (ângulos em volta do eixo Y da cena).
let orbita = null;
let marcadores = [];
let modoTamanho = "real";      // tamanhos do Sistema Solar: "real" ou "ampliado"

const BUILDERS = {
  solar: () => {
    const solar = criarNivelSolar(dataSimulada);
    solar.aplicarTamanho(modoTamanho);
    return solar;
  },
  estrelas: () => criarNivelEstrelas(),
  galaxia: () => {
    const galaxia = criarNivelGalaxia();
    galaxia.definirGiro(!movimentoReduzido);
    return galaxia;
  }
};

function obterNivel(id) {
  if (!niveis[id]) {
    niveis[id] = BUILDERS[id]();
    atualizarMateriais(niveis[id]);
  }
  return niveis[id];
}

const velocidades = () => VELOCIDADES[nivel.id];
const velocidadeAtual = () => velocidades()[indiceVelocidade];
const km = (unidades) => unidades * nivel.unidadeKm;

// ---------- Orientação da câmera ----------

function aplicarOrientacao() {
  olhar.pitch = Math.max(-1.55, Math.min(1.55, olhar.pitch));
  camera.rotation.set(olhar.pitch, olhar.yaw, 0, "YXZ");
}

const matrizAuxiliar = new THREE.Matrix4();
const quaternionAuxiliar = new THREE.Quaternion();
const eulerAuxiliar = new THREE.Euler(0, 0, 0, "YXZ");

/**
 * Em telas em pé (celular) os painéis de baixo cobrem quase metade da tela:
 * a nave olha um pouco abaixo do alvo, e ele aparece na metade de cima.
 */
const INCLINACAO_EM_PE = 0.19; // radianos (≈ 11°)

function quaternionOlhandoPara(ponto) {
  matrizAuxiliar.lookAt(camera.position, ponto, EIXO_Y);
  quaternionAuxiliar.setFromRotationMatrix(matrizAuxiliar);
  if (camera.aspect < 1) {
    eulerAuxiliar.setFromQuaternion(quaternionAuxiliar, "YXZ");
    eulerAuxiliar.x = Math.max(-1.55, eulerAuxiliar.x - INCLINACAO_EM_PE);
    eulerAuxiliar.z = 0;
    quaternionAuxiliar.setFromEuler(eulerAuxiliar);
  }
  return quaternionAuxiliar;
}

function sincronizarOlhar() {
  eulerAuxiliar.setFromQuaternion(camera.quaternion, "YXZ");
  olhar.yaw = eulerAuxiliar.y;
  olhar.pitch = eulerAuxiliar.x;
  aplicarOrientacao();
}

function olharPara(ponto) {
  if (camera.position.distanceToSquared(ponto) === 0) return;
  camera.quaternion.copy(quaternionOlhandoPara(ponto));
  sincronizarOlhar();
}

function orientarSuave(ponto, dt) {
  if (camera.position.distanceToSquared(ponto) === 0) return;
  const alvo = quaternionOlhandoPara(ponto);
  camera.quaternion.slerp(alvo, movimentoReduzido ? 1 : 1 - Math.exp(-dt * 3.5));
  sincronizarOlhar();
}

// ---------- Níveis ----------

function entrarNoNivel(id, { alvo = null } = {}) {
  if (nivel) {
    memoriaDosNiveis[nivel.id] = {
      posicao: camera.position.clone(), yaw: olhar.yaw, pitch: olhar.pitch,
      velocidade: indiceVelocidade, orbita: orbita ? { ...orbita, corpo: orbita.corpo.id } : null
    };
  }
  nivel = obterNivel(id);
  pausarMedidaDeQualidade();
  piloto = null;
  orbita = null;
  fecharAlvo();
  fecharVelocidades();

  camera.near = nivel.near;
  camera.far = nivel.far;
  camera.updateProjectionMatrix();

  const memoria = memoriaDosNiveis[id];
  if (memoria) {
    camera.position.copy(memoria.posicao);
    olhar.yaw = memoria.yaw;
    olhar.pitch = memoria.pitch;
    aplicarOrientacao();
    indiceVelocidade = memoria.velocidade;
    const corpo = memoria.orbita && nivel.corpos.find((c) => c.id === memoria.orbita.corpo);
    if (corpo && !corpo.oculto) {
      orbita = { ...memoria.orbita, corpo };
      posicionarNaOrbita();
    }
  } else {
    const { posicao, olharPara: ponto } = nivel.inicio(camera.aspect);
    camera.position.copy(posicao);
    olharPara(ponto);
    indiceVelocidade = Math.max(0, velocidades().findIndex((v) => v.padrao));
  }

  document.querySelectorAll(".nivel").forEach((botao) => {
    const ativo = botao.dataset.nivel === id;
    botao.classList.toggle("ativo", ativo);
    botao.setAttribute("aria-pressed", String(ativo));
  });
  const temOpcoes = Boolean(nivel.temTempo || nivel.temGiro);
  $("botao-opcoes").hidden = !temOpcoes;
  if (!temOpcoes) fecharOpcoes();
  $("opcoes-solar").hidden = !nivel.temTempo;
  $("opcoes-galaxia").hidden = !nivel.temGiro;
  const rotulo = nivel.temGiro ? "Rotação da galáxia" : "Tempo e tamanhos";
  $("botao-opcoes").setAttribute("aria-label", rotulo);
  $("botao-opcoes").title = rotulo;
  if (nivel.temGiro) atualizarControleGiro();
  document.body.dataset.nivel = id;

  montarMarcadores();
  montarDestinos();
  montarVelocidades();
  atualizarHud();
  atualizarEstadoNave();
  atualizarMissaoAtual();
  progresso.registrarNivel(id);
  for (const idDescoberta of nivel.descobrirAoEntrar || []) {
    const corpo = nivel.corpos.find((c) => c.id === idDescoberta);
    if (corpo) descobrir(corpo);
  }

  const url = new URL(window.location.href);
  url.searchParams.set("nivel", id);
  url.searchParams.delete("alvo");
  if (alvo) {
    const corpo = nivel.corpos.find((c) => c.id === alvo);
    if (corpo) {
      selecionar(corpo);
      url.searchParams.set("alvo", alvo);
    }
  }
  window.history.replaceState(null, "", url);
}

// ---------- Entrada: teclado, mouse e toque ----------

const MAPA_TECLAS = {
  KeyW: "frente", ArrowUp: "frente",
  KeyS: "tras", ArrowDown: "tras",
  KeyA: "esquerda", ArrowLeft: "esquerda",
  KeyD: "direita", ArrowRight: "direita",
  KeyR: "cima", PageUp: "cima",
  KeyF: "baixo", PageDown: "baixo"
};
const teclas = new Set();

function dialogoAberto() {
  return Boolean(document.querySelector("dialog[open]"));
}

window.addEventListener("keydown", (evento) => {
  if (evento.target.closest?.("input, textarea, select") || dialogoAberto()) return;
  if (evento.ctrlKey || evento.metaKey || evento.altKey) return;
  const direcao = MAPA_TECLAS[evento.code];
  if (direcao) {
    teclas.add(direcao);
    cancelarPilotoPorMovimento();
    evento.preventDefault();
    return;
  }
  switch (evento.code) {
    case "Equal": case "NumpadAdd": mudarVelocidade(1); break;
    case "Minus": case "NumpadSubtract": mudarVelocidade(-1); break;
    case "KeyH": abrirAjuda(); break;
    case "Escape": fecharPaineis(); break;
    case "Space":
      if (evento.target.closest?.("button, a")) return;
      pararPiloto();
      evento.preventDefault();
      break;
    default: return;
  }
});
window.addEventListener("keyup", (evento) => {
  const direcao = MAPA_TECLAS[evento.code];
  if (direcao) teclas.delete(direcao);
});
window.addEventListener("blur", () => teclas.clear());

// Arrastar: em voo livre, olha em volta; em órbita, gira em volta do astro.
// Dois dedos (pinça): em órbita, aproxima ou afasta.
const ponteiros = new Map();
let pinca = 0;
const distanciaEntreDedos = () => {
  const [a, b] = [...ponteiros.values()];
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
};
canvas.addEventListener("pointerdown", (evento) => {
  ponteiros.set(evento.pointerId, { x: evento.clientX, y: evento.clientY });
  try { canvas.setPointerCapture(evento.pointerId); } catch { /* ponteiro já solto */ }
  pinca = ponteiros.size === 2 ? distanciaEntreDedos() : 0;
});
canvas.addEventListener("pointermove", (evento) => {
  const ponteiro = ponteiros.get(evento.pointerId);
  if (!ponteiro) return;
  const dx = evento.clientX - ponteiro.x, dy = evento.clientY - ponteiro.y;
  ponteiro.x = evento.clientX;
  ponteiro.y = evento.clientY;
  if (ponteiros.size >= 2) {
    const distancia = distanciaEntreDedos();
    if (orbita && pinca > 0 && distancia > 0) aproximarNaOrbita(pinca / distancia);
    pinca = distancia;
    return;
  }
  const sensibilidade = evento.pointerType === "touch" ? 0.005 : 0.0035;
  if (orbita) {
    orbita.azimute -= dx * sensibilidade * 1.4;
    orbita.elevacao += dy * sensibilidade * 1.4;
    return;
  }
  olhar.yaw -= dx * sensibilidade;
  olhar.pitch -= dy * sensibilidade;
  aplicarOrientacao();
  if (piloto) piloto.olharLivre = true;
});
const soltar = (evento) => {
  ponteiros.delete(evento.pointerId);
  if (ponteiros.size < 2) pinca = 0;
};
canvas.addEventListener("pointerup", soltar);
canvas.addEventListener("pointercancel", soltar);
canvas.addEventListener("lostpointercapture", soltar);

// Rodinha: em órbita, aproxima ou afasta; em voo livre, muda a velocidade.
let ultimaRodinha = 0;
canvas.addEventListener("wheel", (evento) => {
  evento.preventDefault();
  if (orbita) {
    const passos = Math.max(-3, Math.min(3, evento.deltaY / (evento.deltaMode === 1 ? 3 : 100)));
    aproximarNaOrbita(Math.pow(PASSO_DA_RODINHA, -passos));
    return;
  }
  const agora = performance.now();
  if (agora - ultimaRodinha < 140) return;
  ultimaRodinha = agora;
  mudarVelocidade(evento.deltaY < 0 ? 1 : -1);
}, { passive: false });

document.querySelectorAll(".controles-toque [data-tecla]").forEach((botao) => {
  const tecla = botao.dataset.tecla;
  const soltarTecla = () => teclas.delete(tecla);
  botao.addEventListener("pointerdown", (evento) => {
    evento.preventDefault();
    teclas.add(tecla);
    cancelarPilotoPorMovimento();
  });
  botao.addEventListener("pointerup", soltarTecla);
  botao.addEventListener("pointerleave", soltarTecla);
  botao.addEventListener("pointercancel", soltarTecla);
  botao.addEventListener("lostpointercapture", soltarTecla);
  botao.addEventListener("contextmenu", (evento) => evento.preventDefault());
});

// ---------- Velocidade ----------
// A velocidade é a da nave quando ela anda: segurando W/▲ ou no piloto
// automático. Soltou a tecla, a nave para.

function definirVelocidade(indice) {
  const novo = Math.max(0, Math.min(velocidades().length - 1, indice));
  if (novo === indiceVelocidade) return;
  indiceVelocidade = novo;
  if (piloto) piloto.trocouVelocidade = true;
  atualizarHud();
  atualizarEstadoNave();
}
const mudarVelocidade = (delta) => definirVelocidade(indiceVelocidade + delta);
$("velocidade-mais").addEventListener("click", () => mudarVelocidade(1));
$("velocidade-menos").addEventListener("click", () => mudarVelocidade(-1));

/** Lista com todas as velocidades do nível, para escolher direto. */
function montarVelocidades() {
  const lista = $("lista-velocidades");
  lista.innerHTML = "";
  let separou = false;
  velocidades().forEach((velocidade, indice) => {
    if (velocidade.ficcao && !separou) {
      separou = true;
      const separador = document.createElement("li");
      separador.className = "velocidade-separador";
      separador.textContent = "Mais rápido que a luz: ficção";
      lista.append(separador);
    }
    const item = document.createElement("li");
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = velocidade.ficcao ? "opcao-velocidade ficcao" : "opcao-velocidade";
    botao.dataset.indice = String(indice);
    // O separador já avisa que é ficção: na lista o nome fica mais curto.
    const nomeCurto = velocidade.nome.replace(/\s*\(ficção\)$/, "");
    botao.innerHTML = `<span>${escapar(nomeCurto)}</span><small>${escapar(astro.formatarVelocidade(velocidade.kmS))}</small>`;
    botao.addEventListener("click", () => {
      definirVelocidade(indice);
      fecharVelocidades();
      $("botao-velocidades").focus();
    });
    item.append(botao);
    lista.append(item);
  });
}

function fecharVelocidades() {
  alternarPainel("painel-velocidades", "botao-velocidades", false);
}

$("botao-velocidades").addEventListener("click", () => {
  if (alternarPainel("painel-velocidades", "botao-velocidades")) {
    fecharDestinos();
    fecharOpcoes();
    const atual = document.querySelector(`#lista-velocidades [data-indice="${indiceVelocidade}"]`);
    atual?.focus();
    atual?.scrollIntoView({ block: "nearest" });
  }
});

// Clicar fora fecha a lista.
document.addEventListener("pointerdown", (evento) => {
  if ($("painel-velocidades").hidden) return;
  if (evento.target.closest?.("#painel-velocidades, #botao-velocidades")) return;
  fecharVelocidades();
});

// ---------- Movimento ----------

const direcaoAuxiliar = new THREE.Vector3();

/** Na Via Láctea: a nave está dentro do disco (onde ficam as estrelas)? */
function dentroDoDisco() {
  return Math.hypot(camera.position.x, camera.position.z) < 60 && Math.abs(camera.position.y) < 8;
}

// ---------- Órbita ----------
// Ao chegar num astro, a nave entra em órbita: fica parada em relação a ele
// (anda junto quando ele se move). Arrastar gira em volta; rodinha, pinça,
// W/S ou ▲▼ aproximam e afastam, sempre devagar perto da superfície — assim
// a nave nunca "sai voando" sem querer. Só sai da órbita quando a pessoa pede.

const PASSO_DA_RODINHA = 0.84;   // cada "clique" da rodinha muda a altitude em 16%
const APROXIMAR_POR_SEGUNDO = 1.1; // W/S: a altitude muda ≈ 3× por segundo
const GIRO_EM_ORBITA = 1.1;      // A/D e R/F: radianos por segundo
const ELEVACAO_MAXIMA = 1.45;    // não passa por cima do polo (≈ 83°)
const avisosDeOrbita = { primeiro: true, limite: true };

/** Distâncias mínima e máxima da órbita (ao centro do astro) e o raio da superfície. */
function limitesDaOrbita(corpo) {
  const proprio = nivel.limitesDaOrbita?.(corpo);
  if (proprio) return proprio;
  const superficie = corpo.raioExibido || 0;
  const minimo = superficie > 0 ? superficie * 1.06 : corpo.distanciaChegada * 0.25;
  const maximo = Math.max(corpo.raioDescoberta * 2.5, corpo.distanciaChegada * 4, minimo * 4);
  return { minimo, maximo, superficie };
}

function entrarEmOrbita(corpo) {
  if (corpo.regiao) {
    orbita = null;
    return;
  }
  const relativa = camera.position.clone().sub(corpo.posicao);
  const distancia = relativa.length() || corpo.distanciaChegada;
  orbita = {
    corpo,
    distancia,
    alvo: distancia,
    azimute: Math.atan2(relativa.x, relativa.z),
    elevacao: Math.asin(Math.max(-1, Math.min(1, relativa.y / distancia)))
  };
  aproximarNaOrbita(1);
  orbita.distancia = orbita.alvo;
  posicionarNaOrbita();
}

/** Multiplica a altitude (distância à superfície) pelo fator, dentro dos limites. */
function aproximarNaOrbita(fator) {
  if (!orbita) return;
  const { minimo, maximo, superficie } = limitesDaOrbita(orbita.corpo);
  const altitude = Math.max(orbita.alvo - superficie, (minimo - superficie) * 0.5) * fator;
  const novo = Math.min(maximo, Math.max(minimo, superficie + altitude));
  if (fator > 1 && novo >= maximo && orbita.alvo >= maximo * 0.999 && avisosDeOrbita.limite) {
    avisosDeOrbita.limite = false;
    avisar(`🛰️ Essa é a órbita mais alta. Para voar livre, toque em "Sair da órbita".`);
  }
  orbita.alvo = novo;
}

function posicionarNaOrbita() {
  const { corpo } = orbita;
  orbita.elevacao = Math.max(-ELEVACAO_MAXIMA, Math.min(ELEVACAO_MAXIMA, orbita.elevacao));
  const { azimute, elevacao, distancia } = orbita;
  direcaoAuxiliar.set(Math.cos(elevacao) * Math.sin(azimute), Math.sin(elevacao), Math.cos(elevacao) * Math.cos(azimute));
  camera.position.copy(corpo.posicao).addScaledVector(direcaoAuxiliar, distancia);
  olharPara(corpo.posicao);
}

/**
 * Em telas em pé (celular) o campo de visão horizontal é estreito: um astro
 * largo, como Saturno com os anéis, não cabe na distância de chegada normal.
 * A órbita vai então, suavemente, até a distância em que ele cabe inteiro.
 */
function afastarParaCaberNaTela() {
  const raioVisual = orbita?.corpo.astro?.raioVisual;
  if (!raioVisual || camera.aspect >= 1) return;
  const meiaLargura = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect);
  const necessario = (orbita.corpo.raioExibido * raioVisual) / Math.tan(meiaLargura * 0.8);
  orbita.alvo = Math.min(Math.max(orbita.alvo, necessario), limitesDaOrbita(orbita.corpo).maximo);
}

function moverEmOrbita(dt, giro) {
  // Na Via Láctea girando, a órbita gira junto com o disco (a vista não muda).
  if (giro && orbita.corpo.gira) orbita.azimute += giro;
  const lado = (teclas.has("direita") ? 1 : 0) - (teclas.has("esquerda") ? 1 : 0);
  const subir = (teclas.has("cima") ? 1 : 0) - (teclas.has("baixo") ? 1 : 0);
  const aproximar = (teclas.has("frente") ? 1 : 0) - (teclas.has("tras") ? 1 : 0);
  orbita.azimute += lado * GIRO_EM_ORBITA * dt;
  orbita.elevacao += subir * GIRO_EM_ORBITA * dt;
  if (aproximar) aproximarNaOrbita(Math.exp(-aproximar * APROXIMAR_POR_SEGUNDO * dt));
  // A distância vai até o alvo suavemente (em escala logarítmica).
  const k = movimentoReduzido ? 1 : 1 - Math.exp(-dt * 9);
  orbita.distancia = Math.exp(Math.log(orbita.distancia) + (Math.log(orbita.alvo) - Math.log(orbita.distancia)) * k);
  posicionarNaOrbita();
}

/** Sai da órbita: a nave fica parada no espaço, e o astro segue o caminho dele. */
function sairDaOrbita() {
  if (!orbita) return;
  const { corpo } = orbita;
  orbita = null;
  const segue = nivel.temTempo && corpo !== nivel.sol ? ` ${maiuscula(com(corpo))} continua andando na órbita.` : "";
  avisar(`🚀 Voo livre: a nave fica parada até você mandar ela andar.${segue}`);
  atualizarEstadoNave();
}

function mover(dt) {
  const giro = nivel.ultimoGiro || 0;
  if (orbita) {
    moverEmOrbita(dt, giro);
    return;
  }
  // Com a galáxia girando, a nave gira junto quando está dentro do disco,
  // como o Sol de verdade: a vizinhança fica parada e a nave não "escorrega"
  // sozinha. De fora do disco dá para ver o giro.
  if (giro && dentroDoDisco()) {
    camera.position.applyAxisAngle(EIXO_Y, giro);
    olhar.yaw += giro;
    aplicarOrientacao();
  }

  const v = velocidadeAtual().kmS / nivel.unidadeKm; // unidades da cena por segundo
  let percorrido = 0;

  if (piloto) {
    percorrido = passoDoPiloto(dt, v);
  } else if (teclas.size) {
    direcaoAuxiliar.set(
      (teclas.has("direita") ? 1 : 0) - (teclas.has("esquerda") ? 1 : 0),
      (teclas.has("cima") ? 1 : 0) - (teclas.has("baixo") ? 1 : 0),
      (teclas.has("tras") ? 1 : 0) - (teclas.has("frente") ? 1 : 0)
    );
    if (direcaoAuxiliar.lengthSq() > 0) {
      direcaoAuxiliar.normalize().applyQuaternion(camera.quaternion);
      percorrido = v * dt;
      camera.position.addScaledVector(direcaoAuxiliar, percorrido);
    }
  }

  if (percorrido > 0) progresso.somarVoo(km(percorrido), dt);
  evitarColisao();
}

function evitarColisao() {
  for (const corpo of nivel.corpos) {
    if (corpo.oculto || !corpo.raioExibido) continue;
    const minimo = corpo.raioExibido * 1.15;
    const distancia = camera.position.distanceTo(corpo.posicao);
    if (distancia < minimo && distancia > 0) {
      camera.position.sub(corpo.posicao).setLength(minimo).add(corpo.posicao);
    }
  }
}

/** Corpo em cuja vizinhança a nave está (para saber de onde a viagem partiu). */
function corpoOndeEstou() {
  let melhor = null, menor = Infinity;
  for (const corpo of nivel.corpos) {
    if (corpo.oculto) continue;
    const d = camera.position.distanceTo(corpo.posicao);
    if (d <= corpo.raioDescoberta && d / corpo.raioDescoberta < menor) {
      menor = d / corpo.raioDescoberta;
      melhor = corpo;
    }
  }
  return melhor;
}

const AVISO_LUA_ESCONDIDA = "No modo ampliado as luas ficam escondidas (estariam dentro dos planetas). Volte para tamanhos reais.";

function cancelarPilotoPorMovimento() {
  if (piloto) {
    piloto = null;
    avisar("Piloto automático desligado: você assumiu o controle.");
    atualizarPainelAlvo();
    atualizarEstadoNave();
  }
}

function iniciarPiloto(corpo) {
  if (corpo.oculto) return avisar(AVISO_LUA_ESCONDIDA);
  const origem = corpoOndeEstou();
  piloto = {
    corpo,
    origem: origem && origem !== corpo ? origem.id : null,
    velocidade: velocidadeAtual().id,
    trocouVelocidade: false,
    segundos: 0,
    km: 0,
    olharLivre: false
  };
  orbita = null;
  atualizarPainelAlvo();
  atualizarEstadoNave();
}

function pararPiloto() {
  if (!piloto) return;
  piloto = null;
  avisar("⏹ Nave parada. Ela só volta a andar se você mandar.");
  atualizarPainelAlvo();
  atualizarEstadoNave();
}

function passoDoPiloto(dt, v) {
  const corpo = piloto.corpo;
  const paraAlvo = direcaoAuxiliar.copy(corpo.posicao).sub(camera.position);
  const distancia = paraAlvo.length();
  const restante = distancia - corpo.distanciaChegada;
  piloto.segundos += dt;
  if (!piloto.olharLivre) orientarSuave(corpo.posicao, dt);

  const passo = v * dt;
  if (restante <= passo) {
    const andou = Math.max(restante, 0);
    camera.position.copy(corpo.posicao).addScaledVector(paraAlvo.normalize(), -corpo.distanciaChegada);
    piloto.km += km(andou);
    chegar(corpo, { salto: false });
    return andou;
  }
  camera.position.addScaledVector(paraAlvo.normalize(), passo);
  piloto.km += km(passo);
  return passo;
}

function saltar(corpo) {
  if (corpo.oculto) return avisar(AVISO_LUA_ESCONDIDA);
  const vista = nivel.pontoDeVista(corpo) || camera.position.clone().sub(corpo.posicao).normalize();
  if (!Number.isFinite(vista.x) || vista.lengthSq() < 1e-12) vista.set(0, 0.3, 1).normalize();
  camera.position.copy(corpo.posicao).addScaledVector(vista, corpo.distanciaChegada * 1.25);
  piloto = null;
  chegar(corpo, { salto: true });
}

function chegar(corpo, { salto }) {
  const viagem = {
    alvo: corpo.id,
    origem: piloto?.origem || null,
    velocidade: piloto?.velocidade || null,
    trocouVelocidade: Boolean(piloto?.trocouVelocidade),
    salto,
    segundos: piloto?.segundos || 0,
    km: piloto?.km || 0
  };
  piloto = null;
  // Num astro, a nave entra em órbita. Uma região (o Cinturão) não é um
  // corpo: lá a nave só fica parada, olhando ao longo dela.
  entrarEmOrbita(corpo);
  if (!orbita) olharPara(corpo.pontoDeOlhar?.() || corpo.posicao);
  afastarParaCaberNaTela();
  verificarDescobertas();
  if (!salto) {
    avisar(`📍 ${corpo.nome}: viagem de ${astro.formatarDuracao(viagem.segundos)} (${astro.formatarDistancia(viagem.km)})`);
  }
  if (orbita && avisosDeOrbita.primeiro) {
    avisosDeOrbita.primeiro = false;
    const toque = window.matchMedia("(pointer: coarse)").matches;
    avisar(toque
      ? "🛰️ Em órbita: arraste para girar em volta; use dois dedos ou ▲ ▼ para chegar mais perto."
      : "🛰️ Em órbita: arraste para girar em volta; use a rodinha ou W/S para chegar mais perto.");
  }
  progresso.registrarChegada(viagem);
  atualizarPainelAlvo();
  atualizarEstadoNave();
}

// ---------- Estado da nave: piloto automático ou em órbita ----------

// Artigo de cada nome ("da Terra", "do Sol", "das Plêiades", "de Marte").
const ARTIGOS = { terra: "a", lua: "a", voyager: "a", "voyager-2": "a", sol: "o", "sol-galaxia": "o", cinturao: "o", pleiades: "as" };
const artigo = (corpo) => ARTIGOS[corpo.id] || (/^(Nebulosa|Galáxia|Grande|Pequena|Estrela|Nuvem)\b/.test(corpo.nome) ? "a" : "");
const nomeCurto = (corpo) => corpo.nome.replace(/\s*\(.*\)$/, "");
const com = (corpo) => (artigo(corpo) ? `${artigo(corpo)} ${nomeCurto(corpo)}` : nomeCurto(corpo));
const maiuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);
const de = (corpo) => (artigo(corpo) ? `d${artigo(corpo)} ${nomeCurto(corpo)}` : `de ${nomeCurto(corpo)}`);

/**
 * Distância de um astro ao Sol (unidades da cena). Na Via Láctea é o nível que
 * informa a distância medida: lá o disco gira e as galáxias vizinhas não, então
 * a distância entre os dois pontos da cena muda sem que a de verdade mude.
 */
const distanciaAoSol = (corpo) => nivel.distanciaAoSol?.(corpo) ?? corpo.posicao.distanceTo(nivel.sol.posicao);

/** Distância curta para o painel: em km de perto; em UA ou anos-luz de longe. */
function distanciaCurta(quilometros) {
  const texto = astro.formatarDistancia(quilometros);
  const entreParenteses = texto.match(/\(([^)]+)\)$/);
  return quilometros > 5e9 && entreParenteses ? entreParenteses[1] : texto.replace(/\s*\(.*\)$/, "");
}

/** Altitude (astros com superfície) ou distância ao centro (nebulosas, galáxias). */
function detalheDaOrbita() {
  const { superficie } = limitesDaOrbita(orbita.corpo);
  const distanciaKm = km(Math.max(0, orbita.distancia - superficie));
  return superficie > 0
    ? `· ${distanciaCurta(distanciaKm)} de altitude`
    : `· a ${distanciaCurta(distanciaKm)}`;
}

let estadoAnterior = "";
function atualizarEstadoNave() {
  let texto = "", detalhe = "", acao = "", dica = "";
  if (piloto) {
    const corpo = piloto.corpo;
    const restanteKm = km(Math.max(0, camera.position.distanceTo(corpo.posicao) - corpo.distanciaChegada));
    texto = `🚀 Piloto automático: indo para ${corpo.nome}`;
    detalhe = `· faltam ${astro.formatarDuracao(restanteKm / velocidadeAtual().kmS)}`;
    acao = "⏹ Parar";
    dica = "Parar a nave aqui (tecla Espaço)";
  } else if (orbita) {
    // Uma sonda não tem gravidade para segurar a nave: ela só voa ao lado.
    texto = orbita.corpo.sonda ? `🛰️ Voando ao lado ${de(orbita.corpo)}` : `🛰️ Em órbita ${de(orbita.corpo)}`;
    detalhe = detalheDaOrbita();
    acao = orbita.corpo.sonda ? "Voar livre" : "Sair da órbita";
    dica = "Voar livre: a nave fica parada no espaço até você mandar ela andar";
  }
  $("estado-detalhe").textContent = detalhe;
  if (texto === estadoAnterior) return;
  estadoAnterior = texto;
  $("estado-nave").hidden = !texto;
  $("estado-texto").textContent = texto;
  const botao = $("estado-acao");
  botao.textContent = acao;
  botao.title = dica;
}

$("estado-acao").addEventListener("click", () => (piloto ? pararPiloto() : sairDaOrbita()));

// ---------- Descobertas ----------

const filaDeDescobertas = [];

function verificarDescobertas() {
  for (const corpo of nivel.corpos) {
    if (corpo.oculto || progresso.foiDescoberto(corpo.id)) continue;
    if (camera.position.distanceTo(corpo.posicao) <= corpo.raioDescoberta) descobrir(corpo);
  }
}

function descobrir(corpo) {
  if (!progresso.registrarDescoberta(corpo.id)) return;
  // A descoberta mais recente aparece na hora; as anteriores já estão no Diário.
  if (filaDeDescobertas.length && !$("dialogo-quiz").open) filaDeDescobertas.length = 0;
  filaDeDescobertas.push(corpo);
  if (filaDeDescobertas.length === 1) mostrarDescoberta();
  atualizarMarcadoresDescobertos();
  atualizarContadores();
}

let temporizadorDescoberta = null;
function mostrarDescoberta() {
  const corpo = filaDeDescobertas[0];
  const cartao = $("cartao-descoberta");
  // Em telas pequenas o cartão ocupa o lugar do painel do alvo (explorador.css).
  document.body.classList.toggle("com-descoberta", Boolean(corpo));
  if (!corpo) {
    cartao.hidden = true;
    return;
  }
  $("descoberta-nome").textContent = corpo.nome;
  $("descoberta-texto").textContent = corpo.objeto.curiosidade;
  const pergunta = perguntaDoObjeto(corpo.id);
  const botaoDesafio = $("descoberta-desafio");
  botaoDesafio.hidden = !pergunta || Boolean(progresso.obterEstado().respostas[pergunta.id]);
  cartao.hidden = false;
  clearTimeout(temporizadorDescoberta);
  temporizadorDescoberta = setTimeout(proximaDescoberta, 14000);
}

function proximaDescoberta() {
  filaDeDescobertas.shift();
  mostrarDescoberta();
}

$("descoberta-fechar").addEventListener("click", proximaDescoberta);
$("descoberta-desafio").addEventListener("click", () => {
  const corpo = filaDeDescobertas[0];
  if (!corpo) return;
  clearTimeout(temporizadorDescoberta);
  abrirQuiz(perguntaDoObjeto(corpo.id), corpo.nome);
});

// ---------- Quiz ----------

function abrirQuiz(pergunta, nomeDoObjeto) {
  if (!pergunta) return;
  const dialogo = $("dialogo-quiz");
  const opcoes = $("quiz-opcoes");
  const explicacao = $("quiz-explicacao");
  const anterior = progresso.obterEstado().respostas[pergunta.id];

  $("quiz-selo").textContent = `🧠 Desafio · ${nomeDoObjeto}`;
  $("quiz-pergunta").textContent = pergunta.pergunta;
  explicacao.hidden = true;
  opcoes.innerHTML = "";

  const mostrarResultado = (escolha) => {
    [...opcoes.children].forEach((botao, i) => {
      botao.disabled = true;
      botao.classList.toggle("certa", i === pergunta.certa);
      botao.classList.toggle("errada", i === escolha && i !== pergunta.certa);
    });
    const acertou = escolha === pergunta.certa;
    explicacao.innerHTML = `<strong>${acertou ? "✅ Isso mesmo!" : "❌ Quase!"}</strong> ${pergunta.explicacao}`;
    explicacao.hidden = false;
  };

  pergunta.opcoes.forEach((texto, i) => {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "quiz-opcao";
    botao.textContent = texto;
    botao.addEventListener("click", () => {
      progresso.registrarResposta(pergunta.id, i, i === pergunta.certa);
      mostrarResultado(i);
      atualizarContadores();
      if (filaDeDescobertas[0] && perguntaDoObjeto(filaDeDescobertas[0].id) === pergunta) $("descoberta-desafio").hidden = true;
    });
    opcoes.append(botao);
  });
  if (anterior) mostrarResultado(anterior.escolha);
  dialogo.showModal();
  dialogo.scrollTop = 0;
}

$("dialogo-quiz").addEventListener("close", () => {
  if (filaDeDescobertas.length) {
    clearTimeout(temporizadorDescoberta);
    temporizadorDescoberta = setTimeout(proximaDescoberta, 6000);
  }
});

// ---------- Marcadores (rótulos na tela) ----------

function escapar(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function montarMarcadores() {
  const container = $("marcadores");
  container.innerHTML = "";
  marcadores = [];
  for (const corpo of nivel.corpos) {
    const botao = document.createElement("button");
    botao.type = "button";
    // O Sol (ou o "você está aqui") sempre mostra o nome: é a referência do nível.
    botao.className = corpo === nivel.sol ? "marcador sempre" : "marcador";
    botao.style.setProperty("--cor", corpo.cor);
    botao.innerHTML = `<span class="ponto" aria-hidden="true"></span><span class="nome">${escapar(corpo.nome)}</span>`;
    botao.setAttribute("aria-label", `Selecionar ${corpo.nome}`);
    botao.addEventListener("click", () => selecionar(corpo));
    container.append(botao);
    marcadores.push({ el: botao, corpo, largura: 22 + corpo.nome.length * 7.2 });
  }
  atualizarMarcadoresDescobertos();
}

function atualizarMarcadoresDescobertos() {
  for (const m of marcadores) {
    if (!m.corpo) continue;
    m.el.classList.toggle("descoberto", progresso.foiDescoberto(m.corpo.id));
    m.el.classList.toggle("selecionado", m.corpo === selecionado);
  }
}

const projecao = new THREE.Vector3();
let escalaProjecao = 800; // pixels por unidade a 1 unidade de distância (atualizado no redimensionar)

function posicionarMarcadores() {
  const largura = canvas.clientWidth, altura = canvas.clientHeight;
  const visiveis = [];
  for (const m of marcadores) {
    projecao.copy(m.corpo.posicao).applyMatrix4(camera.matrixWorldInverse);
    const distancia = -projecao.z;
    if (distancia <= 0 || m.corpo.oculto) {
      m.el.style.display = "none";
      continue;
    }
    projecao.applyMatrix4(camera.projectionMatrix);
    if (Math.abs(projecao.x) > 1.1 || Math.abs(projecao.y) > 1.1) {
      m.el.style.display = "none";
      continue;
    }
    m.x = (projecao.x + 1) / 2 * largura;
    m.y = (1 - projecao.y) / 2 * altura;
    m.distancia = distancia;
    // Astro grande na tela (planeta de perto, estrela brilhante): o rótulo vai
    // para o lado do disco, para não cobrir o próprio astro.
    m.raioPx = m.corpo.tamanhoPx ? m.corpo.tamanhoPx / 2 : (m.corpo.raioExibido / distancia) * escalaProjecao;
    visiveis.push(m);
  }

  // Prioridade: selecionado, depois descobertos, depois o resto (só o ponto).
  const peso = (m) => (m.corpo === selecionado ? 0 : progresso.foiDescoberto(m.corpo.id) ? 1 : 2);
  visiveis.sort((a, b) => peso(a) - peso(b) || a.distancia - b.distancia);

  const ocupados = [];
  for (const m of visiveis) {
    const caixa = { x0: m.x - 8, y0: m.y - 11, x1: m.x + m.largura, y1: m.y + 11 };
    const comNome = m.corpo === selecionado || m.corpo === nivel.sol || progresso.foiDescoberto(m.corpo.id);
    const sobreposto = comNome && ocupados.some((o) => caixa.x0 < o.x1 && caixa.x1 > o.x0 && caixa.y0 < o.y1 && caixa.y1 > o.y0);
    const grande = m.raioPx > 4;
    m.el.classList.toggle("so-ponto", sobreposto);
    m.el.classList.toggle("grande", grande);
    if (comNome && !sobreposto) ocupados.push(caixa);
    const deslocamento = grande ? Math.min(m.raioPx, largura * 0.3) + 4 : 0;
    m.el.style.display = "";
    m.el.style.transform = `translate(${(m.x + deslocamento).toFixed(1)}px, ${m.y.toFixed(1)}px)`;
  }
}

// ---------- Destinos ----------

function montarDestinos() {
  const lista = $("lista-destinos");
  lista.innerHTML = "";
  for (const corpo of nivel.corpos) {
    const item = document.createElement("li");
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = corpo.pai ? "destino destino-lua" : "destino";
    botao.style.setProperty("--cor", corpo.cor);
    botao.dataset.id = corpo.id;
    botao.innerHTML = `
      <span class="ponto" aria-hidden="true"></span>
      <span class="destino-texto"><span class="destino-nome">${escapar(corpo.nome)}</span><small class="destino-distancia"></small></span>
      <span class="destino-marca" aria-hidden="true"></span>`;
    botao.addEventListener("click", () => {
      selecionar(corpo);
      fecharDestinos();
    });
    item.append(botao);
    lista.append(item);
  }
  atualizarDestinos();
}

function atualizarDestinos() {
  document.querySelectorAll("#lista-destinos .destino").forEach((botao) => {
    const corpo = nivel.corpos.find((c) => c.id === botao.dataset.id);
    if (!corpo) return;
    const descoberto = progresso.foiDescoberto(corpo.id);
    botao.classList.toggle("descoberto", descoberto);
    botao.classList.toggle("selecionado", corpo === selecionado);
    botao.querySelector(".destino-marca").textContent = descoberto ? "✓" : "";
    botao.querySelector(".destino-distancia").textContent = corpo.oculto
      ? "escondida no modo ampliado"
      : distanciaCurta(km(Math.max(0, camera.position.distanceTo(corpo.posicao) - corpo.raioExibido)));
    botao.title = descoberto ? "Já descoberto" : "Ainda não descoberto";
  });
}

function alternarPainel(idPainel, idBotao, abrir) {
  const painel = $(idPainel);
  const aberto = abrir ?? painel.hidden;
  painel.hidden = !aberto;
  $(idBotao).setAttribute("aria-expanded", String(aberto));
  return aberto;
}
const fecharDestinos = () => alternarPainel("painel-destinos", "botao-destinos", false);
const fecharOpcoes = () => alternarPainel("painel-opcoes", "botao-opcoes", false);

$("botao-destinos").addEventListener("click", () => {
  if (alternarPainel("painel-destinos", "botao-destinos")) {
    fecharOpcoes();
    atualizarDestinos();
  }
});
$("botao-opcoes").addEventListener("click", () => {
  if (alternarPainel("painel-opcoes", "botao-opcoes")) fecharDestinos();
});

// ---------- Alvo selecionado ----------

/** Telas em que o cartão de descoberta ocupa o lugar do painel do alvo (a mesma condição do explorador.css). */
const TELA_PEQUENA = window.matchMedia("(max-width: 760px), (max-height: 520px)");

function selecionar(corpo) {
  selecionado = corpo;
  // Quem escolhe um destino segue viagem: em telas pequenas o cartão de descoberta
  // sai para dar lugar a este painel (a descoberta já está guardada no Diário).
  if (filaDeDescobertas.length && TELA_PEQUENA.matches && !$("dialogo-quiz").open) {
    filaDeDescobertas.length = 0;
    mostrarDescoberta();
  }
  const painel = $("painel-alvo");
  painel.hidden = false;
  $("alvo-nome").textContent = corpo.nome;
  $("alvo-tipo").textContent = corpo.objeto.tipo || "";
  // Quando o astro aparece fora de escala (ilustração), o painel avisa.
  $("alvo-nota").textContent = corpo.objeto.notaEscala || "";
  $("alvo-nota").hidden = !corpo.objeto.notaEscala;
  const ficha = fichaRapida(corpo.objeto);
  $("alvo-ficha").hidden = !ficha.length;
  $("alvo-ficha-lista").innerHTML = ficha.map(([campo, valor]) => `<dt>${escapar(campo)}</dt><dd>${escapar(valor)}</dd>`).join("");
  atualizarMarcadoresDescobertos();
  atualizarPainelAlvo();
  atualizarDestinos();
}

/** Até cinco dados da ficha técnica: os campos principais ou, nas estrelas vizinhas, a ficha de catálogo inteira. */
const CAMPOS_RAPIDOS = [
  "Diâmetro", "Tamanho", "Gravidade", "Rotação", "Ano", "Volta", "Temperatura", "Luas", "Estrelas", "Maior berçário", "Profundidade",
  "Onde fica", "Distância do centro", "Massa", "Brilho no céu", "No centro", "Lançamento", "Visitou", "Velocidade"
];

function fichaRapida(objeto) {
  if (!objeto.ficha) return [];
  const campos = objeto.anosLuz ? objeto.ficha : objeto.ficha.filter(([campo]) => CAMPOS_RAPIDOS.some((c) => campo.startsWith(c)));
  return campos.slice(0, 5);
}

function fecharAlvo() {
  selecionado = null;
  $("painel-alvo").hidden = true;
  atualizarMarcadoresDescobertos();
}

function atualizarPainelAlvo() {
  if (!selecionado) return;
  const corpo = selecionado;
  const distanciaKm = km(Math.max(0, camera.position.distanceTo(corpo.posicao) - corpo.raioExibido));
  const restanteKm = km(Math.max(0, camera.position.distanceTo(corpo.posicao) - corpo.distanciaChegada));
  const velocidade = velocidadeAtual();
  const jaChegou = camera.position.distanceTo(corpo.posicao) <= corpo.distanciaChegada * 1.6;
  const luz = (quilometros) => astro.formatarDuracao(quilometros / astro.VELOCIDADE_LUZ_KM_S);
  if (!jaChegou) {
    $("alvo-linha").textContent = `A ${astro.formatarDistancia(distanciaKm)} · a luz leva ${luz(distanciaKm)}`;
  } else if (corpo === nivel.sol) {
    $("alvo-linha").textContent = "Você está aqui";
  } else {
    // Já chegou: mostra quanto a luz do Sol leva para chegar até este astro.
    $("alvo-linha").textContent = `Você está aqui · a luz do Sol leva ${luz(km(distanciaAoSol(corpo)))} até aqui`;
  }
  $("alvo-eta").textContent = jaChegou ? "" : `Nesta velocidade: ${astro.formatarDuracao(restanteKm / velocidade.kmS)}`;

  const viajandoParaEle = piloto && piloto.corpo === corpo;
  $("botao-ir").hidden = viajandoParaEle;
  $("botao-parar").hidden = !viajandoParaEle;
}

$("botao-ir").addEventListener("click", () => selecionado && iniciarPiloto(selecionado));
$("botao-saltar").addEventListener("click", () => selecionado && saltar(selecionado));
$("botao-parar").addEventListener("click", pararPiloto);
$("botao-fechar-alvo").addEventListener("click", fecharAlvo);

// ---------- Painel da nave (HUD) ----------

function atualizarHud() {
  const velocidade = velocidadeAtual();
  $("velocidade-nome").textContent = velocidade.nome;
  $("velocidade-valor").textContent = astro.formatarVelocidade(velocidade.kmS);
  $("velocidade-nivel").textContent = `${indiceVelocidade + 1}/${velocidades().length}`;
  document.querySelector(".hud-velocidade").classList.toggle("ficcao", Boolean(velocidade.ficcao));
  $("velocidade-menos").disabled = indiceVelocidade === 0;
  $("velocidade-mais").disabled = indiceVelocidade === velocidades().length - 1;
  document.querySelectorAll("#lista-velocidades [data-indice]").forEach((botao) => {
    botao.setAttribute("aria-pressed", String(Number(botao.dataset.indice) === indiceVelocidade));
  });
}

// A altura do painel da nave muda (piloto automático, telas pequenas):
// os painéis de baixo se ajustam a ela.
new ResizeObserver(() => {
  document.documentElement.style.setProperty("--altura-hud", `${Math.ceil(document.querySelector(".hud").offsetHeight)}px`);
}).observe(document.querySelector(".hud"));

// Missão atual: uma de cada vez, de preferência do nível em que a nave está.
function missaoAtual() {
  const pendentes = MISSOES.filter((m) => !progresso.missaoConcluida(m.id));
  return pendentes.find((m) => m.nivel === nivel.id) || pendentes.find((m) => !m.nivel) || pendentes[0] || null;
}

function atualizarMissaoAtual() {
  const missao = missaoAtual();
  $("missao-atual").textContent = missao ? `🎯 ${missao.objetivo}` : "🏅 Todas as missões cumpridas!";
}

$("missao-atual").addEventListener("click", () => {
  const missao = missaoAtual();
  if (missao) avisar(`💡 ${missao.dica}`);
});

// ---------- Tempo e tamanhos (Sistema Solar) ----------

const formatoData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function atualizarControleTempo() {
  document.querySelectorAll("#controle-tempo [data-tempo]").forEach((botao) => {
    const valor = botao.dataset.tempo;
    botao.setAttribute("aria-pressed", String(valor !== "hoje" && Number(valor) === escalaTempo));
  });
}

document.querySelectorAll("#controle-tempo [data-tempo]").forEach((botao) => {
  botao.addEventListener("click", () => {
    if (botao.dataset.tempo === "hoje") {
      dataSimulada = new Date();
      escalaTempo = 1;
    } else {
      escalaTempo = Number(botao.dataset.tempo);
    }
    atualizarControleTempo();
  });
});

const NOTAS_TAMANHO = {
  real: "Tamanhos e distâncias reais: os planetas parecem pontinhos porque são minúsculos perto das distâncias entre eles.",
  ampliado: "Planetas 500× maiores e Sol 10× maior; as distâncias continuam reais. As luas somem porque ficariam dentro dos planetas ampliados!"
};

function mudarTamanho(modo) {
  modoTamanho = modo;
  // O Sistema Solar só é montado quando alguém entra nele (quem abre direto
  // nas Estrelas ou na Via Láctea não baixa os planetas à toa).
  const solar = niveis.solar;
  solar?.aplicarTamanho(modo);
  document.querySelectorAll("#controle-tamanho [data-tamanho]").forEach((botao) => {
    botao.setAttribute("aria-pressed", String(botao.dataset.tamanho === modo));
  });
  $("nota-tamanho").textContent = NOTAS_TAMANHO[modo];
  if (orbita && solar && nivel === solar) {
    // O astro mudou de tamanho: a órbita volta para a distância de chegada.
    if (orbita.corpo.oculto) {
      orbita = null;
      atualizarEstadoNave();
    } else {
      orbita.alvo = orbita.distancia = orbita.corpo.distanciaChegada * 1.25;
      posicionarNaOrbita();
    }
  }
  if (selecionado?.oculto) fecharAlvo();
  atualizarDestinos();
}
document.querySelectorAll("#controle-tamanho [data-tamanho]").forEach((botao) => {
  botao.addEventListener("click", () => mudarTamanho(botao.dataset.tamanho));
});

// ---------- Rotação da galáxia ----------

function atualizarControleGiro() {
  const galaxia = niveis.galaxia;
  if (!galaxia) return;
  document.querySelectorAll("#controle-giro [data-giro]").forEach((botao) => {
    botao.setAttribute("aria-pressed", String((botao.dataset.giro === "sim") === galaxia.girando));
  });
  const anos = galaxia.anosDeGiro;
  $("giro-tempo").textContent = anos < 1e6
    ? "Cada segundo aqui equivale a ≈ 1,3 milhão de anos."
    : `Desde que você chegou, passaram ≈ ${astro.formatarGrande(anos)} de anos.`;
}

document.querySelectorAll("#controle-giro [data-giro]").forEach((botao) => {
  botao.addEventListener("click", () => {
    obterNivel("galaxia").definirGiro(botao.dataset.giro === "sim");
    atualizarControleGiro();
  });
});

// ---------- Contadores e painéis ----------

function atualizarContadores() {
  const r = progresso.resumo();
  $("contador-diario").textContent = `${r.descobertos}/${r.totalObjetos}`;
}

function fecharPaineis() {
  if (!$("painel-velocidades").hidden) {
    fecharVelocidades();
    $("botao-velocidades").focus();
    return;
  }
  fecharDestinos();
  fecharOpcoes();
  fecharAlvo();
}

progresso.aoMudar((evento) => {
  if (evento.tipo === "missao") avisar(`🏅 Missão cumprida: ${evento.missao.nome}!`, "missao");
  atualizarContadores();
  atualizarMissaoAtual();
  if (evento.tipo !== "missao") {
    atualizarMarcadoresDescobertos();
    atualizarDestinos();
  }
});

// ---------- Avisos ----------

function avisar(texto, tipo = "") {
  const area = $("avisos");
  const aviso = document.createElement("p");
  aviso.className = `aviso ${tipo}`;
  aviso.textContent = texto;
  area.append(aviso);
  while (area.children.length > 3) area.firstElementChild.remove();
  setTimeout(() => {
    aviso.classList.add("saindo");
    setTimeout(() => aviso.remove(), 400);
  }, tipo === "missao" ? 6000 : 4200);
}

// ---------- Ajuda ----------

function abrirAjuda() {
  const dialogo = $("dialogo-ajuda");
  if (!dialogo.open) dialogo.showModal();
  // Em telas baixas o foco vai para o botão do fim e o texto abriria já rolado.
  dialogo.scrollTop = 0;
}
$("botao-ajuda").addEventListener("click", abrirAjuda);
$("dialogo-ajuda").addEventListener("close", () => {
  try { localStorage.setItem(CHAVE_AJUDA, "1"); } catch { /* sem armazenamento */ }
});

document.querySelectorAll(".nivel").forEach((botao) => {
  botao.addEventListener("click", () => {
    if (botao.dataset.nivel !== nivel.id) entrarNoNivel(botao.dataset.nivel);
  });
});

// ---------- Tamanho da tela ----------

function atualizarMateriais(alvo = nivel) {
  if (!alvo) return;
  const altura = canvas.clientHeight || window.innerHeight;
  escalaProjecao = altura / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  for (const material of alvo.materiaisDePontos) {
    material.uniforms.escalaPixel.value = renderer.getPixelRatio();
    material.uniforms.escalaProjecao.value = escalaProjecao;
  }
}

function redimensionar() {
  const largura = canvas.clientWidth || window.innerWidth;
  const altura = canvas.clientHeight || window.innerHeight;
  renderer.setSize(largura, altura, false);
  camera.aspect = largura / altura;
  camera.updateProjectionMatrix();
  Object.values(niveis).forEach(atualizarMateriais);
}
window.addEventListener("resize", redimensionar);

// ---------- Qualidade adaptável ----------
// Num aparelho mais fraco (ou perto do buraco negro, que é pesado de
// desenhar) a cena passa a ser desenhada com menos pixels, para o voo
// continuar fluido; quando sobra folga, a resolução volta. Com ?depurar na
// URL a qualidade fica fixa, e as capturas automáticas saem sempre iguais.

const QUALIDADES = [1, 0.75, 0.5];          // fração da resolução máxima
const JANELA_DE_MEDIDA = 1.5;                // segundos de cada medida
const qualidade = { nivel: 0, fixa: false, tempo: 0, quadros: 0, ruins: 0, boas: 0, espera: 20, liberaEm: 0, ignorarAte: 0, avisou: false };

/** Recomeça a medida (ao trocar de nível ou voltar para a aba, os primeiros quadros são lentos mesmo). */
function pausarMedidaDeQualidade(milissegundos = 2500) {
  qualidade.ignorarAte = performance.now() + milissegundos;
  qualidade.tempo = qualidade.quadros = qualidade.ruins = qualidade.boas = 0;
}
document.addEventListener("visibilitychange", () => pausarMedidaDeQualidade());

function definirQualidade(novo) {
  qualidade.nivel = novo;
  renderer.setPixelRatio(PIXELS_MAXIMO * QUALIDADES[novo]);
  Object.values(niveis).forEach(atualizarMateriais);
}

function medirQualidade(segundos, agora) {
  if (qualidade.fixa || agora < qualidade.ignorarAte) return;
  qualidade.tempo += segundos;
  qualidade.quadros++;
  if (qualidade.tempo < JANELA_DE_MEDIDA) return;
  const quadrosPorSegundo = qualidade.quadros / qualidade.tempo;
  qualidade.tempo = qualidade.quadros = 0;
  qualidade.ruins = quadrosPorSegundo < 22 ? qualidade.ruins + 1 : 0;
  qualidade.boas = quadrosPorSegundo > 50 ? qualidade.boas + 1 : 0;
  // Duas medidas ruins seguidas: baixa um degrau. Só tenta subir de novo
  // depois de uma espera, que dobra a cada queda (para não ficar oscilando).
  if (qualidade.ruins >= 2 && qualidade.nivel < QUALIDADES.length - 1) {
    definirQualidade(qualidade.nivel + 1);
    qualidade.ruins = 0;
    qualidade.liberaEm = agora + qualidade.espera * 1000;
    qualidade.espera = Math.min(qualidade.espera * 2, 240);
    if (!qualidade.avisou) {
      qualidade.avisou = true;
      avisar("⚙️ Imagem um pouco mais simples, para o voo ficar fluido neste aparelho.");
    }
  } else if (qualidade.boas >= 2 && qualidade.nivel > 0 && agora > qualidade.liberaEm) {
    definirQualidade(qualidade.nivel - 1);
    qualidade.boas = 0;
  }
}

// ---------- Laço principal ----------

let anterior = performance.now();
let acumuladoInterface = 0;

function quadro(agora) {
  medirQualidade((agora - anterior) / 1000, agora);
  const dt = Math.min((agora - anterior) / 1000, 0.1);
  anterior = agora;

  if (nivel.temTempo && escalaTempo) {
    dataSimulada = new Date(dataSimulada.getTime() + dt * 1000 * escalaTempo);
  }
  nivel.atualizar(dataSimulada, camera, dt);
  mover(dt);
  verificarDescobertas();

  camera.updateMatrixWorld();
  posicionarMarcadores();

  acumuladoInterface += dt;
  if (acumuladoInterface > 0.25) {
    acumuladoInterface = 0;
    atualizarPainelAlvo();
    atualizarEstadoNave();
    if (!$("painel-destinos").hidden) atualizarDestinos();
    if (nivel.temTempo) $("data-simulada").textContent = formatoData.format(dataSimulada);
    if (nivel.temGiro && !$("painel-opcoes").hidden) atualizarControleGiro();
  }

  renderer.render(nivel.cena, camera);
  requestAnimationFrame(quadro);
}

// ---------- Início ----------

function iniciar() {
  redimensionar();
  const parametros = new URLSearchParams(window.location.search);
  const alvo = parametros.get("alvo");
  const idNivel = NIVEIS.some((n) => n.id === parametros.get("nivel")) ? parametros.get("nivel") : "solar";

  mudarTamanho("real");
  atualizarControleTempo();
  entrarNoNivel(idNivel, { alvo });
  atualizarContadores();

  let ajudaVista = false;
  try { ajudaVista = localStorage.getItem(CHAVE_AJUDA) === "1"; } catch { /* sem armazenamento */ }
  if (!ajudaVista) abrirAjuda();

  document.body.classList.add("pronto");
  if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => { /* sem modo offline */ });
  }
  // Para testes automatizados: com ?depurar na URL o estado fica exposto e a
  // qualidade não muda sozinha (as capturas saem sempre iguais).
  if (parametros.has("depurar")) {
    qualidade.fixa = !parametros.has("qualidade");
    window.__explorador = { camera, niveis, qualidade, get nivel() { return nivel; }, get orbita() { return orbita; }, progresso };
  }
  requestAnimationFrame((agora) => {
    anterior = agora;
    quadro(agora);
  });
}

iniciar();
