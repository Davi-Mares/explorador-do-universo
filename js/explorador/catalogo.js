// ---------------------------------------------------------------------------
// Explorador do Universo — catálogo de conhecimento.
// Tudo o que o explorador mostra (astros, estrelas, objetos da galáxia,
// missões e perguntas) fica aqui, separado da lógica da cena 3D. É esta
// "base de conhecimento" que o Diário de bordo vai desbloqueando.
//
// Módulo puro: também é lido pelo script de validação (testes/).
//
// Fontes dos dados (resumo; detalhes em docs/MVP-TCC.md):
// - Órbitas: Standish/JPL, elementos keplerianos aproximados (1800–2050).
// - Raios e períodos: NASA Planetary Fact Sheet.
// - Estrelas: coordenadas J2000 (SIMBAD) e distâncias por paralaxe
//   (Hipparcos/Gaia); distâncias de supergigantes têm incerteza grande.
// - Galáxia: R0 = 8,178 kpc (GRAVITY, 2019); coordenadas galácticas SIMBAD.
// ---------------------------------------------------------------------------

/** Níveis de escala do explorador. "unidadeKm" converte a unidade da cena. */
export const NIVEIS = [
  {
    id: "solar",
    nome: "Sistema Solar",
    icone: "☀️",
    unidade: "UA",
    unidadeKm: 149_597_870.7,
    descricao: "Planetas nas posições reais de hoje, com distâncias reais."
  },
  {
    id: "estrelas",
    nome: "Estrelas vizinhas",
    icone: "✨",
    unidade: "ano-luz",
    unidadeKm: 9_460_730_472_580.8,
    descricao: "As estrelas perto do Sol, nas posições reais, em anos-luz."
  },
  {
    id: "galaxia",
    nome: "Via Láctea",
    icone: "🌌",
    unidade: "mil anos-luz",
    unidadeKm: 9_460_730_472_580.8 * 1000,
    descricao: "Onde o Sol fica na nossa galáxia — e o que existe além dela."
  }
];

/**
 * Velocidades da nave por nível (km/s). As de ficção são marcadas: nada com
 * massa pode viajar na velocidade da luz ou acima dela.
 */
const C = 299_792.458;
export const VELOCIDADES = {
  solar: [
    { id: "carro", nome: "Carro na estrada", kmS: 100 / 3600 },
    { id: "aviao", nome: "Avião comercial", kmS: 900 / 3600 },
    { id: "iss", nome: "Estação Espacial (ISS)", kmS: 7.66 },
    { id: "voyager", nome: "Sonda Voyager 1", kmS: 17 },
    { id: "parker", nome: "Sonda Parker (recorde humano)", kmS: 191.7 },
    { id: "luz", nome: "Velocidade da luz", kmS: C },
    { id: "dobra10", nome: "Dobra 10× (ficção)", kmS: C * 10, ficcao: true },
    { id: "dobra100", nome: "Dobra 100× (ficção)", kmS: C * 100, ficcao: true, padrao: true },
    { id: "dobra1000", nome: "Dobra 1.000× (ficção)", kmS: C * 1e3, ficcao: true },
    { id: "dobra10mil", nome: "Dobra 10 mil× (ficção)", kmS: C * 1e4, ficcao: true }
  ],
  estrelas: [
    { id: "voyager", nome: "Sonda Voyager 1", kmS: 17 },
    { id: "luz", nome: "Velocidade da luz", kmS: C },
    { id: "dobra1mi", nome: "Dobra 1 milhão× (ficção)", kmS: C * 1e6, ficcao: true },
    { id: "dobra10mi", nome: "Dobra 10 milhões× (ficção)", kmS: C * 1e7, ficcao: true, padrao: true },
    { id: "dobra100mi", nome: "Dobra 100 milhões× (ficção)", kmS: C * 1e8, ficcao: true },
    { id: "dobra1bi", nome: "Dobra 1 bilhão× (ficção)", kmS: C * 1e9, ficcao: true }
  ],
  galaxia: [
    { id: "luz", nome: "Velocidade da luz", kmS: C },
    { id: "dobra1bi", nome: "Dobra 1 bilhão× (ficção)", kmS: C * 1e9, ficcao: true },
    { id: "dobra10bi", nome: "Dobra 10 bilhões× (ficção)", kmS: C * 1e10, ficcao: true },
    { id: "dobra100bi", nome: "Dobra 100 bilhões× (ficção)", kmS: C * 1e11, ficcao: true, padrao: true },
    { id: "dobra1tri", nome: "Dobra 1 trilhão× (ficção)", kmS: C * 1e12, ficcao: true },
    { id: "dobra10tri", nome: "Dobra 10 trilhões× (ficção)", kmS: C * 1e13, ficcao: true }
  ]
};

// ---------------------------------------------------------------------------
// Nível 1 — Sistema Solar (unidade da cena: UA)
// ---------------------------------------------------------------------------

/** Elementos keplerianos (Standish/JPL, tabela 1800–2050). */
const ORBITAS = {
  mercurio: {
    elementos: { a: 0.38709927, e: 0.20563593, I: 7.00497902, L: 252.25032350, w: 77.45779628, O: 48.33076593 },
    taxas: { a: 0.00000037, e: 0.00001906, I: -0.00594749, L: 149472.67411175, w: 0.16047689, O: -0.12534081 }
  },
  venus: {
    elementos: { a: 0.72333566, e: 0.00677672, I: 3.39467605, L: 181.97909950, w: 131.60246718, O: 76.67984255 },
    taxas: { a: 0.00000390, e: -0.00004107, I: -0.00078890, L: 58517.81538729, w: 0.00268329, O: -0.27769418 }
  },
  terra: {
    elementos: { a: 1.00000261, e: 0.01671123, I: -0.00001531, L: 100.46457166, w: 102.93768193, O: 0 },
    taxas: { a: 0.00000562, e: -0.00004392, I: -0.01294668, L: 35999.37244981, w: 0.32327364, O: 0 }
  },
  marte: {
    elementos: { a: 1.52371034, e: 0.09339410, I: 1.84969142, L: -4.55343205, w: -23.94362959, O: 49.55953891 },
    taxas: { a: 0.00001847, e: 0.00007882, I: -0.00813131, L: 19140.30268499, w: 0.44441088, O: -0.29257343 }
  },
  jupiter: {
    elementos: { a: 5.20288700, e: 0.04838624, I: 1.30439695, L: 34.39644051, w: 14.72847983, O: 100.47390909 },
    taxas: { a: -0.00011607, e: -0.00013253, I: -0.00183714, L: 3034.74612775, w: 0.21252668, O: 0.20469106 }
  },
  saturno: {
    elementos: { a: 9.53667594, e: 0.05386179, I: 2.48599187, L: 49.95424423, w: 92.59887831, O: 113.66242448 },
    taxas: { a: -0.00125060, e: -0.00050991, I: 0.00193609, L: 1222.49362201, w: -0.41897216, O: -0.28867794 }
  },
  urano: {
    elementos: { a: 19.18916464, e: 0.04725744, I: 0.77263783, L: 313.23810451, w: 170.95427630, O: 74.01692503 },
    taxas: { a: -0.00196176, e: -0.00004397, I: -0.00242939, L: 428.48202785, w: 0.40805281, O: 0.04240589 }
  },
  netuno: {
    elementos: { a: 30.06992276, e: 0.00859048, I: 1.77004347, L: -55.12002969, w: 44.96476227, O: 131.78422574 },
    taxas: { a: 0.00026291, e: 0.00005105, I: 0.00035372, L: 218.45945325, w: -0.32241464, O: -0.00508664 }
  }
};

