// ---------------------------------------------------------------------------
// Explorador do Universo — catálogo de conhecimento.
// Tudo o que o explorador mostra (astros, estrelas, objetos da galáxia,
// missões e perguntas) fica aqui, separado da lógica da cena 3D. É esta
// "base de conhecimento" que o Diário de bordo vai desbloqueando.
//
// Módulo puro: também é lido pelo script de validação (testes/).
//
// Fontes dos dados (cada verbete traz os links das suas, em "fonte" ou "fontes"):
// - Órbitas: Standish/JPL, elementos keplerianos aproximados (1800–2050).
// - Raios, períodos, gravidade e inclinação dos eixos: NASA Planetary Fact Sheet.
// - Polos e meridianos: IAU WGCCRE (Archinal et al., 2018).
// - Luas: NASA Science (uma página por lua) e JPL (órbitas e tamanhos);
//   contagem das luas dos planetas gigantes: NASA e JPL (junho de 2026).
// - Estrelas: coordenadas J2000, tipo espectral e magnitude do SIMBAD (CDS,
//   Estrasburgo); distâncias por paralaxe (Hipparcos/Gaia). As distâncias das
//   supergigantes têm incerteza grande.
// - Galáxia: R0 = 8,178 kpc (GRAVITY, 2019); coordenadas galácticas SIMBAD;
//   nebulosas e aglomerados: catálogos Messier e Caldwell do Hubble (NASA);
//   Nebulosa de Órion: 414 pc (Menten et al., 2007); Sagitário A*: ESO (2022);
//   galáxias vizinhas: artigos citados em cada uma, NASA, ESA e ESO.
// - Plutão e Ceres: NASA (NSSDC e NASA Science); Cinturão: NASA e equipe Lucy (SwRI).
// - Voyager 1 e 2: trajetórias publicadas pelo JPL (elementos hiperbólicos,
//   1989) e páginas da missão na NASA.
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
 * Rotação (IAU WGCCRE, Archinal et al., 2018): polo norte (AR/Dec J2000),
 * meridiano principal em J2000 (W0, graus) e período em horas (negativo =
 * gira "ao contrário"). "inclinacao" é a inclinação do eixo em relação à
 * órbita (NASA Planetary Fact Sheet), usada no comparador.
 */
const ROTACOES = {
  mercurio: { poloAr: 281.01, poloDec: 61.41, meridiano: 329.5988, horas: 1407.6, inclinacao: 0.03 },
  venus: { poloAr: 272.76, poloDec: 67.16, meridiano: 160.20, horas: -5832.5, inclinacao: 177.4 },
  terra: { poloAr: 0, poloDec: 90, meridiano: 190.147, horas: 23.9344696, inclinacao: 23.44 },
  marte: { poloAr: 317.68, poloDec: 52.89, meridiano: 176.630, horas: 24.6229, inclinacao: 25.19 },
  jupiter: { poloAr: 268.06, poloDec: 64.50, meridiano: 284.95, horas: 9.925, inclinacao: 3.13 },
  saturno: { poloAr: 40.59, poloDec: 83.54, meridiano: 38.90, horas: 10.656, inclinacao: 26.73 },
  urano: { poloAr: 257.31, poloDec: -15.18, meridiano: 203.81, horas: -17.24, inclinacao: 97.77 },
  netuno: { poloAr: 299.33, poloDec: 42.95, meridiano: 253.18, horas: 16.11, inclinacao: 28.32 }
};

/** Gravidade na superfície (no topo das nuvens, nos gigantes), m/s² — NASA. */
const GRAVIDADES = { mercurio: 3.7, venus: 8.9, terra: 9.8, marte: 3.7, jupiter: 24.8, saturno: 10.4, urano: 8.7, netuno: 11.2 };

export const SOL = {
  id: "sol",
  nome: "Sol",
  nivel: "solar",
  tipo: "Estrela anã amarela (G2V)",
  raioKm: 696_000,
  gravidade: 274,
  temperaturaK: 5772,
  rotacao: { poloAr: 286.13, poloDec: 63.87, meridiano: 84.176, horas: 609.12, inclinacao: 7.25 },
  cor: "#ffd27a",
  resumo: "A estrela no centro do Sistema Solar. Sozinho, o Sol tem 99,86% de toda a massa do sistema.",
  curiosidade: "A luz que sai do Sol leva 8 minutos e 20 segundos para chegar à Terra: você sempre vê o Sol como ele era há 8 minutos."
};

export const PLANETAS = [
  {
    id: "mercurio", nome: "Mercúrio", tipo: "Planeta rochoso", raioKm: 2_439.7, cor: "#a9a39b",
    periodoAnos: 0.2408467,
    resumo: "O menor planeta e o mais próximo do Sol. Não tem atmosfera para segurar o calor.",
    curiosidade: "Um ano em Mercúrio dura só 88 dias terrestres."
  },
  {
    id: "venus", nome: "Vênus", tipo: "Planeta rochoso", raioKm: 6_051.8, cor: "#e8cf9a",
    periodoAnos: 0.61519726,
    resumo: "Quase do tamanho da Terra, mas coberto por nuvens de ácido e um efeito estufa fortíssimo.",
    curiosidade: "É o planeta mais quente (≈ 465 °C), mesmo sendo o segundo mais distante do Sol."
  },
  {
    id: "terra", nome: "Terra", tipo: "Planeta rochoso", raioKm: 6_371, cor: "#3f7fd6",
    periodoAnos: 1.0000174,
    resumo: "Nosso planeta: o único lugar onde sabemos que existe vida.",
    curiosidade: "A Terra viaja em volta do Sol a cerca de 30 km/s — mais de 100 mil km/h."
  },
  {
    id: "marte", nome: "Marte", tipo: "Planeta rochoso", raioKm: 3_389.5, cor: "#c1440e",
    periodoAnos: 1.8808476,
    resumo: "O planeta vermelho, com o maior vulcão do Sistema Solar (Monte Olimpo).",
    curiosidade: "A cor vem do óxido de ferro — a ferrugem — espalhado na poeira."
  },
  {
    id: "jupiter", nome: "Júpiter", tipo: "Gigante gasoso", raioKm: 69_911, cor: "#d8b48a",
    periodoAnos: 11.862615,
    resumo: "O maior planeta. Sua Grande Mancha Vermelha é uma tempestade maior que a Terra.",
    curiosidade: "Caberiam mais de 1.300 Terras dentro de Júpiter."
  },
  {
    id: "saturno", nome: "Saturno", tipo: "Gigante gasoso", raioKm: 58_232, cor: "#e3cf9c",
    periodoAnos: 29.447498,
    // Anéis principais (do anel C ao A), em raios de Saturno.
    aneis: { interno: 1.24, externo: 2.27 },
    resumo: "O planeta dos anéis, feitos de pedaços de gelo e rocha.",
    curiosidade: "Os anéis principais têm cerca de 270 mil km de diâmetro, mas em geral só uns 10 metros de espessura."
  },
  {
    id: "urano", nome: "Urano", tipo: "Gigante gelado", raioKm: 25_362, cor: "#9fe3e6",
    periodoAnos: 84.016846,
    resumo: "Um gigante de gelo que gira 'deitado', com o eixo inclinado 98°.",
    curiosidade: "Cada polo de Urano passa cerca de 42 anos seguidos de dia e depois 42 anos de noite."
  },
  {
    id: "netuno", nome: "Netuno", tipo: "Gigante gelado", raioKm: 24_622, cor: "#4b6fe0",
    periodoAnos: 164.79132,
    resumo: "O planeta mais distante, com os ventos mais rápidos do Sistema Solar.",
    curiosidade: "A luz do Sol leva cerca de 4 horas para chegar a Netuno."
  }
].map((planeta) => ({
  ...planeta, nivel: "solar", orbita: ORBITAS[planeta.id], rotacao: ROTACOES[planeta.id], gravidade: GRAVIDADES[planeta.id]
}));

// ---------------------------------------------------------------------------
// Ficha técnica e "saiba mais" do Sol e dos planetas (dados: NASA).
// Aparecem no verbete do Diário de bordo.
// ---------------------------------------------------------------------------

const FICHAS = {
  sol: {
    fonte: "https://science.nasa.gov/sun/facts/",
    saibaMais: "Com cerca de 4,6 bilhões de anos, o Sol é formado principalmente por hidrogênio e hélio. No núcleo, a fusão nuclear transforma hidrogênio em hélio e libera a energia que chega até nós. O vento solar forma a heliosfera, uma bolha que envolve todo o Sistema Solar.",
    ficha: [
      ["Tipo", "Estrela anã amarela (G2V)"],
      ["Diâmetro", "1.392.700 km (109 Terras)"],
      ["Distância da Terra", "149,6 milhões de km (1 UA)"],
      ["Rotação", "≈ 25 dias no equador"],
      ["Idade", "≈ 4,6 bilhões de anos"],
      ["Temperatura", "≈ 5.500 °C na superfície"],
      ["Núcleo", "≈ 15 milhões de °C"],
      ["Gravidade", "274 m/s² (28× a da Terra)"]
    ]
  },
  mercurio: {
    fonte: "https://science.nasa.gov/mercury/facts/",
    saibaMais: "Mercúrio é só um pouco maior que a Lua e não tem luas. A superfície cheia de crateras lembra a lunar, e o núcleo rico em ferro gera um campo magnético fraco. Quase sem atmosfera, a temperatura varia muito entre o dia e a noite.",
    ficha: [
      ["Tipo", "Planeta rochoso"],
      ["Diâmetro", "4.879 km"],
      ["Distância do Sol", "57,9 milhões de km (0,39 UA)"],
      ["Rotação", "59 dias terrestres"],
      ["Ano", "88 dias terrestres"],
      ["Luas", "Nenhuma"],
      ["Temperatura", "−180 °C a 430 °C"],
      ["Gravidade", "3,7 m/s² (38% da Terra)"]
    ]
  },
  venus: {
    fonte: "https://science.nasa.gov/venus/venus-facts/",
    saibaMais: "Chamado de “irmão da Terra” pelo tamanho parecido, Vênus tem uma atmosfera espessa de dióxido de carbono, com nuvens de ácido sulfúrico. O efeito estufa mantém a superfície perto de 465 °C, com pressão cerca de 92 vezes maior que a da Terra. No céu, é a “Estrela da Manhã” ou “da Tarde”.",
    ficha: [
      ["Tipo", "Planeta rochoso"],
      ["Diâmetro", "12.104 km"],
      ["Distância do Sol", "108,2 milhões de km (0,72 UA)"],
      ["Rotação", "243 dias terrestres (gira ao contrário)"],
      ["Ano", "225 dias terrestres"],
      ["Luas", "Nenhuma"],
      ["Temperatura", "≈ 465 °C (média)"],
      ["Gravidade", "8,9 m/s² (91% da Terra)"]
    ]
  },
  terra: {
    fonte: "https://spaceplace.nasa.gov/all-about-earth/en/",
    saibaMais: "Com cerca de 4,54 bilhões de anos, a Terra é o maior planeta rochoso. Oceanos cobrem 71% da superfície, a inclinação do eixo provoca as estações do ano, a Lua influencia as marés e as placas tectônicas renovam a superfície bem devagar.",
    ficha: [
      ["Tipo", "Planeta rochoso"],
      ["Diâmetro", "12.742 km"],
      ["Distância do Sol", "149,6 milhões de km (1 UA)"],
      ["Rotação", "23 h 56 min"],
      ["Ano", "365,25 dias"],
      ["Luas", "1 (a Lua)"],
      ["Temperatura", "≈ 15 °C (média)"],
      ["Gravidade", "9,8 m/s²"]
    ]
  },
  marte: {
    fonte: "https://science.nasa.gov/mars/facts/",
    saibaMais: "Marte tem atmosfera fina, calotas polares, vulcões e o Valles Marineris, um sistema de cânions enorme. A gravidade é cerca de 38% da terrestre e as duas luas são Fobos e Deimos. Robôs investigam se o planeta já teve vida microbiana.",
    ficha: [
      ["Tipo", "Planeta rochoso"],
      ["Diâmetro", "6.779 km"],
      ["Distância do Sol", "227,9 milhões de km (1,5 UA)"],
      ["Rotação", "24 h 37 min"],
      ["Ano", "687 dias terrestres"],
      ["Luas", "2 (Fobos e Deimos)"],
      ["Temperatura", "≈ −60 °C (média)"],
      ["Gravidade", "3,7 m/s² (38% da Terra)"]
    ]
  },
  jupiter: {
    fonte: "https://science.nasa.gov/jupiter/jupiter-facts/",
    saibaMais: "Gigante gasoso de hidrogênio e hélio, Júpiter tem um dia de cerca de 10 horas, faixas de nuvens, tempestades intensas e a magnetosfera mais forte entre os planetas. Entre as suas mais de cem luas estão Ganimedes, a maior do Sistema Solar, e Europa, que pode ter um oceano sob o gelo.",
    ficha: [
      ["Tipo", "Gigante gasoso"],
      ["Diâmetro", "139.820 km (11 Terras)"],
      ["Distância do Sol", "778 milhões de km (5,2 UA)"],
      ["Rotação", "9 h 56 min"],
      ["Ano", "11,9 anos terrestres"],
      ["Luas", "115 conhecidas (2026)"],
      ["Temperatura", "≈ −110 °C (topo das nuvens)"],
      ["Gravidade", "24,8 m/s² (2,5× a da Terra)"]
    ]
  },
  saturno: {
    fonte: "https://science.nasa.gov/saturn/facts/",
    saibaMais: "Gigante gasoso com núcleo rochoso, Saturno gira tão rápido que é o planeta mais achatado. Titã, sua maior lua, é a única com atmosfera densa e tem lagos de metano e etano. O planeta foi estudado pela sonda Cassini, e a Huygens pousou em Titã.",
    ficha: [
      ["Tipo", "Gigante gasoso"],
      ["Diâmetro", "116.460 km (9 Terras)"],
      ["Distância do Sol", "1,4 bilhão de km (9,5 UA)"],
      ["Rotação", "10 h 33 min"],
      ["Ano", "29,4 anos terrestres"],
      ["Luas", "293 conhecidas (2026)"],
      ["Temperatura", "≈ −140 °C"],
      ["Gravidade", "10,4 m/s² (1,07× a da Terra)"]
    ]
  },
  urano: {
    fonte: "https://science.nasa.gov/uranus/facts/",
    saibaMais: "Descoberto com telescópio em 1781, Urano tem atmosfera de hidrogênio, hélio e metano. O eixo inclinado cerca de 98° faz o planeta girar quase de lado e produz estações extremas. Tem anéis, luas e ventos fortes.",
    ficha: [
      ["Tipo", "Gigante gelado"],
      ["Diâmetro", "50.724 km (4 Terras)"],
      ["Distância do Sol", "2,9 bilhões de km (19,2 UA)"],
      ["Rotação", "17 h 14 min (gira de lado, eixo a 98°)"],
      ["Ano", "84 anos terrestres"],
      ["Luas", "29 conhecidas"],
      ["Temperatura", "≈ −195 °C"],
      ["Gravidade", "8,7 m/s² (89% da Terra)"]
    ]
  },
  netuno: {
    fonte: "https://science.nasa.gov/neptune/neptune-facts/",
    saibaMais: "Com massa 17 vezes a da Terra, Netuno tem os ventos mais rápidos do Sistema Solar (até cerca de 2.000 km/h) e é azul por causa do metano. Foi descoberto em 1846 por cálculos matemáticos, tem 16 luas conhecidas (Tritão é a maior) e só foi visitado pela Voyager 2, em 1989.",
    ficha: [
      ["Tipo", "Gigante gelado"],
      ["Diâmetro", "49.244 km (4 Terras)"],
      ["Distância do Sol", "4,5 bilhões de km (30 UA)"],
      ["Rotação", "16 h 6 min"],
      ["Ano", "165 anos terrestres"],
      ["Luas", "16 conhecidas"],
      ["Temperatura", "≈ −200 °C"],
      ["Gravidade", "11,2 m/s² (1,14× a da Terra)"]
    ]
  }
};

