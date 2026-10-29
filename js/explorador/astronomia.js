// ---------------------------------------------------------------------------
// Explorador do Universo — cálculos astronômicos.
// Módulo puro (sem DOM e sem Three.js): roda no navegador e também no Node,
// o que permite validar os cálculos automaticamente (testes/validar-dados.mjs).
//
// Referência das órbitas: E. M. Standish (JPL), "Keplerian Elements for
// Approximate Positions of the Major Planets" — elementos válidos de 1800 a
// 2050, com erro típico de poucos minutos de arco para os planetas internos.
// ---------------------------------------------------------------------------

export const KM_POR_UA = 149_597_870.7;           // 1 unidade astronômica
export const KM_POR_ANO_LUZ = 9_460_730_472_580.8; // 1 ano-luz
export const UA_POR_ANO_LUZ = KM_POR_ANO_LUZ / KM_POR_UA; // ≈ 63.241 UA
export const VELOCIDADE_LUZ_KM_S = 299_792.458;
export const SEGUNDOS_POR_DIA = 86_400;
export const SEGUNDOS_POR_ANO = 365.25 * SEGUNDOS_POR_DIA; // ano juliano
export const OBLIQUIDADE_GRAUS = 23.43928;        // inclinação do eixo da Terra (J2000)

const RAD = Math.PI / 180;

// ---------- Tempo ----------

/** Data juliana (dias) de um objeto Date. */
export function dataJuliana(data) {
  return data.getTime() / 86_400_000 + 2_440_587.5;
}

/** Séculos julianos desde J2000.0 (1º/jan/2000, 12h TT). */
export function seculosDesdeJ2000(data) {
  return (dataJuliana(data) - 2_451_545.0) / 36_525;
}

// ---------- Órbitas keplerianas ----------

function normalizarGraus(angulo) {
  const resto = angulo % 360;
  return resto < 0 ? resto + 360 : resto;
}

/** Resolve a equação de Kepler M = E − e·sen(E) (graus) pelo método de Newton. */
export function resolverKepler(anomaliaMediaGraus, excentricidade) {
  let m = normalizarGraus(anomaliaMediaGraus);
  if (m > 180) m -= 360;
  const mRad = m * RAD;
  let e = mRad + excentricidade * Math.sin(mRad);
  for (let i = 0; i < 30; i++) {
    const delta = (e - excentricidade * Math.sin(e) - mRad) / (1 - excentricidade * Math.cos(e));
    e -= delta;
    if (Math.abs(delta) < 1e-12) break;
  }
  return e; // radianos
}

/**
 * Elementos orbitais de um planeta numa data.
 * elementos = { a, e, I, L, w, O } (valores em J2000) e
 * taxas = mesmas chaves por século juliano. Ângulos em graus, a em UA.
 */
export function elementosNaData(planeta, data) {
  const t = seculosDesdeJ2000(data);
  const { elementos: el, taxas: tx } = planeta.orbita;
  return {
    a: el.a + tx.a * t,
    e: el.e + tx.e * t,
    I: el.I + tx.I * t,
    L: el.L + tx.L * t,
    w: el.w + tx.w * t, // longitude do periélio (ϖ)
    O: el.O + tx.O * t  // longitude do nodo ascendente (Ω)
  };
}

/** Converte coordenadas no plano da órbita para o referencial eclíptico. */
function planoOrbitalParaEcliptica(xo, yo, { I, w, O }) {
  const argPerielio = (w - O) * RAD;
  const nodo = O * RAD;
  const inclinacao = I * RAD;
  const cw = Math.cos(argPerielio), sw = Math.sin(argPerielio);
  const cO = Math.cos(nodo), sO = Math.sin(nodo);
  const cI = Math.cos(inclinacao), sI = Math.sin(inclinacao);
  return {
    x: (cw * cO - sw * sO * cI) * xo + (-sw * cO - cw * sO * cI) * yo,
    y: (cw * sO + sw * cO * cI) * xo + (-sw * sO + cw * cO * cI) * yo,
    z: (sw * sI) * xo + (cw * sI) * yo
  };
}

