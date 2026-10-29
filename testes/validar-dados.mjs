// ---------------------------------------------------------------------------
// Validação técnica do Explorador do Universo (sem testes com pessoas).
//
// Confere o modelo astronômico contra eventos de referência publicados
// (equinócio, solstício, periélio, oposições), contra leis físicas (3ª lei
// de Kepler, tempo-luz) e a integridade da base de conhecimento.
// Técnicas de Sargent (2013): validação por dados históricos, validade de
// eventos, comparação com outro modelo e testes de condição extrema.
//
// Uso:  node testes/validar-dados.mjs        (ou: npm run validar)
// Sai com código 1 se algum teste falhar — dá para rodar no GitHub Actions.
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import * as astro from "../js/explorador/astronomia.js";
import * as cat from "../js/explorador/catalogo.js";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const resultados = [];

function teste(grupo, nome, obtido, esperado, tolerancia, unidade = "") {
  const erro = Math.abs(obtido - esperado);
  resultados.push({ grupo, nome, obtido, esperado, erro, tolerancia, unidade, ok: erro <= tolerancia });
}

function verdadeiro(grupo, nome, condicao, detalhe = "") {
  resultados.push({ grupo, nome, ok: Boolean(condicao), detalhe });
}

/** Diferença angular com sinal, em graus (−180 a 180). */
function diferencaAngular(a, b) {
  return ((a - b + 540) % 360) - 180;
}

const planeta = (id) => cat.PLANETAS.find((p) => p.id === id);
const longitudeHelio = (id, data) => astro.longitudeNoEquinocioDaData(
  astro.longitudeEcliptica(astro.posicaoHeliocentrica(planeta(id), data)), data
);

// ---------- 1. Órbita da Terra contra o calendário astronômico ----------
// No equinócio de março o Sol (visto da Terra) está na longitude 0°, então a
// Terra (vista do Sol) está em 180°; no solstício de junho, em 270°.
const eventosDaTerra = [
  ["Equinócio de março de 2026 (20/03, 14h46 UTC)", "2026-03-20T14:46:00Z", 180],
  ["Solstício de junho de 2026 (21/06, 08h24 UTC)", "2026-06-21T08:24:00Z", 270],
  ["Equinócio de setembro de 2026 (23/09, 00h05 UTC)", "2026-09-23T00:05:00Z", 0],
  ["Solstício de dezembro de 2026 (21/12, 20h50 UTC)", "2026-12-21T20:50:00Z", 90]
];
for (const [nome, iso, esperado] of eventosDaTerra) {
  const data = new Date(iso);
  const obtido = longitudeHelio("terra", data);
  teste("Terra", nome, diferencaAngular(obtido, esperado), 0, 0.05, "°");
}

// Periélio de 2026: 3 de janeiro (17h UTC). Procura a menor distância Terra–Sol.
{
  let menor = Infinity, diaDoMenor = null;
  for (let h = 0; h < 24 * 20; h++) {
    const data = new Date(Date.UTC(2025, 11, 25) + h * 3_600_000);
    const p = astro.posicaoHeliocentrica(planeta("terra"), data);
    const r = Math.hypot(p.x, p.y, p.z);
    if (r < menor) { menor = r; diaDoMenor = data; }
  }
  const esperado = Date.parse("2026-01-03T17:15:00Z");
  teste("Terra", "Periélio de 2026 (03/01) — diferença em dias", (diaDoMenor - esperado) / 86_400_000, 0, 1.5, " dia(s)");
  teste("Terra", "Distância no periélio (0,98330 UA)", menor, 0.98330, 0.0003, " UA");
}