/**
 * Eixo de rotação: direção do polo norte (AR/Dec J2000, IAU WGCCRE) e
 * período de rotação em horas (negativo = gira "ao contrário").
 */
const ROTACOES = {
  mercurio: { poloAr: 281.01, poloDec: 61.41, horas: 1407.6 },
  venus: { poloAr: 272.76, poloDec: 67.16, horas: -5832.5 },
  terra: { poloAr: 0, poloDec: 90, horas: 23.934 },
  marte: { poloAr: 317.68, poloDec: 52.89, horas: 24.623 },
  jupiter: { poloAr: 268.06, poloDec: 64.50, horas: 9.925 },
  saturno: { poloAr: 40.59, poloDec: 83.54, horas: 10.656 },
  urano: { poloAr: 257.31, poloDec: -15.18, horas: -17.24 },
  netuno: { poloAr: 299.36, poloDec: 43.46, horas: 16.11 }
};

export const SOL = {
  id: "sol",
  nome: "Sol",
  nivel: "solar",
  tipo: "Estrela anã amarela (G2V)",
  raioKm: 696_000,
  cor: "#ffd27a",
  pagina: "sol.html",
  imagem: "img/planetas/sol.webp",
  resumo: "A estrela no centro do Sistema Solar. Sozinho, o Sol tem 99,86% de toda a massa do sistema.",
  curiosidade: "A luz que sai do Sol leva 8 minutos e 20 segundos para chegar à Terra: você sempre vê o Sol como ele era há 8 minutos."
};

export const PLANETAS = [
  {
    id: "mercurio", nome: "Mercúrio", tipo: "Planeta rochoso", raioKm: 2_439.7, cor: "#a9a39b",
    periodoAnos: 0.2408467, pagina: "mercurio.html", imagem: "img/planetas/mercurio.webp",
    resumo: "O menor planeta e o mais próximo do Sol. Não tem atmosfera para segurar o calor.",
    curiosidade: "Um ano em Mercúrio dura só 88 dias terrestres."
  },
  {
    id: "venus", nome: "Vênus", tipo: "Planeta rochoso", raioKm: 6_051.8, cor: "#e8cf9a",
    periodoAnos: 0.61519726, pagina: "venus.html", imagem: "img/planetas/venus.webp",
    resumo: "Quase do tamanho da Terra, mas coberto por nuvens de ácido e um efeito estufa fortíssimo.",
    curiosidade: "É o planeta mais quente (≈ 465 °C), mesmo sendo o segundo mais distante do Sol."
  },
  {
    id: "terra", nome: "Terra", tipo: "Planeta rochoso", raioKm: 6_371, cor: "#3f7fd6",
    periodoAnos: 1.0000174, pagina: "terra.html", imagem: "img/planetas/terra.webp",
    resumo: "Nosso planeta: o único lugar onde sabemos que existe vida.",
    curiosidade: "A Terra viaja em volta do Sol a cerca de 30 km/s — mais de 100 mil km/h."
  },
  {
    id: "marte", nome: "Marte", tipo: "Planeta rochoso", raioKm: 3_389.5, cor: "#c1440e",
    periodoAnos: 1.8808476, pagina: "marte.html", imagem: "img/planetas/marte.webp",
    resumo: "O planeta vermelho, com o maior vulcão do Sistema Solar (Monte Olimpo).",
    curiosidade: "A cor vem do óxido de ferro — a ferrugem — espalhado na poeira."
  },
  {
    id: "jupiter", nome: "Júpiter", tipo: "Gigante gasoso", raioKm: 69_911, cor: "#d8b48a",
    periodoAnos: 11.862615, pagina: "jupiter.html", imagem: "img/planetas/jupiter.webp",
    resumo: "O maior planeta. Sua Grande Mancha Vermelha é uma tempestade maior que a Terra.",
    curiosidade: "Caberiam mais de 1.300 Terras dentro de Júpiter."
  },
  {
    id: "saturno", nome: "Saturno", tipo: "Gigante gasoso", raioKm: 58_232, cor: "#e3cf9c",
    periodoAnos: 29.447498, pagina: "saturno.html", imagem: "img/planetas/saturno.webp",
    // Anéis principais (do anel C ao A), em raios de Saturno.
    aneis: { interno: 1.24, externo: 2.27 },
    resumo: "O planeta dos anéis, feitos de pedaços de gelo e rocha.",
    curiosidade: "Os anéis principais têm cerca de 270 mil km de diâmetro, mas em geral só uns 10 metros de espessura."
  },
  {
    id: "urano", nome: "Urano", tipo: "Gigante gelado", raioKm: 25_362, cor: "#9fe3e6",
    periodoAnos: 84.016846, pagina: "urano.html", imagem: "img/planetas/urano.webp",
    resumo: "Um gigante de gelo que gira 'deitado', com o eixo inclinado 98°.",
    curiosidade: "Cada polo de Urano passa cerca de 42 anos seguidos de dia e depois 42 anos de noite."
  },
  {
    id: "netuno", nome: "Netuno", tipo: "Gigante gelado", raioKm: 24_622, cor: "#4b6fe0",
    periodoAnos: 164.79132, pagina: "netuno.html", imagem: "img/planetas/netuno.webp",
    resumo: "O planeta mais distante, com os ventos mais rápidos do Sistema Solar.",
    curiosidade: "A luz do Sol leva cerca de 4 horas para chegar a Netuno."
  }
].map((planeta) => ({ ...planeta, nivel: "solar", orbita: ORBITAS[planeta.id], rotacao: ROTACOES[planeta.id] }));