/** Posição heliocêntrica eclíptica (UA) de um planeta numa data. */
export function posicaoHeliocentrica(planeta, data) {
  const el = elementosNaData(planeta, data);
  const anomaliaMedia = el.L - el.w;
  const E = resolverKepler(anomaliaMedia, el.e);
  const xo = el.a * (Math.cos(E) - el.e);
  const yo = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E);
  return planoOrbitalParaEcliptica(xo, yo, el);
}

/** Pontos da elipse orbital (para desenhar a órbita), em UA. */
export function pontosDaOrbita(planeta, data, quantidade = 256) {
  const el = elementosNaData(planeta, data);
  const pontos = [];
  for (let i = 0; i <= quantidade; i++) {
    const E = (i / quantidade) * Math.PI * 2;
    const xo = el.a * (Math.cos(E) - el.e);
    const yo = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E);
    pontos.push(planoOrbitalParaEcliptica(xo, yo, el));
  }
  return pontos;
}

/** Período orbital pela 3ª lei de Kepler (anos), com a em UA. */
export function periodoKeplerAnos(semiEixoUA) {
  return Math.pow(semiEixoUA, 1.5);
}

/** Longitude eclíptica (graus, 0–360) de um vetor heliocêntrico. */
export function longitudeEcliptica({ x, y }) {
  return normalizarGraus(Math.atan2(y, x) / RAD);
}

/**
 * Converte uma longitude do referencial J2000 para o equinócio da data,
 * somando a precessão geral (≈ 50,29″ por ano). Calendários de equinócios e
 * oposições usam o equinócio da data; as órbitas acima usam J2000.
 */
export function longitudeNoEquinocioDaData(longitudeJ2000, data) {
  return normalizarGraus(longitudeJ2000 + 1.396971 * seculosDesdeJ2000(data));
}

// ---------- Lua e Voyager ----------

/**
 * Posição geocêntrica eclíptica da Lua (km), pela fórmula de baixa precisão
 * do Astronomical Almanac (erro de ~0,3° na posição e ~0,2% na distância).
 */
export function posicaoLuaGeocentrica(data) {
  const d = dataJuliana(data) - 2_451_545.0;
  const L = 218.316 + 13.176396 * d;  // longitude média
  const M = 134.963 + 13.064993 * d;  // anomalia média
  const F = 93.272 + 13.229350 * d;   // argumento de latitude
  const lambda = (L + 6.289 * Math.sin(M * RAD)) * RAD;
  const beta = 5.128 * Math.sin(F * RAD) * RAD;
  const distancia = 385_001 - 20_905 * Math.cos(M * RAD);
  return {
    x: distancia * Math.cos(beta) * Math.cos(lambda),
    y: distancia * Math.cos(beta) * Math.sin(lambda),
    z: distancia * Math.sin(beta)
  };
}

/**
 * Posição heliocêntrica eclíptica aproximada (UA) de uma sonda que se afasta
 * em linha reta (caso da Voyager 1 depois de Saturno).
 */
export function posicaoSondaHeliocentrica(sonda, data) {
  const { referencia, direcao } = sonda;
  const anos = (data.getTime() - Date.parse(referencia.data)) / (SEGUNDOS_POR_ANO * 1000);
  const distancia = referencia.distanciaUA + referencia.uaPorAno * anos;
  return equatorialParaEcliptica(direcao.ar, direcao.dec, distancia);
}

/** Magnitude aparente de uma estrela vista a uma distância (anos-luz). */
export function magnitudeAparente(magnitudeAbsoluta, distanciaAnosLuz) {
  const parsecs = Math.max(distanciaAnosLuz, 1e-9) / 3.261563777;
  return magnitudeAbsoluta + 5 * Math.log10(parsecs) - 5;
}

/** Magnitude absoluta a partir da aparente e da distância (anos-luz). */
export function magnitudeAbsoluta(magnitudeAparenteVista, distanciaAnosLuz) {
  const parsecs = distanciaAnosLuz / 3.261563777;
  return magnitudeAparenteVista - 5 * Math.log10(parsecs) + 5;
}

// ---------- Coordenadas ----------

/** Converte ascensão reta "hh mm ss" e declinação "±dd mm ss" para graus. */
export function arParaGraus(ar) {
  const [h, m = 0, s = 0] = ar.split(/\s+/).map(Number);
  return (h + m / 60 + s / 3600) * 15;
}