// ---------- 2. Oposições: planeta e Terra alinhados do mesmo lado do Sol ----------
const oposicoes = [
  ["marte", "Marte — 16/01/2025", "2025-01-16T03:00:00Z"],
  ["jupiter", "Júpiter — 10/01/2026", "2026-01-10T08:00:00Z"],
  ["saturno", "Saturno — 21/09/2025", "2025-09-21T05:00:00Z"],
  ["urano", "Urano — 21/11/2025", "2025-11-21T12:00:00Z"],
  ["netuno", "Netuno — 23/09/2025", "2025-09-23T12:00:00Z"],
  ["marte", "Marte — 19/02/2027", "2027-02-19T12:00:00Z"]
];
for (const [id, nome, iso] of oposicoes) {
  const data = new Date(iso);
  const diferenca = diferencaAngular(longitudeHelio(id, data), longitudeHelio("terra", data));
  teste("Oposições", nome, diferenca, 0, 1.0, "°");
}

// ---------- 3. Leis físicas e coerência da ficha técnica ----------
for (const p of [...cat.PLANETAS, ...cat.PLANETAS_ANOES]) {
  const periodo = astro.periodoKeplerAnos(p.orbita.elementos.a);
  teste("Kepler", `${p.nome}: período pela 3ª lei (${p.periodoAnos} anos)`, periodo / p.periodoAnos, 1, 0.005);
}

// A ficha técnica (em texto) precisa bater com a órbita usada
// na simulação: a distância em UA escrita na ficha × semieixo maior.
for (const p of [...cat.PLANETAS, ...cat.PLANETAS_ANOES]) {
  const linha = p.ficha.find(([campo]) => campo.startsWith("Distância"));
  const ua = linha && Number(linha[1].match(/\(([\d,]+) UA\)/)?.[1].replace(",", "."));
  verdadeiro("Ficha", `${p.nome}: ficha técnica, texto e fonte presentes`, p.ficha?.length >= 6 && p.saibaMais && p.fonte?.startsWith("https://"));
  if (ua) teste("Ficha", `${p.nome}: distância da ficha (${ua} UA) × órbita`, ua / p.orbita.elementos.a, 1, 0.02);
}

// Diâmetro e gravidade da ficha (texto) × números usados no 3D e no comparador.
const numeroDaFicha = (objeto, campo) => {
  const linha = objeto.ficha?.find(([c]) => c === campo);
  return linha ? Number(linha[1].match(/^≈?\s*([\d.,]+)/)[1].replace(/\./g, "").replace(",", ".")) : null;
};
for (const o of [cat.SOL, ...cat.PLANETAS, cat.LUA, ...cat.PLANETAS_ANOES]) {
  teste("Ficha", `${o.nome}: diâmetro da ficha × raio do modelo`, numeroDaFicha(o, "Diâmetro") / (2 * o.raioKm), 1, 0.01);
  teste("Ficha", `${o.nome}: gravidade da ficha × comparador`, numeroDaFicha(o, "Gravidade") / o.gravidade, 1, 0.01);
}

teste("Luz", "Luz do Sol até a Terra (1 UA) ≈ 499 s", astro.KM_POR_UA / astro.VELOCIDADE_LUZ_KM_S, 499.0, 0.5, " s");
teste("Luz", "1 ano-luz ≈ 63.241 UA", astro.UA_POR_ANO_LUZ, 63_241, 1, " UA");

{
  const soma = cat.PLANETAS.filter((p) => p.id !== "terra").reduce((total, p) => total + 2 * p.raioKm, 0);
  verdadeiro("Quiz", `Planetas cabem entre a Terra e a Lua (soma dos diâmetros: ${Math.round(soma).toLocaleString("pt-BR")} km < 384.400 km)`, soma < cat.LUA.distanciaMediaKm);
  const anosVoyager = (4.246 * astro.KM_POR_ANO_LUZ) / 17 / astro.SEGUNDOS_POR_ANO;
  teste("Quiz", "Voyager até Proxima ≈ 75 mil anos", anosVoyager, 75_000, 1_500, " anos");
  const horasNetuno = (30.07 * astro.KM_POR_UA) / astro.VELOCIDADE_LUZ_KM_S / 3600;
  teste("Quiz", "Luz do Sol até Netuno ≈ 4,2 h", horasNetuno, 4.17, 0.1, " h");
  const volumeJupiter = (planeta("jupiter").raioKm / planeta("terra").raioKm) ** 3;
  verdadeiro("Quiz", `Mais de 1.300 Terras cabem em Júpiter (${Math.round(volumeJupiter)})`, volumeJupiter > 1300);
}

