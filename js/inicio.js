// ---------------------------------------------------------------------------
// Explorador do Universo — página inicial.
// Liga o fundo 3D (a Terra vista da órbita, com o Sol nascendo), o topo que
// fica sólido ao rolar, os números da base de conhecimento e as animações de
// entrada dos cartões. Sem WebGL (ou sem internet para o three.js), o fundo
// fica num horizonte desenhado só com CSS.
// ---------------------------------------------------------------------------

import { resumo } from "./explorador/progresso.js";
import { TODOS_OS_OBJETOS, ESTRELAS, MISSOES } from "./explorador/catalogo.js";

const $ = (id) => document.getElementById(id);
const movimentoReduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const telaPequena = Math.min(window.innerWidth, window.innerHeight) < 600;

// Progresso do Diário de bordo.
const r = resumo();
$("progresso").textContent = r.descobertos
  ? `Você já descobriu ${r.descobertos} de ${r.totalObjetos} astros.`
  : `${r.totalObjetos} astros esperando para serem descobertos.`;

// Números da base de conhecimento (sempre os do catálogo).
$("numero-astros").textContent = TODOS_OS_OBJETOS.length;
$("numero-estrelas").textContent = ESTRELAS.length;
$("numero-missoes").textContent = MISSOES.length;

// Os cartões aparecem ao rolar até eles.
const revelar = document.querySelectorAll(".revelar");
if ("IntersectionObserver" in window && !movimentoReduzido) {
  document.documentElement.classList.add("com-revelar");
  const observador = new IntersectionObserver((entradas) => {
    for (const entrada of entradas) {
      if (!entrada.isIntersecting) continue;
      entrada.target.classList.add("visivel");
      observador.unobserve(entrada.target);
    }
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
  revelar.forEach((elemento) => observador.observe(elemento));
}

// Fundo: a Terra.
let fundo = null;
function aoRolar() {
  const fracao = Math.min(1, window.scrollY / window.innerHeight);
  document.body.classList.toggle("rolou", window.scrollY > 24);
  document.body.style.setProperty("--rolagem", fracao.toFixed(3));
  fundo?.definirRolagem(fracao);
}
window.addEventListener("scroll", aoRolar, { passive: true });
aoRolar();

try {
  const { iniciarTerraDeFundo } = await import("./inicio-terra.js");
  fundo = iniciarTerraDeFundo($("fundo-terra"), { movimentoReduzido, telaPequena });
  await fundo.pronta;
  aoRolar();
  document.body.classList.add("terra-pronta");
} catch (erro) {
  console.warn("Fundo 3D indisponível; fica o horizonte em CSS.", erro);
  document.body.classList.add("sem-terra");
}