export function decParaGraus(dec) {
  const negativo = dec.trim().startsWith("-") || dec.trim().startsWith("−");
  const [g, m = 0, s = 0] = dec.replace("−", "-").replace("+", "").split(/\s+/).map((v) => Math.abs(Number(v)));
  const valor = g + m / 60 + s / 3600;
  return negativo ? -valor : valor;
}

/**
 * Vetor no referencial eclíptico a partir de coordenadas equatoriais
 * (ascensão reta e declinação em graus) e distância (qualquer unidade).
 */
export function equatorialParaEcliptica(arGraus, decGraus, distancia) {
  const ra = arGraus * RAD, dec = decGraus * RAD, eps = OBLIQUIDADE_GRAUS * RAD;
  const xEq = distancia * Math.cos(dec) * Math.cos(ra);
  const yEq = distancia * Math.cos(dec) * Math.sin(ra);
  const zEq = distancia * Math.sin(dec);
  return {
    x: xEq,
    y: Math.cos(eps) * yEq + Math.sin(eps) * zEq,
    z: -Math.sin(eps) * yEq + Math.cos(eps) * zEq
  };
}

// ---------- Orientação dos astros (modelo da IAU) ----------

const TT_MENOS_UTC_DIAS = 69.184 / 86_400; // 32,184 s + 37 segundos intercalares