for (const objeto of [SOL, ...PLANETAS]) Object.assign(objeto, FICHAS[objeto.id]);

// ---------------------------------------------------------------------------
// Fotos do Diário de bordo: todas de agências espaciais, com o crédito exato
// que cada uma pede (copiado da página oficial da foto). As da ESA/Hubble têm
// licença CC BY 4.0: o crédito precisa aparecer junto da foto, sem mudar as
// palavras. As da NASA e do JPL são de uso livre, com crédito.
// As fotos só foram recortadas e reduzidas (quadradas, 512 px, fundo preto).
// ---------------------------------------------------------------------------

const ESA_HUBBLE = "CC BY 4.0";
const NASA_LIVRE = "uso livre, com crédito";

const FOTOS = {
  sol: {
    descricao: "Observatório de Dinâmica Solar (SDO), em luz ultravioleta extrema, 28 de março de 2013",
    credito: "NASA/SDO/AIA",
    link: "https://www.jpl.nasa.gov/images/pia17669-pulses-from-the-sun/",
    licenca: NASA_LIVRE
  },
  mercurio: {
    descricao: "Mosaico global da sonda MESSENGER, 2011",
    credito: "NASA/Johns Hopkins University Applied Physics Laboratory/Carnegie Institution of Washington",
    link: "https://science.nasa.gov/photojournal/mercury-globe-0n-180e/",
    licenca: NASA_LIVRE
  },
  venus: {
    descricao: "Sonda Mariner 10, fevereiro de 1974 (cores aproximadas, imagem reprocessada em 2020)",
    credito: "NASA/JPL-Caltech",
    link: "https://www.jpl.nasa.gov/images/pia23791-venus-from-mariner-10/",
    licenca: NASA_LIVRE
  },
  terra: {
    descricao: "Satélite Suomi NPP, 30 de março de 2014 (montagem de oito passagens)",
    credito: "NASA Earth Observatory image by Robert Simmon, using Suomi NPP VIIRS imagery from NOAA's Environmental Visualization Laboratory",
    link: "https://science.nasa.gov/earth/earth-observatory/blue-marble-eastern-hemisphere-84214/",
    licenca: NASA_LIVRE
  },
  lua: {
    descricao: "Sonda Galileo, 7 de dezembro de 1992 (cores realçadas)",
    credito: "NASA/JPL/USGS",
    link: "https://www.jpl.nasa.gov/images/pia00405-earths-moon/",
    licenca: NASA_LIVRE
  },
  marte: {
    descricao: "Telescópio Hubble, 26 de junho de 2001",
    credito: "NASA/ESA and The Hubble Heritage Team STScI/AURA",
    link: "https://esahubble.org/images/opo0124a/",
    licenca: ESA_HUBBLE
  },
  jupiter: {
    descricao: "Telescópio Hubble, 25 de agosto de 2020",
    credito: "NASA, ESA, A. Simon (Goddard Space Flight Center), and M. H. Wong (University of California, Berkeley) and the OPAL team",
    link: "https://esahubble.org/images/heic2017a/",
    licenca: ESA_HUBBLE
  },
  saturno: {
    descricao: "Telescópio Hubble, 20 de junho de 2019",
    credito: "NASA, ESA, A. Simon (Goddard Space Flight Center), and M.H. Wong (University of California, Berkeley)",
    link: "https://esahubble.org/images/heic1917a/",
    licenca: ESA_HUBBLE
  },
  urano: {
    descricao: "Telescópio Hubble, programa OPAL (divulgada em 2019)",
    credito: "NASA, ESA, A.A. Simon (NASA Goddard), and M.H. Wong and A.I. Hsu (University of California, Berkeley)",
    link: "https://esahubble.org/images/potw1906a/",
    licenca: ESA_HUBBLE
  },
  netuno: {
    descricao: "Telescópio Hubble (divulgada em 2016)",
    credito: "NASA, ESA, and M.H. Wong and J. Tollefson (UC Berkeley)",
    link: "https://esahubble.org/images/opo1622b/",
    licenca: ESA_HUBBLE
  },
  andromeda: {
    descricao: "Mosaico de mais de 600 imagens do Telescópio Hubble, 2025 (parte central)",
    credito: "NASA, ESA, B. Williams (University of Washington)",
    link: "https://esahubble.org/images/heic2501a/",
    licenca: ESA_HUBBLE
  }
};
const PASTA_DAS_FOTOS = { andromeda: "img/universo" };

export const LUA = {
  id: "lua",
  nome: "Lua",
  nivel: "solar",
  tipo: "Satélite natural da Terra",
  raioKm: 1_737.4,
  gravidade: 1.62,
  // Gira uma vez a cada volta em torno da Terra (27,3 dias): mostra sempre a mesma face.
  rotacao: { horas: 655.72, inclinacao: 6.68 },
  periodoDias: 27.32,
  cor: "#bdbab4",
  distanciaMediaKm: 384_400,
  resumo: "O único lugar fora da Terra onde seres humanos já pisaram (missões Apollo, 1969–1972).",
  curiosidade: "Todos os planetas do Sistema Solar, enfileirados, caberiam entre a Terra e a Lua.",
  fonte: "https://science.nasa.gov/moon/facts/",
  saibaMais: "A Lua provavelmente se formou há cerca de 4,5 bilhões de anos, com os destroços de uma colisão entre a Terra jovem e um corpo do tamanho de Marte. Ela gira em torno de si no mesmo tempo em que dá uma volta na Terra, por isso mostra sempre a mesma face. Sua gravidade é a principal causa das marés.",
  ficha: [
    ["Tipo", "Satélite natural"],
    ["Diâmetro", "3.475 km (27% da Terra)"],
    ["Distância da Terra", "384.400 km (média)"],
    ["Rotação", "27,3 dias (sempre a mesma face para a Terra)"],
    ["Volta na Terra", "27,3 dias"],
    ["Temperatura", "−173 °C a 127 °C"],
    ["Gravidade", "1,62 m/s² (17% da Terra)"]
  ]
};

// ---------------------------------------------------------------------------
// Sondas Voyager. Cada uma segue a hipérbole que o JPL publicou para o trecho
// depois do último planeta visitado ("Voyager 1 and 2 Hyperbolic Orbital
// Elements", S. Matousek, JPL, novembro de 1989): semieixo em km e ângulos em
// graus, com o Sol no foco, na eclíptica de 1950,0; M é a anomalia média na
// época (1º/jan/1991). A conta está em astronomia.posicaoSondaHeliocentrica.
// Conferido com a NASA (testes/): Voyager 1 a 121,6 UA do Sol em 25/ago/2012 e
// Voyager 2 a 119 UA em 5/nov/2018 (saída da heliosfera); Voyager 1 a 173,2 UA
// da Terra no instante em que a NASA marca 1 dia-luz (173,1 UA): 0,03% a mais.
// ---------------------------------------------------------------------------

/**
 * Em 18/nov/2026, às 10h16 UTC, a Voyager 1 chega a 1 dia-luz da Terra
 * (25,902 bilhões de km), segundo a NASA. A Terra vai e volta na órbita, mas
 * a sonda se afasta mais rápido: depois dessa data ela não fica mais a menos
 * de 1 dia-luz.
 */
export const VOYAGER_A_UM_DIA_LUZ = Date.UTC(2026, 10, 18, 10, 16, 7);

export const VOYAGER = {
  id: "voyager",
  nome: "Voyager 1",
  nivel: "solar",
  tipo: "Sonda espacial (NASA, lançada em 1977)",
  raioKm: 0.002,
  cor: "#f4f1e8",
  // Depois de Saturno (nov/1980): sobe 35° para o norte do plano dos planetas, rumo a Ofiúco.
  trajetoria: { epoca: "1991-01-01T00:00:00Z", aKm: -480_926_000, e: 3.724716, i: 35.762854, O: 178.197845, w: -21.671355, M: 688.967795 },
  resumo: "O objeto feito por humanos mais distante da Terra. Já saiu da bolha do vento solar e está no espaço interestelar.",
  /** O texto acompanha a data: antes e depois de a sonda chegar a 1 dia-luz. */
  get curiosidade() {
    return Date.now() < VOYAGER_A_UM_DIA_LUZ
      ? "Em 18 de novembro de 2026 ela chega a 1 dia-luz da Terra, segundo a NASA: um comando enviado daqui passa a levar 24 horas para chegar. Nenhum objeto feito por humanos foi tão longe."
      : "Desde 18 de novembro de 2026 ela está a mais de 1 dia-luz da Terra: um comando enviado daqui leva mais de 24 horas para chegar. Nenhum outro objeto feito por humanos foi tão longe.";
  },
  fontes: [
    ["NASA (onde estão as Voyager)", "https://science.nasa.gov/mission/voyager/where-are-voyager-1-and-voyager-2-now/"],
    ["NASA (ficha da missão)", "https://science.nasa.gov/mission/voyager/fact-sheet"]
  ],
  saibaMais: "Lançada em 1977, a Voyager 1 passou por Júpiter em 1979 e por Saturno em 1980. Desde então se afasta a cerca de 17 km/s, subindo 35° para o norte do plano dos planetas. Em agosto de 2012 ela saiu da heliosfera, a bolha de vento solar que envolve os planetas. Em 2026, quase 50 anos depois do lançamento, dois dos seus dez instrumentos científicos continuavam ligados.",
  ficha: [
    ["Tipo", "Sonda espacial da NASA"],
    ["Lançamento", "5 de setembro de 1977"],
    ["Visitou", "Júpiter (1979) e Saturno (1980)"],
    ["Espaço interestelar", "desde agosto de 2012"],
    ["Velocidade", "cerca de 17 km/s (61 mil km/h)"],
    ["Rumo", "35° ao norte do plano dos planetas, na direção de Ofiúco"],
    ["1 dia-luz da Terra", "18 de novembro de 2026"]
  ]
};

export const VOYAGER_2 = {
  id: "voyager-2",
  nome: "Voyager 2",
  nivel: "solar",
  tipo: "Sonda espacial (NASA, lançada em 1977)",
  raioKm: 0.002,
  cor: "#f4f1e8",
  // Depois de Netuno (ago/1989): desce 48° para o sul do plano dos planetas, rumo ao Pavão.
  trajetoria: { epoca: "1991-01-01T00:00:00Z", aKm: -601_124_000, e: 6.284578, i: 78.810177, O: 100.934989, w: 130.043962, M: 342.970736 },
  resumo: "A única sonda que já visitou Urano e Netuno. Depois dos quatro planetas gigantes, também saiu da bolha do vento solar e viaja pelo espaço interestelar.",
  curiosidade: "Foi lançada 16 dias antes da Voyager 1, mas a irmã pegou um caminho mais curto e mais rápido e chegou primeiro a Júpiter e a Saturno.",
  fontes: [
    ["NASA (Voyager 2)", "https://science.nasa.gov/mission/voyager/voyager-2/"],
    ["NASA (2018)", "https://science.nasa.gov/missions/voyager/nasas-voyager-2-probe-enters-interstellar-space/"],
    ["NASA (ficha da missão)", "https://science.nasa.gov/mission/voyager/fact-sheet"]
  ],
  saibaMais: "A Voyager 2 aproveitou um alinhamento de Júpiter, Saturno, Urano e Netuno que só acontece a cada 175 anos, mais ou menos: a gravidade de cada planeta jogou a sonda para o seguinte, e a viagem até Netuno caiu de 30 para 12 anos. Em Urano ela descobriu 10 luas. Em 5 de novembro de 2018 saiu da heliosfera, seis anos depois da irmã. Hoje se afasta a cerca de 15 km/s, descendo 48° para o sul do plano dos planetas. Em 2026, três dos seus dez instrumentos científicos continuavam ligados.",
  ficha: [
    ["Tipo", "Sonda espacial da NASA"],
    ["Lançamento", "20 de agosto de 1977"],
    ["Visitou", "Júpiter (1979), Saturno (1981), Urano (1986) e Netuno (1989)"],
    ["Espaço interestelar", "desde 5 de novembro de 2018"],
    ["Velocidade", "cerca de 15 km/s (55 mil km/h)"],
    ["Rumo", "48° ao sul do plano dos planetas, na direção do Pavão"]
  ]
};

/** As duas sondas, na ordem em que aparecem nos destinos e no Diário. */
export const SONDAS = [VOYAGER, VOYAGER_2];

// ---------------------------------------------------------------------------
// Planetas anões e o Cinturão de Asteroides.
// Ceres: elementos osculantes do JPL Small-Body Database (época JD 2458000,5);
// Plutão: elementos médios J2000 da NASA (NSSDC, Pluto Fact Sheet). Sem as
// perturbações dos planetas, a posição pode errar alguns décimos de grau.
// ---------------------------------------------------------------------------