export const LUA = {
  id: "lua",
  nome: "Lua",
  nivel: "solar",
  tipo: "Satélite natural da Terra",
  raioKm: 1_737.4,
  cor: "#bdbab4",
  distanciaMediaKm: 384_400,
  resumo: "O único lugar fora da Terra onde seres humanos já pisaram (missões Apollo, 1969–1972).",
  curiosidade: "Todos os planetas do Sistema Solar, enfileirados, caberiam entre a Terra e a Lua."
};

/**
 * Voyager 1: posição aproximada (±1 UA). Depois de passar por Saturno ela
 * segue quase em linha reta rumo à constelação de Ofiúco, afastando-se
 * ≈ 3,58 UA por ano. Cruzou a heliopausa em 25/ago/2012 a 121,6 UA.
 */
export const VOYAGER = {
  id: "voyager",
  nome: "Voyager 1",
  nivel: "solar",
  tipo: "Sonda espacial (NASA, lançada em 1977)",
  raioKm: 0.002,
  cor: "#f4f1e8",
  direcao: { ar: 258.0, dec: 12.1 },             // graus (equatorial J2000)
  referencia: { data: "2012-08-25", distanciaUA: 121.6, uaPorAno: 3.58 },
  resumo: "O objeto feito por humanos mais distante da Terra. Já saiu da bolha do vento solar e está no espaço interestelar.",
  curiosidade: "Por volta de novembro de 2026 ela fica a 1 dia-luz da Terra: um comando enviado daqui leva quase 24 horas para chegar."
};

/** Referências desenhadas na cena (não são "descobertas"). */
export const REFERENCIAS_SOLAR = {
  heliopausaUA: 120,
  choqueTerminalUA: 94
};

// ---------------------------------------------------------------------------
// Nível 2 — Estrelas vizinhas (unidade da cena: ano-luz)
// ar = ascensão reta "h m s"; dec = declinação "±g m s" (J2000);
// mag = magnitude aparente vista da Terra (quanto menor, mais brilhante).
// ---------------------------------------------------------------------------