function vetorial(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function equatorialParaEclipticoVetor([x, y, z]) {
  const eps = OBLIQUIDADE_GRAUS * RAD;
  return { x, y: Math.cos(eps) * y + Math.sin(eps) * z, z: -Math.sin(eps) * y + Math.cos(eps) * z };
}

/**
 * Orientação de um astro pelo modelo da IAU (Archinal et al., 2018): polo
 * norte em (α0, δ0) e meridiano principal no ângulo W = W0 + Ẇ·d, medido a
 * partir do nó do equador do astro no equador celeste (d = dias desde J2000).
 * rotacao = { poloAr, poloDec, meridiano (W0), horas (período; negativo =
 * gira ao contrário) }. Devolve vetores unitários eclípticos: o polo, a
 * direção da longitude 0° e a da longitude 90° leste.
 */
export function orientacaoIau(rotacao, data) {
  const dias = dataJuliana(data) - 2_451_545.0 + TT_MENOS_UTC_DIAS;
  const w = normalizarGraus(rotacao.meridiano + (360 / (rotacao.horas / 24)) * dias) * RAD;
  const a = rotacao.poloAr * RAD, d = rotacao.poloDec * RAD;
  const polo = [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
  const no = [-Math.sin(a), Math.cos(a), 0];
  const depoisDoNo = vetorial(polo, no);
  const meridiano = no.map((v, i) => v * Math.cos(w) + depoisDoNo[i] * Math.sin(w));
  return {
    polo: equatorialParaEclipticoVetor(polo),
    meridiano: equatorialParaEclipticoVetor(meridiano),
    leste: equatorialParaEclipticoVetor(vetorial(polo, meridiano))
  };
}

/**
 * Inclinação do eixo em relação à órbita (graus), pelo polo da IAU e pelos
 * elementos orbitais. Para quem gira ao contrário, usa o polo "da mão
 * direita" (oposto ao da IAU), como nas tabelas da NASA.
 */
export function inclinacaoDoEixo(planeta, data = new Date(Date.UTC(2000, 0, 1, 12))) {
  const { I, O } = elementosNaData(planeta, data);
  const normal = [Math.sin(I * RAD) * Math.sin(O * RAD), -Math.sin(I * RAD) * Math.cos(O * RAD), Math.cos(I * RAD)];
  const p = equatorialParaEcliptica(planeta.rotacao.poloAr, planeta.rotacao.poloDec, 1);
  const cosseno = Math.max(-1, Math.min(1, p.x * normal[0] + p.y * normal[1] + p.z * normal[2]));
  const angulo = Math.acos(cosseno) / RAD;
  return planeta.rotacao.horas < 0 ? 180 - angulo : angulo;
}

/**
 * Coordenadas galácticas (l, b em graus) a partir de ascensão reta e
 * declinação J2000 (graus), pela matriz de rotação padrão ICRS → galáctico
 * (Hipparcos, ESA 1997).
 */
export function equatorialParaGalactica(arGraus, decGraus) {
  const ra = arGraus * RAD, dec = decGraus * RAD;
  const x = Math.cos(dec) * Math.cos(ra), y = Math.cos(dec) * Math.sin(ra), z = Math.sin(dec);
  const gx = -0.0548755604 * x - 0.8734370902 * y - 0.4838350155 * z;
  const gy = 0.4941094279 * x - 0.4448296300 * y + 0.7469822445 * z;
  const gz = -0.8676661490 * x - 0.1980763734 * y + 0.4559837762 * z;
  return { l: normalizarGraus(Math.atan2(gy, gx) / RAD), b: Math.asin(Math.max(-1, Math.min(1, gz))) / RAD };
}

/**
 * Posição galactocêntrica (mesma unidade de d) de um objeto com longitude e
 * latitude galácticas l, b (graus), visto do Sol. O centro da galáxia fica na
 * origem e o Sol em (−R0, 0, 0), com x apontando do Sol para o centro.
 */
export function galacticaParaGalactocentrica(l, b, d, distanciaSolCentro) {
  const lr = l * RAD, br = b * RAD;
  return {
    x: -distanciaSolCentro + d * Math.cos(br) * Math.cos(lr),
    y: d * Math.cos(br) * Math.sin(lr),
    z: d * Math.sin(br)
  };
}

/**
 * Passa de um referencial astronômico (z para o "norte") para o da cena 3D
 * (y para cima). A troca preserva a orientação (é uma rotação de 90°).
 */
export function paraCena({ x, y, z }) {
  return { x, y: z, z: -y };
}

// ---------- Luz perto de um buraco negro (Schwarzschild) ----------
// A mesma conta do desenho do buraco negro (shader em astros3d.js), aqui em
// JavaScript para poder ser testada. Unidades: raio do horizonte (raio de
// Schwarzschild) = 1. A trajetória da luz obedece à equação de Binet,
// u'' + u = 1,5 u² (u = 1/r), que equivale a uma "força" −1,5 h² x / r⁵,
// com h = momento angular do raio. Passo de Verlet igual ao do shader.

/**
 * Segue um raio de luz que chega de longe, em linha reta, a uma distância b
 * do centro (parâmetro de impacto, em raios do horizonte).
 * Devolve { capturado, desvio (rad), raioMinimo }.
 */
export function seguirRaioDeLuz(b, { inicio = Math.max(200, 60 * b), passos = 2_000_000 } = {}) {
  let x = -inicio, y = b, vx = 1, vy = 0;
  const h2 = b * b;
  let raioMinimo = Infinity;
  for (let i = 0; i < passos; i++) {
    const r2 = x * x + y * y, r = Math.sqrt(r2);
    raioMinimo = Math.min(raioMinimo, r);
    const dt = Math.min(0.8, Math.max(0.015, 0.07 * r));
    const k = -1.5 * h2 / (r2 * r2 * r);
    const ax = k * x, ay = k * y;
    const xn = x + vx * dt + 0.5 * ax * dt * dt;
    const yn = y + vy * dt + 0.5 * ay * dt * dt;
    const rn2 = xn * xn + yn * yn;
    const kn = -1.5 * h2 / (rn2 * rn2 * Math.sqrt(rn2));
    vx += 0.5 * (ax + kn * xn) * dt;
    vy += 0.5 * (ay + kn * yn) * dt;
    x = xn;
    y = yn;
    if (rn2 < 1) return { capturado: true, desvio: NaN, raioMinimo: Math.sqrt(rn2) };
    if (rn2 > inicio * inicio && x * vx + y * vy > 0) {
      return { capturado: false, desvio: Math.abs(Math.atan2(vy, vx)), raioMinimo };
    }
  }
  return { capturado: false, desvio: Math.abs(Math.atan2(vy, vx)), raioMinimo };
}

// ---------- Formatação (pt-BR) ----------

const numero = (valor, casas = 0) =>
  valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

/** Distância em km legível: "384 mil km", "1,5 bilhão de km"... */
export function formatarKm(km) {
  const abs = Math.abs(km);
  if (abs < 1_000) return `${numero(km)} km`;
  if (abs < 1e6) return `${numero(km / 1e3, abs < 1e4 ? 1 : 0)} mil km`;
  if (abs < 1e9) return `${numero(km / 1e6, abs < 1e7 ? 1 : 0)} ${abs < 2e6 ? "milhão" : "milhões"} de km`;
  if (abs < 1e12) return `${numero(km / 1e9, abs < 1e10 ? 1 : 0)} ${abs < 2e9 ? "bilhão" : "bilhões"} de km`;
  return `${numero(km / 1e12, abs < 1e13 ? 1 : 0)} ${abs < 2e12 ? "trilhão" : "trilhões"} de km`;
}

/** Distância escolhendo a unidade mais didática para o tamanho. */
export function formatarDistancia(km) {
  const ua = km / KM_POR_UA;
  const anosLuz = km / KM_POR_ANO_LUZ;
  if (anosLuz >= 0.1) {
    const casas = anosLuz < 10 ? 2 : anosLuz < 1000 ? 1 : 0;
    return `${numero(anosLuz, casas)} ${anosLuz >= 2 || anosLuz < 1 ? "anos-luz" : "ano-luz"}`;
  }
  if (ua >= 0.01) return `${formatarKm(km)} (${numero(ua, ua < 10 ? 2 : 1)} UA)`;
  return formatarKm(km);
}

/** Duração legível a partir de segundos: "8 min 19 s", "4,2 anos"... */
export function formatarDuracao(segundos) {
  if (!Number.isFinite(segundos)) return "—";
  const s = Math.abs(segundos);
  if (s < 1) return `${numero(s, 2)} s`;
  if (s < 59.5) return `${numero(s, s < 10 ? 1 : 0)} s`;
  if (s < 3570) {
    const total = Math.round(s);
    return `${Math.floor(total / 60)} min ${total % 60} s`;
  }
  if (s < SEGUNDOS_POR_DIA - 30) {
    const minutos = Math.round(s / 60);
    return `${Math.floor(minutos / 60)} h ${minutos % 60} min`;
  }
  if (s < SEGUNDOS_POR_ANO) {
    const dias = s / SEGUNDOS_POR_DIA;
    return `${numero(dias, dias < 10 ? 1 : 0)} ${dias < 2 ? "dia" : "dias"}`;
  }
  const anos = s / SEGUNDOS_POR_ANO;
  if (anos < 1e6) return `${numero(anos, anos < 10 ? 1 : 0)} ${anos < 2 ? "ano" : "anos"}`;
  if (anos < 1e9) return `${numero(anos / 1e6, 1)} milhões de anos`;
  return `${numero(anos / 1e9, 1)} bilhões de anos`;
}

/** Números grandes por extenso: 1.000, "10 mil", "100 milhões", "1 trilhão"... */
export function formatarGrande(valor) {
  const escalas = [[1e12, "trilhão", "trilhões"], [1e9, "bilhão", "bilhões"], [1e6, "milhão", "milhões"]];
  for (const [base, singular, plural] of escalas) {
    if (valor >= base) {
      const n = valor / base;
      return `${numero(n, n < 10 && !Number.isInteger(n) ? 1 : 0)} ${n < 2 ? singular : plural}`;
    }
  }
  if (valor >= 10_000) return `${numero(valor / 1000)} mil`;
  return numero(valor, valor < 10 && !Number.isInteger(valor) ? 1 : 0);
}

/** Velocidade legível: em km/h para coisas lentas, em km/s e em "c" acima. */
export function formatarVelocidade(kmPorSegundo) {
  if (kmPorSegundo < 1) return `${numero(kmPorSegundo * 3600)} km/h`;
  if (kmPorSegundo < VELOCIDADE_LUZ_KM_S * 0.5) return `${numero(kmPorSegundo, kmPorSegundo < 100 ? 1 : 0)} km/s`;
  const c = kmPorSegundo / VELOCIDADE_LUZ_KM_S;
  if (c < 1.5) return `${numero(VELOCIDADE_LUZ_KM_S)} km/s (a velocidade da luz)`;
  const texto = formatarGrande(c);
  const usaDe = /(milhão|milhões|bilhão|bilhões|trilhão|trilhões)$/.test(texto);
  return `${texto}${usaDe ? " de" : ""} vezes a velocidade da luz`;
}