/** Elementos de uma época (JD) → formato J2000 + taxa da longitude média (Kepler). */
function elementosDaEpoca({ a, e, I, O, w, M }, jdEpoca) {
  const grausPorDia = 0.9856076686 / a ** 1.5; // constante de Gauss
  const longitudeMedia = O + w + M - grausPorDia * (jdEpoca - 2_451_545.0);
  return {
    elementos: { a, e, I, L: longitudeMedia, w: O + w, O },
    taxas: { a: 0, e: 0, I: 0, L: grausPorDia * 36_525, w: 0, O: 0 }
  };
}

export const PLANETAS_ANOES = [
  {
    id: "ceres", nome: "Ceres", tipo: "Planeta anão (no Cinturão de Asteroides)", raioKm: 469.7, cor: "#a49f97",
    gravidade: 0.28, periodoAnos: 4.6,
    orbita: elementosDaEpoca({ a: 2.76740933, e: 0.07560729, I: 10.59321706, O: 80.30888261, w: 73.02374265, M: 309.49405514 }, 2_458_000.5),
    // Rotação: IAU WGCCRE (Archinal et al., 2018); período de 9,074 h (NASA NSSDC).
    rotacao: { poloAr: 291.418, poloDec: 66.764, meridiano: 170.65, horas: 9.074, inclinacao: 4 },
    resumo: "O maior objeto do Cinturão de Asteroides: sozinho, tem cerca de um quarto de toda a massa do cinturão.",
    curiosidade: "Foi o primeiro planeta anão visitado por uma sonda: a Dawn, da NASA, chegou lá em 2015.",
    fonte: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/asteroidfact.html",
    saibaMais: "Ceres foi descoberto em 1801 e, desde 2006, é classificado como planeta anão. Tem gelo de água misturado às rochas e manchas claras de sal no fundo de algumas crateras. A sonda Dawn orbitou Ceres de 2015 a 2018.",
    ficha: [
      ["Tipo", "Planeta anão"],
      ["Diâmetro", "939 km"],
      ["Distância do Sol", "414 milhões de km (2,8 UA)"],
      ["Rotação", "9 h 4 min"],
      ["Ano", "4,6 anos terrestres"],
      ["Luas", "Nenhuma"],
      ["Gravidade", "0,28 m/s² (3% da Terra)"]
    ]
  },
  {
    id: "plutao", nome: "Plutão", tipo: "Planeta anão", raioKm: 1_188, cor: "#c9b49a",
    gravidade: 0.62, periodoAnos: 247.94,
    orbita: {
      elementos: { a: 39.48168677, e: 0.24880766, I: 17.14175, L: 238.92881, w: 224.06676, O: 110.30347 },
      taxas: { a: 0, e: 0, I: 0, L: 145.197, w: 0, O: 0 }
    },
    // Polo positivo (regra da mão direita) e meridiano: IAU WGCCRE (Archinal et al., 2018).
    rotacao: { poloAr: 132.993, poloDec: -6.163, meridiano: 302.695, horas: 153.2928, inclinacao: 119.51 },
    resumo: "Foi chamado de planeta até 2006. É menor que a nossa Lua e tem um 'coração' de gelo de nitrogênio.",
    curiosidade: "Em 2015 a sonda New Horizons, da NASA, passou por Plutão e mostrou montanhas de gelo e uma névoa azulada.",
    fonte: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/plutofact.html",
    saibaMais: "Em 2006 a União Astronômica Internacional definiu que um planeta precisa ter 'limpado' a vizinhança da sua órbita. Plutão divide a região com muitos outros corpos gelados, o Cinturão de Kuiper, e virou o primeiro de uma nova categoria: os planetas anões. Ele tem cinco luas; a maior, Caronte, tem metade do tamanho dele.",
    ficha: [
      ["Tipo", "Planeta anão"],
      ["Diâmetro", "2.376 km"],
      ["Distância do Sol", "5,9 bilhões de km (39,5 UA)"],
      ["Rotação", "6,4 dias (gira de lado, eixo a 120°)"],
      ["Ano", "248 anos terrestres"],
      ["Luas", "5 (a maior é Caronte)"],
      ["Temperatura", "−249 °C a −235 °C"],
      ["Gravidade", "0,62 m/s² (6% da Terra)"]
    ]
  }
].map((objeto) => ({ ...objeto, nivel: "solar" }));

/**
 * Luas principais. Tamanho (raio médio) e massa: JPL/NASA (parâmetros físicos
 * dos satélites); órbitas: elementos médios do JPL (Solar System Dynamics) e
 * períodos siderais da NASA (NSSDC). aKm = semieixo maior; i, no, peri e M0 em
 * graus (inclinação em relação ao equador do planeta, nodo ascendente,
 * argumento do periastro e anomalia média em J2000). Tamanho da órbita e
 * período são os reais; a posição exata ao longo da órbita é aproximada
 * (elementos médios não servem para efemérides precisas). Todas giram
 * sincronizadas: mostram sempre a mesma face para o planeta.
 */
export const LUAS = [
  {
    id: "fobos", nome: "Fobos", pai: "marte", nomePai: "Marte", tipo: "Lua de Marte", cor: "#8f8172",
    raioKm: 11.08, gravidade: 0.0057, periodoDias: 0.31891, distanciaMediaKm: 9_375,
    orbitaDaLua: { aKm: 9_375, e: 0.015, i: 1.1, no: 169.2, peri: 216.3, M0: 189.7 },
    resumo: "A maior das duas luas de Marte: uma rocha escura e irregular, com uns 22 km, cheia de crateras.",
    curiosidade: "Está chegando mais perto de Marte, cerca de 1,8 metro a cada século: daqui a uns 50 milhões de anos ela vai cair no planeta ou se desfazer num anel.",
    fonte: "https://science.nasa.gov/mars/moons/phobos/",
    saibaMais: "Fobos dá a volta em Marte mais rápido do que Marte gira: visto do chão marciano, ele nasce no oeste e se põe no leste, duas vezes por dia. Fobos e Deimos podem ser asteroides capturados ou restos de uma grande colisão com Marte.",
    ficha: [
      ["Tipo", "Lua de Marte"],
      ["Tamanho", "27 × 22 × 18 km (formato de batata)"],
      ["Distância de Marte", "9.375 km do centro (6.000 km acima do chão)"],
      ["Volta em Marte", "7 h 39 min"],
      ["Gravidade", "0,006 m/s² (0,06% da Terra)"],
      ["Descoberta", "1877, por Asaph Hall"]
    ]
  },
  {
    id: "deimos", nome: "Deimos", pai: "marte", nomePai: "Marte", tipo: "Lua de Marte", cor: "#9b8e7f",
    raioKm: 6.2, gravidade: 0.0025, periodoDias: 1.26244, distanciaMediaKm: 23_457,
    orbitaDaLua: { aKm: 23_457, e: 0.0, i: 1.8, no: 54.3, peri: 0, M0: 205.0 },
    resumo: "A menor e mais distante das luas de Marte, com uns 12 km.",
    curiosidade: "Fobos e Deimos têm os nomes dos filhos do deus grego da guerra: Medo e Pavor.",
    fonte: "https://science.nasa.gov/mars/moons/deimos/",
    saibaMais: "Deimos tem a superfície lisa, coberta por uma camada de poeira fina que esconde a maioria das crateras. Do chão de Marte, ela parece uma estrela brilhante.",
    ficha: [
      ["Tipo", "Lua de Marte"],
      ["Tamanho", "15 × 12 × 11 km"],
      ["Distância de Marte", "23.460 km"],
      ["Volta em Marte", "30 h 18 min"],
      ["Gravidade", "0,0025 m/s² (0,03% da Terra)"],
      ["Descoberta", "1877, por Asaph Hall"]
    ]
  },
  {
    id: "io", nome: "Io", pai: "jupiter", nomePai: "Júpiter", tipo: "Lua de Júpiter (de Galileu)", cor: "#e3d26e",
    raioKm: 1_821.49, gravidade: 1.80, periodoDias: 1.769138, distanciaMediaKm: 421_800,
    orbitaDaLua: { aKm: 421_800, e: 0.004, i: 0.04, no: 0, peri: 49.1, M0: 330.9 },
    resumo: "O lugar com mais vulcões ativos de todo o Sistema Solar.",
    curiosidade: "Tem cerca de 400 vulcões ativos; alguns jogam lava a dezenas de quilômetros de altura.",
    fonte: "https://science.nasa.gov/jupiter/moons/io/",
    saibaMais: "Os vulcões de Io são aquecidos pelo 'aperta e solta' da gravidade de Júpiter e das outras luas, que deforma Io o tempo todo. O enxofre dos vulcões deixa a superfície amarela, laranja e vermelha.",
    ficha: [
      ["Tipo", "Lua de Júpiter (uma das quatro de Galileu)"],
      ["Diâmetro", "3.643 km (um pouco maior que a nossa Lua)"],
      ["Distância de Júpiter", "421.800 km"],
      ["Volta em Júpiter", "1 dia e 18 h"],
      ["Gravidade", "1,8 m/s² (18% da Terra)"],
      ["Descoberta", "1610, por Galileu Galilei"]
    ]
  },
  {
    id: "europa", nome: "Europa", pai: "jupiter", nomePai: "Júpiter", tipo: "Lua de Júpiter (de Galileu)", cor: "#d9c9ad",
    raioKm: 1_560.8, gravidade: 1.31, periodoDias: 3.551181, distanciaMediaKm: 671_100,
    orbitaDaLua: { aKm: 671_100, e: 0.009, i: 0.47, no: 184.0, peri: 45.0, M0: 345.4 },
    resumo: "Coberta por uma casca de gelo, com um oceano de água salgada embaixo.",
    curiosidade: "O oceano de Europa pode ter o dobro da água de todos os oceanos da Terra — um dos melhores lugares para procurar vida fora daqui.",
    fonte: "https://science.nasa.gov/jupiter/moons/europa/",
    saibaMais: "As listras avermelhadas são rachaduras no gelo. A sonda Europa Clipper, da NASA, lançada em 2024, vai passar dezenas de vezes por Europa para estudar o gelo e o oceano.",
    ficha: [
      ["Tipo", "Lua de Júpiter (uma das quatro de Galileu)"],
      ["Diâmetro", "3.122 km (um pouco menor que a nossa Lua)"],
      ["Distância de Júpiter", "671.100 km"],
      ["Volta em Júpiter", "3 dias e 13 h"],
      ["Gravidade", "1,3 m/s² (13% da Terra)"],
      ["Descoberta", "1610, por Galileu Galilei"]
    ]
  },
  {
    id: "ganimedes", nome: "Ganimedes", pai: "jupiter", nomePai: "Júpiter", tipo: "Lua de Júpiter (de Galileu)", cor: "#b7ada0",
    raioKm: 2_631.2, gravidade: 1.43, periodoDias: 7.154553, distanciaMediaKm: 1_070_400,
    orbitaDaLua: { aKm: 1_070_400, e: 0.001, i: 0.2, no: 58.5, peri: 198.3, M0: 324.8 },
    resumo: "A maior lua do Sistema Solar: é maior até que o planeta Mercúrio.",
    curiosidade: "É a única lua conhecida com campo magnético próprio, que até faz auroras nela.",
    fonte: "https://science.nasa.gov/jupiter/moons/ganymede/",
    saibaMais: "Ganimedes tem regiões escuras e antigas e faixas mais claras cheias de sulcos. Por baixo do gelo deve haver um oceano. A sonda JUICE, da Agência Espacial Europeia, vai entrar em órbita dela na década de 2030.",
    ficha: [
      ["Tipo", "Lua de Júpiter (uma das quatro de Galileu)"],
      ["Diâmetro", "5.262 km (maior que Mercúrio)"],
      ["Distância de Júpiter", "1,07 milhão de km"],
      ["Volta em Júpiter", "7 dias e 4 h"],
      ["Gravidade", "1,4 m/s² (15% da Terra)"],
      ["Descoberta", "1610, por Galileu Galilei"]
    ]
  },
  {
    id: "calisto", nome: "Calisto", pai: "jupiter", nomePai: "Júpiter", tipo: "Lua de Júpiter (de Galileu)", cor: "#6a5e50",
    raioKm: 2_410.3, gravidade: 1.24, periodoDias: 16.689017, distanciaMediaKm: 1_882_700,
    orbitaDaLua: { aKm: 1_882_700, e: 0.007, i: 0.3, no: 309.1, peri: 43.8, M0: 87.4 },
    resumo: "Uma das superfícies com mais crateras de todo o Sistema Solar.",
    curiosidade: "Sua superfície tem cerca de 4 bilhões de anos e quase não mudou desde então.",
    fonte: "https://science.nasa.gov/jupiter/moons/callisto/",
    saibaMais: "Calisto é escura, coberta de crateras de todos os tamanhos. A maior marca é Valhalla, uma cratera rodeada de anéis que se estendem por quase 4 mil km.",
    ficha: [
      ["Tipo", "Lua de Júpiter (uma das quatro de Galileu)"],
      ["Diâmetro", "4.821 km (quase do tamanho de Mercúrio)"],
      ["Distância de Júpiter", "1,88 milhão de km"],
      ["Volta em Júpiter", "16 dias e 17 h"],
      ["Gravidade", "1,2 m/s² (13% da Terra)"],
      ["Descoberta", "1610, por Galileu Galilei"]
    ]
  },
  {
    id: "tita", nome: "Titã", pai: "saturno", nomePai: "Saturno", tipo: "Lua de Saturno", cor: "#d9a05b",
    raioKm: 2_574.76, gravidade: 1.35, periodoDias: 15.945, distanciaMediaKm: 1_221_870,
    orbitaDaLua: { aKm: 1_221_870, e: 0.029, i: 0.3, no: 78.6, peri: 78.3, M0: 11.7 },
    resumo: "A maior lua de Saturno, envolta numa atmosfera alaranjada mais densa que a da Terra.",
    curiosidade: "Tem rios, lagos e mares — mas de metano e etano líquidos, não de água.",
    fonte: "https://science.nasa.gov/saturn/moons/titan/",
    saibaMais: "A névoa de Titã esconde a superfície; a sonda Cassini viu o chão com radar e a sonda Huygens pousou lá em 2005. A pressão do ar na superfície é cerca de 50% maior que a da Terra.",
    ficha: [
      ["Tipo", "Lua de Saturno"],
      ["Diâmetro", "5.150 km (maior que Mercúrio)"],
      ["Distância de Saturno", "1,22 milhão de km"],
      ["Volta em Saturno", "15 dias e 23 h"],
      ["Temperatura", "−179 °C na superfície"],
      ["Gravidade", "1,35 m/s² (14% da Terra)"],
      ["Descoberta", "1655, por Christiaan Huygens"]
    ]
  },
  {
    id: "encelado", nome: "Encélado", pai: "saturno", nomePai: "Saturno", tipo: "Lua de Saturno", cor: "#eef2f4",
    raioKm: 252.1, gravidade: 0.113, periodoDias: 1.370218, distanciaMediaKm: 238_040,
    orbitaDaLua: { aKm: 238_040, e: 0.005, i: 0.0, no: 0, peri: 119.5, M0: 57.0 },
    resumo: "Uma lua pequena e branquinha: reflete quase toda a luz do Sol que chega nela.",
    curiosidade: "Jatos de água saem de rachaduras perto do polo sul, as 'listras de tigre', e formam um dos anéis de Saturno.",
    fonte: "https://science.nasa.gov/saturn/moons/enceladus/",
    saibaMais: "Embaixo do gelo de Encélado há um oceano de água salgada. A sonda Cassini atravessou os jatos e encontrou água, sal e moléculas orgânicas.",
    ficha: [
      ["Tipo", "Lua de Saturno"],
      ["Diâmetro", "504 km"],
      ["Distância de Saturno", "238.000 km"],
      ["Volta em Saturno", "1 dia e 9 h"],
      ["Gravidade", "0,11 m/s² (1% da Terra)"],
      ["Descoberta", "1789, por William Herschel"]
    ]
  },
  {
    id: "tritao", nome: "Tritão", pai: "netuno", nomePai: "Netuno", tipo: "Lua de Netuno", cor: "#c9c1b6",
    raioKm: 1_352.6, gravidade: 0.78, periodoDias: 5.876854, distanciaMediaKm: 354_760,
    // Órbita retrógrada: inclinação de 157° (gira ao contrário da rotação de Netuno).
    orbitaDaLua: { aKm: 354_760, e: 0.000016, i: 157.345, no: 0, peri: 0, M0: 0 },
    resumo: "A maior lua de Netuno e a única grande lua que gira em volta do planeta ao contrário.",
    curiosidade: "Provavelmente foi capturada do Cinturão de Kuiper. Tem gêiseres de nitrogênio e é um dos lugares mais frios já medidos: −235 °C.",
    fonte: "https://science.nasa.gov/neptune/moons/triton/",
    saibaMais: "Tritão foi visto de perto uma vez só, pela Voyager 2, em 1989. Por girar ao contrário, ele está se aproximando de Netuno e um dia deve se despedaçar e virar um anel.",
    ficha: [
      ["Tipo", "Lua de Netuno"],
      ["Diâmetro", "2.705 km"],
      ["Distância de Netuno", "354.760 km"],
      ["Volta em Netuno", "5 dias e 21 h (ao contrário)"],
      ["Temperatura", "−235 °C"],
      ["Gravidade", "0,78 m/s² (8% da Terra)"],
      ["Descoberta", "1846, por William Lassell"]
    ]
  },
  {
    id: "caronte", nome: "Caronte", pai: "plutao", nomePai: "Plutão", tipo: "Lua de Plutão", cor: "#a29c94",
    raioKm: 606, gravidade: 0.29, periodoDias: 6.3872, distanciaMediaKm: 19_596,
    // Sempre em cima do mesmo ponto de Plutão (o meridiano zero dele aponta para Caronte).
    orbitaDaLua: { aKm: 19_596, e: 0, i: 0, no: 0, peri: 0, M0: 0, acompanhaRotacao: true },
    resumo: "A maior lua de Plutão: tem metade do tamanho dele.",
    curiosidade: "Plutão e Caronte estão sempre virados um para o outro e giram em volta de um ponto entre os dois, fora de Plutão.",
    fonte: "https://science.nasa.gov/dwarf-planets/pluto/moons/charon/",
    saibaMais: "Caronte tem uma grande mancha avermelhada no polo norte e um cinturão de cânions maiores que o Grand Canyon. Ela e Plutão foram fotografados de perto pela New Horizons em 2015.",
    ficha: [
      ["Tipo", "Lua de Plutão"],
      ["Diâmetro", "1.212 km (metade de Plutão)"],
      ["Distância de Plutão", "19.596 km"],
      ["Volta em Plutão", "6 dias e 9 h (o mesmo tempo que Plutão leva para girar)"],
      ["Gravidade", "0,29 m/s² (3% da Terra)"],
      ["Descoberta", "1978, por James Christy"]
    ]
  }
].map((objeto) => ({ ...objeto, nivel: "solar", categoria: "lua" }));

