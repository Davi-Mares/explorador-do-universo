// ---------------------------------------------------------------------------
// Constelações — desenha cada constelação em SVG a partir das coordenadas
// reais das estrelas (ascensão reta em horas e declinação em graus), com o
// norte para cima e o leste para a esquerda, como num mapa do céu.
// O tamanho de cada estrela segue o brilho (magnitude: menor = mais brilhante).
// Usado só por constelacoes.html.
// ---------------------------------------------------------------------------

// estrela: [nome, ascensão reta (h), declinação (°), magnitude]
// linhas: pares de índices das estrelas que formam o desenho
const CONSTELACOES = [
  {
    nome: "Cruzeiro do Sul",
    latim: "Crux",
    quando: "O ano todo no Sul do Brasil; melhor de abril a julho, à noite",
    texto: "A menor das 88 constelações e a mais famosa do Hemisfério Sul. Está na bandeira do Brasil, e prolongar o braço maior da cruz cerca de 4,5 vezes leva ao polo sul celeste — usado por navegadores para achar o Sul.",
    estrelas: [
      ["Acrux (Estrela de Magalhães)", 12.443, -63.10, 0.8],
      ["Mimosa", 12.795, -59.69, 1.25],
      ["Gacrux", 12.519, -57.11, 1.6],
      ["Imai (Pálida)", 12.252, -58.75, 2.8],
      ["Intrometida", 12.356, -60.40, 3.6]
    ],
    linhas: [[0, 2], [1, 3]]
  },
  {
    nome: "Órion",
    latim: "Orion",
    quando: "Dezembro a março, no céu de verão",
    texto: "O caçador da mitologia grega. As “Três Marias” do céu brasileiro são o cinturão dele. Betelgeuse, no ombro, é uma supergigante vermelha; Rigel, no pé, uma supergigante azul. Logo abaixo do cinturão fica a Nebulosa de Órion, um berçário de estrelas.",
    estrelas: [
      ["Betelgeuse", 5.919, 7.41, 0.5],
      ["Rigel", 5.242, -8.20, 0.13],
      ["Bellatrix", 5.419, 6.35, 1.6],
      ["Saiph", 5.796, -9.67, 2.1],
      ["Alnitak", 5.679, -1.94, 1.8],
      ["Alnilam", 5.604, -1.20, 1.7],
      ["Mintaka", 5.533, -0.30, 2.2],
      ["Meissa", 5.585, 9.93, 3.4]
    ],
    linhas: [[7, 0], [7, 2], [0, 4], [2, 6], [6, 5], [5, 4], [4, 3], [6, 1]]
  },
  {
    nome: "Escorpião",
    latim: "Scorpius",
    quando: "Junho a agosto, no céu de inverno",
    texto: "Um dos poucos desenhos que realmente parecem o que representam. Seu coração é Antares, supergigante vermelha cujo nome significa “rival de Marte”, por causa da cor. O Escorpião também aparece na bandeira do Brasil.",
    estrelas: [
      ["Acrab", 16.090, -19.81, 2.6],
      ["Dschubba", 16.006, -22.62, 2.3],
      ["Fang", 15.981, -26.11, 2.9],
      ["Alniyat (σ)", 16.353, -25.59, 2.9],
      ["Antares", 16.490, -26.43, 1.0],
      ["Paikauhale (τ)", 16.598, -28.22, 2.8],
      ["Larawag (ε)", 16.836, -34.29, 2.3],
      ["Xamidimura (μ)", 16.864, -38.05, 3.0],
      ["ζ Scorpii", 16.910, -42.36, 3.6],
      ["η Scorpii", 17.203, -43.24, 3.3],
      ["Sargas", 17.622, -43.00, 1.9],
      ["ι Scorpii", 17.793, -40.13, 3.0],
      ["Girtab (κ)", 17.708, -39.03, 2.4],
      ["Shaula", 17.560, -37.10, 1.6]
    ],
    linhas: [[0, 1], [1, 2], [1, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 13]]
  },
  {
    nome: "Leão",
    latim: "Leo",
    quando: "Março a maio, ao anoitecer",
    texto: "A cabeça do leão forma uma “foice” (ou um ponto de interrogação ao contrário) que termina em Regulus, uma estrela quase em cima da eclíptica, o caminho que o Sol e os planetas fazem no céu. Em novembro, a chuva de meteoros Leônidas parece sair desta região.",
    estrelas: [
      ["Regulus", 10.140, 11.97, 1.4],
      ["η Leonis", 10.122, 16.76, 3.5],
      ["Algieba", 10.333, 19.84, 2.0],
      ["Adhafera", 10.278, 23.42, 3.4],
      ["Rasalas", 9.880, 26.01, 3.9],
      ["ε Leonis", 9.764, 23.77, 3.0],
      ["Zosma", 11.235, 20.52, 2.6],
      ["Denebola", 11.818, 14.57, 2.1],
      ["Chertan", 11.237, 15.43, 3.3]
    ],
    linhas: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2, 6], [6, 7], [7, 8], [8, 0], [6, 8]]
  },
  {
    nome: "Ursa Maior",
    latim: "Ursa Major",
    quando: "Abril a junho, baixa no horizonte norte (melhor no Norte e Nordeste do Brasil)",
    texto: "Suas sete estrelas mais brilhantes formam o “Grande Carro”, ou “Grande Concha”. Dubhe e Merak apontam para a Estrela Polar, que mostra o Norte. Mizar, no cabo, tem uma companheira próxima, Alcor, que era usada como teste de visão.",
    estrelas: [
      ["Dubhe", 11.062, 61.75, 1.8],
      ["Merak", 11.031, 56.38, 2.4],
      ["Phecda", 11.897, 53.69, 2.4],
      ["Megrez", 12.257, 57.03, 3.3],
      ["Alioth", 12.900, 55.96, 1.8],
      ["Mizar", 13.399, 54.93, 2.2],
      ["Alkaid", 13.792, 49.31, 1.9]
    ],
    linhas: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]]
  },
  {
    nome: "Cassiopeia",
    latim: "Cassiopeia",
    quando: "Outubro a dezembro, rente ao horizonte norte (difícil de ver no Brasil)",
    texto: "A rainha vaidosa da mitologia grega, presa no céu sentada em seu trono. Suas cinco estrelas principais formam um “W” (ou um “M”, dependendo da hora) muito fácil de reconhecer no Hemisfério Norte.",
    estrelas: [
      ["Caph", 0.153, 59.15, 2.3],
      ["Schedar", 0.675, 56.54, 2.2],
      ["Navi", 0.945, 60.72, 2.2],
      ["Ruchbah", 1.430, 60.24, 2.7],
      ["Segin", 1.907, 63.67, 3.4]
    ],
    linhas: [[0, 1], [1, 2], [2, 3], [3, 4]]
  }
];

