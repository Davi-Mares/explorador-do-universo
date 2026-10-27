// ---------------------------------------------------------------------------
// Céu estrelado animado no fundo de todas as páginas.
// Desenha estrelas piscando (e uma estrela cadente de vez em quando) em um
// <canvas> fixo atrás do conteúdo. Quem prefere menos movimento
// (prefers-reduced-motion) vê o céu parado.
// ---------------------------------------------------------------------------

(() => {
  const AREA_POR_ESTRELA = 3200; // px² — quanto menor, mais estrelas
  const CORES = ["255, 255, 255", "200, 225, 255", "255, 240, 210", "180, 240, 255"];
  const INTERVALO_CADENTE = [4000, 9000]; // ms entre estrelas cadentes

  const movimentoReduzido = window.matchMedia("(prefers-reduced-motion: reduce)");

  const canvas = document.createElement("canvas");
  canvas.className = "ceu-estrelado";
  canvas.setAttribute("aria-hidden", "true");
  const ctx = canvas.getContext("2d");

  let largura = 0;
  let altura = 0;
  let estrelas = [];
  let cadente = null;
  let proximaCadente = 0;

  const aleatorio = (min, max) => min + Math.random() * (max - min);

  function criarEstrela() {
    const grande = Math.random() < 0.08;
    return {
      // Posição em proporção da tela (0 a 1), para sobreviver a redimensionamentos.
      x: Math.random(),
      y: Math.random(),
      raio: grande ? aleatorio(1.2, 2) : aleatorio(0.3, 1.1),
      cor: CORES[Math.floor(Math.random() * CORES.length)],
      brilhoBase: aleatorio(0.35, 0.85),
      fase: Math.random() * Math.PI * 2,
      velocidade: aleatorio(0.6, 2.4), // ciclos de piscar por ~6 s
      grande
    };
  }

  function redimensionar() {
    const escala = window.devicePixelRatio || 1;
    largura = window.innerWidth;
    altura = window.innerHeight;

    canvas.width = largura * escala;
    canvas.height = altura * escala;
    ctx.setTransform(escala, 0, 0, escala, 0, 0);

    // Só recria o céu se a quantidade ideal mudar bastante (ex.: girar o
    // celular), e não quando a barra de endereço do navegador some ao rolar.
    const quantidade = Math.round((largura * altura) / AREA_POR_ESTRELA);
    if (Math.abs(quantidade - estrelas.length) > quantidade * 0.25) {
      estrelas = Array.from({ length: quantidade }, criarEstrela);
    }

    if (movimentoReduzido.matches) desenhar(0);
  }

  function desenharEstrela(estrela, tempo) {
    const x = estrela.x * largura;
    const y = estrela.y * altura;
    const piscar = Math.sin(tempo * 0.001 * estrela.velocidade + estrela.fase);
    const opacidade = Math.max(0.05, estrela.brilhoBase + piscar * 0.35);

    if (estrela.grande) {
      const halo = ctx.createRadialGradient(x, y, 0, x, y, estrela.raio * 5);
      halo.addColorStop(0, `rgba(${estrela.cor}, ${opacidade * 0.5})`);
      halo.addColorStop(1, `rgba(${estrela.cor}, 0)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, estrela.raio * 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = `rgba(${estrela.cor}, ${opacidade})`;
    ctx.beginPath();
    ctx.arc(x, y, estrela.raio, 0, Math.PI * 2);
    ctx.fill();
  }

  function lancarCadente(tempo) {
    const angulo = aleatorio(0.35, 0.7); // inclinação para baixo e à direita
    const velocidade = aleatorio(0.6, 1.1); // px por ms
    cadente = {
      x: aleatorio(0, largura * 0.7),
      y: aleatorio(0, altura * 0.4),
      vx: Math.cos(angulo) * velocidade,
      vy: Math.sin(angulo) * velocidade,
      inicio: tempo,
      duracao: aleatorio(700, 1200)
    };
    proximaCadente = tempo + aleatorio(...INTERVALO_CADENTE);
  }

  function desenharCadente(tempo) {
    const progresso = (tempo - cadente.inicio) / cadente.duracao;
    if (progresso >= 1) {
      cadente = null;
      return;
    }

    const decorrido = tempo - cadente.inicio;
    const x = cadente.x + cadente.vx * decorrido;
    const y = cadente.y + cadente.vy * decorrido;
    const cauda = 90;
    const opacidade = Math.sin(progresso * Math.PI); // acende e apaga

    const rastro = ctx.createLinearGradient(x, y, x - cadente.vx * cauda, y - cadente.vy * cauda);
    rastro.addColorStop(0, `rgba(255, 255, 255, ${opacidade})`);
    rastro.addColorStop(1, "rgba(255, 255, 255, 0)");

    ctx.strokeStyle = rastro;
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - cadente.vx * cauda, y - cadente.vy * cauda);
    ctx.stroke();
  }

  function desenhar(tempo) {
    ctx.clearRect(0, 0, largura, altura);
    estrelas.forEach((estrela) => desenharEstrela(estrela, tempo));

    if (movimentoReduzido.matches) return;

    if (!cadente && tempo >= proximaCadente) lancarCadente(tempo);
    if (cadente) desenharCadente(tempo);
  }

  function animar(tempo) {
    if (movimentoReduzido.matches) return;
    desenhar(tempo);
    requestAnimationFrame(animar);
  }

  function iniciar() {
    document.body.prepend(canvas);
    redimensionar();
    proximaCadente = performance.now() + aleatorio(...INTERVALO_CADENTE);
    requestAnimationFrame(animar);
  }

  let esperaRedimensionar;
  window.addEventListener("resize", () => {
    clearTimeout(esperaRedimensionar);
    esperaRedimensionar = setTimeout(redimensionar, 150);
  });

  // Se o usuário mudar a preferência com a página aberta, segue a nova.
  movimentoReduzido.addEventListener("change", () => {
    if (movimentoReduzido.matches) desenhar(0);
    else requestAnimationFrame(animar);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