/**
 * O Cinturão de Asteroides é uma região, não um corpo: no explorador ele é
 * desenhado como milhares de pontos com órbitas de Kepler, e o "destino" é o
 * ponto do cinturão mais perto da nave.
 */
export const CINTURAO = {
  id: "cinturao",
  nome: "Cinturão de Asteroides",
  nivel: "solar",
  tipo: "Região entre Marte e Júpiter",
  cor: "#bba98e",
  raioInternoUA: 2.1,
  raioExternoUA: 3.3,
  resumo: "Uma faixa entre Marte e Júpiter com milhões de rochas que sobraram da formação dos planetas.",
  curiosidade: "Ao contrário dos filmes, ele é quase vazio: os asteroides maiores que 1 km ficam, em média, a centenas de milhares de km uns dos outros.",
  fonte: "https://science.nasa.gov/solar-system/asteroids/",
  saibaMais: "A NASA estima que existam de 1,1 a 1,9 milhão de asteroides com mais de 1 km no cinturão principal. Somados, eles têm menos massa que a nossa Lua. Na mesma órbita de Júpiter há ainda dois enxames, os asteroides troianos, que a sonda Lucy, da NASA, vai visitar a partir de 2027.",
  ficha: [
    ["Onde fica", "Entre Marte e Júpiter (≈ 2,1 a 3,3 UA do Sol)"],
    ["Asteroides com mais de 1 km", "≈ 1,1 a 1,9 milhão"],
    ["Massa total", "Menor que a da Lua"],
    ["Maior objeto", "Ceres (planeta anão)"]
  ]
};

// ---------------------------------------------------------------------------
// Gigantes para o comparador: galáxias e buracos negros. Raio de um buraco
// negro = raio do horizonte de eventos, Rs = 2GM/c² ≈ 2,953 km por massa solar.
// ---------------------------------------------------------------------------

export const KM_POR_MASSA_SOLAR_SCHWARZSCHILD = 2.95325;

/** Objetos que só aparecem no comparador (grandes demais ou longe demais para o explorador). */
export const GIGANTES = [
  {
    id: "via-lactea", nome: "Via Láctea", tipo: "Galáxia espiral barrada (a nossa)", categoria: "galáxia",
    cor: "#dfe6ff", diametroAnosLuz: 100_000,
    resumo: "A nossa galáxia: um disco com centenas de bilhões de estrelas. O Sol fica a uns 27 mil anos-luz do centro.",
    fonte: "https://imagine.gsfc.nasa.gov/science/featured_science/milkyway"
  },
  {
    id: "ton-618", nome: "TON 618", tipo: "Buraco negro supermassivo (no centro de um quasar)", categoria: "buraco negro",
    cor: "#ffb36b", massaSolar: 6.6e10, anosLuzViagem: 10.8e9,
    resumo: "Um dos buracos negros mais pesados já medidos: cerca de 66 bilhões de vezes a massa do Sol.",
    // Massa: Shemmer et al. (2004), ApJ 614, 547 (log M = 10,82). Outras estimativas dão ~40 bilhões.
    fonte: "https://arxiv.org/abs/astro-ph/0406559"
  }
];

// ---------------------------------------------------------------------------
// Nível 2 — Estrelas vizinhas (unidade da cena: ano-luz)
// ar = ascensão reta "h m s"; dec = declinação "±g m s" (J2000);
// mag = magnitude aparente vista da Terra (quanto menor, mais brilhante).
// ---------------------------------------------------------------------------

/**
 * Raio (em raios do Sol) e temperatura da superfície (K) das estrelas do
 * comparador: medidas publicadas (interferometria e modelos), arredondadas.
 * Nas supergigantes a incerteza é grande (o raio de Betelgeuse varia).
 */
const TAMANHOS_ESTELARES = {
  proxima: { raioSolar: 0.154, temperaturaK: 3040 },
  "alfa-centauri": { raioSolar: 1.22, temperaturaK: 5790, nomeComparador: "Alfa Centauri A" },
  sirius: { raioSolar: 1.71, temperaturaK: 9940, nomeComparador: "Sírius A" },
  vega: { raioSolar: 2.6, temperaturaK: 9600 },
  polux: { raioSolar: 9.1, temperaturaK: 4590 },
  arcturo: { raioSolar: 25.4, temperaturaK: 4290 },
  aldebara: { raioSolar: 44, temperaturaK: 3910 },
  canopus: { raioSolar: 71, temperaturaK: 7400 },
  rigel: { raioSolar: 79, temperaturaK: 12100 },
  antares: { raioSolar: 680, temperaturaK: 3600 },
  betelgeuse: { raioSolar: 764, temperaturaK: 3600 }
};

/**
 * Nome de cada estrela no SIMBAD, o banco de dados de referência do CDS
 * (Estrasburgo), de onde vêm as coordenadas, o tipo espectral e a magnitude.
 * Designações de catálogo (Bayer, Gliese, HD), que o SIMBAD sempre reconhece.
 */
const NOMES_NO_SIMBAD = {
  proxima: "Proxima Centauri", "alfa-centauri": "alf Cen", barnard: "GJ 699", "wolf-359": "Wolf 359",
  "lalande-21185": "HD 95735", sirius: "alf CMa", "luyten-726-8": "GJ 65", "ross-154": "Ross 154",
  "ross-248": "Ross 248", "epsilon-eridani": "eps Eri", "lacaille-9352": "HD 217987", "ross-128": "Ross 128",
  "61-cygni": "61 Cyg", procyon: "alf CMi", "tau-ceti": "tau Cet", altair: "alf Aql", vega: "alf Lyr",
  fomalhaut: "alf PsA", polux: "bet Gem", arcturo: "alf Boo", capela: "alf Aur", aldebara: "alf Tau",
  regulo: "alf Leo", espiga: "alf Vir", canopus: "alf Car", acrux: "alf Cru", polaris: "alf UMi",
  antares: "alf Sco", betelgeuse: "alf Ori", rigel: "bet Ori"
};

/** Endereço da estrela no SIMBAD (formato do guia do SIMBAD: sim-id?Ident=nome). */
const enderecoNoSimbad = (nome) => `https://simbad.cds.unistra.fr/simbad/sim-id?Ident=${encodeURIComponent(nome)}`;

const numeroBr = (valor, casas) => valor.toLocaleString("pt-BR", { maximumFractionDigits: casas }).replace("-", "−");

/** Como a estrela aparece no céu da Terra, pela magnitude (o olho vê até perto de 6). */
function visibilidade(magnitude) {
  if (magnitude <= 1.5) return "uma das mais brilhantes do céu";
  if (magnitude <= 6) return "visível a olho nu";
  if (magnitude <= 10) return "com binóculos ou telescópio pequeno";
  return "só com telescópio";
}

/** Ficha técnica de uma estrela, montada com os dados do próprio catálogo (a fonte é a página dela no SIMBAD). */
function fichaDaEstrela(estrela) {
  const ficha = [
    ["Tipo espectral", estrela.espectro],
    ["Brilho no céu", `Magnitude ${numeroBr(estrela.mag, 2)} (${visibilidade(estrela.mag)})`],
    ["Distância do Sol", `${numeroBr(estrela.anosLuz, 2)} anos-luz`]
  ];
  if (estrela.raioSolar) ficha.push(["Tamanho", `${numeroBr(estrela.raioSolar, estrela.raioSolar < 10 ? 2 : 0)} × o raio do Sol`]);
  if (estrela.temperaturaK) ficha.push(["Temperatura", `${numeroBr(estrela.temperaturaK, 0)} K na superfície`]);
  return ficha;
}

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
].map((estrela) => {
  const completa = { ...estrela, ...TAMANHOS_ESTELARES[estrela.id], nivel: "estrelas" };
  return {
    ...completa,
    ficha: fichaDaEstrela(completa),
    fontes: [["SIMBAD (CDS)", enderecoNoSimbad(NOMES_NO_SIMBAD[estrela.id])]]
  };
});

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
  /**
   * Braços espirais medidos pelas paralaxes de masers em regiões de formação
   * de estrelas (Reid et al., 2019, ApJ 885, 131, Tabela 2):
   *   ln(R / R_kink) = −(β − β_kink) · tan ψ
   * β = azimute visto do centro da galáxia (0° = direção do Sol, crescendo no
   * sentido da rotação); ψ = inclinação do braço antes/depois da "dobra"
   * (kink). "desenho" é o trecho desenhado: onde não há medidas (o outro lado
   * da galáxia), o braço continua com a mesma inclinação.
   */
  bracos: [
    { nome: "Braço de 3 kpc", betaKink: 15, rKinkKpc: 3.52, psiAntes: -4.2, psiDepois: -4.2, larguraKpc: 0.18, desenho: [-25, 60], forca: 0.35 },
    { nome: "Braço de Norma", betaKink: 18, rKinkKpc: 4.46, psiAntes: -1.0, psiDepois: 19.5, larguraKpc: 0.14, desenho: [-45, 70], forca: 0.7 },
    { nome: "Braço Escudo–Centauro", betaKink: 23, rKinkKpc: 4.91, psiAntes: 14.1, psiDepois: 12.1, larguraKpc: 0.23, desenho: [-195, 108], forca: 1 },
    { nome: "Braço Sagitário–Carina", betaKink: 24, rKinkKpc: 6.04, psiAntes: 17.1, psiDepois: 1.0, larguraKpc: 0.27, desenho: [-118, 96], forca: 0.9 },
    { nome: "Braço Local (de Órion)", betaKink: 9, rKinkKpc: 8.26, psiAntes: 11.4, psiDepois: 11.4, larguraKpc: 0.31, desenho: [-28, 58], forca: 0.6 },
    { nome: "Braço de Perseu", betaKink: 40, rKinkKpc: 8.87, psiAntes: 10.3, psiDepois: 8.7, larguraKpc: 0.35, desenho: [-115, 235], forca: 1 },
    { nome: "Braço Externo", betaKink: 18, rKinkKpc: 12.24, psiAntes: 3.0, psiDepois: 9.4, larguraKpc: 0.65, desenho: [-60, 120], forca: 0.6 }
  ],
  /** Barra longa: meio comprimento de 5,0 kpc, a 28° da linha Sol–centro (Wegg, Gerhard e Portail, 2015). */
  barra: { meioComprimentoKly: 16.3, anguloGraus: 28 },
  /** Disco fino: comprimento de escala de 2,6 kpc e altura de 300 pc (Bland-Hawthorn e Gerhard, 2016). */
  disco: { escalaKly: 8.5, alturaKly: 0.98 }
};

