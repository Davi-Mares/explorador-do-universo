// ---------------------------------------------------------------------------
// Diário de bordo — a base de conhecimento do Explorador do Universo.
// Mostra os verbetes desbloqueados (com distâncias reais calculadas), as
// missões e os desafios. Lê e grava o mesmo progresso do explorador 3D.
// ---------------------------------------------------------------------------

import * as astro from "./explorador/astronomia.js";
import {
  NIVEIS, SOL, PLANETAS, LUA, VOYAGER, ESTRELAS, OBJETOS_GALAXIA, MISSOES, PERGUNTAS, GALAXIA,
  perguntaDoObjeto, corDaEstrela
} from "./explorador/catalogo.js";
import * as progresso from "./explorador/progresso.js";

const $ = (id) => document.getElementById(id);
const VOYAGER_KM_S = 17;
let filtro = "todos";

function escapar(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- Distâncias reais de cada verbete ----------

/** { km, rotulo } — distância usada no verbete e a referência dela. */
function distanciaDoObjeto(objeto) {
  if (objeto.id === "sol") return { km: astro.KM_POR_UA, rotulo: "da Terra" };
  if (objeto.id === "lua") return { km: LUA.distanciaMediaKm, rotulo: "da Terra (em média)" };
  if (objeto.id === "voyager") {
    const p = astro.posicaoSondaHeliocentrica(VOYAGER, new Date());
    return { km: Math.hypot(p.x, p.y, p.z) * astro.KM_POR_UA, rotulo: "do Sol (hoje, aproximada)" };
  }
  if (objeto.orbita) return { km: objeto.orbita.elementos.a * astro.KM_POR_UA, rotulo: "do Sol (em média)" };
  if (objeto.anosLuz) return { km: objeto.anosLuz * astro.KM_POR_ANO_LUZ, rotulo: "do Sol" };
  if (objeto.id === "sol-galaxia") return { km: GALAXIA.distanciaSolCentroKly * 1000 * astro.KM_POR_ANO_LUZ, rotulo: "do centro da galáxia" };
  if (objeto.id === "sgr-a") return { km: GALAXIA.distanciaSolCentroKly * 1000 * astro.KM_POR_ANO_LUZ, rotulo: "do Sol" };
  if (objeto.d) return { km: objeto.d * 1000 * astro.KM_POR_ANO_LUZ, rotulo: "do Sol" };
  return null;
}

const GRUPOS = [
  { nivel: "solar", objetos: [SOL, ...PLANETAS, LUA, VOYAGER] },
  { nivel: "estrelas", objetos: ESTRELAS },
  { nivel: "galaxia", objetos: OBJETOS_GALAXIA }
];

function imagemDoVerbete(objeto) {
  if (objeto.imagem) return `<img src="${objeto.imagem}" alt="" loading="lazy">`;
  const cor = objeto.espectro ? corDaEstrela(objeto) : objeto.cor || "#cfe0ff";
  return `<span class="orbe" style="--cor:${cor}" aria-hidden="true"></span>`;
}

function verbete(objeto, nivel) {
  const descoberto = progresso.foiDescoberto(objeto.id);
  const visivel = filtro === "todos" || (filtro === "descobertos") === descoberto;
  if (!visivel) return "";

  if (!descoberto) {
    return `
      <article class="verbete bloqueado" id="${objeto.id}">
        <span class="orbe orbe-bloqueado" aria-hidden="true">?</span>
        <div class="verbete-corpo">
          <h3>🔒 ${escapar(objeto.nome)}</h3>
          <p class="verbete-tipo">${escapar(objeto.tipo || "")}</p>
          <a class="verbete-link" href="explorador.html?nivel=${nivel.id}&alvo=${objeto.id}">🚀 Ir até lá para descobrir</a>
        </div>
      </article>`;
  }

  const distancia = distanciaDoObjeto(objeto);
  const pergunta = perguntaDoObjeto(objeto.id);
  const resposta = pergunta ? progresso.obterEstado().respostas[pergunta.id] : null;
  const dataDescoberta = new Date(progresso.obterEstado().descobertas[objeto.id]).toLocaleDateString("pt-BR");
  const dados = distancia ? `
    <dl class="verbete-dados">
      <div><dt>Distância ${escapar(distancia.rotulo)}</dt><dd>${astro.formatarDistancia(distancia.km)}</dd></div>
      <div><dt>A luz leva</dt><dd>${astro.formatarDuracao(distancia.km / astro.VELOCIDADE_LUZ_KM_S)}</dd></div>
      <div><dt>A Voyager 1 levaria</dt><dd>${astro.formatarDuracao(distancia.km / VOYAGER_KM_S)}</dd></div>
    </dl>` : "";
  const desafio = pergunta
    ? resposta
      ? `<p class="desafio-feito ${resposta.correta ? "certo" : "errado"}">${resposta.correta ? "✅ Desafio respondido certo" : "❌ Desafio respondido (errou)"}
           <button type="button" class="link-botao" data-quiz="${pergunta.id}">ver explicação</button></p>`
      : `<button type="button" class="btn btn-sm botao-desafio" data-quiz="${pergunta.id}">🧠 Responder desafio</button>`
    : "";

  return `
    <article class="verbete" id="${objeto.id}">
      ${imagemDoVerbete(objeto)}
      <div class="verbete-corpo">
        <h3>${escapar(objeto.nome)}</h3>
        <p class="verbete-tipo">${escapar(objeto.tipo || "")}${objeto.espectro ? ` · classe ${escapar(objeto.espectro)}` : ""}</p>
        <p>${escapar(objeto.resumo)}</p>
        <p class="verbete-curiosidade">💡 ${escapar(objeto.curiosidade)}</p>
        ${dados}
        <div class="verbete-acoes">
          ${desafio}
          <a class="verbete-link" href="explorador.html?nivel=${nivel.id}&alvo=${objeto.id}">🚀 Ver no Explorador</a>
          ${objeto.pagina ? `<a class="verbete-link" href="${objeto.pagina}">📖 Ler mais na Biblioteca</a>` : ""}
        </div>
        <p class="verbete-data">Descoberto em ${dataDescoberta}</p>
      </div>
    </article>`;
}

function montarVerbetes() {
  $("verbetes").innerHTML = GRUPOS.map(({ nivel: idNivel, objetos }) => {
    const nivel = NIVEIS.find((n) => n.id === idNivel);
    const descobertos = objetos.filter((o) => progresso.foiDescoberto(o.id)).length;
    const cartoes = objetos.map((o) => verbete(o, nivel)).join("");
    return `
      <section class="grupo-verbetes" aria-labelledby="grupo-${idNivel}">
        <h2 id="grupo-${idNivel}">${nivel.icone} ${escapar(nivel.nome)} <span class="contagem">${descobertos}/${objetos.length}</span></h2>
        ${cartoes ? `<div class="grade-verbetes">${cartoes}</div>` : `<p class="vazio">Nada para mostrar com este filtro.</p>`}
      </section>`;
  }).join("");
}

function montarEstatisticas() {
  const r = progresso.resumo();
  const e = progresso.obterEstado().estatisticas;
  const itens = [
    ["✨", `${r.descobertos}/${r.totalObjetos}`, "astros descobertos"],
    ["🏅", `${r.missoes}/${r.totalMissoes}`, "missões cumpridas"],
    ["🧠", `${r.acertos}/${PERGUNTAS.length}`, "desafios acertados"],
    ["🛰️", astro.formatarDistancia(e.kmPercorridos), "percorridos voando"],
    ["⏱️", astro.formatarDuracao(e.segundosDeVoo), "de voo"],
    ["⚡", String(e.saltos), e.saltos === 1 ? "salto" : "saltos"]
  ];
  $("estatisticas").innerHTML = itens.map(([icone, valor, rotulo]) => `
    <li><span class="icone" aria-hidden="true">${icone}</span><strong>${valor}</strong><span>${rotulo}</span></li>`).join("");
}

function montarMissoes() {
  $("missoes").innerHTML = MISSOES.map((missao) => {
    const feita = progresso.missaoConcluida(missao.id);
    return `
      <li class="${feita ? "feita" : ""}">
        <span aria-hidden="true">${feita ? "🏅" : "○"}</span>
        <div><strong>${escapar(missao.nome)}</strong> — ${escapar(missao.objetivo)}
          ${feita ? "" : `<br><small>💡 ${escapar(missao.dica)}</small>`}</div>
      </li>`;
  }).join("");
}

function montarTudo() {
  montarEstatisticas();
  montarMissoes();
  montarVerbetes();
}

// ---------- Quiz ----------

function abrirQuiz(idPergunta) {
  const pergunta = PERGUNTAS.find((p) => p.id === idPergunta);
  if (!pergunta) return;
  const objeto = [SOL, ...PLANETAS, LUA, VOYAGER, ...ESTRELAS, ...OBJETOS_GALAXIA].find((o) => o.id === pergunta.objeto);
  const opcoes = $("quiz-opcoes");
  const explicacao = $("quiz-explicacao");
  $("quiz-selo").textContent = `🧠 Desafio · ${objeto?.nome || ""}`;
  $("quiz-pergunta").textContent = pergunta.pergunta;
  explicacao.hidden = true;
  opcoes.innerHTML = "";

  const mostrar = (escolha) => {
    [...opcoes.children].forEach((botao, i) => {
      botao.disabled = true;
      botao.classList.toggle("certa", i === pergunta.certa);
      botao.classList.toggle("errada", i === escolha && i !== pergunta.certa);
    });
    explicacao.innerHTML = `<strong>${escolha === pergunta.certa ? "✅ Isso mesmo!" : "❌ Quase!"}</strong> ${escapar(pergunta.explicacao)}`;
    explicacao.hidden = false;
  };

  pergunta.opcoes.forEach((texto, i) => {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "quiz-opcao";
    botao.textContent = texto;
    botao.addEventListener("click", () => {
      progresso.registrarResposta(pergunta.id, i, i === pergunta.certa);
      mostrar(i);
    });
    opcoes.append(botao);
  });
  const anterior = progresso.obterEstado().respostas[pergunta.id];
  if (anterior) mostrar(anterior.escolha);
  $("dialogo-quiz").showModal();
}

$("dialogo-quiz").addEventListener("close", montarTudo);

document.addEventListener("click", (evento) => {
  const botao = evento.target.closest("[data-quiz]");
  if (botao) abrirQuiz(botao.dataset.quiz);
});

// ---------- Filtros e dados ----------

document.querySelectorAll(".filtro").forEach((botao) => {
  botao.addEventListener("click", () => {
    filtro = botao.dataset.filtro;
    document.querySelectorAll(".filtro").forEach((b) => b.setAttribute("aria-pressed", String(b === botao)));
    montarVerbetes();
  });
});

$("botao-exportar").addEventListener("click", () => {
  const blob = new Blob([progresso.exportarJson()], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `diario-de-bordo-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});

$("botao-zerar").addEventListener("click", () => {
  if (window.confirm("Apagar todas as descobertas, missões e respostas deste navegador? Isso não pode ser desfeito.")) {
    progresso.zerarProgresso();
    montarTudo();
  }
});

progresso.aoMudar((evento) => {
  if (evento.tipo === "sincronizado") montarTudo();
});

montarTudo();

// Abre direto no verbete pedido (ex.: diario.html#marte).
if (window.location.hash) {
  requestAnimationFrame(() => document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "center" }));
}
