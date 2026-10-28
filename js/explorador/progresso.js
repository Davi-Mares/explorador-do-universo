// ---------------------------------------------------------------------------
// Explorador do Universo — progresso do estudante (Diário de bordo).
// Guarda descobertas, respostas do quiz, missões e estatísticas no
// localStorage do navegador. Tudo fica no aparelho da pessoa: não há
// cadastro nem envio de dados (importante para uso com crianças).
// ---------------------------------------------------------------------------

import { MISSOES, TODOS_OS_OBJETOS } from "./catalogo.js";

const CHAVE = "wikiUniverso:explorador:v1";
const ouvintes = new Set();

function estadoInicial() {
  return {
    versao: 1,
    criadoEm: new Date().toISOString(),
    descobertas: {},      // id do objeto → data ISO
    respostas: {},        // id da pergunta → { correta, escolha, em }
    missoes: {},          // id da missão → data ISO
    niveis: {},           // id do nível → data ISO da primeira visita
    viagens: [],          // últimas chegadas voando: { alvo, origem, velocidade, segundos, km, em }
    estatisticas: { kmPercorridos: 0, segundosDeVoo: 0, saltos: 0 }
  };
}

let estado = carregar();

function carregar() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE));
    if (salvo && salvo.versao === 1) return { ...estadoInicial(), ...salvo };
  } catch {
    // localStorage bloqueado (modo privado) ou dado corrompido: começa do zero.
  }
  return estadoInicial();
}

let salvarAgendado = null;
function salvar(imediato = false) {
  const gravar = () => {
    salvarAgendado = null;
    try {
      localStorage.setItem(CHAVE, JSON.stringify(estado));
    } catch {
      // Sem armazenamento: o progresso vale só enquanto a página estiver aberta.
    }
  };
  if (imediato) return gravar();
  if (!salvarAgendado) salvarAgendado = setTimeout(gravar, 800);
}

function avisar(evento) {
  for (const ouvinte of ouvintes) ouvinte(evento, estado);
}

// Salva antes de fechar a aba (as estatísticas de voo são gravadas com atraso).
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => salvar(true));
  // Outra aba (ex.: o Diário aberto ao lado) mudou o progresso.
  window.addEventListener("storage", (evento) => {
    if (evento.key !== CHAVE) return;
    estado = carregar();
    avisar({ tipo: "sincronizado" });
  });
}

// ---------- Leitura ----------

export function obterEstado() {
  return estado;
}

export function foiDescoberto(id) {
  return Boolean(estado.descobertas[id]);
}

export function missaoConcluida(id) {
  return Boolean(estado.missoes[id]);
}

export function totalDeAcertos() {
  return Object.values(estado.respostas).filter((r) => r.correta).length;
}

export function resumo() {
  return {
    descobertos: Object.keys(estado.descobertas).length,
    totalObjetos: TODOS_OS_OBJETOS.length,
    missoes: Object.keys(estado.missoes).length,
    totalMissoes: MISSOES.length,
    acertos: totalDeAcertos(),
    respondidas: Object.keys(estado.respostas).length
  };
}

/** Assina mudanças: o callback recebe (evento, estado). Devolve "cancelar". */
export function aoMudar(callback) {
  ouvintes.add(callback);
  return () => ouvintes.delete(callback);
}

// ---------- Missões ----------

function condicaoCumprida(missao, evento) {
  const c = missao.condicao;
  switch (c.tipo) {
    case "descobrir":
      return c.ids.every((id) => estado.descobertas[id]);
    case "niveis":
      return c.ids.every((id) => estado.niveis[id]);
    case "acertos":
      return totalDeAcertos() >= c.minimo;
    case "viagem":
      return Boolean(evento && evento.tipo === "chegada" && !evento.salto
        && evento.alvo === c.alvo
        && (!c.origem || evento.origem === c.origem)
        && (!c.velocidade || (evento.velocidade === c.velocidade && !evento.trocouVelocidade)));
    default:
      return false;
  }
}

function verificarMissoes(evento) {
  const novas = [];
  for (const missao of MISSOES) {
    if (estado.missoes[missao.id]) continue;
    if (condicaoCumprida(missao, evento)) {
      estado.missoes[missao.id] = new Date().toISOString();
      novas.push(missao);
    }
  }
  for (const missao of novas) avisar({ tipo: "missao", missao });
  return novas;
}

// ---------- Escrita ----------

export function registrarDescoberta(id) {
  if (estado.descobertas[id]) return false;
  estado.descobertas[id] = new Date().toISOString();
  salvar(true);
  avisar({ tipo: "descoberta", id });
  verificarMissoes({ tipo: "descoberta", id });
  salvar(true);
  return true;
}

export function registrarResposta(idPergunta, escolha, correta) {
  if (estado.respostas[idPergunta]) return false; // vale a primeira tentativa
  estado.respostas[idPergunta] = { escolha, correta, em: new Date().toISOString() };
  avisar({ tipo: "resposta", idPergunta, correta });
  verificarMissoes({ tipo: "resposta" });
  salvar(true);
  return true;
}

export function registrarNivel(id) {
  if (estado.niveis[id]) return;
  estado.niveis[id] = new Date().toISOString();
  verificarMissoes({ tipo: "nivel", id });
  salvar(true);
}

/** Chegada a um destino. viagem = { alvo, origem, velocidade, trocouVelocidade, salto, segundos, km }. */
export function registrarChegada(viagem) {
  if (viagem.salto) {
    estado.estatisticas.saltos++;
  } else {
    estado.viagens = [{ ...viagem, em: new Date().toISOString() }, ...estado.viagens].slice(0, 20);
  }
  verificarMissoes({ tipo: "chegada", ...viagem });
  salvar(true);
}

export function somarVoo(km, segundos) {
  estado.estatisticas.kmPercorridos += km;
  estado.estatisticas.segundosDeVoo += segundos;
  salvar();
}

export function zerarProgresso() {
  estado = estadoInicial();
  salvar(true);
  avisar({ tipo: "zerado" });
}

export function exportarJson() {
  return JSON.stringify({ ...estado, exportadoEm: new Date().toISOString() }, null, 2);
}