export const OBJETOS_GALAXIA = [
  {
    id: "sol-galaxia", nome: "Sol (você está aqui)", tipo: "Nossa estrela", centro: false, l: 0, b: 0, d: 0,
    cor: "#ffd27a",
    resumo: "O Sol fica num braço pequeno, o Braço de Órion, a cerca de 26.670 anos-luz do centro da galáxia.",
    curiosidade: "O Sol leva cerca de 230 milhões de anos para dar uma volta na galáxia — a última vez que esteve neste ponto, os primeiros dinossauros estavam surgindo.",
    saibaMais: "A distância até o centro foi medida seguindo a estrela S2, que dá uma volta em torno do buraco negro central a cada 16 anos: 8.178 parsecs, com erro de 0,3%. A essa distância, o Sol leva cerca de 230 milhões de anos para completar uma volta, segundo a NASA.",
    fontes: [
      ["NASA (StarChild)", "https://starchild.gsfc.nasa.gov/docs/StarChild/questions/question18.html"],
      ["GRAVITY Collaboration (2019)", "https://doi.org/10.1051/0004-6361/201935656"]
    ],
    ficha: [
      ["Onde fica", "no Braço Local (de Órion), entre os braços de Sagitário e de Perseu"],
      ["Distância do centro", "26.670 anos-luz (8.178 parsecs)"],
      ["Volta na galáxia", "cerca de 230 milhões de anos"]
    ]
  },
  {
    id: "sgr-a", nome: "Sagitário A*", tipo: "Buraco negro supermassivo", centro: true,
    cor: "#ffb36b", categoria: "buraco negro", massaSolar: 4.0e6,   // ESO/EHT (2022): ≈ 4 milhões de Sóis
    notaEscala: "🎨 O buraco negro aqui é uma ilustração ampliada mais de 1 milhão de vezes. O de verdade tem 24 milhões de km de diâmetro e seria invisível nesta escala.",
    resumo: "O buraco negro no centro da Via Láctea, com cerca de 4 milhões de vezes a massa do Sol.",
    curiosidade: "Em 2022 o Event Horizon Telescope mostrou a primeira imagem da 'sombra' dele.",
    saibaMais: "A imagem, divulgada em 12 de maio de 2022, foi feita com uma rede de radiotelescópios espalhados pelo planeta, que juntos funcionam como um telescópio do tamanho da Terra. Ela mostra um anel de gás brilhante em volta de uma região escura, a 'sombra' do buraco negro. A massa é conhecida pelo movimento das estrelas que giram em volta dele.",
    fontes: [
      ["ESO (2022)", "https://www.eso.org/public/news/eso2208-eht-mw/"],
      ["GRAVITY Collaboration (2019)", "https://doi.org/10.1051/0004-6361/201935656"]
    ],
    ficha: [
      ["Massa", "cerca de 4 milhões de vezes a do Sol"],
      ["Diâmetro", "cerca de 24 milhões de km (o horizonte de eventos, calculado pela massa)"],
      ["Distância do Sol", "26.670 anos-luz (8.178 parsecs)"],
      ["Primeira imagem", "12 de maio de 2022 (Event Horizon Telescope)"]
    ]
  },
  {
    id: "pleiades", nome: "Plêiades (Sete Estrelo)", tipo: "Aglomerado aberto de estrelas", l: 166.57, b: -23.52, d: 0.445,
    cor: "#a9c4ff",
    resumo: "Um grupo de estrelas jovens e azuis que nasceram juntas, na constelação de Touro.",
    curiosidade: "Muitos povos indígenas do Brasil usavam o aparecimento das Plêiades no céu para marcar o calendário.",
    saibaMais: "O nome popular fala em sete estrelas, mas o aglomerado tem mais de mil, segundo a NASA. É um dos objetos mais fáceis de achar no céu: tem magnitude 1,6 e aparece melhor nas noites de dezembro. Também é chamado de M45, o número dele no catálogo de Charles Messier.",
    fontes: [["NASA (Hubble, catálogo Messier)", "https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-45/"]],
    ficha: [
      ["Tipo", "Aglomerado aberto de estrelas (M45)"],
      ["Distância do Sol", "cerca de 445 anos-luz"],
      ["Estrelas", "mais de mil"],
      ["Brilho no céu", "magnitude 1,6 (visível a olho nu)"],
      ["Constelação", "Touro"],
      ["Melhor época", "dezembro"]
    ]
  },
  {
    id: "orion-nebula", nome: "Nebulosa de Órion", tipo: "Berçário de estrelas", l: 209.01, b: -19.38,
    d: 1.35,                           // 414 pc (Menten et al., 2007, paralaxe com o radiotelescópio VLBA)
    cor: "#ff7aa8",
    resumo: "Uma nuvem enorme de gás e poeira onde novas estrelas estão nascendo agora.",
    curiosidade: "Dá para ver a olho nu, como uma 'manchinha' na espada de Órion, pertinho das Três Marias.",
    saibaMais: "É um dos berçários de estrelas mais próximos da Terra. No centro ficam quatro estrelas jovens e muito pesadas, o Trapézio, que iluminam a nuvem. A distância foi medida por paralaxe com radiotelescópios: 414 parsecs, uns 1.350 anos-luz (a NASA arredonda para 1.500). No céu ela tem magnitude 4 e aparece melhor em janeiro.",
    fontes: [
      ["NASA (Hubble, catálogo Messier)", "https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-42/"],
      ["Menten et al. (2007)", "https://doi.org/10.1051/0004-6361:20078247"]
    ],
    ficha: [
      ["Tipo", "Nebulosa de emissão, berçário de estrelas (M42)"],
      ["Distância do Sol", "cerca de 1.350 anos-luz (414 parsecs)"],
      ["Estrelas do centro", "o Trapézio: quatro estrelas jovens e muito pesadas"],
      ["Brilho no céu", "magnitude 4 (visível a olho nu)"],
      ["Constelação", "Órion"],
      ["Melhor época", "janeiro"]
    ]
  },
  {
    id: "crab", nome: "Nebulosa do Caranguejo", tipo: "Resto de supernova", l: 184.56, b: -5.78, d: 6.5,
    cor: "#ffa26b",
    resumo: "O que sobrou de uma estrela que explodiu. No centro gira uma estrela de nêutrons.",
    curiosidade: "A explosão foi vista na Terra em 1054 e registrada por astrônomos chineses: brilhou até de dia.",
    saibaMais: "Os astrônomos chineses chamaram a explosão de 'estrela convidada': ela ficou visível de dia por quase um mês. O que sobrou do centro da estrela é um pulsar, uma estrela de nêutrons que gira 30 vezes por segundo. A nuvem de gás em volta tem uns 6 anos-luz de largura e continua se expandindo.",
    fontes: [["NASA (Hubble, catálogo Messier)", "https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-1/"]],
    ficha: [
      ["Tipo", "Resto de supernova (M1)"],
      ["Distância do Sol", "cerca de 6.500 anos-luz"],
      ["Tamanho", "uns 6 anos-luz de largura"],
      ["Explosão vista em", "1054 (registrada na China)"],
      ["No centro", "um pulsar que gira 30 vezes por segundo"],
      ["Constelação", "Touro"]
    ]
  },
  {
    id: "eagle", nome: "Nebulosa da Águia", tipo: "Berçário de estrelas", l: 16.95, b: 0.79, d: 7.0,
    cor: "#ff9a6b",
    resumo: "Casa dos famosos 'Pilares da Criação', colunas de gás onde nascem estrelas.",
    curiosidade: "Os Pilares foram fotografados pelo Hubble em 1995 e de novo pelo James Webb em 2022.",
    saibaMais: "Os Pilares da Criação são colunas de gás frio e poeira com 4 a 5 anos-luz de altura, mais ou menos a distância do Sol até a estrela mais próxima. A luz forte das estrelas jovens vizinhas vai desgastando as colunas, e nas partes mais densas novas estrelas se formam. A nebulosa foi descoberta em 1745 pelo astrônomo suíço Jean-Philippe Loys de Chéseaux.",
    fontes: [["NASA (Hubble, catálogo Messier)", "https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-16/"]],
    ficha: [
      ["Tipo", "Nebulosa de emissão, berçário de estrelas (M16)"],
      ["Distância do Sol", "cerca de 7.000 anos-luz"],
      ["Tamanho dos Pilares", "4 a 5 anos-luz de altura"],
      ["Constelação", "Serpente"],
      ["Descoberta", "1745, por Jean-Philippe Loys de Chéseaux"]
    ]
  },
  {
    id: "carina", nome: "Nebulosa de Carina", tipo: "Berçário de estrelas", l: 287.6, b: -0.63, d: 7.5,
    cor: "#ff8f8f",
    resumo: "Uma das maiores nebulosas da galáxia, com algumas das estrelas mais pesadas conhecidas.",
    curiosidade: "Dentro dela está Eta Carinae, uma estrela que pode explodir a qualquer momento (em termos astronômicos).",
    saibaMais: "A nebulosa tem uns 300 anos-luz de largura e fica no céu do sul, por isso é bem vista do Brasil. Eta Carinae é um par de estrelas: a maior tem cerca de 100 vezes a massa do Sol e emite uns 5 milhões de vezes mais luz que ele, segundo a NASA. A nebulosa foi descoberta em 1752 pelo francês Nicolas-Louis de Lacaille.",
    fontes: [["NASA (Hubble, catálogo Caldwell)", "https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-caldwell-catalog/caldwell-92/"]],
    ficha: [
      ["Tipo", "Nebulosa de emissão, berçário de estrelas (Caldwell 92)"],
      ["Distância do Sol", "cerca de 7.500 anos-luz"],
      ["Tamanho", "uns 300 anos-luz de largura"],
      ["Estrela mais famosa", "Eta Carinae, uns 5 milhões de vezes mais luminosa que o Sol"],
      ["Constelação", "Carina (a Quilha)"],
      ["Descoberta", "1752, por Nicolas-Louis de Lacaille"]
    ]
  },
  {
    id: "omega-centauri", nome: "Ômega Centauri", tipo: "Aglomerado globular", l: 309.10, b: 14.97, d: 17,
    cor: "#ffe6a8",
    resumo: "Uma bola com cerca de 10 milhões de estrelas velhas, fora do disco da galáxia.",
    curiosidade: "Pode ser o núcleo de uma pequena galáxia que a Via Láctea 'engoliu' há muito tempo.",
    saibaMais: "É o maior aglomerado globular da Via Láctea. A olho nu parece uma estrela meio borrada, e foi assim que Ptolomeu o registrou há quase 2 mil anos. Em 1677, Edmond Halley percebeu que não era uma estrela. Fica na constelação do Centauro, no céu do sul.",
    fontes: [["NASA (Hubble, catálogo Caldwell)", "https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-caldwell-catalog/caldwell-80/"]],
    ficha: [
      ["Tipo", "Aglomerado globular (Caldwell 80)"],
      ["Distância do Sol", "cerca de 17.000 anos-luz"],
      ["Estrelas", "cerca de 10 milhões"],
      ["Constelação", "Centauro"],
      ["Reconhecido como aglomerado", "1677, por Edmond Halley"]
    ]
  },
  // -------------------------------------------------------------------------
  // Galáxias vizinhas. Além de l, b e d, cada uma tem o centro no céu (ar,
  // dec, J2000) e a geometria medida, que os modelos 3D usam para ficar
  // virados como de verdade (astronomia.geometriaDoDisco):
  //   disco.pa          ângulo de posição do eixo maior (graus, do norte para o leste);
  //   disco.inclinacao  0° = de frente, 90° = de lado;
  //   disco.ladoProximo ângulo de posição do lado do disco mais perto de nós;
  //   disco.giro        sentido do giro visto da Terra (dos mapas de velocidade).
  // "regioes" são lugares de verdade (posição no céu e tamanho aproximado em
  // mil anos-luz): o modelo os põe no ponto certo do disco.
  // -------------------------------------------------------------------------
  {
    id: "lmc", nome: "Grande Nuvem de Magalhães", tipo: "Galáxia satélite da Via Láctea",
    ar: "05 23 34.5", dec: "-69 45 22", l: 280.47, b: -32.89,
    d: 161.7,                          // 49,59 kpc (Pietrzyński et al., 2019, eclipses de estrelas duplas)
    cor: "#cfd8ff", categoria: "galáxia",
    diametroAnosLuz: 14_000,           // corpo principal (NASA, Swift, 2013; ESO, 2018)
    // Disco das estrelas velhas: i = 34°, linha dos nodos a 139° e giro no sentido
    // horário visto daqui (van der Marel e Kallivayalil, 2014); o lado nordeste é o
    // mais próximo e a escala do disco é 1,44° ≈ 4 mil anos-luz (van der Marel, 2001).
    disco: { pa: 139.1, inclinacao: 34, ladoProximo: 49.1, giro: "horario", escalaGraus: 1.44 },
    centroDoDisco: { ar: "05 19 31.2", dec: "-69 35 24" },   // centro da rotação (van der Marel e Kallivayalil, 2014)
    // Barra fora do centro: máximo de estrelas em 5h25,1m, −69°47′; ângulo de 112° a 126° (van der Marel, 2001).
    barra: { ar: "05 25 06", dec: "-69 47 00", pa: 120, meioComprimentoGraus: 1.6, razao: 0.4 },
    regioes: [
      { id: "tarantula", nome: "Nebulosa da Tarântula (30 Doradus)", ar: "05 38 42", dec: "-69 06 03", raioKly: 0.6 },   // mais de 1.000 anos-luz (ESO, 2018)
      { id: "n11", nome: "N11", ar: "04 56 48", dec: "-66 24 00", raioKly: 0.3 },
      { id: "n44", nome: "N44", ar: "05 22 01", dec: "-67 57 00", raioKly: 0.15 }
    ],
    resumo: "Uma galáxia anã que gira em volta da Via Láctea, visível a olho nu no Hemisfério Sul. Tem uma barra de estrelas fora do centro e um só braço espiral.",
    curiosidade: "Em 1987 uma estrela explodiu lá, perto da Nebulosa da Tarântula: a supernova 1987A, uma das explosões de estrela mais brilhantes vistas da Terra em mais de 400 anos.",
    saibaMais: "É a maior das galáxias que giram em volta da Via Láctea: tem uns 14 mil anos-luz de diâmetro, um décimo do tamanho da nossa galáxia, e só 1% da massa dela. A distância de 162 mil anos-luz foi medida com erro de 1%, usando pares de estrelas que passam uma na frente da outra (estrelas binárias eclipsantes). O disco é visto quase de frente e gira no sentido horário visto daqui.",
    fontes: [
      ["NASA (Swift, 2013)", "https://www.nasa.gov/universe/nasas-swift-produces-best-ultraviolet-maps-of-the-nearest-galaxies"],
      ["NASA (Hubble, 2007)", "https://science.nasa.gov/missions/hubble/nasas-hubble-telescope-celebrates-sn-1987as-20th-anniversary/"],
      ["ESO (2018)", "https://www.eso.org/public/news/eso1816/"],
      ["Pietrzyński et al. (2019)", "https://doi.org/10.1038/s41586-019-0999-4"],
      ["van der Marel e Kallivayalil (2014)", "https://doi.org/10.1088/0004-637X/781/2/121"]
    ],
    ficha: [
      ["Diâmetro", "cerca de 14 mil anos-luz (o corpo principal)"],
      ["Distância do Sol", "162 mil anos-luz (49,6 mil parsecs)"],
      ["Maior berçário", "Nebulosa da Tarântula, com mais de 1.000 anos-luz"],
      ["Forma", "barra fora do centro e um só braço espiral"],
      ["Inclinação do disco", "cerca de 34° (vemos quase de frente)"]
    ]
  },
  {
    id: "smc", nome: "Pequena Nuvem de Magalhães", tipo: "Galáxia satélite da Via Láctea",
    ar: "00 52 44.8", dec: "-72 49 43", l: 302.80, b: -44.30,
    d: 203.7,                          // 62,44 kpc (Graczyk et al., 2020)
    cor: "#c4ccff", categoria: "galáxia",
    diametroAnosLuz: 7_000,            // NASA (Swift, 2013)
    // Não é um disco: é alongada na direção da Terra. As estrelas velhas ocupam
    // ≈ 7 kpc de profundidade (Graczyk et al., 2020); as jovens formam uma "barra"
    // de nordeste a sudoeste, com o nordeste mais perto de nós, e a "Asa" a leste,
    // na direção da Grande Nuvem (Zaritsky et al., 2000; Ripepi et al., 2017).
    corpo: { profundidadeKly: 22.8, paBarra: 45, inclinacaoDoEixo: 70 },
    regioes: [
      { id: "ngc346", nome: "NGC 346", ar: "00 59 05.2", dec: "-72 10 38", raioKly: 0.1 }
    ],
    resumo: "A irmã menor da Grande Nuvem, também visível do Brasil longe das luzes da cidade. É uma galáxia anã irregular, esticada pela gravidade da vizinha.",
    curiosidade: "É mais funda do que larga: tem uns 7 mil anos-luz de largura no céu, mas as estrelas dela ocupam uns 23 mil anos-luz na direção da Terra.",
    saibaMais: "Tem metade do tamanho da Grande Nuvem e cerca de dois terços da massa dela. A distância de 204 mil anos-luz foi medida com erro menor que 2%, com estrelas binárias eclipsantes. A gravidade da Grande Nuvem esticou a Pequena: a parte nordeste está mais perto de nós, e entre as duas há uma ponte de gás e de estrelas jovens.",
    fontes: [
      ["NASA (Swift, 2013)", "https://www.nasa.gov/universe/nasas-swift-produces-best-ultraviolet-maps-of-the-nearest-galaxies"],
      ["Graczyk et al. (2020)", "https://doi.org/10.3847/1538-4357/abbb2b"],
      ["Ripepi et al. (2017)", "https://doi.org/10.1093/mnras/stx2096"],
      ["Belokurov et al. (2017)", "https://doi.org/10.1093/mnras/stw3357"]
    ],
    ficha: [
      ["Diâmetro", "cerca de 7 mil anos-luz"],
      ["Distância do Sol", "204 mil anos-luz (62,4 mil parsecs)"],
      ["Profundidade", "cerca de 23 mil anos-luz na direção da Terra"],
      ["Maior berçário", "NGC 346, na ponta nordeste"],
      ["Ponte de Magalhães", "gás e estrelas jovens que ligam as duas Nuvens"]
    ]
  },
  {
    id: "andromeda", nome: "Galáxia de Andrômeda", tipo: "Galáxia espiral vizinha (M31)",
    ar: "00 42 44.3", dec: "+41 16 09", l: 121.17, b: -21.57,
    d: 2482,                           // 761 kpc (Li et al., 2021, cefeidas com o Hubble)
    cor: "#e6dcff",
    categoria: "galáxia", diametroAnosLuz: 220_000,   // NASA (Hubble, 2025): "mais de 200 mil anos-luz" de diâmetro
    // i = 77° e eixo maior a 38° (Carignan et al., 2006). O
    // lado próximo é o noroeste e o nordeste se afasta de nós (Chemin, Carignan e
    // Foster, 2009): visto daqui, o disco gira no sentido anti-horário.
    // Disco exponencial de 5,3 kpc e bojo de Sérsic n = 2,2 com Re = 1,0 kpc (Courteau et al., 2011);
    // anel de formação de estrelas de 43′ de raio, partido perto de M32, e dois braços
    // de 9° e 9,5° de inclinação (Gordon et al., 2006); barra de 4 kpc vista a 55,7°
    // (Blaña Díaz et al., 2017).
    disco: { pa: 38, inclinacao: 77, ladoProximo: 308, giro: "anti-horario" },
    regioes: [
      { id: "ngc206", nome: "NGC 206", ar: "00 40 31.3", dec: "+40 44 21", raioKly: 2 },   // ≈ 4.000 anos-luz (NASA)
      // Satélites (McConnachie, 2012): raio de meia-luz, achatamento e ângulo no céu.
      // M32 fica na distância de Andrômeda (na frente do disco); M110, 41 kpc atrás.
      { id: "m32", nome: "M32", ar: "00 42 41.8", dec: "+40 51 55", raioMeiaLuzKly: 0.36, elipticidade: 0.25, pa: 159, atrasKly: 0 },
      { id: "m110", nome: "M110", ar: "00 40 22.1", dec: "+41 41 07", raioMeiaLuzKly: 1.92, elipticidade: 0.43, pa: 28, atrasKly: 134 }
    ],
    resumo: "A grande galáxia mais próxima, com cerca de 1 trilhão de estrelas. É um dos objetos mais distantes que dá para ver a olho nu.",
    curiosidade: "Andrômeda e a Via Láctea se aproximam a ≈ 110 km/s e podem se fundir daqui a bilhões de anos (estudos de 2025 estimam uma chance de cerca de 50% nos próximos 10 bilhões de anos).",
    saibaMais: "É uma galáxia espiral como a Via Láctea, só que maior: o disco passa de 200 mil anos-luz e tem cerca de 1 trilhão de estrelas. A distância de 2,48 milhões de anos-luz foi medida pelo Hubble com estrelas cefeidas, que piscam num ritmo ligado ao brilho verdadeiro delas. A foto é um mosaico de mais de 600 imagens do Hubble, montado em mais de 10 anos, que mostra 200 milhões de estrelas.",
    fontes: [
      ["NASA (Hubble, 2025)", "https://science.nasa.gov/missions/hubble/nasas-hubble-traces-hidden-history-of-andromeda-galaxy/"],
      ["NASA (Hubble, 2012)", "https://science.nasa.gov/missions/hubble/nasas-hubble-shows-milky-way-is-destined-for-head-on-collision-with-andromeda-galaxy"],
      ["Li et al. (2021)", "https://doi.org/10.3847/1538-4357/ac1597"],
      ["Sawala et al. (2025)", "https://doi.org/10.1038/s41550-025-02563-1"]
    ],
    ficha: [
      ["Diâmetro", "mais de 200 mil anos-luz"],
      ["Estrelas", "cerca de 1 trilhão"],
      ["Distância do Sol", "2,48 milhões de anos-luz (761 mil parsecs)"],
      ["Maior berçário", "NGC 206, nuvem de estrelas jovens de uns 4 mil anos-luz"],
      ["Satélites", "M32 e M110 são os mais brilhantes"],
      ["Inclinação do disco", "77° (vemos quase de lado)"]
    ]
  },
  {
    id: "triangulo", nome: "Galáxia do Triângulo", tipo: "Galáxia espiral vizinha (M33)",
    ar: "01 33 50.9", dec: "+30 39 36", l: 133.61, b: -31.33,
    d: 2740,                           // 840 kpc (Breuval et al., 2023, cefeidas com o Hubble)
    cor: "#cddcff", categoria: "galáxia",
    diametroAnosLuz: 60_000,           // ESA/Hubble (2019)
    // i = 52° e eixo maior a 22,5°; a metade norte se aproxima de nós (Kam et al., 2017).
    // Os braços são do tipo "Z" e o lado próximo é o noroeste (Andrae e Jahnke, 2011):
    // visto daqui, gira no sentido horário. Disco de 1,6 kpc
    // (Kam et al., 2017) e braços abertos, de ≈ 42° (Seigar et al., 2008). Sem bojo.
    disco: { pa: 22.5, inclinacao: 52, ladoProximo: 292.5, giro: "horario" },
    regioes: [
      { id: "ngc604", nome: "NGC 604", ar: "01 34 32.9", dec: "+30 47 04", raioKly: 0.65 }   // uns 1.300 anos-luz (NASA, Webb, 2024)
    ],
    resumo: "A terceira maior galáxia do Grupo Local, depois de Andrômeda e da Via Láctea. Não tem bojo nem barra: é um disco cheio de gás onde nascem muitas estrelas.",
    curiosidade: "Num céu bem escuro dá para vê-la a olho nu, como uma mancha bem fraca. A luz que chega dela hoje saiu de lá há uns 2,7 milhões de anos.",
    saibaMais: "Tem uns 60 mil anos-luz de diâmetro e cerca de 40 bilhões de estrelas, pelo menos dez vezes menos que a Via Láctea. Mesmo menor, forma estrelas novas num ritmo de cerca de 1 Sol a cada 2 anos. No berçário NGC 604, com uns 1.300 anos-luz, há mais de 200 estrelas das mais quentes e pesadas que existem.",
    fontes: [
      ["ESA/Hubble (2019)", "https://esahubble.org/news/heic1901/"],
      ["NASA (Webb, 2024)", "https://science.nasa.gov/missions/webb/peering-into-the-tendrils-of-ngc-604-with-nasas-webb/"],
      ["Breuval et al. (2023)", "https://doi.org/10.3847/1538-4357/acd3f4"],
      ["Kam et al. (2017)", "https://doi.org/10.3847/1538-3881/aa79f3"]
    ],
    ficha: [
      ["Diâmetro", "cerca de 60 mil anos-luz"],
      ["Estrelas", "cerca de 40 bilhões"],
      ["Distância do Sol", "2,74 milhões de anos-luz (840 mil parsecs)"],
      ["Maior berçário", "NGC 604, com uns 1.300 anos-luz"],
      ["Estrelas novas", "cerca de 1 Sol a cada 2 anos"],
      ["Inclinação do disco", "52°"]
    ]
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
    id: "galileu", nome: "As luas de Galileu", nivel: "solar",
    objetivo: "Descubra Io, Europa, Ganimedes e Calisto, as quatro luas que Galileu viu em 1610.",
    dica: "Viaje até Júpiter: em órbita, afaste-se com a rodinha ou S para ver as quatro luas em volta dele.",
    condicao: { tipo: "descobrir", ids: ["io", "europa", "ganimedes", "calisto"] }
  },
  {
    id: "voyager", nome: "Até onde já fomos", nivel: "solar",
    objetivo: "Alcance a Voyager 1, o objeto humano mais distante.",
    dica: "Ela está bem além de Netuno, a mais de 170 UA do Sol.",
    condicao: { tipo: "descobrir", ids: ["voyager"] }
  },
  {
    id: "voyagers", nome: "As gêmeas Voyager", nivel: "solar",
    objetivo: "Descubra as duas sondas Voyager, lançadas em 1977.",
    dica: "Elas foram para lados diferentes: a Voyager 1 subiu para o norte do plano dos planetas e a Voyager 2 desceu para o sul. As duas estão a mais de 140 UA do Sol.",
    condicao: { tipo: "descobrir", ids: ["voyager", "voyager-2"] }
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
    id: "grupo-local", nome: "Os vizinhos", nivel: "galaxia",
    objetivo: "Descubra as duas Nuvens de Magalhães, Andrômeda e a Galáxia do Triângulo.",
    dica: "As Nuvens estão a uns 160 e 200 mil anos-luz; Andrômeda e o Triângulo, a mais de 2 milhões. Use o salto!",
    condicao: { tipo: "descobrir", ids: ["lmc", "smc", "andromeda", "triangulo"] }
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
// Quiz: um desafio por objeto (todos têm o seu), liberado quando o objeto é
// descoberto. As respostas saem da ficha e das fontes do próprio verbete.
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
    id: "q-io", objeto: "io",
    pergunta: "O que deixa a superfície de Io amarela e alaranjada?",
    opcoes: ["Ferrugem, como em Marte", "Enxofre dos vulcões", "Gelo sujo de poeira", "A luz de Júpiter"],
    certa: 1,
    explicacao: "Io é o lugar com mais vulcões ativos do Sistema Solar, e o enxofre que eles soltam pinta o chão de amarelo, laranja e vermelho."
  },
  {
    id: "q-europa", objeto: "europa",
    pergunta: "Por que Europa é um dos melhores lugares para procurar vida fora da Terra?",
    opcoes: ["Tem florestas", "Tem um oceano de água salgada embaixo do gelo", "É a lua mais quente", "Tem ar igual ao da Terra"],
    certa: 1,
    explicacao: "Embaixo da casca de gelo há um oceano de água salgada, que pode ter o dobro da água dos oceanos da Terra (NASA)."
  },
  {
    id: "q-tita", objeto: "tita",
    pergunta: "Do que são feitos os lagos e mares de Titã?",
    opcoes: ["Água", "Lava", "Metano e etano líquidos", "Areia"],
    certa: 2,
    explicacao: "Titã é tão frio (−179 °C) que o metano e o etano, que na Terra são gases, ficam líquidos e formam rios, lagos e mares."
  },
  {
    id: "q-fobos", objeto: "fobos",
    pergunta: "Fobos chega 1,8 metro mais perto de Marte a cada século. O que deve acontecer com ela daqui a uns 50 milhões de anos?",
    opcoes: ["Vai escapar e virar um planeta", "Vai cair em Marte ou se despedaçar e virar um anel", "Nada: a órbita dela não muda"],
    certa: 1,
    explicacao: "Segundo a NASA, nesse ritmo Fobos acaba caindo em Marte ou se despedaçando, e os pedaços formariam um anel em volta do planeta."
  },
  {
    id: "q-deimos", objeto: "deimos",
    pergunta: "A nossa Lua leva 27 dias para dar uma volta na Terra. Quanto tempo Deimos leva para dar uma volta em Marte?",
    opcoes: ["Cerca de 30 horas", "Cerca de 30 dias", "Cerca de 3 anos"],
    certa: 0,
    explicacao: "Deimos fica a só 23.460 km de Marte e completa a volta em 30 horas e 18 minutos. Fobos, ainda mais perto, leva 7 horas e 39 minutos."
  },
  {
    id: "q-ganimedes", objeto: "ganimedes",
    pergunta: "O que Ganimedes tem que nenhuma outra lua conhecida tem?",
    opcoes: ["Vulcões ativos", "Um campo magnético próprio", "Mares de metano"],
    certa: 1,
    explicacao: "Ganimedes é a maior lua do Sistema Solar e a única com campo magnético próprio, que produz auroras nela. Os vulcões ativos são de Io, e os mares de metano, de Titã."
  },
  {
    id: "q-calisto", objeto: "calisto",
    pergunta: "Por que Calisto é um dos astros com mais crateras do Sistema Solar?",
    opcoes: ["Porque a superfície é muito antiga e quase não mudou em 4 bilhões de anos", "Porque tem muitos vulcões", "Porque fica muito perto do Sol"],
    certa: 0,
    explicacao: "Quase sem atividade que renove o chão, as marcas das batidas de asteroides e cometas foram se acumulando. Segundo a NASA, a superfície de Calisto tem cerca de 4 bilhões de anos."
  },
  {
    id: "q-encelado", objeto: "encelado",
    pergunta: "De onde vem o material do anel E, um dos anéis de Saturno?",
    opcoes: ["Dos jatos de água e gelo que saem de Encélado", "Da poeira dos desertos de Titã", "De pedaços do próprio Saturno"],
    certa: 0,
    explicacao: "Os jatos saem das 'listras de tigre', rachaduras perto do polo sul de Encélado. O gelo que escapa da lua forma o anel E, segundo a NASA."
  },
  {
    id: "q-tritao", objeto: "tritao",
    pergunta: "O que Tritão tem de diferente de todas as outras luas grandes?",
    opcoes: ["Gira em volta do planeta no sentido contrário ao da rotação dele", "É maior que o planeta em volta do qual gira", "Não tem gravidade"],
    certa: 0,
    explicacao: "A órbita 'ao contrário' indica que Tritão não nasceu junto com Netuno: provavelmente veio do Cinturão de Kuiper e foi capturado pela gravidade do planeta."
  },
  {
    id: "q-caronte", objeto: "caronte",
    pergunta: "Qual é o tamanho de Caronte comparado com Plutão?",
    opcoes: ["É cem vezes menor", "Tem cerca de metade do diâmetro", "É duas vezes maior"],
    certa: 1,
    explicacao: "Caronte tem 1.212 km, metade do diâmetro de Plutão. Segundo a NASA, nenhuma outra lua conhecida é tão grande em comparação com o astro em volta do qual gira."
  },
  {
    id: "q-ceres", objeto: "ceres",
    pergunta: "Quanto da massa de todo o Cinturão de Asteroides está só em Ceres?",
    opcoes: ["Quase nada (1%)", "Cerca de um quarto (25%)", "Metade (50%)", "Tudo (100%)"],
    certa: 1,
    explicacao: "Segundo a NASA, Ceres sozinho tem cerca de 25% da massa do cinturão. O resto está espalhado em milhões de rochas bem menores."
  },
  {
    id: "q-plutao", objeto: "plutao",
    pergunta: "Por que Plutão deixou de ser chamado de planeta em 2006?",
    opcoes: ["Porque ele se partiu ao meio", "Porque não 'limpou' a vizinhança da sua órbita", "Porque saiu do Sistema Solar", "Porque não é redondo"],
    certa: 1,
    explicacao: "A União Astronômica Internacional decidiu que um planeta precisa ser o corpo dominante da sua órbita. Plutão divide a região com muitos corpos gelados e virou um planeta anão."
  },
  {
    id: "q-cinturao", objeto: "cinturao",
    pergunta: "Uma nave atravessando o Cinturão de Asteroides precisa desviar de rochas o tempo todo?",
    opcoes: ["Sim, elas estão coladas umas nas outras", "Não: em média, ficam a centenas de milhares de km umas das outras", "Sim, mas só de dia", "Ninguém nunca atravessou o cinturão"],
    certa: 1,
    explicacao: "O cinturão é quase vazio. Segundo a equipe da sonda Lucy, da NASA, ela cruza o cinturão sem precisar ligar os motores para desviar de nenhuma rocha."
  },
  {
    id: "q-voyager", objeto: "voyager",
    pergunta: "Lançada em 1977, a Voyager 1 está tão longe que um sinal de rádio (que viaja na velocidade da luz) leva quanto tempo para chegar até ela?",
    opcoes: ["Cerca de 1 minuto", "Cerca de 1 hora", "Cerca de 1 dia inteiro"],
    certa: 2,
    explicacao: "A mais de 170 UA do Sol, a Voyager 1 chega em novembro de 2026 a 1 dia-luz da Terra, segundo a NASA: mandar um comando e receber a resposta demora uns 2 dias."
  },
  {
    id: "q-voyager-2", objeto: "voyager-2",
    pergunta: "Qual é a única sonda que já visitou Urano e Netuno?",
    opcoes: ["Voyager 1", "Voyager 2", "New Horizons"],
    certa: 1,
    explicacao: "A Voyager 2 passou por Urano em 1986 e por Netuno em 1989. A Voyager 1 visitou Júpiter e Saturno, e a New Horizons, Plutão."
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
    id: "q-barnard", objeto: "barnard",
    pergunta: "A Estrela de Barnard é a campeã em quê?",
    opcoes: ["É a estrela que mais rápido muda de posição no nosso céu", "É a maior estrela conhecida", "É a mais brilhante do céu noturno"],
    certa: 0,
    explicacao: "As estrelas parecem fixas, mas todas se movem. A de Barnard, por estar perto e ser rápida, anda no céu o equivalente à largura da Lua cheia em cerca de 180 anos."
  },
  {
    id: "q-wolf-359", objeto: "wolf-359",
    pergunta: "Wolf 359 está a menos de 8 anos-luz, mas não dá para vê-la a olho nu. Por quê?",
    opcoes: ["Porque fica escondida atrás da Lua", "Porque é uma anã vermelha fraquinha: emite cerca de 0,1% da luz do Sol", "Porque só aparece durante o dia"],
    certa: 1,
    explicacao: "Estar perto não basta para brilhar no céu. A maior parte das estrelas vizinhas do Sol são anãs vermelhas, fracas demais para o olho nu."
  },
  {
    id: "q-lalande-21185", objeto: "lalande-21185",
    pergunta: "Lalande 21185 tem magnitude 7,5. O olho humano enxerga, num céu bem escuro, até a magnitude 6. O que isso quer dizer?",
    opcoes: ["Que ela brilha demais para olhar direto", "Que ela é fraca demais para o olho nu, mas aparece em binóculos", "Que ela tem 7 planetas e meio"],
    certa: 1,
    explicacao: "Na escala de magnitude, quanto maior o número, mais fraca a estrela aparece. Sírius, a mais brilhante do céu noturno, tem magnitude −1,46."
  },
  {
    id: "q-luyten-726-8", objeto: "luyten-726-8",
    pergunta: "O que UV Ceti, uma das duas estrelas de Luyten 726-8, faz de especial?",
    opcoes: ["Dá 'explosões' de brilho: em minutos fica várias vezes mais brilhante", "Muda de cor toda noite", "Gira em volta da Terra"],
    certa: 0,
    explicacao: "São erupções parecidas com as do Sol, só que muito mais fortes para o tamanho da estrela. Anãs vermelhas que fazem isso são chamadas de estrelas eruptivas."
  },
  {
    id: "q-ross-154", objeto: "ross-154",
    pergunta: "Ross 154 está a 9,69 anos-luz. Se ela se apagasse hoje, quando deixaríamos de vê-la?",
    opcoes: ["Na mesma hora", "Daqui a quase 10 anos", "Daqui a 10 mil anos"],
    certa: 1,
    explicacao: "A luz leva 9,69 anos para vir de lá. Tudo o que vemos dessa estrela aconteceu quase 10 anos atrás."
  },
  {
    id: "q-ross-248", objeto: "ross-248",
    pergunta: "As estrelas se movem pela galáxia. Qual delas deve passar a ser, daqui a uns 36 mil anos, a mais próxima do Sol?",
    opcoes: ["Ross 248", "Betelgeuse", "A Estrela Polar"],
    certa: 0,
    explicacao: "Ross 248 está vindo na nossa direção. Por um tempo ela vai ficar mais perto do Sol do que Proxima Centauri, a vizinha mais próxima de hoje."
  },
  {
    id: "q-epsilon-eridani", objeto: "epsilon-eridani",
    pergunta: "Epsilon Eridani é uma estrela do tipo K (laranja). Comparada com o Sol, que é do tipo G (amarelo), ela é…",
    opcoes: ["mais quente e maior", "um pouco mais fria e menor", "igualzinha"],
    certa: 1,
    explicacao: "As letras O, B, A, F, G, K e M põem as estrelas em ordem, das mais quentes (azuis) para as mais frias (vermelhas). Uma estrela K fica entre o Sol e as anãs vermelhas."
  },
  {
    id: "q-lacaille-9352", objeto: "lacaille-9352",
    pergunta: "Por que as anãs vermelhas, como Lacaille 9352, são vermelhas?",
    opcoes: ["Porque a superfície delas é mais fria que a do Sol", "Porque são mais quentes que o Sol", "Porque são cobertas de ferrugem, como Marte"],
    certa: 0,
    explicacao: "A cor de uma estrela mostra a temperatura: as vermelhas são as mais frias, as amarelas como o Sol ficam no meio e as azuis são as mais quentes."
  },
  {
    id: "q-ross-128", objeto: "ross-128",
    pergunta: "O que os astrônomos encontraram girando em volta de Ross 128?",
    opcoes: ["Um planeta com massa parecida com a da Terra", "Um buraco negro", "Uma estrela igual ao Sol"],
    certa: 0,
    explicacao: "O planeta se chama Ross 128 b. Planetas que giram em volta de outras estrelas são chamados de exoplanetas."
  },
  {
    id: "q-procyon", objeto: "procyon",
    pergunta: "O nome Prócion vem do grego e quer dizer 'antes do cão'. Por quê?",
    opcoes: ["Porque, vista da Grécia, ela nasce um pouco antes de Sírius, a estrela do Cão Maior", "Porque foi descoberta antes de existirem cachorros", "Porque tem o formato de um cão"],
    certa: 0,
    explicacao: "Sírius é a estrela mais brilhante do Cão Maior, e Prócion, a do Cão Menor. Vistas do Brasil, a ordem se inverte: Sírius nasce primeiro."
  },
  {
    id: "q-tau-ceti", objeto: "tau-ceti",
    pergunta: "Por que Tau Ceti é uma das primeiras estrelas em que os astrônomos procuram planetas parecidos com a Terra?",
    opcoes: ["Porque é parecida com o Sol e está perto: 11,9 anos-luz", "Porque é a maior estrela do céu", "Porque já sabemos que existe vida lá"],
    certa: 0,
    explicacao: "Tau Ceti é do tipo G, como o Sol, só um pouco menor e mais fria. Por isso também é um alvo clássico na busca por sinais de vida inteligente. Até hoje, nenhum sinal foi encontrado."
  },
  {
    id: "q-altair", objeto: "altair",
    pergunta: "Altair dá uma volta em si mesma a cada 9 horas, mais ou menos (o Sol leva uns 25 dias). O que isso faz com ela?",
    opcoes: ["Deixa a estrela achatada nos polos e mais larga no equador", "Faz a estrela ficar parada no céu", "Nada: girar não muda o formato"],
    certa: 0,
    explicacao: "Girando tão rápido, o equador é empurrado para fora. Acontece o mesmo, bem mais de leve, com a Terra, com Júpiter e com Saturno."
  },
  {
    id: "q-vega", objeto: "vega",
    pergunta: "Vega já foi a 'estrela polar' do norte, há uns 12 mil anos, e vai voltar a ser. Como isso é possível?",
    opcoes: ["O eixo da Terra balança devagar, como um pião, e vai apontando para estrelas diferentes", "Vega gira em volta da Terra", "As estrelas trocam de lugar a cada mil anos"],
    certa: 0,
    explicacao: "Esse balanço se chama precessão e leva cerca de 26 mil anos para completar uma volta. Hoje o eixo aponta para perto da Estrela Polar."
  },
  {
    id: "q-fomalhaut", objeto: "fomalhaut",
    pergunta: "O que existe em volta de Fomalhaut?",
    opcoes: ["Um grande anel de poeira", "Um anel de fogo", "Nada"],
    certa: 0,
    explicacao: "O anel é feito de poeira e de pedaços de gelo e rocha, como um Cinturão de Kuiper gigante. Discos assim são restos da formação de planetas."
  },
  {
    id: "q-polux", objeto: "polux",
    pergunta: "Pólux tem 9 vezes o raio do Sol. Por que ela ficou tão grande?",
    opcoes: ["Porque gastou o hidrogênio do núcleo e inchou: virou uma gigante", "Porque engoliu outra estrela", "Porque é uma estrela recém-nascida"],
    certa: 0,
    explicacao: "É uma fase do fim da vida das estrelas parecidas com o Sol. O próprio Sol deve virar uma gigante vermelha daqui a uns 5 bilhões de anos."
  },
  {
    id: "q-arcturo", objeto: "arcturo",
    pergunta: "Arcturo é 25 vezes maior que o Sol, mas a superfície dela é mais fria: 4.290 K contra 5.772 K. De que cor ela aparece no céu?",
    opcoes: ["Azulada", "Alaranjada", "Verde"],
    certa: 1,
    explicacao: "Estrelas mais frias que o Sol têm tons de laranja e vermelho; as mais quentes, de branco e azul. Mesmo mais fria, Arcturo emite bem mais luz que o Sol, porque é enorme."
  },
  {
    id: "q-capela", objeto: "capela",
    pergunta: "A olho nu, Capela parece uma estrela só. O que ela é de verdade?",
    opcoes: ["Um sistema de quatro estrelas: duas gigantes amarelas e duas anãs vermelhas", "Um planeta do Sistema Solar", "Uma galáxia distante"],
    certa: 0,
    explicacao: "Muitos pontos de luz do céu são duas ou mais estrelas girando umas em volta das outras. As duas gigantes de Capela ficam tão juntas que parecem uma só."
  },
  {
    id: "q-aldebara", objeto: "aldebara",
    pergunta: "No céu, Aldebarã parece fazer parte do aglomerado das Híades. Ela faz mesmo?",
    opcoes: ["Sim: é a estrela principal do aglomerado", "Não: ela está bem mais perto de nós e só fica na mesma direção", "Não: ela fica muito mais longe que o aglomerado"],
    certa: 1,
    explicacao: "Aldebarã está a 65 anos-luz, e as Híades, a uns 150. O céu parece 'chapado', mas as estrelas de uma mesma região podem estar a distâncias muito diferentes."
  },
  {
    id: "q-regulo", objeto: "regulo",
    pergunta: "Por que a Lua às vezes passa na frente de Régulo e a esconde?",
    opcoes: ["Porque Régulo fica quase em cima da eclíptica, o caminho do Sol no céu, do qual a Lua nunca se afasta muito", "Porque Régulo gira em volta da Lua", "Porque Régulo é menor que a Lua"],
    certa: 0,
    explicacao: "Quando a Lua esconde uma estrela, isso se chama ocultação. Só as estrelas brilhantes perto da eclíptica passam por isso: Régulo, Espiga, Antares e Aldebarã."
  },
  {
    id: "q-espiga", objeto: "espiga",
    pergunta: "Na bandeira do Brasil, que estrela aparece sozinha acima da faixa 'Ordem e Progresso'?",
    opcoes: ["Espiga, que representa o Pará", "Sírius, que representa Mato Grosso", "Ácrux, que representa São Paulo"],
    certa: 0,
    explicacao: "As três estão na bandeira, mas só Espiga fica acima da faixa. As estrelas mostram o céu do Rio de Janeiro na manhã de 15 de novembro de 1889, dia da Proclamação da República."
  },
  {
    id: "q-canopus", objeto: "canopus",
    pergunta: "Para que muitas sondas espaciais usam a estrela Canopus?",
    opcoes: ["Para se orientar: ela serve de referência para a sonda saber para onde está apontando", "Para recarregar as baterias", "Para pegar impulso com a gravidade dela"],
    certa: 0,
    explicacao: "Canopus é a segunda estrela mais brilhante do céu noturno e fica longe da direção do Sol. Um sensor da sonda procura por ela e, junto com o Sol, dá a orientação da nave."
  },
  {
    id: "q-polaris", objeto: "polaris",
    pergunta: "Por que a Estrela Polar não aparece no céu de quase todo o Brasil?",
    opcoes: ["Porque ela fica quase em cima do polo norte celeste, abaixo do horizonte de quem está ao sul do equador", "Porque ela só brilha no inverno", "Porque a poluição do ar esconde a estrela"],
    certa: 0,
    explicacao: "No Hemisfério Sul, quem aponta o polo é o Cruzeiro do Sul: prolongando o braço maior da cruz umas quatro vezes e meia, chega-se perto do polo sul celeste."
  },
  {
    id: "q-antares", objeto: "antares",
    pergunta: "Antares tem cerca de 680 vezes o raio do Sol. Se ela estivesse no lugar do Sol, até onde chegaria?",
    opcoes: ["Só até a órbita de Mercúrio", "Além da órbita de Marte", "Até a Lua"],
    certa: 1,
    explicacao: "São uns 470 milhões de km de raio, ou 3,2 UA. Mercúrio, Vênus, a Terra e Marte (a 1,5 UA do Sol) ficariam dentro da estrela."
  },
  {
    id: "q-rigel", objeto: "rigel",
    pergunta: "Rigel está 100 vezes mais longe que Sírius (860 contra 8,6 anos-luz) e mesmo assim é uma das estrelas mais brilhantes do céu. Como?",
    opcoes: ["Ela emite dezenas de milhares de vezes mais luz que o Sol", "Ela fica dentro do Sistema Solar", "Ela reflete a luz da Lua"],
    certa: 0,
    explicacao: "O brilho que vemos depende de duas coisas: de quanta luz a estrela emite e da distância. Rigel é uma supergigante azul, tão luminosa que aparece forte mesmo de muito longe."
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
    pergunta: "As Plêiades estão a cerca de 445 anos-luz. Na velocidade da luz, quanto tempo levaria a viagem até lá?",
    opcoes: ["445 dias", "445 anos", "4 anos"],
    certa: 1,
    explicacao: "Um ano-luz é a distância que a luz percorre em um ano. Então 445 anos-luz = 445 anos viajando na velocidade da luz."
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
    id: "q-eagle", objeto: "eagle",
    pergunta: "Os 'Pilares da Criação', na Nebulosa da Águia, são colunas de gás e poeira. Qual é a altura deles?",
    opcoes: ["Mais ou menos a de uma montanha", "A distância da Terra ao Sol", "De 4 a 5 anos-luz, parecida com a distância do Sol até a estrela mais próxima"],
    certa: 2,
    explicacao: "Segundo a NASA, os pilares têm de 4 a 5 anos-luz de altura. Proxima Centauri, a estrela mais próxima do Sol, está a 4,25 anos-luz."
  },
  {
    id: "q-carina", objeto: "carina",
    pergunta: "Dentro da Nebulosa de Carina fica Eta Carinae, um par de estrelas. Quanta luz a maior delas emite?",
    opcoes: ["A mesma que o Sol", "Umas 5 mil vezes a do Sol", "Uns 5 milhões de vezes a do Sol"],
    certa: 2,
    explicacao: "Segundo a NASA, ela tem cerca de 100 vezes a massa do Sol e emite uns 5 milhões de vezes mais luz. Estrelas tão pesadas vivem pouco e terminam numa explosão: uma supernova."
  },
  {
    id: "q-omega-centauri", objeto: "omega-centauri",
    pergunta: "Quantas estrelas tem Ômega Centauri, o maior aglomerado globular da Via Láctea?",
    opcoes: ["Cerca de 10 mil", "Cerca de 10 milhões", "Cerca de 10 trilhões"],
    certa: 1,
    explicacao: "São uns 10 milhões de estrelas velhas, presas umas às outras pela gravidade. Pode ser o que sobrou de uma galáxia anã engolida pela Via Láctea (NASA)."
  },
  {
    id: "q-lmc", objeto: "lmc",
    pergunta: "O que é a Grande Nuvem de Magalhães?",
    opcoes: ["Uma galáxia satélite da Via Láctea", "Uma nuvem de chuva vista do espaço", "Uma nebulosa dentro do Sistema Solar"],
    certa: 0,
    explicacao: "É uma galáxia anã a uns 162 mil anos-luz, que gira em volta da nossa."
  },
  {
    id: "q-smc", objeto: "smc",
    pergunta: "O que liga a Pequena Nuvem de Magalhães à Grande Nuvem?",
    opcoes: ["Nada: elas estão longe demais uma da outra", "A Ponte de Magalhães, uma faixa de gás com estrelas jovens", "Um rio de água congelada"],
    certa: 1,
    explicacao: "A gravidade da Grande Nuvem arrancou gás da Pequena. Essa ponte de gás liga as duas, e nela ainda nascem estrelas."
  },
  {
    id: "q-andromeda", objeto: "andromeda",
    pergunta: "A luz de Andrômeda que chega hoje aos seus olhos saiu de lá há uns 2,5 milhões de anos. O que existia na Terra naquela época?",
    opcoes: ["Dinossauros", "Os primeiros ancestrais humanos do gênero Homo", "As pirâmides do Egito"],
    certa: 1,
    explicacao: "Os dinossauros (não avianos) sumiram há 66 milhões de anos; as pirâmides têm uns 4.500 anos. Há 2,5 milhões de anos surgiam os primeiros Homo."
  },
  {
    id: "q-triangulo", objeto: "triangulo",
    pergunta: "Quantas estrelas tem a Galáxia do Triângulo?",
    opcoes: ["Cerca de 40 mil", "Cerca de 40 bilhões", "Cerca de 40 trilhões"],
    certa: 1,
    explicacao: "O Hubble estima uns 40 bilhões: bem menos que a Via Láctea (centenas de bilhões) e que Andrômeda (cerca de 1 trilhão)."
  }
];