// ---------- 3b. Rotação e eixos (modelo da IAU) ----------
// Ponto subsolar: onde o Sol está a pino. Ao meio-dia UTC ele fica perto do
// meridiano de Greenwich (a diferença é a equação do tempo); a latitude é a
// declinação do Sol. Confere juntos a órbita, o polo e o meridiano da Terra.
{
  const terra = planeta("terra");
  const subsolar = (iso) => {
    const data = new Date(iso);
    const o = astro.orientacaoIau(terra.rotacao, data);
    const p = astro.posicaoHeliocentrica(terra, data);
    const r = Math.hypot(p.x, p.y, p.z);
    const sol = { x: -p.x / r, y: -p.y / r, z: -p.z / r };
    const escalar = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
    return {
      longitude: Math.atan2(escalar(sol, o.leste), escalar(sol, o.meridiano)) * 180 / Math.PI,
      latitude: Math.asin(escalar(sol, o.polo)) * 180 / Math.PI
    };
  };
  const junho = subsolar("2026-06-21T12:00:00Z");
  teste("Rotação", "Solstício de jun/2026, 12h UTC: Sol a pino perto de Greenwich (longitude ≈ +0,4°)", junho.longitude, 0.4, 1, "°");
  teste("Rotação", "Solstício de jun/2026: Sol a pino no Trópico de Câncer (+23,44°)", junho.latitude, 23.44, 0.1, "°");
  const marco = subsolar("2026-03-20T18:00:00Z");
  teste("Rotação", "Equinócio de mar/2026, 18h UTC: Sol a pino na longitude ≈ −88,2°", marco.longitude, -88.2, 1, "°");
  teste("Rotação", "Equinócio de mar/2026: Sol a pino no equador", marco.latitude, 0, 0.1, "°");
}
for (const p of cat.PLANETAS) {
  teste("Rotação", `${p.nome}: inclinação do eixo pelo polo da IAU × NASA (${p.rotacao.inclinacao}°)`, astro.inclinacaoDoEixo(p), p.rotacao.inclinacao, 0.5, "°");
}
// Planetas anões: a inclinação publicada é arredondada (Ceres ≈ 4°), daí a tolerância maior.
for (const p of cat.PLANETAS_ANOES) {
  teste("Rotação", `${p.nome}: inclinação do eixo pelo polo da IAU × NASA (${p.rotacao.inclinacao}°)`, astro.inclinacaoDoEixo(p), p.rotacao.inclinacao, 1, "°");
}