export const ESTRELAS = [
  {
    id: "proxima", nome: "Proxima Centauri", ar: "14 29 42.95", dec: "-62 40 46.1", anosLuz: 4.246,
    espectro: "M5.5 V", mag: 11.13, tipo: "Anã vermelha",
    resumo: "A estrela mais próxima do Sol. Fraca demais para ser vista a olho nu.",
    curiosidade: "Tem pelo menos um planeta na zona habitável, Proxima b — onde poderia existir água líquida."
  },
  {
    id: "alfa-centauri", nome: "Alfa Centauri A e B", ar: "14 39 36.5", dec: "-60 50 02", anosLuz: 4.37,
    espectro: "G2 V + K1 V", mag: -0.27, tipo: "Sistema de duas estrelas parecidas com o Sol",
    resumo: "O sistema estelar mais próximo visível a olho nu. Proxima Centauri gira em volta dele.",
    curiosidade: "Alfa e Beta Centauri são os 'ponteiros' que ajudam a achar o Cruzeiro do Sul no céu."
  },
  {
    id: "barnard", nome: "Estrela de Barnard", ar: "17 57 48.5", dec: "+04 41 36", anosLuz: 5.96,
    espectro: "M4 V", mag: 9.51, tipo: "Anã vermelha",
    resumo: "Uma anã vermelha muito antiga, com cerca de 10 bilhões de anos.",
    curiosidade: "É a estrela que mais rápido muda de posição no nosso céu."
  },
  {
    id: "wolf-359", nome: "Wolf 359", ar: "10 56 29.2", dec: "+07 00 53", anosLuz: 7.86,
    espectro: "M6 V", mag: 13.54, tipo: "Anã vermelha",
    resumo: "Uma das estrelas mais fracas conhecidas perto do Sol.",
    curiosidade: "Emite só cerca de 0,1% da luz do Sol."
  },
  {
    id: "lalande-21185", nome: "Lalande 21185", ar: "11 03 20.2", dec: "+35 58 12", anosLuz: 8.31,
    espectro: "M2 V", mag: 7.52, tipo: "Anã vermelha",
    resumo: "Anã vermelha visível com binóculos no céu do Hemisfério Norte.",
    curiosidade: "Tem pelo menos um planeta conhecido."
  },
  {
    id: "sirius", nome: "Sírius", ar: "06 45 08.9", dec: "-16 42 58", anosLuz: 8.60,
    espectro: "A1 V + anã branca", mag: -1.46, tipo: "Estrela branca + anã branca",
    resumo: "A estrela mais brilhante do céu noturno, na constelação do Cão Maior.",
    curiosidade: "Tem uma companheira, Sírius B: uma anã branca do tamanho da Terra com a massa de um Sol."
  },
  {
    id: "luyten-726-8", nome: "Luyten 726-8 (UV Ceti)", ar: "01 39 01.3", dec: "-17 57 01", anosLuz: 8.73,
    espectro: "M5.5 V", mag: 12.54, tipo: "Par de anãs vermelhas",
    resumo: "Duas anãs vermelhas que giram uma em volta da outra.",
    curiosidade: "UV Ceti dá 'explosões' de brilho: em minutos fica várias vezes mais brilhante."
  },
  {
    id: "ross-154", nome: "Ross 154", ar: "18 49 49.4", dec: "-23 50 10", anosLuz: 9.69,
    espectro: "M3.5 V", mag: 10.44, tipo: "Anã vermelha",
    resumo: "Anã vermelha jovem na direção da constelação de Sagitário.",
    curiosidade: "Assim como UV Ceti, também tem explosões de brilho."
  },
  {
    id: "ross-248", nome: "Ross 248", ar: "23 41 54.7", dec: "+44 10 30", anosLuz: 10.3,
    espectro: "M5.5 V", mag: 12.29, tipo: "Anã vermelha",
    resumo: "Uma anã vermelha que está se aproximando do Sol.",
    curiosidade: "Daqui a uns 36 mil anos ela será, por um tempo, a estrela mais próxima do Sol."
  },
  {
    id: "epsilon-eridani", nome: "Epsilon Eridani", ar: "03 32 55.8", dec: "-09 27 30", anosLuz: 10.5,
    espectro: "K2 V", mag: 3.73, tipo: "Estrela laranja",
    resumo: "Uma estrela jovem, cercada por discos de poeira, com um planeta gigante.",
    curiosidade: "Dá para vê-la a olho nu longe das luzes da cidade."
  },
  {
    id: "lacaille-9352", nome: "Lacaille 9352", ar: "23 05 52.0", dec: "-35 51 11", anosLuz: 10.7,
    espectro: "M0.5 V", mag: 7.34, tipo: "Anã vermelha",
    resumo: "Uma das anãs vermelhas mais brilhantes vistas da Terra.",
    curiosidade: "Fica na constelação do Peixe Austral, bem visível do Brasil."
  },
  {
    id: "ross-128", nome: "Ross 128", ar: "11 47 44.4", dec: "+00 48 16", anosLuz: 11.0,
    espectro: "M4 V", mag: 11.13, tipo: "Anã vermelha",
    resumo: "Uma anã vermelha calma, sem grandes explosões de brilho.",
    curiosidade: "Tem um planeta com massa parecida com a da Terra, Ross 128 b."
  },
  {
    id: "61-cygni", nome: "61 Cygni", ar: "21 06 53.9", dec: "+38 44 58", anosLuz: 11.4,
    espectro: "K5 V + K7 V", mag: 4.8, tipo: "Par de estrelas laranja",
    resumo: "Duas estrelas laranja que giram uma em volta da outra a cada ~680 anos.",
    curiosidade: "Foi a primeira estrela a ter a distância medida, por Friedrich Bessel, em 1838."
  },
  {
    id: "procyon", nome: "Prócion", ar: "07 39 18.1", dec: "+05 13 30", anosLuz: 11.46,
    espectro: "F5 IV-V + anã branca", mag: 0.34, tipo: "Estrela branco-amarelada",
    resumo: "A estrela mais brilhante do Cão Menor; também tem uma anã branca companheira.",
    curiosidade: "Seu nome, do grego, quer dizer 'antes do cão': ela nasce no céu um pouco antes de Sírius."
  },
  {
    id: "tau-ceti", nome: "Tau Ceti", ar: "01 44 04.1", dec: "-15 56 15", anosLuz: 11.9,
    espectro: "G8 V", mag: 3.50, tipo: "Estrela parecida com o Sol",
    resumo: "Uma estrela parecida com o Sol, só um pouco menor e mais fria.",
    curiosidade: "É um dos alvos clássicos na busca por sinais de vida inteligente."
  },
  {
    id: "altair", nome: "Altair", ar: "19 50 47.0", dec: "+08 52 06", anosLuz: 16.7,
    espectro: "A7 V", mag: 0.76, tipo: "Estrela branca",
    resumo: "A estrela mais brilhante da constelação da Águia.",
    curiosidade: "Gira tão rápido (uma volta a cada ~9 horas) que fica achatada nos polos."
  },
  {
    id: "vega", nome: "Vega", ar: "18 36 56.3", dec: "+38 47 01", anosLuz: 25.0,
    espectro: "A0 V", mag: 0.03, tipo: "Estrela branca",
    resumo: "Uma das estrelas mais brilhantes do céu, usada como padrão de brilho pelos astrônomos.",
    curiosidade: "Há uns 12 mil anos ela era a 'estrela polar' do norte — e voltará a ser por volta do ano 13.700."
  },
  {
    id: "fomalhaut", nome: "Fomalhaut", ar: "22 57 39.0", dec: "-29 37 20", anosLuz: 25.1,
    espectro: "A3 V", mag: 1.16, tipo: "Estrela branca",
    resumo: "Estrela brilhante do Peixe Austral, cercada por um grande anel de poeira.",
    curiosidade: "Nas noites de primavera ela fica sozinha numa região do céu com poucas estrelas brilhantes."
  },
  {
    id: "polux", nome: "Pólux", ar: "07 45 18.9", dec: "+28 01 34", anosLuz: 33.8,
    espectro: "K0 III", mag: 1.14, tipo: "Gigante laranja",
    resumo: "A estrela mais brilhante da constelação de Gêmeos.",
    curiosidade: "É uma gigante: já gastou o hidrogênio do núcleo e inchou."
  },
  {
    id: "arcturo", nome: "Arcturo", ar: "14 15 39.7", dec: "+19 10 57", anosLuz: 36.7,
    espectro: "K1.5 III", mag: -0.05, tipo: "Gigante laranja",
    resumo: "A estrela mais brilhante do hemisfério celeste norte.",
    curiosidade: "É cerca de 25 vezes maior que o Sol — um retrato do que o Sol vai virar no futuro."
  },
  {
    id: "capela", nome: "Capela", ar: "05 16 41.4", dec: "+45 59 53", anosLuz: 42.9,
    espectro: "G3 III + G0 III", mag: 0.08, tipo: "Par de gigantes amarelas",
    resumo: "Parece uma estrela só, mas são duas gigantes amarelas (e mais duas anãs vermelhas).",
    curiosidade: "É a sexta estrela mais brilhante do céu."
  },
  {
    id: "aldebara", nome: "Aldebarã", ar: "04 35 55.2", dec: "+16 30 33", anosLuz: 65.3,
    espectro: "K5 III", mag: 0.86, tipo: "Gigante laranja",
    resumo: "O 'olho vermelho' da constelação de Touro.",
    curiosidade: "Parece estar no meio do aglomerado das Híades, mas fica bem mais perto de nós que ele."
  },
  {
    id: "regulo", nome: "Régulo", ar: "10 08 22.3", dec: "+11 58 02", anosLuz: 79.3,
    espectro: "B8 IV", mag: 1.40, tipo: "Estrela azul-branca",
    resumo: "O 'coração' da constelação de Leão.",
    curiosidade: "Fica quase em cima da eclíptica, então a Lua às vezes passa na frente dela."
  },
  {
    id: "espiga", nome: "Espiga", ar: "13 25 11.6", dec: "-11 09 41", anosLuz: 250,
    espectro: "B1 III-IV", mag: 0.97, tipo: "Par de estrelas azuis",
    resumo: "A estrela mais brilhante de Virgem; são duas estrelas azuis muito quentes e coladas.",
    curiosidade: "Representa o estado do Pará na bandeira do Brasil."
  },
  {
    id: "canopus", nome: "Canopus", ar: "06 23 57.1", dec: "-52 41 44", anosLuz: 310,
    espectro: "A9 II", mag: -0.74, tipo: "Supergigante branca",
    resumo: "A segunda estrela mais brilhante do céu noturno, ótima de ver do Brasil.",
    curiosidade: "Sondas espaciais usam Canopus como referência para se orientar no espaço."
  },
  {
    id: "acrux", nome: "Ácrux (Estrela de Magalhães)", ar: "12 26 35.9", dec: "-63 05 57", anosLuz: 321,
    espectro: "B0.5 IV + B1 V", mag: 0.76, tipo: "Sistema de estrelas azuis",
    resumo: "A estrela mais brilhante do Cruzeiro do Sul.",
    curiosidade: "Está na bandeira do Brasil, representando o estado de São Paulo."
  },
  {
    id: "polaris", nome: "Estrela Polar", ar: "02 31 49.1", dec: "+89 15 51", anosLuz: 433,
    espectro: "F7 Ib", mag: 1.98, tipo: "Supergigante amarela",
    resumo: "Fica quase em cima do polo norte celeste, por isso parece não se mover no céu.",
    curiosidade: "De quase todo o Brasil ela não aparece: fica abaixo do horizonte para quem está ao sul do equador."
  },
  {
    id: "antares", nome: "Antares", ar: "16 29 24.5", dec: "-26 25 55", anosLuz: 550,
    espectro: "M1.5 Iab", mag: 1.06, tipo: "Supergigante vermelha",
    resumo: "O 'coração' vermelho da constelação de Escorpião. Distância incerta.",
    curiosidade: "Se estivesse no lugar do Sol, engoliria Mercúrio, Vênus, a Terra e Marte."
  },
  {
    id: "betelgeuse", nome: "Betelgeuse", ar: "05 55 10.3", dec: "+07 24 25", anosLuz: 548,
    espectro: "M1-2 Ia", mag: 0.50, tipo: "Supergigante vermelha",
    resumo: "O 'ombro' de Órion: uma supergigante vermelha no fim da vida. Distância incerta (500–650 anos-luz).",
    curiosidade: "Um dia vai explodir como supernova — talvez daqui a 100 mil anos — e brilhar como a Lua cheia."
  },
  {
    id: "rigel", nome: "Rigel", ar: "05 14 32.3", dec: "-08 12 06", anosLuz: 860,
    espectro: "B8 Ia", mag: 0.13, tipo: "Supergigante azul",
    resumo: "O 'pé' de Órion, uma das estrelas mais luminosas que dá para ver a olho nu.",
    curiosidade: "Emite dezenas de milhares de vezes mais luz que o Sol."
  }
].map((estrela) => ({ ...estrela, nivel: "estrelas" }));