// ---------------------------------------------------------------------------
// Utilidades de consulta
// ---------------------------------------------------------------------------

/** Todos os objetos que podem ser descobertos, com o nível de cada um. */
// Cada foto vai para o seu astro: imagem (o arquivo) e creditoImagem.
for (const objeto of [SOL, ...PLANETAS, LUA, ...OBJETOS_GALAXIA]) {
  const foto = FOTOS[objeto.id];
  if (!foto) continue;
  objeto.imagem = `${PASTA_DAS_FOTOS[objeto.id] || "img/planetas"}/${objeto.id}.webp`;
  objeto.creditoImagem = foto;
}

export const TODOS_OS_OBJETOS = [SOL, ...PLANETAS, LUA, ...LUAS, ...PLANETAS_ANOES, CINTURAO, ...SONDAS, ...ESTRELAS, ...OBJETOS_GALAXIA];

/** Fontes de um verbete, para mostrar na ficha: [{ rotulo, url }]. */
export function fontesDoObjeto(objeto) {
  if (objeto.fontes) return objeto.fontes.map(([rotulo, url]) => ({ rotulo, url }));
  if (objeto.fonte) return [{ rotulo: rotuloDoSite(objeto.fonte), url: objeto.fonte }];
  return [];
}

function rotuloDoSite(url) {
  const site = new URL(url).hostname.replace(/^www\./, "");
  if (site.endsWith("nasa.gov")) return "NASA";
  if (site === "esahubble.org") return "ESA/Hubble";
  if (site.endsWith("esa.int")) return "ESA";
  if (site.endsWith("eso.org")) return "ESO";
  if (site === "arxiv.org") return "arXiv";
  return site;
}

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