// ---------- 3d. Planetas anões e Cinturão de Asteroides ----------
{
  const distanciaDoSol = (objeto, data) => {
    const p = astro.posicaoHeliocentrica(objeto, data);
    return Math.hypot(p.x, p.y, p.z);
  };
  const periélio = (objeto, inicio, fim, passoDias) => {
    let menor = Infinity, quando = null;
    for (let t = inicio; t <= fim; t += passoDias * 86_400_000) {
      const r = distanciaDoSol(objeto, new Date(t));
      if (r < menor) { menor = r; quando = t; }
    }
    return { menor, quando };
  };
  const anao = (id) => cat.PLANETAS_ANOES.find((p) => p.id === id);
  // Plutão: de 1979 a 1999 esteve perto do periélio (NASA), que caiu em 1989;
  // distância no periélio: 4.434,987 milhões de km = 29,646 UA (NASA/NSSDC).
  const plutao = periélio(anao("plutao"), Date.UTC(1980, 0, 1), Date.UTC(1999, 0, 1), 5);
  const anoDoPerielio = 1970 + plutao.quando / (365.25 * 86_400_000);
  teste("Planetas anões", "Plutão: periélio no meio de 1979–1999 (em 1989) — anos depois de 1º/jul/1989", anoDoPerielio - 1989.5, 0, 0.5, " ano");
  teste("Planetas anões", "Plutão: distância no periélio (29,646 UA, NSSDC)", plutao.menor, 29.646, 0.02, " UA");
  // Ceres: periélio em abril de 2018 (NASA/JPL, missão Dawn).
  const ceres = periélio(anao("ceres"), Date.UTC(2017, 6, 1), Date.UTC(2019, 0, 1), 1);
  teste("Planetas anões", "Ceres: periélio em abril de 2018 (NASA/JPL) — dias depois de 15/04/2018", (ceres.quando - Date.UTC(2018, 3, 15)) / 86_400_000, 0, 15, " dia(s)");
  const netuno = planeta("netuno");
  teste("Planetas anões", "Plutão dá 2 voltas enquanto Netuno dá 3 (ressonância 3:2)", anao("plutao").periodoAnos / netuno.periodoAnos, 1.5, 0.01);
  const a = anao("ceres").orbita.elementos.a;
  verdadeiro("Planetas anões", `Ceres (${a.toFixed(2)} UA) fica dentro do Cinturão (${cat.CINTURAO.raioInternoUA}–${cat.CINTURAO.raioExternoUA} UA)`,
    a > cat.CINTURAO.raioInternoUA && a < cat.CINTURAO.raioExternoUA);
  verdadeiro("Planetas anões", "O Cinturão fica entre Marte e Júpiter",
    cat.CINTURAO.raioInternoUA > planeta("marte").orbita.elementos.a && cat.CINTURAO.raioExternoUA < planeta("jupiter").orbita.elementos.a);
  verdadeiro("Planetas anões", "Plutão é menor que a Lua (o quiz e o comparador dizem isso)", anao("plutao").raioKm < cat.LUA.raioKm);
}

// ---------- 3c. Comparador e texturas ----------
{
  const estrelas = cat.ESTRELAS.filter((e) => e.raioSolar);
  verdadeiro("Comparador", `${estrelas.length} estrelas com raio e temperatura`, estrelas.length >= 10
    && estrelas.every((e) => e.raioSolar > 0 && e.temperaturaK > 2000 && e.temperaturaK < 50_000));
  const betelgeuse = cat.ESTRELAS.find((e) => e.id === "betelgeuse");
  const volume = betelgeuse.raioSolar ** 3;
  verdadeiro("Comparador", `Cabem centenas de milhões de Sóis em Betelgeuse (${Math.round(volume / 1e6)} milhões)`, volume > 1e8);
  const proxima = cat.ESTRELAS.find((e) => e.id === "proxima");
  verdadeiro("Comparador", "Proxima Centauri é menor que o Sol e maior que Júpiter",
    proxima.raioSolar < 1 && proxima.raioSolar * cat.SOL.raioKm > planeta("jupiter").raioKm);
  const astros3d = readFileSync(join(raiz, "js/explorador/astros3d.js"), "utf8");
  const arquivos = [...astros3d.matchAll(/"([a-z-]+\.(?:webp|png))"/g)].map((m) => m[1]);
  for (const arquivo of arquivos) {
    let existe = true;
    try { readFileSync(join(raiz, "img/texturas", arquivo)); } catch { existe = false; }
    verdadeiro("Comparador", `Textura img/texturas/${arquivo} existe`, existe);
  }
}

// ---------- 4. Lua ----------
{
  let menor = Infinity, maior = 0;
  for (let h = 0; h < 24 * 365; h += 3) {
    const p = astro.posicaoLuaGeocentrica(new Date(Date.UTC(2026, 0, 1) + h * 3_600_000));
    const r = Math.hypot(p.x, p.y, p.z);
    menor = Math.min(menor, r);
    maior = Math.max(maior, r);
  }
  verdadeiro("Lua", `Perigeu entre 356 e 371 mil km (${Math.round(menor).toLocaleString("pt-BR")} km)`, menor > 356_000 && menor < 371_000);
  verdadeiro("Lua", `Apogeu entre 400 e 407 mil km (${Math.round(maior).toLocaleString("pt-BR")} km)`, maior > 400_000 && maior < 407_000);
}