/** O Sol também aparece como estrela no nível 2 (magnitude absoluta 4,83). */
export const SOL_MAGNITUDE_ABSOLUTA = 4.83;

/** Direção do centro da galáxia (Sagitário A*), equatorial J2000. */
export const DIRECAO_CENTRO_GALAXIA = { ar: "17 45 40.04", dec: "-29 00 28.1" };

/** Cor aproximada pela classe espectral (Mitchell Charity, "What color are the stars?"). */
export const CORES_ESPECTRAIS = {
  O: "#9bb0ff", B: "#aabfff", A: "#cad7ff", F: "#f8f7ff", G: "#fff4ea", K: "#ffd2a1", M: "#ffcc6f"
};

// ---------------------------------------------------------------------------
// Nível 3 — Via Láctea (unidade da cena: mil anos-luz)
// l, b = longitude e latitude galácticas (graus); d = distância do Sol (mil anos-luz).
// ---------------------------------------------------------------------------

export const GALAXIA = {
  distanciaSolCentroKly: 26.67,     // 8,178 kpc (GRAVITY, 2019)
  raioDiscoKly: 50,                  // disco com ~100 mil anos-luz de diâmetro
  inclinacaoEspiralGraus: 12,        // ângulo dos braços espirais
  // Raio de cada braço no azimute do Sol (de dentro para fora), mil anos-luz.
  bracos: [
    { nome: "Braço Escudo–Centauro", raioNoSol: 16.1 },
    { nome: "Braço Sagitário–Carina", raioNoSol: 22.5 },
    { nome: "Braço de Perseu", raioNoSol: 31.4 },
    { nome: "Braço Externo", raioNoSol: 43.9 }
  ],
  barra: { meioComprimentoKly: 14, anguloGraus: 27 }
};