// ---------------------------------------------------------------------------
// Comparador: os astros que dá para pôr lado a lado
// ---------------------------------------------------------------------------

const KM_POR_ANO_LUZ = NIVEIS[1].unidadeKm;
const KM_POR_UA = NIVEIS[0].unidadeKm;
const IDS_ANOES = new Set(PLANETAS_ANOES.map((p) => p.id));

/**
 * O Sistema Solar inteiro, para comparar com estrelas gigantes, buracos
 * negros e galáxias. O tamanho vai até a órbita de Netuno, o planeta mais
 * distante (semieixo de 30,07 UA ≈ 4,5 bilhões de km, NASA). Contando a
 * Nuvem de Oort, de cometas, ele iria muito mais longe.
 */
export const SISTEMA_SOLAR = {
  id: "sistema-solar",
  nome: "Sistema Solar",
  nomeComparador: "Sistema Solar (até Netuno)",
  tipo: "O Sol e os 8 planetas, até a órbita de Netuno",
  categoria: "sistema planetário",
  cor: "#ffd27a",
  resumo: "O Sol, os 8 planetas e suas luas, os planetas anões e milhões de asteroides e cometas.",
  fonte: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/"
};

/** "planeta", "planeta anão", "lua", "estrela", "buraco negro", "galáxia" ou "sistema planetário". */
export function categoriaDoAstro(objeto) {
  if (objeto.categoria) return objeto.categoria;
  if (objeto.id === "sol" || objeto.espectro) return "estrela";
  if (objeto.id === "lua") return "lua";
  return IDS_ANOES.has(objeto.id) ? "planeta anão" : "planeta";
}

