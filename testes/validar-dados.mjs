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
for (const p of cat.PLANETAS) {
  const periodo = astro.periodoKeplerAnos(p.orbita.elementos.a);
  teste("Kepler", `${p.nome}: período pela 3ª lei (${p.periodoAnos} anos)`, periodo / p.periodoAnos, 1, 0.005);
}

// A ficha técnica (em texto) precisa bater com a órbita usada
// na simulação: a distância em UA escrita na ficha × semieixo maior.
for (const p of cat.PLANETAS) {
  const linha = p.ficha.find(([campo]) => campo.startsWith("Distância"));
  const ua = linha && Number(linha[1].match(/\(([\d,]+) UA\)/)?.[1].replace(",", "."));
  verdadeiro("Ficha", `${p.nome}: ficha técnica, texto e fonte presentes`, p.ficha?.length >= 6 && p.saibaMais && p.fonte?.startsWith("https://"));
  if (ua) teste("Ficha", `${p.nome}: distância da ficha (${ua} UA) × órbita`, ua / p.orbita.elementos.a, 1, 0.02);
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