(() => {
  const LARGURA = 300;
  const ALTURA = 240;
  const MARGEM = 34;

  // Projeta (ascensão reta, declinação) num plano: leste à esquerda.
  function projetar(estrelas) {
    const decMedia = estrelas.reduce((soma, e) => soma + e[2], 0) / estrelas.length;
    const fatorRA = Math.cos((decMedia * Math.PI) / 180);
    const brutos = estrelas.map(([, ra, dec]) => ({ x: -ra * 15 * fatorRA, y: -dec }));

    const minX = Math.min(...brutos.map((p) => p.x));
    const maxX = Math.max(...brutos.map((p) => p.x));
    const minY = Math.min(...brutos.map((p) => p.y));
    const maxY = Math.max(...brutos.map((p) => p.y));
    const escala = Math.min((LARGURA - 2 * MARGEM) / (maxX - minX || 1), (ALTURA - 2 * MARGEM) / (maxY - minY || 1));
    const deslocX = (LARGURA - (maxX - minX) * escala) / 2;
    const deslocY = (ALTURA - (maxY - minY) * escala) / 2;

    return brutos.map((p) => ({ x: (p.x - minX) * escala + deslocX, y: (p.y - minY) * escala + deslocY }));
  }

  const raioPelaMagnitude = (magnitude) => Math.max(1.6, 5.2 - magnitude * 1.05);

  function criarSvg(constelacao, indice) {
    const pontos = projetar(constelacao.estrelas);

    const linhas = constelacao.linhas.map(([a, b]) => {
      const comprimento = Math.hypot(pontos[b].x - pontos[a].x, pontos[b].y - pontos[a].y);
      return `<line x1="${pontos[a].x.toFixed(1)}" y1="${pontos[a].y.toFixed(1)}" x2="${pontos[b].x.toFixed(1)}" y2="${pontos[b].y.toFixed(1)}" style="--comprimento: ${comprimento.toFixed(1)}px"/>`;
    }).join("");

    const estrelas = constelacao.estrelas.map(([nome, , , magnitude], i) => {
      const { x, y } = pontos[i];
      return `
        <g class="estrela" tabindex="0" data-nome="${nome}" data-magnitude="${magnitude.toLocaleString("pt-BR")}" style="--brilho-atraso: ${((i * 0.37) % 3).toFixed(2)}s">
          <title>${nome} (magnitude ${magnitude.toLocaleString("pt-BR")})</title>
          <circle class="estrela-halo" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(raioPelaMagnitude(magnitude) * 2.6).toFixed(1)}"/>
          <circle class="estrela-ponto" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${raioPelaMagnitude(magnitude).toFixed(1)}"/>
        </g>`;
    }).join("");

    return `
      <svg viewBox="0 0 ${LARGURA} ${ALTURA}" role="group" aria-labelledby="constelacao-${indice}">
        <g class="linhas-constelacao">${linhas}</g>
        ${estrelas}
      </svg>`;
  }

  function montar() {
    const grade = document.getElementById("grade-constelacoes");
    if (!grade) return;

    grade.innerHTML = CONSTELACOES.map((constelacao, indice) => {
      const principais = [...constelacao.estrelas]
        .sort((a, b) => a[3] - b[3])
        .slice(0, 3)
        .map((estrela) => estrela[0].split(" (")[0])
        .join(", ");

      return `
        <article class="constelacao">
          <div class="constelacao-ceu">
            ${criarSvg(constelacao, indice)}
            <p class="estrela-escolhida" aria-live="polite">✨ Toque ou passe o mouse numa estrela</p>
          </div>
          <div class="constelacao-texto">
            <h2 id="constelacao-${indice}">${constelacao.nome} <span lang="la">(${constelacao.latim})</span></h2>
            <p class="constelacao-quando">🗓️ ${constelacao.quando}</p>
            <p>${constelacao.texto}</p>
            <p class="constelacao-estrelas"><strong>Mais brilhantes:</strong> ${principais}</p>
          </div>
        </article>`;
    }).join("");

    // As linhas se desenham quando o card aparece na tela.
    const observador = new IntersectionObserver((entradas) => {
      entradas.forEach((entrada) => {
        if (!entrada.isIntersecting) return;
        entrada.target.classList.add("desenhada");
        observador.unobserve(entrada.target);
      });
    }, { threshold: 0.35 });
    grade.querySelectorAll(".constelacao").forEach((card) => observador.observe(card));

    // Mostra o nome da estrela embaixo do desenho (mouse, toque ou Tab).
    const mostrarNome = (evento) => {
      const estrela = evento.target.closest(".estrela");
      if (!estrela) return;
      const legenda = estrela.closest(".constelacao").querySelector(".estrela-escolhida");
      legenda.innerHTML = `⭐ <strong>${estrela.dataset.nome}</strong> · magnitude ${estrela.dataset.magnitude}`;
    };
    ["mouseover", "focusin", "click"].forEach((tipo) => grade.addEventListener(tipo, mostrarNome));

    document.getElementById("mostrar-linhas")?.addEventListener("change", (evento) => {
      grade.classList.toggle("sem-linhas", !evento.target.checked);
    });
  }

  document.addEventListener("DOMContentLoaded", montar);
})();