/**
 * Raio (km) usado no comparador. Buraco negro: raio do horizonte de eventos
 * (raio de Schwarzschild, 2GM/c²). Galáxia: metade do diâmetro.
 */
export function raioParaComparar(objeto) {
  if (objeto.categoria === "buraco negro") return objeto.massaSolar * KM_POR_MASSA_SOLAR_SCHWARZSCHILD;
  if (objeto.categoria === "galáxia") return (objeto.diametroAnosLuz / 2) * KM_POR_ANO_LUZ;
  if (objeto.categoria === "sistema planetário") return PLANETAS.find((p) => p.id === "netuno").orbita.elementos.a * KM_POR_UA;
  return objeto.raioKm || objeto.raioSolar * SOL.raioKm;
}

/** Todos os astros do comparador, numa lista só, em ordem crescente (do menor para o maior). */
export const COMPARAVEIS = [
  SOL, ...PLANETAS, LUA, ...LUAS.filter((l) => l.raioKm > 200), ...PLANETAS_ANOES,
  ...ESTRELAS.filter((e) => e.raioSolar),
  SISTEMA_SOLAR,
  ...GIGANTES,
  ...OBJETOS_GALAXIA.filter((o) => o.categoria)   // Sagitário A* e as galáxias vizinhas
].sort((a, b) => raioParaComparar(a) - raioParaComparar(b));
