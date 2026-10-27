// ---------------------------------------------------------------------------
// Viagem da luz — simula um fóton saindo do Sol a 299.792 km/s e marca a
// chegada em cada planeta. As distâncias vêm de CORPOS_CELESTES (dados.js).
// Usado só por viagem-da-luz.html.
// ---------------------------------------------------------------------------

(() => {
  const VELOCIDADE_DA_LUZ = 299792.458; // km/s
  const KM_POR_UA = 149597870.7;
  const VOLTA_NA_TERRA = 40075; // km (circunferência no equador)

  // Duas escalas: a interna mostra os rochosos separados; a completa vai até
  // Netuno (nela, Mercúrio, Vênus, Terra e Marte ficam quase colados no Sol).
  const TRILHAS = [
    { titulo: "Sistema Solar interno (até Marte)", maxUA: 1.6 },
    { titulo: "Sistema Solar inteiro (até Netuno)", maxUA: 31 }
  ];

  const CURIOSIDADES = {
    "Mercúrio": "Mesmo o planeta mais próximo já ficou 3 minutos para trás. Do Sol até aqui, a luz não para em nada no caminho.",
    "Vênus": "Vênus brilha tanto no céu porque reflete muito bem essa luz do Sol que acabou de chegar.",
    "Terra": "Chegamos em casa! A luz do Sol que você vê agora saiu de lá há uns 8 minutos — se o Sol sumisse, só perceberíamos depois disso.",
    "Marte": "Por causa dessa demora, um comando enviado da Terra para um robô em Marte leva de 3 a 22 minutos para chegar.",
    "Júpiter": "Foi observando as luas de Júpiter, em 1676, que Ole Rømer percebeu pela primeira vez que a luz tem velocidade finita.",
    "Saturno": "Mais de uma hora de viagem: as fotos da sonda Cassini levavam esse tempo para chegar até a Terra.",
    "Urano": "Mais de 2 horas e meia viajando a 300 mil km por segundo — e ainda faltam quase 1,5 hora até Netuno.",
    "Netuno": "Fim da viagem pelos planetas: cerca de 4 horas. Até a estrela mais próxima (Proxima Centauri), a luz levaria mais 4,2 anos!"
  };

  const planetas = CORPOS_CELESTES.filter((corpo) => corpo.distanciaUA).map((corpo) => ({
    ...corpo,
    tempoLuz: (corpo.distanciaUA * KM_POR_UA) / VELOCIDADE_DA_LUZ, // segundos
    chegou: false
  }));
  const tempoFinal = planetas[planetas.length - 1].tempoLuz;

  let tempoSimulado = 0; // segundos "de luz" desde a partida
  let rodando = false;
  let ultimoQuadro = null;
  let multiplicador = 60;

  const el = {};

  // ---------- Formatação ----------

  function formatarDuracao(segundos) {
    const total = Math.floor(segundos);
    const h = Math.floor(total / 3600);
    const min = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h) return `${h} h ${String(min).padStart(2, "0")} min`;
    if (min) return `${min} min ${String(s).padStart(2, "0")} s`;
    return `${s} s`;
  }

  function formatarDistancia(km) {
    if (km >= 1e9) return `${(km / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} bilhões de km`;
    if (km >= 1e6) return `${(km / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} milhões de km`;
    return `${Math.round(km).toLocaleString("pt-BR")} km`;
  }

  // ---------- Montagem ----------

  function montarTrilhas() {
    el.trilhas.innerHTML = TRILHAS.map((trilha, i) => {
      const marcadores = planetas
        .filter((p) => p.distanciaUA <= trilha.maxUA)
        .map((p, j) => {
          const posicao = (p.distanciaUA / trilha.maxUA) * 100;
          // Planetas colados no Sol (na escala completa) ficam só com o ponto;
          // os rótulos alternam acima/abaixo da linha para não se encostarem.
          const rotulo = posicao > 8 ? `<span class="${j % 2 ? "rotulo-acima" : ""}">${p.nome}</span>` : "";
          return `
          <div class="marcador" style="--posicao: ${posicao}%" data-planeta="${p.nome}" title="${p.nome}">
            <img src="${p.imagem}" alt="" loading="lazy">
            ${rotulo}
          </div>`;
        })
        .join("");

      return `
        <div class="trilha" data-max="${trilha.maxUA}">
          <p class="trilha-titulo">${trilha.titulo}</p>
          <div class="trilha-linha">
            <div class="trilha-sol" aria-hidden="true"></div>
            <div class="trilha-percorrida" id="percorrida-${i}"></div>
            ${marcadores}
            <div class="foton" id="foton-${i}" aria-hidden="true"></div>
          </div>
        </div>`;
    }).join("");
  }

  function montarParadas() {
    el.paradas.innerHTML = planetas.map((p) => `
      <li class="parada" data-planeta="${p.nome}">
        <img src="${p.imagem}" alt="" loading="lazy">
        <div>
          <strong>${p.nome}</strong>
          <span>${formatarDistancia(p.distanciaUA * KM_POR_UA)} do Sol</span>
        </div>
        <span class="parada-tempo">${formatarDuracao(p.tempoLuz)}</span>
        <span class="parada-status" aria-label="Ainda não chegou">⏳</span>
      </li>`).join("");
  }

  // ---------- Atualização da tela ----------

  function atualizar() {
    const km = tempoSimulado * VELOCIDADE_DA_LUZ;
    const ua = km / KM_POR_UA;

    el.tempo.textContent = formatarDuracao(tempoSimulado);
    el.distancia.textContent = formatarDistancia(km);
    el.voltas.textContent = `${Math.floor(km / VOLTA_NA_TERRA).toLocaleString("pt-BR")} voltas`;

    TRILHAS.forEach((trilha, i) => {
      const fracao = Math.min(ua / trilha.maxUA, 1);
      document.getElementById(`foton-${i}`).style.setProperty("--progresso", `${fracao * 100}%`);
      document.getElementById(`percorrida-${i}`).style.width = `${fracao * 100}%`;
    });

    planetas.forEach((p) => {
      if (p.chegou || tempoSimulado < p.tempoLuz) return;
      p.chegou = true;
      marcarChegada(p);
    });

    const proximo = planetas.find((p) => !p.chegou);
    el.proxima.textContent = proximo
      ? `${proximo.nome} em ${formatarDuracao(proximo.tempoLuz - tempoSimulado)}`
      : "Chegamos a Netuno! 🎉";
  }

  function marcarChegada(planeta) {
    document.querySelectorAll(`[data-planeta="${planeta.nome}"]`).forEach((item) => item.classList.add("chegou"));
    const status = el.paradas.querySelector(`[data-planeta="${planeta.nome}"] .parada-status`);
    status.textContent = "✅";
    status.setAttribute("aria-label", "Chegou");

    el.curiosidade.innerHTML = `<strong>Chegou a ${planeta.nome} em ${formatarDuracao(planeta.tempoLuz)}.</strong> ${CURIOSIDADES[planeta.nome]}`;
  }

  function reiniciarPlanetas() {
    planetas.forEach((p) => { p.chegou = false; });
    document.querySelectorAll(".chegou").forEach((item) => item.classList.remove("chegou"));
    el.paradas.querySelectorAll(".parada-status").forEach((status) => {
      status.textContent = "⏳";
      status.setAttribute("aria-label", "Ainda não chegou");
    });
  }

  // ---------- Controles ----------

  function quadro(agora) {
    if (!rodando) return;
    if (ultimoQuadro !== null) {
      tempoSimulado += ((agora - ultimoQuadro) / 1000) * multiplicador;
    }
    ultimoQuadro = agora;

    if (tempoSimulado >= tempoFinal) {
      tempoSimulado = tempoFinal;
      atualizar();
      pausar();
      el.iniciar.textContent = "🔁 Viajar de novo";
      return;
    }

    atualizar();
    requestAnimationFrame(quadro);
  }

  function iniciar() {
    if (tempoSimulado >= tempoFinal) recomecar();
    rodando = true;
    ultimoQuadro = null;
    el.iniciar.textContent = "⏸️ Pausar";
    el.iniciar.setAttribute("aria-pressed", "true");
    el.painel.classList.add("em-viagem");
    requestAnimationFrame(quadro);
  }

  function pausar() {
    rodando = false;
    el.iniciar.textContent = "▶️ Continuar";
    el.iniciar.setAttribute("aria-pressed", "false");
    el.painel.classList.remove("em-viagem");
  }

  function recomecar() {
    pausar();
    tempoSimulado = 0;
    reiniciarPlanetas();
    el.iniciar.textContent = "▶️ Partir do Sol";
    el.curiosidade.textContent = "O fóton está no Sol, pronto para partir. Escolha a velocidade da simulação e aperte o play!";
    atualizar();
  }

  document.addEventListener("DOMContentLoaded", () => {
    el.painel = document.querySelector(".viagem-painel");
    if (!el.painel) return;

    el.trilhas = document.getElementById("viagem-trilhas");
    el.paradas = document.getElementById("viagem-paradas");
    el.tempo = document.getElementById("viagem-tempo");
    el.distancia = document.getElementById("viagem-distancia");
    el.voltas = document.getElementById("viagem-voltas");
    el.proxima = document.getElementById("viagem-proxima");
    el.curiosidade = document.getElementById("viagem-curiosidade");
    el.iniciar = document.getElementById("viagem-iniciar");

    montarTrilhas();
    montarParadas();
    recomecar();

    el.iniciar.addEventListener("click", () => (rodando ? pausar() : iniciar()));
    document.getElementById("viagem-reiniciar").addEventListener("click", recomecar);
    document.querySelectorAll('input[name="velocidade"]').forEach((opcao) => {
      if (opcao.checked) multiplicador = Number(opcao.value);
      opcao.addEventListener("change", () => { multiplicador = Number(opcao.value); });
    });
  });
})();
