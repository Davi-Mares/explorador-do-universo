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

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import * as astro from "../js/explorador/astronomia.js";
import * as cat from "../js/explorador/catalogo.js";
import { blocoDeFontes, fontesDoGrupo, GRUPOS_DE_FONTES } from "../ferramentas/atualizar_fontes_do_sobre.mjs";

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

// ---------- 3b2. Luas: 3ª lei de Kepler com a massa dos planetas ----------
// Período calculado P = 2π·√(a³ / G(M+m)) contra o período sideral da NASA.
// GM (km³/s²): planetas, NASA NSSDC; luas, JPL (parâmetros físicos dos satélites).
{
  const GM_PLANETA = { marte: 42_828.37, jupiter: 126_686_534, saturno: 37_931_187, netuno: 6_836_529, plutao: 869.6 };
  const GM_LUA = { fobos: 0.0007087, deimos: 0.0000962, io: 5_959.92, europa: 3_202.71, ganimedes: 9_887.83, calisto: 7_179.28,
    tita: 8_978.14, encelado: 7.21, tritao: 1_428.5, caronte: 106.1 };
  for (const lua of cat.LUAS) {
    const a = lua.orbitaDaLua.aKm;
    const periodo = (2 * Math.PI * Math.sqrt(a ** 3 / (GM_PLANETA[lua.pai] + GM_LUA[lua.id]))) / 86_400;
    teste("Luas", `${lua.nome}: período pela 3ª lei de Kepler × NASA (${lua.periodoDias} dias)`, periodo / lua.periodoDias, 1, 0.01);
    teste("Luas", `${lua.nome}: gravidade na superfície (GM/R²) × catálogo`, (GM_LUA[lua.id] / lua.raioKm ** 2) * 1000 / lua.gravidade, 1, 0.05);
  }
  const data = new Date(Date.UTC(2026, 10, 4));
  for (const lua of cat.LUAS) {
    const pai = [...cat.PLANETAS, ...cat.PLANETAS_ANOES].find((p) => p.id === lua.pai);
    const p = astro.posicaoDaLua(lua, pai.rotacao, data);
    const d = Math.hypot(p.x, p.y, p.z), { aKm, e } = lua.orbitaDaLua;
    verdadeiro("Luas", `${lua.nome}: distância ao planeta entre o periastro e o apoastro`, d >= aKm * (1 - e) * 0.999 && d <= aKm * (1 + e) * 1.001);
  }
  // Caronte fica sempre sobre o meridiano zero de Plutão (que a IAU define virado para ele).
  const caronte = cat.LUAS.find((l) => l.id === "caronte");
  const plutao = cat.PLANETAS_ANOES.find((p) => p.id === "plutao");
  for (const horas of [0, 40, 100]) {
    const quando = new Date(data.getTime() + horas * 3_600_000);
    const p = astro.posicaoDaLua(caronte, plutao.rotacao, quando);
    const { meridiano } = astro.orientacaoIau(plutao.rotacao, quando);
    const cosseno = (p.x * meridiano.x + p.y * meridiano.y + p.z * meridiano.z) / Math.hypot(p.x, p.y, p.z);
    teste("Luas", `Caronte sobre o meridiano zero de Plutão (+${horas} h)`, Math.acos(Math.min(1, cosseno)) * 180 / Math.PI, 0, 0.01, "°");
  }
  // Tritão gira ao contrário: o momento angular aponta contra o polo de Netuno.
  const tritao = cat.LUAS.find((l) => l.id === "tritao");
  const netuno = planeta("netuno");
  const p1 = astro.posicaoDaLua(tritao, netuno.rotacao, data);
  const p2 = astro.posicaoDaLua(tritao, netuno.rotacao, new Date(data.getTime() + 3_600_000));
  const momento = [p1.y * p2.z - p1.z * p2.y, p1.z * p2.x - p1.x * p2.z, p1.x * p2.y - p1.y * p2.x];
  const { polo } = astro.orientacaoIau(netuno.rotacao, data);
  verdadeiro("Luas", "Tritão: órbita retrógrada (gira ao contrário da rotação de Netuno)", momento[0] * polo.x + momento[1] * polo.y + momento[2] * polo.z < 0);
  verdadeiro("Luas", "Ganimedes é maior que Mercúrio (a ficha diz isso)", cat.LUAS.find((l) => l.id === "ganimedes").raioKm > planeta("mercurio").raioKm);
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

// ---------- 5. Voyager 1 e 2 ----------
// As sondas partem da posição e da velocidade do JPL Horizons em novembro de
// 2026 (catalogo.js) e seguem as suas hipérboles. A conta é conferida com
// marcos da NASA (a marca de 1 dia-luz, a saída da heliosfera de cada uma e o
// rumo com que escapam) e com uma segunda fonte: os elementos orbitais que o
// JPL publicou em 1989, levados até hoje.
{
  const G = "Voyager";
  const modulo = (p) => Math.hypot(p.x, p.y, p.z);
  const doSol = (sonda, iso) => modulo(astro.posicaoSondaHeliocentrica(sonda, new Date(iso)));
  const vistaDaTerra = (sonda, iso) => {
    const data = new Date(iso), v = astro.posicaoSondaHeliocentrica(sonda, data), t = astro.posicaoHeliocentrica(planeta("terra"), data);
    return { x: v.x - t.x, y: v.y - t.y, z: v.z - t.z };
  };
  const UA_POR_DIA_LUZ = (astro.VELOCIDADE_LUZ_KM_S * 86_400) / astro.KM_POR_UA;   // 173,14 UA
  const [v1, v2] = cat.SONDAS;

  teste(G, "Voyager 1 a 1 dia-luz da Terra em 18/nov/2026, 10h16 UTC (NASA: 25,902 bilhões de km)",
    modulo(vistaDaTerra(v1, new Date(cat.VOYAGER_A_UM_DIA_LUZ).toISOString())) / UA_POR_DIA_LUZ, 1, 0.0001, " dia-luz");
  teste(G, "Voyager 1 a 121,6 UA do Sol ao sair da heliosfera, em 25/ago/2012 (NASA)", doSol(v1, "2012-08-25T00:00:00Z"), 121.6, 0.15, " UA");
  teste(G, "Voyager 2 a ≈ 119 UA do Sol ao sair da heliosfera, em 5/nov/2018 (NASA)", doSol(v2, "2018-11-05T00:00:00Z"), 119, 0.3, " UA");
  const v2Em2018 = modulo(vistaDaTerra(v2, "2018-12-10T00:00:00Z")) * astro.KM_POR_UA;
  teste(G, "Voyager 2 a ≈ 18 bilhões de km da Terra em 10/dez/2018 (NASA)", v2Em2018 / 1e9, 18, 0.2, " bilhões de km");
  teste(G, "A luz levava ≈ 16,5 h da Voyager 2 até a Terra em 10/dez/2018 (NASA)", v2Em2018 / astro.VELOCIDADE_LUZ_KM_S / 3600, 16.5, 0.2, " h");

  // Velocidade com que escapam, longe do Sol: 520 e 470 milhões de km por ano (NASA).
  const milhoesDeKmPorAno = (sonda) => (astro.velocidadeDeFuga(sonda) * astro.SEGUNDOS_POR_ANO) / 1e6;
  teste(G, "Voyager 1 escapa a ≈ 520 milhões de km por ano (NASA)", milhoesDeKmPorAno(v1), 520, 10, " milhões de km/ano");
  teste(G, "Voyager 2 escapa a ≈ 470 milhões de km por ano (NASA)", milhoesDeKmPorAno(v2), 470, 10, " milhões de km/ano");
  teste(G, "Voyager 1 a ≈ 17 km/s em relação ao Sol, em nov/2026", astro.velocidadeDaSonda(v1, new Date("2026-11-11T00:00:00Z")), 17, 0.2, " km/s");
  teste(G, "Voyager 2 a ≈ 15,4 km/s em relação ao Sol, em nov/2026 (NASA)", astro.velocidadeDaSonda(v2, new Date("2026-11-11T00:00:00Z")), 15.4, 0.2, " km/s");

  // Rumo de saída: a direção do movimento daqui a séculos, em relação ao plano dos planetas.
  const latitudeDoRumo = (sonda) => {
    const a = astro.posicaoSondaHeliocentrica(sonda, new Date("2300-01-01T00:00:00Z"));
    const b = astro.posicaoSondaHeliocentrica(sonda, new Date("2301-01-01T00:00:00Z"));
    return (Math.asin((b.z - a.z) / modulo({ x: b.x - a.x, y: b.y - a.y, z: b.z - a.z })) * 180) / Math.PI;
  };
  teste(G, "Voyager 1 sobe ≈ 35° para o norte do plano dos planetas (NASA)", latitudeDoRumo(v1), 35, 1, "°");
  teste(G, "Voyager 2 desce ≈ 48° para o sul do plano dos planetas (NASA)", latitudeDoRumo(v2), -48, 1, "°");

  // Lugar no céu visto da Terra em dezembro de 2018 (Sky & Telescope, com as efemérides do JPL):
  // confere a passagem do referencial de 1950 para o de 2000.
  const separacao = (sonda, ar, dec) => {
    const g = vistaDaTerra(sonda, "2018-12-15T00:00:00Z"), e = astro.equatorialParaEcliptica(ar, dec, 1);
    return (Math.acos((g.x * e.x + g.y * e.y + g.z * e.z) / modulo(g)) * 180) / Math.PI;
  };
  teste(G, "Voyager 1 em Ofiúco (AR 17h13m03s, Dec +11°58′) em dez/2018", separacao(v1, (17 + 13 / 60 + 3 / 3600) * 15, 11 + 58 / 60 + 19 / 3600), 0, 0.25, "°");
  teste(G, "Voyager 2 no Pavão (AR 20h02m57s, Dec −57°37′) em dez/2018", separacao(v2, (20 + 2 / 60 + 57 / 3600) * 15, -(57 + 37 / 60 + 12 / 3600)), 0, 0.25, "°");

  // Segunda fonte: os elementos de 1989, levados por 36 anos, caem quase no mesmo lugar.
  for (const sonda of [v1, v2]) {
    const data = new Date("2026-11-18T10:15:01Z");
    const hoje = astro.posicaoSondaHeliocentrica(sonda, data);
    const em1989 = astro.posicaoSondaHeliocentrica({ trajetoria: cat.ELEMENTOS_JPL_1989[sonda.id] }, data);
    const diferenca = modulo({ x: hoje.x - em1989.x, y: hoje.y - em1989.y, z: hoje.z - em1989.z });
    teste(G, `${sonda.nome}: Horizons (2026) × elementos do JPL de 1989, diferença em nov/2026`, diferenca, 0, 0.15, " UA");
    teste(G, `${sonda.nome}: a mesma diferença em relação à distância do Sol`, (diferenca / modulo(hoje)) * 100, 0, 0.1, "%");
  }

  const equinocio = astro.eclipticaB1950ParaJ2000({ x: 1, y: 0, z: 0 });
  teste(G, "Precessão de 1950 a 2000: o equinócio anda 0,698° (50,3″ por ano)", (Math.atan2(equinocio.y, equinocio.x) * 180) / Math.PI, (50.29 * 50) / 3600, 0.001, "°");
  verdadeiro(G, "A Voyager 1 está mais longe do Sol que a Voyager 2 (é o objeto humano mais distante)",
    doSol(v1, "2026-11-11T00:00:00Z") > doSol(v2, "2026-11-11T00:00:00Z"));
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

// ---------- 7b2. Galáxias vizinhas: posição, distância e geometria ----------
// Os modelos 3D usam a geometria medida de cada disco. Aqui se confere que a
// conta reproduz o que foi medido: o lado que se afasta de nós, o sentido do
// giro, a inclinação e onde ficam os lugares com nome.
{
  const G = "Galáxias vizinhas";
  const KPC = 3.26156;
  const escalar = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const vetorial = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const vizinha = (id) => cat.objetoPorId(id);
  const geometria = (o) => astro.geometriaDoDisco({ ar: astro.arParaGraus(o.ar), dec: astro.decParaGraus(o.dec), ...o.disco });
  for (const [id, kpc, fonte] of [["andromeda", 761, "Li et al., 2021"], ["triangulo", 840, "Breuval et al., 2023"], ["lmc", 49.59, "Pietrzyński et al., 2019"], ["smc", 62.44, "Graczyk et al., 2020"]]) {
    const o = vizinha(id);
    const { l, b } = astro.equatorialParaGalactica(astro.arParaGraus(o.ar), astro.decParaGraus(o.dec));
    teste(G, `${o.nome}: l e b batem com a posição no céu (ar, dec)`, Math.hypot(diferencaAngular(l, o.l) * Math.cos(b * Math.PI / 180), b - o.b), 0, 0.02, "°");
    teste(G, `${o.nome}: distância de ${kpc} kpc (${fonte})`, o.d, kpc * KPC, 0.6, " mil anos-luz");
  }
  for (const id of ["andromeda", "triangulo", "lmc"]) {
    const o = vizinha(id), g = geometria(o);
    const angulo = Math.acos(Math.abs(escalar(g.giro, g.n))) * 180 / Math.PI;
    teste(G, `${o.nome}: o eixo de giro faz ${o.disco.inclinacao}° com a linha de visada (inclinação)`, angulo, o.disco.inclinacao, 1e-6, "°");
    teste(G, `${o.nome}: lado próximo a 90° do eixo maior`, Math.abs(diferencaAngular(o.disco.ladoProximo, o.disco.pa)), 90, 1e-9, "°");
  }
  // Velocidade de um ponto do eixo maior, do lado "pa": v = giro × r; + = se afasta de nós.
  const seAfasta = (o) => { const g = geometria(o); return escalar(vetorial(g.giro, g.m), g.n); };
  verdadeiro(G, "Andrômeda: o lado nordeste se afasta de nós e o sudoeste se aproxima (Chemin et al., 2009)", seAfasta(vizinha("andromeda")) > 0.9);
  verdadeiro(G, "Triângulo: a metade norte se aproxima de nós (Kam et al., 2017)", seAfasta(vizinha("triangulo")) < -0.7);
  verdadeiro(G, "Grande Nuvem: gira no sentido horário visto da Terra (van der Marel e Kallivayalil, 2014)", escalar(geometria(vizinha("lmc")).giro, geometria(vizinha("lmc")).n) > 0);
  // O eixo de giro de Andrômeda reproduz o publicado por Andrae e Jahnke (2011),
  // que usam o sinal contrário (o deles aponta para longe de nós).
  {
    const g = geometria(vizinha("andromeda"));
    const publicado = [-0.08031, -0.79651, 0.59926];
    const cosseno = -escalar(g.giro, publicado) / Math.hypot(...publicado);
    teste(G, "Andrômeda: eixo de giro igual ao de Andrae e Jahnke (2011), com o sinal trocado", Math.acos(Math.min(1, cosseno)) * 180 / Math.PI, 0, 0.05, "°");
  }
  // Lugares com nome, levados do céu para o plano do disco.
  const noDisco = (id, regiao) => {
    const o = vizinha(id), r = o.regioes.find((x) => x.id === regiao);
    const p = astro.noPlanoDoDisco(geometria(o), o.d, astro.arParaGraus(r.ar), astro.decParaGraus(r.dec));
    return Math.hypot(p.x, p.z);
  };
  const r206 = noDisco("andromeda", "ngc206"), r604 = noDisco("triangulo", "ngc604"), rTarantula = noDisco("lmc", "tarantula");
  verdadeiro(G, `NGC 206 fica no disco de Andrômeda, perto do anel de 10 kpc (${r206.toFixed(1)} mil anos-luz do centro)`, r206 > 25 && r206 < 36);
  verdadeiro(G, `NGC 604 fica a ${r604.toFixed(1)} mil anos-luz do centro da Triângulo, dentro do disco de 60 mil`, r604 > 6 && r604 < 15);
  verdadeiro(G, `A Tarântula fica a ${rTarantula.toFixed(1)} mil anos-luz do centro da Grande Nuvem`, rTarantula > 2 && rTarantula < 8);
  // M32: 24′ ao sul do núcleo (≈ 5,3 kpc no céu, na distância de Andrômeda).
  {
    const o = vizinha("andromeda"), m32 = o.regioes.find((x) => x.id === "m32");
    const sep = Math.acos(escalar(astro.vetorEquatorial(astro.arParaGraus(o.ar), astro.decParaGraus(o.dec)),
      astro.vetorEquatorial(astro.arParaGraus(m32.ar), astro.decParaGraus(m32.dec)))) * 180 / Math.PI * 60;
    teste(G, "M32 está a 24′ do núcleo de Andrômeda", sep, 24.3, 0.5, "′");
  }
  // Tamanhos no comparador, do menor para o maior.
  const ordem = cat.COMPARAVEIS.filter((o) => o.categoria === "galáxia").map((o) => o.id);
  verdadeiro(G, `Galáxias no comparador em ordem: ${ordem.join(" < ")}`, ordem.join(",") === "smc,lmc,triangulo,via-lactea,andromeda");
  teste(G, "A Triângulo tem ≈ 60% do diâmetro da Via Láctea (ESA/Hubble)", vizinha("triangulo").diametroAnosLuz / 100_000, 0.6, 0.01);
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
    verdadeiro("Base", `Pergunta ${q.id}: objeto existe, resposta válida e opções diferentes entre si`,
      cat.objetoPorId(q.objeto) && Number.isInteger(q.certa) && q.certa >= 0 && q.certa < q.opcoes.length &&
      q.opcoes.length >= 3 && new Set(q.opcoes).size === q.opcoes.length && q.pergunta && q.explicacao);
  }
  // Todo objeto tem o seu desafio, e só um.
  const desafios = cat.PERGUNTAS.map((q) => q.objeto);
  verdadeiro("Base", `Cada um dos ${ids.length} objetos tem um desafio (${cat.PERGUNTAS.length} perguntas)`,
    new Set(desafios).size === desafios.length && ids.every((id) => desafios.includes(id)));
  verdadeiro("Base", "Ids das perguntas únicos", new Set(cat.PERGUNTAS.map((q) => q.id)).size === cat.PERGUNTAS.length);
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

// ---------- Créditos das fotos e fontes ----------
{
  const G = "Créditos e fontes";
  const sobre = readFileSync(join(raiz, "sobre.html"), "utf8").replace(/&amp;/g, "&");
  const AGENCIAS = /^https:\/\/(esahubble\.org|www\.jpl\.nasa\.gov|science\.nasa\.gov)\//;
  const comFoto = cat.TODOS_OS_OBJETOS.filter((x) => x.imagem);
  verdadeiro(G, `${comFoto.length} fotos no Diário, todas com crédito`, comFoto.length >= 11 && comFoto.every((o) => o.creditoImagem));
  for (const o of comFoto) {
    const c = o.creditoImagem;
    verdadeiro(G, `${o.nome}: crédito, descrição, licença e link da página oficial da foto`,
      c.credito && c.descricao && c.licenca && AGENCIAS.test(c.link));
    if (c.link.includes("esahubble.org")) verdadeiro(G, `${o.nome}: foto da ESA/Hubble com licença CC BY 4.0`, c.licenca === "CC BY 4.0");
    verdadeiro(G, `${o.nome}: crédito exato e link na página Sobre`, sobre.includes(c.credito) && sobre.includes(c.link));
    // WebP: largura e altura no cabeçalho (VP8, VP8L ou VP8X); as fotos são quadradas.
    const b = readFileSync(join(raiz, o.imagem));
    const tipo = b.toString("ascii", 12, 16);
    const [w, h] = tipo === "VP8X" ? [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)]
      : tipo === "VP8L" ? [1 + (b.readUInt32LE(21) & 0x3fff), 1 + ((b.readUInt32LE(21) >> 14) & 0x3fff)]
        : [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    verdadeiro(G, `${o.nome}: foto quadrada de ${w} × ${h} px`, w === h && w >= 400);
  }
  // Todo objeto tem ficha técnica e pelo menos uma fonte com link. Fora as estrelas
  // (ficha montada com os dados de catálogo do SIMBAD), todos têm também o "saiba mais".
  for (const o of [...cat.TODOS_OS_OBJETOS, ...cat.GIGANTES, cat.SISTEMA_SOLAR]) {
    const fontes = cat.fontesDoObjeto(o);
    const noExplorador = cat.TODOS_OS_OBJETOS.includes(o);
    const texto = !noExplorador ? "fonte" : o.espectro ? "ficha de catálogo" : 'ficha com "saiba mais"';
    verdadeiro(G, `${o.nome}: ${texto} e ${fontes.length} ${fontes.length === 1 ? "fonte" : "fontes"} com link`,
      (!noExplorador || (o.ficha?.length && (o.saibaMais || o.espectro))) &&
      fontes.length && fontes.every((f) => f.rotulo && f.url.startsWith("https://")));
  }
  // As 30 estrelas apontam para a página de cada uma no SIMBAD.
  verdadeiro(G, "Estrelas: cada uma com o endereço da sua página no SIMBAD",
    new Set(cat.ESTRELAS.map((e) => cat.fontesDoObjeto(e)[0].url)).size === cat.ESTRELAS.length &&
    cat.ESTRELAS.every((e) => cat.fontesDoObjeto(e)[0].url.startsWith("https://simbad.cds.unistra.fr/simbad/sim-id?Ident=")));
  // A página Sobre lista todas as fontes das fichas (refazer: node ferramentas/atualizar_fontes_do_sobre.mjs).
  const enderecos = GRUPOS_DE_FONTES.flatMap(([, objetos]) => fontesDoGrupo(objetos).map((f) => f.url));
  const sobreSemEscape = readFileSync(join(raiz, "sobre.html"), "utf8");
  verdadeiro(G, `Página Sobre: lista com as ${enderecos.length} fontes das fichas, em dia com o catálogo`,
    enderecos.length >= 80 && sobreSemEscape.includes(blocoDeFontes()));
  verdadeiro(G, "Fontes: nenhuma ficha cita a Wikipédia", enderecos.every((url) => !/wikipedia\.org/i.test(url)));
  // Não sobra foto sem dono (e portanto sem crédito) nas pastas do Diário.
  const usadas = new Set(comFoto.map((o) => o.imagem));
  for (const pasta of ["img/planetas", "img/universo"]) {
    for (const arquivo of readdirSync(join(raiz, pasta))) {
      verdadeiro(G, `${pasta}/${arquivo} tem crédito (é foto de um astro)`, usadas.has(`${pasta}/${arquivo}`));
    }
  }
}
// ---------- Foto de verdade ou ilustração ----------
{
  const G = "Foto ou ilustração";
  const tipos = Object.keys(cat.TIPOS_DE_APARENCIA);
  const avisos = cat.TODOS_OS_OBJETOS.map((o) => [o, cat.aparenciaDoObjeto(o)]);
  const semAviso = avisos.filter(([, a]) => !a || !tipos.includes(a.tipo) || !a.icone || a.texto.length < 40).map(([o]) => o.nome);
  verdadeiro(G, `Os ${avisos.length} astros avisam se o que aparece em 3D é foto de verdade ou ilustração`, !semAviso.length, semAviso.join(", "));
  const conta = (tipo) => avisos.filter(([, a]) => a?.tipo === tipo).length;
  verdadeiro(G, `${conta("real")} com imagem de verdade, ${conta("parcial")} com parte ilustrada e ${conta("ilustracao")} ilustrações`,
    conta("real") >= 10 && conta("parcial") >= 8 && conta("real") + conta("parcial") + conta("ilustracao") === avisos.length);
  // Estrelas, nebulosas, galáxias, sondas e o cinturão são sempre ilustrações.
  const desenhados = cat.TODOS_OS_OBJETOS.filter((o) => o.espectro || o.nivel === "galaxia" || o.trajetoria || o.id === "cinturao");
  verdadeiro(G, `Estrelas, nebulosas, galáxias, sondas e cinturão (${desenhados.length}) aparecem como ilustração`,
    desenhados.every((o) => cat.aparenciaDoObjeto(o).tipo === "ilustracao"));
  // Todo mapa do Sistema Solar que o programa carrega tem aviso de imagem de verdade ou de parte ilustrada.
  const comMapa = cat.TODOS_OS_OBJETOS.filter((o) => o.nivel === "solar" && o.raioKm && !o.trajetoria);
  const mapas = readdirSync(join(raiz, "img/texturas"));
  verdadeiro(G, `Os ${comMapa.length} astros com mapa têm o arquivo em img/texturas`, comMapa.every((o) => mapas.includes(`${o.id}.webp`)), comMapa.filter((o) => !mapas.includes(`${o.id}.webp`)).map((o) => o.id).join(", "));
  verdadeiro(G, "A Via Láctea avisa que é uma ilustração", cat.APARENCIA_DA_VIA_LACTEA.tipo === "ilustracao" && /fotografou de fora/.test(cat.APARENCIA_DA_VIA_LACTEA.texto));
  const sobre = readFileSync(join(raiz, "sobre.html"), "utf8");
  verdadeiro(G, "Página Sobre explica os três avisos (📷, 🧩 e 🎨)", ["📷", "🧩", "🎨"].every((icone) => sobre.includes(icone)));
}
// ---------- Decolagem (abertura do Explorador) ----------
{
  const G = "Decolagem";
  const pagina = readFileSync(join(raiz, "explorador.html"), "utf8");
  const principal = readFileSync(join(raiz, "js/explorador/main.js"), "utf8");
  verdadeiro(G, "A página tem a legenda, o alfinete e o botão de pular",
    ["decolagem-titulo", "decolagem-texto", "decolagem-altura", "decolagem-pino", "decolagem-pular", "botao-decolagem"].every((id) => pagina.includes(`id="${id}"`)));
  const partida = principal.match(/PARTIDA = \{[^}]*latitude: (-?[\d.]+), longitude: (-?[\d.]+)/);
  verdadeiro(G, "A partida é em Sinop (11,86° S, 55,51° O)", Boolean(partida) && Math.abs(Number(partida[1]) + 11.86) < 0.05 && Math.abs(Number(partida[2]) + 55.51) < 0.05);
  verdadeiro(G, "Dá para pular e quem pediu menos movimento não vê a animação", /terminarDecolagem\(\{ pulou: true \}\)/.test(principal) && /if \(movimentoReduzido\) return false;/.test(principal));
}
// ---------- Site offline (PWA) e página do repositório ----------
{
  const G = "Site";
  const sw = readFileSync(join(raiz, "pwa/service-worker.js"), "utf8");
  const lista = [...sw.matchAll(/"\.\/([^"]+)"/g)].map((m) => m[1]);
  const existe = (caminho) => { try { readFileSync(join(raiz, caminho)); return true; } catch { return false; } };
  const faltando = lista.filter((caminho) => !existe(caminho));
  verdadeiro(G, `Service worker: os ${lista.length} arquivos guardados para uso offline existem`, lista.length > 40 && !faltando.length, faltando.join(", "));
  const doSite = [
    ...readdirSync(raiz).filter((a) => a.endsWith(".html")),
    ...["css", "js", "js/explorador"].flatMap((pasta) => readdirSync(join(raiz, pasta)).filter((a) => /\.(css|js)$/.test(a)).map((a) => `${pasta}/${a}`))
  ];
  const foraDaLista = doSite.filter((caminho) => !lista.includes(caminho));
  verdadeiro(G, `Service worker: as ${doSite.length} páginas, estilos e scripts do site estão na lista`, !foraDaLista.length, foraDaLista.join(", "));
  // O README (a página do repositório) acompanha a base de conhecimento.
  const leiame = readFileSync(join(raiz, "README.md"), "utf8");
  const numeros = { objetos: cat.TODOS_OS_OBJETOS.length, desafios: cat.PERGUNTAS.length, missoes: cat.MISSOES.length, estrelas: cat.ESTRELAS.length };
  verdadeiro(G, `README com os números da base: ${numeros.objetos} astros, ${numeros.desafios} desafios, ${numeros.missoes} missões e ${numeros.estrelas} estrelas`,
    leiame.includes(`${numeros.objetos} astros`) && leiame.includes(`${numeros.desafios} desafios`) &&
    leiame.includes(`${numeros.missoes} missões`) && leiame.includes(`${numeros.estrelas} estrelas`));
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