export const OBJETOS_GALAXIA = [
  {
    id: "sol-galaxia", nome: "Sol (você está aqui)", tipo: "Nossa estrela", centro: false, l: 0, b: 0, d: 0,
    cor: "#ffd27a", pagina: "via-lactea.html",
    resumo: "O Sol fica num braço pequeno, o Braço de Órion, a cerca de 26.670 anos-luz do centro da galáxia.",
    curiosidade: "O Sol leva cerca de 230 milhões de anos para dar uma volta na galáxia — a última vez que esteve neste ponto, os primeiros dinossauros estavam surgindo."
  },
  {
    id: "sgr-a", nome: "Sagitário A*", tipo: "Buraco negro supermassivo", centro: true,
    cor: "#ffb36b", pagina: "universo.html",
    resumo: "O buraco negro no centro da Via Láctea, com cerca de 4 milhões de vezes a massa do Sol.",
    curiosidade: "Em 2022 o Event Horizon Telescope mostrou a primeira imagem da 'sombra' dele."
  },
  {
    id: "pleiades", nome: "Plêiades (Sete Estrelo)", tipo: "Aglomerado aberto de estrelas", l: 166.57, b: -23.52, d: 0.444,
    cor: "#a9c4ff",
    resumo: "Um grupo de estrelas jovens e azuis que nasceram juntas, na constelação de Touro.",
    curiosidade: "Muitos povos indígenas do Brasil usavam o aparecimento das Plêiades no céu para marcar o calendário."
  },
  {
    id: "orion-nebula", nome: "Nebulosa de Órion", tipo: "Berçário de estrelas", l: 209.01, b: -19.38, d: 1.344,
    cor: "#ff7aa8",
    resumo: "Uma nuvem enorme de gás e poeira onde novas estrelas estão nascendo agora.",
    curiosidade: "Dá para ver a olho nu, como uma 'manchinha' na espada de Órion, pertinho das Três Marias."
  },
  {
    id: "crab", nome: "Nebulosa do Caranguejo", tipo: "Resto de supernova", l: 184.56, b: -5.78, d: 6.5,
    cor: "#ffa26b",
    resumo: "O que sobrou de uma estrela que explodiu. No centro gira uma estrela de nêutrons.",
    curiosidade: "A explosão foi vista na Terra em 1054 e registrada por astrônomos chineses: brilhou até de dia."
  },
  {
    id: "eagle", nome: "Nebulosa da Águia", tipo: "Berçário de estrelas", l: 16.95, b: 0.79, d: 5.7,
    cor: "#ff9a6b",
    resumo: "Casa dos famosos 'Pilares da Criação', colunas de gás onde nascem estrelas.",
    curiosidade: "Os Pilares foram fotografados pelo Hubble em 1995 e de novo pelo James Webb em 2022."
  },
  {
    id: "carina", nome: "Nebulosa de Carina", tipo: "Berçário de estrelas", l: 287.6, b: -0.63, d: 8.5,
    cor: "#ff8f8f",
    resumo: "Uma das maiores nebulosas da galáxia, com algumas das estrelas mais pesadas conhecidas.",
    curiosidade: "Dentro dela está Eta Carinae, uma estrela que pode explodir a qualquer momento (em termos astronômicos)."
  },
  {
    id: "omega-centauri", nome: "Ômega Centauri", tipo: "Aglomerado globular", l: 309.10, b: 14.97, d: 17.1,
    cor: "#ffe6a8",
    resumo: "Uma bola com cerca de 10 milhões de estrelas velhas, fora do disco da galáxia.",
    curiosidade: "Pode ser o núcleo de uma pequena galáxia que a Via Láctea 'engoliu' há muito tempo."
  },
  {
    id: "lmc", nome: "Grande Nuvem de Magalhães", tipo: "Galáxia satélite", l: 280.47, b: -32.89, d: 163,
    cor: "#cfd8ff",
    resumo: "Uma galáxia anã que gira em volta da Via Láctea, visível a olho nu no Hemisfério Sul.",
    curiosidade: "Em 1987 uma supernova explodiu lá e foi a mais brilhante vista da Terra em quase 400 anos."
  },
  {
    id: "smc", nome: "Pequena Nuvem de Magalhães", tipo: "Galáxia satélite", l: 302.80, b: -44.30, d: 200,
    cor: "#c4ccff",
    resumo: "A irmã menor da Grande Nuvem, também visível do Brasil longe das luzes da cidade.",
    curiosidade: "As duas Nuvens foram descritas na viagem de Fernão de Magalhães (1519–1522), daí o nome."
  },
  {
    id: "andromeda", nome: "Galáxia de Andrômeda", tipo: "Galáxia espiral vizinha", l: 121.17, b: -21.57, d: 2537,
    cor: "#e6dcff", pagina: "curiosidades.html", imagem: "img/universo/andromeda.webp",
    resumo: "A grande galáxia mais próxima, com cerca de 1 trilhão de estrelas. É um dos objetos mais distantes que dá para ver a olho nu.",
    curiosidade: "Andrômeda e a Via Láctea se aproximam a ≈ 110 km/s e podem se fundir daqui a bilhões de anos (estudos de 2025 estimam uma chance de cerca de 50% nos próximos 10 bilhões de anos)."
  }
].map((objeto) => ({ ...objeto, nivel: "galaxia" }));

// ---------------------------------------------------------------------------
// Missões (o "jogo"): cada uma tem uma condição verificada pelo explorador.
// Tipos de condição:
//   descobrir: lista de ids que precisam ser descobertos
//   viagem:    chegada a um alvo voando (sem salto), com filtros opcionais
//   acertos:   número mínimo de respostas certas no quiz
//   niveis:    lista de níveis visitados
// ---------------------------------------------------------------------------

export const MISSOES = [
  {
    id: "lua", nome: "Pertinho de casa", nivel: "solar",
    objetivo: "Viaje até a Lua voando (sem usar o salto).",
    dica: "Escolha a Lua em Destinos e use o piloto automático. Na velocidade da luz leva 1,3 segundo; num carro, uns 5 meses sem parar.",
    condicao: { tipo: "viagem", alvo: "lua" }
  },
  {
    id: "luz-do-sol", nome: "Oito minutos de luz", nivel: "solar",
    objetivo: "Saia do Sol e chegue à Terra na velocidade da luz, sem trocar de velocidade.",
    dica: "Salte até o Sol, escolha 'Velocidade da luz', selecione a Terra e use o piloto automático. Cronometre!",
    condicao: { tipo: "viagem", alvo: "terra", origem: "sol", velocidade: "luz" }
  },
  {
    id: "planetas", nome: "Os oito planetas", nivel: "solar",
    objetivo: "Descubra os oito planetas do Sistema Solar.",
    dica: "Os planetas são descobertos quando você chega perto deles.",
    condicao: { tipo: "descobrir", ids: ["mercurio", "venus", "terra", "marte", "jupiter", "saturno", "urano", "netuno"] }
  },
  {
    id: "voyager", nome: "Até onde já fomos", nivel: "solar",
    objetivo: "Alcance a Voyager 1, o objeto humano mais distante.",
    dica: "Ela está bem além de Netuno, a mais de 170 UA do Sol.",
    condicao: { tipo: "descobrir", ids: ["voyager"] }
  },
  {
    id: "proxima", nome: "A vizinha mais próxima", nivel: "estrelas",
    objetivo: "Descubra Proxima Centauri, a estrela mais próxima do Sol.",
    dica: "Mude para o nível 'Estrelas vizinhas'. Na velocidade da luz, a viagem leva 4,2 anos!",
    condicao: { tipo: "descobrir", ids: ["proxima"] }
  },
  {
    id: "ceu-do-brasil", nome: "Estrelas do céu do Brasil", nivel: "estrelas",
    objetivo: "Descubra Sírius, Canopus e Ácrux.",
    dica: "As três aparecem bem no céu do Brasil. Ácrux está na bandeira!",
    condicao: { tipo: "descobrir", ids: ["sirius", "canopus", "acrux"] }
  },
  {
    id: "centro", nome: "O coração da galáxia", nivel: "galaxia",
    objetivo: "Chegue a Sagitário A*, no centro da Via Láctea.",
    dica: "Mude para o nível 'Via Láctea'. O centro está a 26.670 anos-luz do Sol.",
    condicao: { tipo: "descobrir", ids: ["sgr-a"] }
  },
  {
    id: "andromeda", nome: "Além da Via Láctea", nivel: "galaxia",
    objetivo: "Visite a Galáxia de Andrômeda.",
    dica: "Ela está a 2,5 milhões de anos-luz. Talvez seja melhor usar o salto…",
    condicao: { tipo: "descobrir", ids: ["andromeda"] }
  },
  {
    id: "tres-escalas", nome: "Três escalas", nivel: null,
    objetivo: "Visite os três níveis: Sistema Solar, Estrelas vizinhas e Via Láctea.",
    dica: "Use os botões de nível no topo da tela.",
    condicao: { tipo: "niveis", ids: ["solar", "estrelas", "galaxia"] }
  },
  {
    id: "cientista", nome: "Cientista de bordo", nivel: null,
    objetivo: "Acerte 10 desafios do quiz.",
    dica: "Cada descoberta libera um desafio. Você pode responder no explorador ou no Diário de bordo.",
    condicao: { tipo: "acertos", minimo: 10 }
  }
];