// ---------- 5. Voyager 1 ----------
{
  const data = new Date("2026-11-15T00:00:00Z");
  const v = astro.posicaoSondaHeliocentrica(cat.VOYAGER, data);
  const t = astro.posicaoHeliocentrica(planeta("terra"), data);
  const distanciaDaTerra = Math.hypot(v.x - t.x, v.y - t.y, v.z - t.z);
  const diasLuz = (distanciaDaTerra * astro.KM_POR_UA) / astro.VELOCIDADE_LUZ_KM_S / 86_400;
  teste("Voyager", "Voyager 1 a ≈ 1 dia-luz da Terra em nov/2026", diasLuz, 1, 0.02, " dia-luz");
}

// ---------- 6. Estrelas ----------
{
  const ids = new Set();
  for (const e of cat.ESTRELAS) {
    const ar = astro.arParaGraus(e.ar), dec = astro.decParaGraus(e.dec);
    const p = astro.equatorialParaEcliptica(ar, dec, e.anosLuz);
    const ok = ar >= 0 && ar < 360 && dec >= -90 && dec <= 90 && e.anosLuz > 0 && !ids.has(e.id)
      && Math.abs(Math.hypot(p.x, p.y, p.z) - e.anosLuz) < 1e-9 * e.anosLuz;
    ids.add(e.id);
    verdadeiro("Estrelas", `${e.nome}: coordenadas e distância coerentes`, ok);
  }
  const maisProxima = [...cat.ESTRELAS].sort((a, b) => a.anosLuz - b.anosLuz)[0];
  verdadeiro("Estrelas", "Proxima Centauri é a estrela mais próxima do catálogo", maisProxima.id === "proxima");
  const sirius = cat.ESTRELAS.find((e) => e.id === "sirius");
  teste("Estrelas", "Magnitude absoluta de Sírius ≈ +1,42", astro.magnitudeAbsoluta(sirius.mag, sirius.anosLuz), 1.42, 0.05);
  const p = astro.equatorialParaEcliptica(astro.arParaGraus("06 00 00"), 23.43928, 1);
  teste("Estrelas", "Solstício de junho (AR 6h, Dec +23,44°) cai na eclíptica", p.z, 0, 1e-6);
}

// ---------- 7. Galáxia ----------
{
  const r0 = cat.GALAXIA.distanciaSolCentroKly;
  const centro = astro.galacticaParaGalactocentrica(0, 0, r0, r0);
  teste("Galáxia", "Direção l = 0°, b = 0° a R0 cai no centro", Math.hypot(centro.x, centro.y, centro.z), 0, 1e-9, " mil anos-luz");
  // O Sol gira no sentido horário visto do polo norte galáctico: braços "arrastados".
  const lmc = cat.OBJETOS_GALAXIA.find((o) => o.id === "lmc");
  const p = astro.galacticaParaGalactocentrica(lmc.l, lmc.b, lmc.d, r0);
  teste("Galáxia", "Grande Nuvem de Magalhães a ≈ 160 mil anos-luz do centro", Math.hypot(p.x, p.y, p.z), 160, 6, " mil anos-luz");
  // Equatorial → galáctica (matriz do Hipparcos): pontos de referência da IAU.
  const centroGalactico = astro.equatorialParaGalactica(266.40499, -28.93617);
  teste("Galáxia", "Centro galáctico (AR 266,405°, Dec −28,936°) → l = 0°", diferencaAngular(centroGalactico.l, 0), 0, 0.01, "°");
  teste("Galáxia", "Centro galáctico → b = 0°", centroGalactico.b, 0, 0.01, "°");
  teste("Galáxia", "Polo norte galáctico (AR 192,859°, Dec +27,128°) → b = 90°", astro.equatorialParaGalactica(192.85948, 27.12825).b, 90, 0.001, "°");
  const orion = astro.equatorialParaGalactica(astro.arParaGraus("05 35 17.3"), astro.decParaGraus("-05 23 28"));
  teste("Galáxia", "Nebulosa de Órion (M42) → l = 209,01° (SIMBAD)", orion.l, 209.01, 0.05, "°");
  teste("Galáxia", "Nebulosa de Órion (M42) → b = −19,38° (SIMBAD)", orion.b, -19.38, 0.05, "°");
}

