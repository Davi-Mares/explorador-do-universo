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
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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
let estacionadoEm = null;      // corpo que a câmera acompanha depois de chegar
let marcadores = [];

const BUILDERS = {
  solar: () => criarNivelSolar(dataSimulada),
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

function quaternionOlhandoPara(ponto) {
  matrizAuxiliar.lookAt(camera.position, ponto, EIXO_Y);
  return quaternionAuxiliar.setFromRotationMatrix(matrizAuxiliar);
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
      velocidade: indiceVelocidade, estacionadoEm: estacionadoEm?.corpo.id || null
    };
  }
  nivel = obterNivel(id);
  piloto = null;
  estacionadoEm = null;
  fecharAlvo();

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
    const corpo = nivel.corpos.find((c) => c.id === memoria.estacionadoEm);
    if (corpo) estacionadoEm = { corpo, ultima: corpo.posicao.clone() };
  } else {
    const { posicao, olharPara: ponto } = nivel.inicio();
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
  atualizarHud();
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

let arrastando = null;
canvas.addEventListener("pointerdown", (evento) => {
  arrastando = { id: evento.pointerId, x: evento.clientX, y: evento.clientY };
  canvas.setPointerCapture(evento.pointerId);
});
canvas.addEventListener("pointermove", (evento) => {
  if (!arrastando || arrastando.id !== evento.pointerId) return;
  const dx = evento.clientX - arrastando.x, dy = evento.clientY - arrastando.y;
  arrastando.x = evento.clientX;
  arrastando.y = evento.clientY;
  const sensibilidade = evento.pointerType === "touch" ? 0.005 : 0.0035;
  olhar.yaw -= dx * sensibilidade;
  olhar.pitch -= dy * sensibilidade;
  aplicarOrientacao();
  if (piloto) piloto.olharLivre = true;
});
const soltar = () => { arrastando = null; };
canvas.addEventListener("pointerup", soltar);
canvas.addEventListener("pointercancel", soltar);

let ultimaRodinha = 0;
canvas.addEventListener("wheel", (evento) => {
  evento.preventDefault();
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
  botao.addEventListener("contextmenu", (evento) => evento.preventDefault());
});

// ---------- Velocidade ----------

function mudarVelocidade(delta) {
  const novo = Math.max(0, Math.min(velocidades().length - 1, indiceVelocidade + delta));
  if (novo === indiceVelocidade) return;
  indiceVelocidade = novo;
  if (piloto) piloto.trocouVelocidade = true;
  atualizarHud();
}
$("velocidade-mais").addEventListener("click", () => mudarVelocidade(1));
$("velocidade-menos").addEventListener("click", () => mudarVelocidade(-1));

// ---------- Movimento ----------

const direcaoAuxiliar = new THREE.Vector3();

function mover(dt) {
  if (estacionadoEm) {
    const { corpo, ultima } = estacionadoEm;
    camera.position.add(direcaoAuxiliar.copy(corpo.posicao).sub(ultima));
    ultima.copy(corpo.posicao);
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
  if (estacionadoEm && camera.position.distanceTo(estacionadoEm.corpo.posicao) > estacionadoEm.corpo.raioDescoberta * 3) {
    estacionadoEm = null;
  }
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

function cancelarPilotoPorMovimento() {
  if (piloto) {
    piloto = null;
    avisar("Piloto automático desligado: você assumiu o controle.");
    atualizarPainelAlvo();
  }
}

function iniciarPiloto(corpo) {
  if (corpo.oculto) return avisar("No modo ampliado a Lua fica escondida (estaria dentro da Terra). Volte para tamanhos reais.");
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
  estacionadoEm = null;
  atualizarPainelAlvo();
}

function pararPiloto() {
  if (!piloto) return;
  piloto = null;
  avisar("Nave parada.");
  atualizarPainelAlvo();
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
  if (corpo.oculto) return avisar("No modo ampliado a Lua fica escondida (estaria dentro da Terra). Volte para tamanhos reais.");
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
  estacionadoEm = { corpo, ultima: corpo.posicao.clone() };
  olharPara(corpo.posicao);
  verificarDescobertas();
  if (!salto) {
    avisar(`📍 ${corpo.nome}: viagem de ${astro.formatarDuracao(viagem.segundos)} (${astro.formatarDistancia(viagem.km)})`);
  }
  progresso.registrarChegada(viagem);
  atualizarPainelAlvo();
}

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
    botao.className = "destino";
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
      : astro.formatarDistancia(km(Math.max(0, camera.position.distanceTo(corpo.posicao) - corpo.raioExibido)));
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

function selecionar(corpo) {
  selecionado = corpo;
  const painel = $("painel-alvo");
  painel.hidden = false;
  $("alvo-nome").textContent = corpo.nome;
  $("alvo-tipo").textContent = corpo.objeto.tipo || "";
  atualizarMarcadoresDescobertos();
  atualizarPainelAlvo();
  atualizarDestinos();
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
    $("alvo-linha").textContent = `Você está aqui · a luz do Sol leva ${luz(km(corpo.posicao.distanceTo(nivel.sol.posicao)))} até aqui`;
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
  document.querySelector(".hud-velocidade").classList.toggle("ficcao", Boolean(velocidade.ficcao));
  $("velocidade-menos").disabled = indiceVelocidade === 0;
  $("velocidade-mais").disabled = indiceVelocidade === velocidades().length - 1;
}

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
  ampliado: "Planetas 500× maiores e Sol 10× maior; as distâncias continuam reais. A Lua some porque ficaria dentro da Terra ampliada!"
};

function mudarTamanho(modo) {
  const solar = obterNivel("solar");
  solar.aplicarTamanho(modo);
  document.querySelectorAll("#controle-tamanho [data-tamanho]").forEach((botao) => {
    botao.setAttribute("aria-pressed", String(botao.dataset.tamanho === modo));
  });
  $("nota-tamanho").textContent = NOTAS_TAMANHO[modo];
  if (estacionadoEm && nivel === solar) {
    const { corpo } = estacionadoEm;
    const distancia = Math.max(camera.position.distanceTo(corpo.posicao), corpo.distanciaChegada);
    camera.position.sub(corpo.posicao).setLength(distancia).add(corpo.posicao);
    olharPara(corpo.posicao);
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

// ---------- Laço principal ----------

let anterior = performance.now();
let acumuladoInterface = 0;

function quadro(agora) {
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
  // Para testes automatizados (testes/): expõe o estado só com ?depurar na URL.
  if (parametros.has("depurar")) window.__explorador = { camera, niveis, get nivel() { return nivel; }, progresso };
  requestAnimationFrame((agora) => {
    anterior = agora;
    quadro(agora);
  });
}

iniciar();
