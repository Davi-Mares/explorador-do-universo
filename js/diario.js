// ---------------------------------------------------------------------------
// Diário de bordo — a base de conhecimento do Explorador do Universo.
// Mostra os verbetes desbloqueados (com distâncias reais calculadas e ficha
// técnica), as missões e os desafios. Usa o mesmo progresso do explorador.
// ---------------------------------------------------------------------------

import * as astro from "./explorador/astronomia.js";
import {
  NIVEIS, SOL, PLANETAS, LUA, VOYAGER, ESTRELAS, OBJETOS_GALAXIA, MISSOES, PERGUNTAS, GALAXIA,
  TODOS_OS_OBJETOS, perguntaDoObjeto, corDaEstrela
} from "./explorador/catalogo.js";
import * as progresso from "./explorador/progresso.js";

const $ = (id) => document.getElementById(id);

function escapar(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- Distância real de cada verbete ----------

/** { km, rotulo }: a distância mostrada no verbete e a referência dela. */
function distanciaDoObjeto(objeto) {
  const kmPorKly = 1000 * astro.KM_POR_ANO_LUZ;
  if (objeto.id === "sol") return { km: astro.KM_POR_UA, rotulo: "da Terra" };
  if (objeto.id === "lua") return { km: LUA.distanciaMediaKm, rotulo: "da Terra" };
  if (objeto.id === "voyager") {
    const p = astro.posicaoSondaHeliocentrica(VOYAGER, new Date());
    return { km: Math.hypot(p.x, p.y, p.z) * astro.KM_POR_UA, rotulo: "do Sol, hoje" };
  }
  if (objeto.orbita) return { km: objeto.orbita.elementos.a * astro.KM_POR_UA, rotulo: "do Sol" };
  if (objeto.anosLuz) return { km: objeto.anosLuz * astro.KM_POR_ANO_LUZ, rotulo: "do Sol" };
  if (objeto.id === "sol-galaxia") return { km: GALAXIA.distanciaSolCentroKly * kmPorKly, rotulo: "do centro da galáxia" };
  if (objeto.id === "sgr-a") return { km: GALAXIA.distanciaSolCentroKly * kmPorKly, rotulo: "do Sol" };
  if (objeto.d) return { km: objeto.d * kmPorKly, rotulo: "do Sol" };
  return null;
}

const GRUPOS = [
  { nivel: "solar", objetos: [SOL, ...PLANETAS, LUA, VOYAGER] },
  { nivel: "estrelas", objetos: ESTRELAS },
  { nivel: "galaxia", objetos: OBJETOS_GALAXIA }
];

function imagem(objeto) {
  if (objeto.imagem) return `<img src="${objeto.imagem}" alt="" loading="lazy">`;
  const cor = objeto.espectro ? corDaEstrela(objeto) : objeto.cor || "#cfe0ff";
  return `<span class="orbe" style="--cor:${cor}" aria-hidden="true"></span>`;
}

function verbete(objeto, nivel) {
  const distancia = distanciaDoObjeto(objeto);
  const pergunta = perguntaDoObjeto(objeto.id);
  const resposta = pergunta ? progresso.obterEstado().respostas[pergunta.id] : null;

  const dados = distancia ? `
    <dl class="verbete-dados">
      <div><dt>Distância ${escapar(distancia.rotulo)}</dt><dd>${astro.formatarDistancia(distancia.km)}</dd></div>
      <div><dt>A luz leva</dt><dd>${astro.formatarDuracao(distancia.km / astro.VELOCIDADE_LUZ_KM_S)}</dd></div>
    </dl>` : "";

  const ficha = objeto.ficha ? `
    <details class="ficha">
      <summary>Ficha técnica e saiba mais</summary>
      <p>${escapar(objeto.saibaMais)}</p>
      <table>${objeto.ficha.map(([campo, valor]) => `<tr><th scope="row">${escapar(campo)}</th><td>${escapar(valor)}</td></tr>`).join("")}</table>
      <p class="fonte">Fonte: <a href="${objeto.fonte}" target="_blank" rel="noopener noreferrer">NASA</a></p>
    </details>` : "";

  const desafio = !pergunta ? "" : resposta
    ? `<button type="button" class="link-botao ${resposta.correta ? "certo" : "errado"}" data-quiz="${pergunta.id}">${resposta.correta ? "✅ Desafio certo" : "❌ Desafio errado"} · ver explicação</button>`
    : `<button type="button" class="botao botao-pequeno botao-principal" data-quiz="${pergunta.id}">🧠 Responder desafio</button>`;

  return `
    <article class="verbete" id="${objeto.id}">
      ${imagem(objeto)}
      <div class="verbete-corpo">
        <h3>${escapar(objeto.nome)}</h3>
        <p class="verbete-tipo">${escapar(objeto.tipo || "")}</p>
        <p>${escapar(objeto.resumo)}</p>
        <p class="verbete-curiosidade">💡 ${escapar(objeto.curiosidade)}</p>
        ${dados}
        ${ficha}
        <div class="verbete-acoes">
          ${desafio}
          <a href="explorador.html?nivel=${nivel.id}&alvo=${objeto.id}">🚀 Ver no Explorador</a>
        </div>
      </div>
    </article>`;
}

function montarVerbetes() {
  $("verbetes").innerHTML = GRUPOS.map(({ nivel: idNivel, objetos }) => {
    const nivel = NIVEIS.find((n) => n.id === idNivel);
    const descobertos = objetos.filter((o) => progresso.foiDescoberto(o.id));
    const faltam = objetos.filter((o) => !progresso.foiDescoberto(o.id));
    const cartoes = descobertos.length
      ? `<div class="grade-verbetes">${descobertos.map((o) => verbete(o, nivel)).join("")}</div>`
      : "";
    const pendentes = faltam.length
      ? `<p class="faltam">Faltam ${faltam.length} — <a href="explorador.html?nivel=${idNivel}">descobrir no Explorador</a></p>`
      : "";
    return `
      <section aria-labelledby="grupo-${idNivel}">
        <h2 id="grupo-${idNivel}">${nivel.icone} ${escapar(nivel.nome)} <span class="contagem">${descobertos.length}/${objetos.length}</span></h2>
        ${cartoes}
        ${pendentes}
      </section>`;
  }).join("");
}

function montarResumo() {
  const r = progresso.resumo();
  $("resumo").textContent = `✨ ${r.descobertos} de ${r.totalObjetos} astros · 🏅 ${r.missoes} de ${r.totalMissoes} missões · 🧠 ${r.acertos} de ${PERGUNTAS.length} desafios certos`;
}

function montarMissoes() {
  const feitas = MISSOES.filter((m) => progresso.missaoConcluida(m.id)).length;
  $("contagem-missoes").textContent = `(${feitas}/${MISSOES.length})`;
  $("missoes").innerHTML = MISSOES.map((missao) => {
    const feita = progresso.missaoConcluida(missao.id);
    return `<li class="${feita ? "feita" : ""}"><span aria-hidden="true">${feita ? "🏅" : "○"}</span> <strong>${escapar(missao.nome)}</strong> — ${escapar(missao.objetivo)}</li>`;
  }).join("");
}

function montarTudo() {
  montarResumo();
  montarVerbetes();
  montarMissoes();
}

// ---------- Desafios (quiz) ----------

function abrirQuiz(idPergunta) {
  const pergunta = PERGUNTAS.find((p) => p.id === idPergunta);
  if (!pergunta) return;
  const objeto = TODOS_OS_OBJETOS.find((o) => o.id === pergunta.objeto);
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

// ---------- Exportar e recomeçar ----------

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