// ---------- 7b. Buracos negros e galáxias no comparador ----------
{
  // Raio de Schwarzschild: r = 2GM/c², com GM do Sol = 1,32712440041 × 10¹¹ km³/s² (IAU 2015).
  const esperado = (2 * 1.32712440041e11) / astro.VELOCIDADE_LUZ_KM_S ** 2;
  teste("Buracos negros e galáxias", "Raio do horizonte por massa do Sol = 2GM/c² (≈ 2,953 km)", cat.KM_POR_MASSA_SOLAR_SCHWARZSCHILD, esperado, 1e-4, " km");
  const sgr = cat.objetoPorId("sgr-a");
  const raioSgrUa = cat.raioParaComparar(sgr) / astro.KM_POR_UA;
  verdadeiro("Buracos negros e galáxias", `O horizonte de Sagitário A* (${raioSgrUa.toFixed(3)} UA) caberia dentro da órbita de Mercúrio`, raioSgrUa < planeta("mercurio").orbita.elementos.a);
  const ton = cat.GIGANTES.find((o) => o.id === "ton-618");
  teste("Buracos negros e galáxias", "TON 618: raio do horizonte ≈ 1.300 UA", cat.raioParaComparar(ton) / astro.KM_POR_UA, 1300, 50, " UA");
  const via = cat.GIGANTES.find((o) => o.id === "via-lactea"), andromeda = cat.objetoPorId("andromeda");
  teste("Buracos negros e galáxias", "Andrômeda tem ≈ 2,2 vezes o diâmetro da Via Láctea", cat.raioParaComparar(andromeda) / cat.raioParaComparar(via), 2.2, 0.01);
  const lista = cat.COMPARAVEIS;
  verdadeiro("Buracos negros e galáxias", `Lista do comparador em ordem crescente (${lista.length} astros, de ${lista[0].nome} a ${lista.at(-1).nome})`,
    lista.every((o, i) => i === 0 || cat.raioParaComparar(lista[i - 1]) <= cat.raioParaComparar(o)) && new Set(lista).size === lista.length);
  verdadeiro("Buracos negros e galáxias", "Toda categoria do comparador tem nome", lista.every((o) => ["galáxia", "buraco negro", "estrela", "planeta", "planeta anão", "lua", "sistema planetário"].includes(cat.categoriaDoAstro(o))));
  // Sistema Solar até Netuno: 2 × 30,07 UA ≈ 9 bilhões de km (NASA: Netuno a 4.515 milhões de km do Sol).
  const sistemaSolar = cat.raioParaComparar(cat.SISTEMA_SOLAR);
  teste("Buracos negros e galáxias", "Sistema Solar até Netuno: ≈ 9 bilhões de km de diâmetro", 2 * sistemaSolar / 1e9, 9.0, 0.05, " bilhões de km");
  verdadeiro("Buracos negros e galáxias", `O horizonte de TON 618 é maior que o Sistema Solar até Netuno (${Math.round(cat.raioParaComparar(ton) / sistemaSolar)} vezes)`,
    cat.raioParaComparar(ton) > sistemaSolar);
}