// ---------------------------------------------------------------------------
// Quiz: um desafio por objeto, liberado quando o objeto é descoberto.
// "certa" é o índice da opção correta.
// ---------------------------------------------------------------------------

export const PERGUNTAS = [
  {
    id: "q-terra", objeto: "terra",
    pergunta: "Quanto tempo a luz do Sol leva para chegar à Terra?",
    opcoes: ["Menos de 1 segundo", "Cerca de 8 minutos e 20 segundos", "Cerca de 1 hora", "Um dia inteiro"],
    certa: 1,
    explicacao: "A Terra está a 1 UA do Sol (≈ 150 milhões de km). Mesmo a 300 mil km/s, a luz leva uns 500 segundos."
  },
  {
    id: "q-lua", objeto: "lua",
    pergunta: "Todos os planetas do Sistema Solar caberiam, enfileirados, entre a Terra e a Lua?",
    opcoes: ["Sim, e ainda sobra um espacinho", "Não: só Júpiter já é maior que essa distância", "Só os planetas rochosos caberiam"],
    certa: 0,
    explicacao: "Somando os diâmetros dos 7 outros planetas dá ≈ 380 mil km, e a distância média até a Lua é 384.400 km."
  },
  {
    id: "q-sol", objeto: "sol",
    pergunta: "Quanto da massa do Sistema Solar está no Sol?",
    opcoes: ["Cerca de 50%", "Cerca de 75%", "Mais de 99%"],
    certa: 2,
    explicacao: "O Sol tem 99,86% da massa. Júpiter fica com quase todo o resto."
  },
  {
    id: "q-mercurio", objeto: "mercurio",
    pergunta: "Mercúrio é o planeta mais próximo do Sol. Ele é o mais quente?",
    opcoes: ["Sim, por estar mais perto", "Não: Vênus é mais quente por causa do efeito estufa", "Não: Júpiter é o mais quente"],
    certa: 1,
    explicacao: "Sem atmosfera, Mercúrio perde calor: à noite chega a −180 °C. Vênus prende o calor e passa de 460 °C."
  },
  {
    id: "q-venus", objeto: "venus",
    pergunta: "Quanto tempo Vênus leva para dar uma volta em torno do próprio eixo?",
    opcoes: ["24 horas", "243 dias terrestres — mais que o próprio ano de Vênus", "10 horas"],
    certa: 1,
    explicacao: "Vênus gira devagar e ao contrário: o 'dia' (243 dias) é maior que o ano (225 dias)."
  },
  {
    id: "q-marte", objeto: "marte",
    pergunta: "Por que Marte é avermelhado?",
    opcoes: ["Por causa de lava quente na superfície", "Por causa do óxido de ferro (ferrugem) na poeira", "Porque reflete a luz vermelha do Sol"],
    certa: 1,
    explicacao: "A poeira e as rochas de Marte têm muito óxido de ferro, o mesmo material da ferrugem."
  },
  {
    id: "q-jupiter", objeto: "jupiter",
    pergunta: "Quantas Terras caberiam dentro de Júpiter?",
    opcoes: ["Cerca de 10", "Cerca de 100", "Mais de 1.300"],
    certa: 2,
    explicacao: "Júpiter tem 11 vezes o diâmetro da Terra; o volume cresce ao cubo: 11³ ≈ 1.300."
  },
  {
    id: "q-saturno", objeto: "saturno",
    pergunta: "Do que são feitos os anéis de Saturno?",
    opcoes: ["De gás colorido", "Principalmente de pedaços de gelo de água, com um pouco de rocha", "De metal"],
    certa: 1,
    explicacao: "São bilhões de pedaços de gelo, do tamanho de grãos de areia até casas."
  },
  {
    id: "q-urano", objeto: "urano",
    pergunta: "O que Urano tem de diferente dos outros planetas?",
    opcoes: ["Gira 'deitado', com o eixo inclinado 98°", "Não tem atmosfera", "É o maior planeta"],
    certa: 0,
    explicacao: "Provavelmente uma grande colisão no passado deixou Urano de lado."
  },
  {
    id: "q-netuno", objeto: "netuno",
    pergunta: "Quanto tempo a luz do Sol leva para chegar a Netuno?",
    opcoes: ["8 minutos", "Cerca de 4 horas", "Cerca de 2 dias"],
    certa: 1,
    explicacao: "Netuno está a 30 UA. Se a luz leva 8 min 20 s por UA, são ≈ 4 horas e 10 minutos."
  },
  {
    id: "q-voyager", objeto: "voyager",
    pergunta: "Lançada em 1977, a Voyager 1 está hoje tão longe que um sinal de rádio (que viaja na velocidade da luz) leva quanto tempo para chegar até ela?",
    opcoes: ["Cerca de 1 minuto", "Cerca de 1 hora", "Quase 1 dia inteiro"],
    certa: 2,
    explicacao: "A mais de 170 UA, a Voyager 1 está quase a 1 dia-luz: 'falar' com ela demora quase 2 dias, ida e volta."
  },
  {
    id: "q-proxima", objeto: "proxima",
    pergunta: "Viajando na velocidade da Voyager 1 (17 km/s), quanto tempo levaríamos até Proxima Centauri?",
    opcoes: ["Uns 70 anos", "Uns 750 anos", "Uns 75 mil anos"],
    certa: 2,
    explicacao: "São 4,25 anos-luz ≈ 40 trilhões de km. A 17 km/s, isso dá cerca de 75 mil anos."
  },
  {
    id: "q-alfa-centauri", objeto: "alfa-centauri",
    pergunta: "Alfa Centauri ajuda a encontrar qual constelação famosa do céu do Brasil?",
    opcoes: ["Órion", "O Cruzeiro do Sul", "A Ursa Maior"],
    certa: 1,
    explicacao: "Alfa e Beta Centauri são os 'ponteiros' do Cruzeiro do Sul."
  },
  {
    id: "q-sirius", objeto: "sirius",
    pergunta: "Por que Sírius é a estrela mais brilhante do céu noturno?",
    opcoes: ["Porque é a maior estrela que existe", "Porque é luminosa e está relativamente perto (8,6 anos-luz)", "Porque, na verdade, é um planeta"],
    certa: 1,
    explicacao: "Sírius emite ≈ 25 vezes mais luz que o Sol e é uma das estrelas mais próximas. Existem estrelas bem maiores, só que mais longe."
  },
  {
    id: "q-61-cygni", objeto: "61-cygni",
    pergunta: "Qual foi a primeira estrela a ter a distância medida, em 1838?",
    opcoes: ["Sírius", "61 Cygni", "Proxima Centauri"],
    certa: 1,
    explicacao: "Friedrich Bessel mediu a paralaxe de 61 Cygni: o pequeno 'pulo' da estrela no céu enquanto a Terra gira em volta do Sol."
  },
  {
    id: "q-acrux", objeto: "acrux",
    pergunta: "Na bandeira do Brasil, Ácrux (a estrela mais brilhante do Cruzeiro do Sul) representa…",
    opcoes: ["o Distrito Federal", "o estado de São Paulo", "o estado de Mato Grosso"],
    certa: 1,
    explicacao: "Cada estrela da bandeira representa um estado; Ácrux, a Alfa do Cruzeiro, é São Paulo."
  },
  {
    id: "q-betelgeuse", objeto: "betelgeuse",
    pergunta: "Quando você olha para Betelgeuse, está vendo a luz que ela emitiu…",
    opcoes: ["agora mesmo", "há uns 8 minutos", "há uns 550 anos, mais ou menos na época das Grandes Navegações"],
    certa: 2,
    explicacao: "Olhar longe é olhar para o passado: a luz de Betelgeuse viajou uns 550 anos até chegar aqui."
  },
  {
    id: "q-sgr-a", objeto: "sgr-a",
    pergunta: "O que existe no centro da Via Láctea?",
    opcoes: ["Um buraco negro supermassivo, com uns 4 milhões de vezes a massa do Sol", "Uma estrela gigante", "Nada: é um espaço vazio"],
    certa: 0,
    explicacao: "Os astrônomos 'pesaram' Sagitário A* observando estrelas que giram rapidíssimo em volta dele."
  },
  {
    id: "q-sol-galaxia", objeto: "sol-galaxia",
    pergunta: "Quanto tempo o Sol leva para dar uma volta em torno do centro da galáxia?",
    opcoes: ["1 ano", "Cerca de 1 milhão de anos", "Cerca de 230 milhões de anos"],
    certa: 2,
    explicacao: "Mesmo a uns 230 km/s, a volta é enorme: ≈ 230 milhões de anos, um 'ano galáctico'."
  },
  {
    id: "q-pleiades", objeto: "pleiades",
    pergunta: "As Plêiades estão a cerca de 444 anos-luz. Na velocidade da luz, quanto tempo levaria a viagem até lá?",
    opcoes: ["444 dias", "444 anos", "4 anos"],
    certa: 1,
    explicacao: "Um ano-luz é a distância que a luz percorre em um ano. Então 444 anos-luz = 444 anos viajando na velocidade da luz."
  },
  {
    id: "q-orion-nebula", objeto: "orion-nebula",
    pergunta: "O que é a Nebulosa de Órion?",
    opcoes: ["Um berçário: uma nuvem de gás onde estrelas estão nascendo", "O resto de uma estrela que explodiu", "Uma galáxia vizinha"],
    certa: 0,
    explicacao: "Lá dentro há milhares de estrelas jovens; algumas têm discos onde planetas estão se formando."
  },
  {
    id: "q-crab", objeto: "crab",
    pergunta: "Em que ano a explosão que formou a Nebulosa do Caranguejo foi vista na Terra?",
    opcoes: ["1054", "1500", "1969"],
    certa: 0,
    explicacao: "Astrônomos chineses registraram uma 'estrela convidada' em 1054, visível até de dia por semanas."
  },
  {
    id: "q-lmc", objeto: "lmc",
    pergunta: "O que é a Grande Nuvem de Magalhães?",
    opcoes: ["Uma galáxia satélite da Via Láctea", "Uma nuvem de chuva vista do espaço", "Uma nebulosa dentro do Sistema Solar"],
    certa: 0,
    explicacao: "É uma galáxia anã a uns 163 mil anos-luz, que gira em volta da nossa."
  },
  {
    id: "q-andromeda", objeto: "andromeda",
    pergunta: "A luz de Andrômeda que chega hoje aos seus olhos saiu de lá há uns 2,5 milhões de anos. O que existia na Terra naquela época?",
    opcoes: ["Dinossauros", "Os primeiros ancestrais humanos do gênero Homo", "As pirâmides do Egito"],
    certa: 1,
    explicacao: "Os dinossauros (não avianos) sumiram há 66 milhões de anos; as pirâmides têm uns 4.500 anos. Há 2,5 milhões de anos surgiam os primeiros Homo."
  }
];

// ---------------------------------------------------------------------------
// Utilidades de consulta
// ---------------------------------------------------------------------------

/** Todos os objetos que podem ser descobertos, com o nível de cada um. */
export const TODOS_OS_OBJETOS = [SOL, ...PLANETAS, LUA, VOYAGER, ...ESTRELAS, ...OBJETOS_GALAXIA];

const PORID = new Map(TODOS_OS_OBJETOS.map((objeto) => [objeto.id, objeto]));

export function objetoPorId(id) {
  return PORID.get(id) || null;
}

export function perguntaDoObjeto(id) {
  return PERGUNTAS.find((pergunta) => pergunta.objeto === id) || null;
}

export function nivelPorId(id) {
  return NIVEIS.find((nivel) => nivel.id === id) || NIVEIS[0];
}

/** Cor de uma estrela a partir da letra da classe espectral. */
export function corDaEstrela(estrela) {
  return CORES_ESPECTRAIS[estrela.espectro.trim()[0]] || "#ffffff";
}