// ---------- 7c. A luz perto de um buraco negro (a conta do desenho) ----------
// O desenho do buraco negro segue cada raio de luz com a relatividade geral.
// A mesma conta, em JavaScript, tem de reproduzir resultados conhecidos.
{
  let capturado = 2, escapa = 4;   // parâmetros de impacto (raios do horizonte)
  for (let i = 0; i < 32; i++) {
    const meio = (capturado + escapa) / 2;
    if (astro.seguirRaioDeLuz(meio).capturado) capturado = meio; else escapa = meio;
  }
  teste("Luz e buracos negros", "Sombra: a luz é engolida até 3√3/2 ≈ 2,598 raios do horizonte (o tamanho da sombra)",
    (capturado + escapa) / 2, (3 * Math.sqrt(3)) / 2, 0.01);
  const quase = astro.seguirRaioDeLuz((3 * Math.sqrt(3)) / 2 + 0.002);
  teste("Luz e buracos negros", "Luz que quase cai dá voltas na esfera de fótons (1,5 raio do horizonte)", quase.raioMinimo, 1.5, 0.1);
  const b = 50;
  const previsto = 2 / b + (15 * Math.PI / 16) / (b * b);
  teste("Luz e buracos negros", "Desvio da luz a 50 raios do horizonte = 2/b + 15π/(16b²) (relatividade geral)",
    astro.seguirRaioDeLuz(b).desvio, previsto, Number((previsto * 0.01).toPrecision(2)), " rad");
  const desvioNoSol = ((2 * cat.KM_POR_MASSA_SOLAR_SCHWARZSCHILD) / cat.SOL.raioKm) * (180 / Math.PI) * 3600;
  teste("Luz e buracos negros", "Desvio da luz na borda do Sol ≈ 1,75″ (Einstein, 1915; eclipse de 1919)", desvioNoSol, 1.75, 0.01, "″");
}

// ---------- 8. Integridade da base de conhecimento ----------
{
  const ids = cat.TODOS_OS_OBJETOS.map((o) => o.id);
  verdadeiro("Base", `Ids únicos (${ids.length} objetos)`, new Set(ids).size === ids.length);
  for (const q of cat.PERGUNTAS) {
    verdadeiro("Base", `Pergunta ${q.id}: objeto existe e resposta válida`,
      cat.objetoPorId(q.objeto) && Number.isInteger(q.certa) && q.certa >= 0 && q.certa < q.opcoes.length);
  }
  for (const m of cat.MISSOES) {
    const c = m.condicao;
    const referencias = c.tipo === "descobrir" ? c.ids : c.tipo === "viagem" ? [c.alvo, c.origem].filter(Boolean) : [];
    verdadeiro("Base", `Missão ${m.id}: objetos referenciados existem`, referencias.every((id) => cat.objetoPorId(id)));
  }
  for (const o of cat.TODOS_OS_OBJETOS) {
    verdadeiro("Base", `${o.nome}: tem resumo e curiosidade`, o.resumo && o.curiosidade);
  }
  for (const o of cat.TODOS_OS_OBJETOS.filter((x) => x.imagem)) {
    let existe = true;
    try { readFileSync(join(raiz, o.imagem)); } catch { existe = false; }
    verdadeiro("Base", `${o.nome}: imagem ${o.imagem} existe`, existe);
  }
}
// ---------- Relatório ----------
const formatar = (v) => (typeof v === "number" ? (Math.abs(v) >= 1000 ? v.toFixed(0) : v.toPrecision(5)) : v);
let grupoAtual = "";
let falhas = 0;
for (const r of resultados) {
  if (r.grupo !== grupoAtual) {
    grupoAtual = r.grupo;
    console.log(`\n■ ${grupoAtual}`);
  }
  if (!r.ok) falhas++;
  const marca = r.ok ? "✔" : "✘";
  const numeros = r.erro !== undefined
    ? `  obtido ${formatar(r.obtido)}${r.unidade} · esperado ${formatar(r.esperado)}${r.unidade} · tolerância ±${r.tolerancia}${r.unidade}`
    : "";
  console.log(`  ${marca} ${r.nome}${numeros}`);
}
console.log(`\n${resultados.length - falhas}/${resultados.length} verificações passaram.`);
process.exit(falhas ? 1 : 0);
