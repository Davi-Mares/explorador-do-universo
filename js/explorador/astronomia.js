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

// ---------- Lua e sondas Voyager ----------

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

/** GM do Sol (km³/s²), o valor das efemérides do JPL. */
export const GM_SOL_KM3_S2 = 1.32712440018e11;

/** Resolve a equação de Kepler da hipérbole, M = e·senh(H) − H (radianos), pelo método de Newton. */
export function resolverKeplerHiperbolico(anomaliaMedia, excentricidade) {
  let h = Math.asinh(anomaliaMedia / excentricidade);
  for (let i = 0; i < 50; i++) {
    const delta = (excentricidade * Math.sinh(h) - h - anomaliaMedia) / (excentricidade * Math.cosh(h) - 1);
    h -= delta;
    if (Math.abs(delta) < 1e-13) break;
  }
  return h;
}

/**
 * Precessão de B1950,0 a J2000,0 em coordenadas eclípticas (modelo da IAU de
 * 1976; Meeus, "Astronomical Algorithms", cap. 21): η é o ângulo entre as duas
 * eclípticas, Π a longitude da linha em que elas se cruzam e p a precessão geral.
 */
const PRECESSAO_B1950 = (() => {
  const T = (2_433_282.4235 - 2_451_545.0) / 36_525, t = -T;   // séculos julianos: de B1950,0 até J2000,0
  const segundo = RAD / 3600;
  return {
    eta: ((47.0029 - 0.06603 * T + 0.000598 * T * T) * t + (-0.03302 + 0.000598 * T) * t * t + 0.00006 * t ** 3) * segundo,
    Pi: 174.876384 * RAD + (3289.4789 * T + 0.60622 * T * T - (869.8089 + 0.50491 * T) * t + 0.03536 * t * t) * segundo,
    p: ((5029.0966 + 2.22226 * T - 0.000042 * T * T) * t + (1.11113 - 0.000042 * T) * t * t - 0.000006 * t ** 3) * segundo
  };
})();

/** Leva um vetor da eclíptica e equinócio de B1950,0 para os de J2000,0. */
export function eclipticaB1950ParaJ2000({ x, y, z }) {
  const { eta, Pi, p } = PRECESSAO_B1950;
  // Eixo x na linha em que as duas eclípticas se cruzam, inclinação η e volta ao equinócio novo.
  const x1 = x * Math.cos(Pi) + y * Math.sin(Pi), y1 = -x * Math.sin(Pi) + y * Math.cos(Pi);
  const y2 = y1 * Math.cos(eta) + z * Math.sin(eta), z2 = -y1 * Math.sin(eta) + z * Math.cos(eta);
  const giro = Pi + p;
  return { x: x1 * Math.cos(giro) - y2 * Math.sin(giro), y: x1 * Math.sin(giro) + y2 * Math.cos(giro), z: z2 };
}

/** GM do Sol em UA³/dia² (o quadrado da constante de Gauss). */
const GM_SOL_UA3_DIA2 = (GM_SOL_KM3_S2 * 86_400 ** 2) / KM_POR_UA ** 3;
const UA_POR_DIA_EM_KM_S = KM_POR_UA / 86_400;

/**
 * Deixa pronta a hipérbole de uma sonda que está saindo do Sistema Solar, com
 * o Sol no foco. "trajetoria" pode vir de dois jeitos:
 * - vetores de estado (o que o JPL Horizons entrega): epoca, posicao (UA) e
 *   velocidade (UA/dia), heliocêntricas, na eclíptica de J2000;
 * - elementos orbitais (como o JPL publicou os das Voyager em 1989): aKm
 *   (negativo na hipérbole), e, i, O (nodo), w (periélio) e M (anomalia média
 *   na época), em graus, na eclíptica de B1950,0.
 * Devolve o semieixo |a| (UA), a excentricidade, o movimento médio (rad/dia),
 * a anomalia média na época e os eixos P (rumo ao periélio) e Q do plano da órbita.
 */
const trajetoriasProntas = new WeakMap();
function prepararTrajetoria(trajetoria) {
  let pronta = trajetoriasProntas.get(trajetoria);
  if (pronta) return pronta;
  const epoca = Date.parse(trajetoria.epoca);
  if (trajetoria.posicao) {
    const [x, y, z] = trajetoria.posicao, [vx, vy, vz] = trajetoria.velocidade;
    const raio = Math.hypot(x, y, z), v2 = vx * vx + vy * vy + vz * vz, rv = x * vx + y * vy + z * vz;
    const a = 1 / (v2 / GM_SOL_UA3_DIA2 - 2 / raio);                 // energia da órbita
    const momento = [y * vz - z * vy, z * vx - x * vz, x * vy - y * vx];
    const k = v2 - GM_SOL_UA3_DIA2 / raio;                            // vetor excentricidade: aponta para o periélio
    const vetorE = [(k * x - rv * vx) / GM_SOL_UA3_DIA2, (k * y - rv * vy) / GM_SOL_UA3_DIA2, (k * z - rv * vz) / GM_SOL_UA3_DIA2];
    const e = Math.hypot(...vetorE), h = Math.hypot(...momento);
    const P = vetorE.map((c) => c / e), W = momento.map((c) => c / h);
    const Q = [W[1] * P[2] - W[2] * P[1], W[2] * P[0] - W[0] * P[2], W[0] * P[1] - W[1] * P[0]];
    const anomalia = Math.sign(rv) * Math.acosh((raio / a + 1) / e);  // positiva: a sonda está se afastando
    pronta = { a, e, P, Q, epoca, movimentoMedio: Math.sqrt(GM_SOL_UA3_DIA2 / a ** 3), anomaliaMedia: e * Math.sinh(anomalia) - anomalia };
  } else {
    const a = Math.abs(trajetoria.aKm) / KM_POR_UA;
    const nodo = trajetoria.O * RAD, inclinacao = trajetoria.i * RAD;
    const eixo = (u) => {
      const v = eclipticaB1950ParaJ2000({
        x: Math.cos(nodo) * Math.cos(u) - Math.sin(nodo) * Math.sin(u) * Math.cos(inclinacao),
        y: Math.sin(nodo) * Math.cos(u) + Math.cos(nodo) * Math.sin(u) * Math.cos(inclinacao),
        z: Math.sin(u) * Math.sin(inclinacao)
      });
      return [v.x, v.y, v.z];
    };
    pronta = {
      a, e: trajetoria.e, P: eixo(trajetoria.w * RAD), Q: eixo(trajetoria.w * RAD + Math.PI / 2), epoca,
      movimentoMedio: Math.sqrt(GM_SOL_UA3_DIA2 / a ** 3), anomaliaMedia: trajetoria.M * RAD
    };
  }
  trajetoriasProntas.set(trajetoria, pronta);
  return pronta;
}

/**
 * Posição heliocêntrica eclíptica (UA, J2000) de uma sonda que está saindo do
 * Sistema Solar, na data pedida. Vale do último planeta visitado em diante.
 */
export function posicaoSondaHeliocentrica(sonda, data) {
  const { a, e, P, Q, epoca, movimentoMedio, anomaliaMedia } = prepararTrajetoria(sonda.trajetoria);
  const h = resolverKeplerHiperbolico(anomaliaMedia + (movimentoMedio * (data.getTime() - epoca)) / 86_400_000, e);
  const noEixoP = a * (e - Math.cosh(h)), noEixoQ = a * Math.sqrt(e * e - 1) * Math.sinh(h);
  return { x: noEixoP * P[0] + noEixoQ * Q[0], y: noEixoP * P[1] + noEixoQ * Q[1], z: noEixoP * P[2] + noEixoQ * Q[2] };
}

/** Velocidade da sonda em relação ao Sol (km/s), pela conservação da energia: v² = GM·(2/r + 1/|a|). */
export function velocidadeDaSonda(sonda, data) {
  const p = posicaoSondaHeliocentrica(sonda, data);
  const { a } = prepararTrajetoria(sonda.trajetoria);
  return Math.sqrt(GM_SOL_UA3_DIA2 * (2 / Math.hypot(p.x, p.y, p.z) + 1 / a)) * UA_POR_DIA_EM_KM_S;
}

/** Velocidade com que a sonda escapa, muito longe do Sol (km/s): v∞ = √(GM/|a|). */
export function velocidadeDeFuga(sonda) {
  return Math.sqrt(GM_SOL_UA3_DIA2 / prepararTrajetoria(sonda.trajetoria).a) * UA_POR_DIA_EM_KM_S;
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
 * Posição de uma lua em relação ao planeta (km, eclíptica J2000), pelos
 * elementos médios em relação ao equador do planeta (lua.orbitaDaLua): o
 * nodo é medido a partir do nó do equador do planeta no equador celeste, como
 * o meridiano da IAU. Com "acompanhaRotacao" (Caronte), a lua fica sempre
 * sobre o meridiano zero do planeta, que a IAU define virado para ela.
 */
export function posicaoDaLua(lua, rotacaoDoPai, data) {
  const o = lua.orbitaDaLua;
  if (o.acompanhaRotacao) {
    const { meridiano } = orientacaoIau(rotacaoDoPai, data);
    return { x: meridiano.x * o.aKm, y: meridiano.y * o.aKm, z: meridiano.z * o.aKm };
  }
  const dias = dataJuliana(data) - 2_451_545.0;
  const anomalia = resolverKepler(o.M0 + (360 * dias) / lua.periodoDias, o.e);
  const xo = o.aKm * (Math.cos(anomalia) - o.e);
  const yo = o.aKm * Math.sqrt(1 - o.e * o.e) * Math.sin(anomalia);
  const no = o.no * RAD, w = o.peri * RAD, i = o.i * RAD;
  const x = (Math.cos(no) * Math.cos(w) - Math.sin(no) * Math.sin(w) * Math.cos(i)) * xo
    + (-Math.cos(no) * Math.sin(w) - Math.sin(no) * Math.cos(w) * Math.cos(i)) * yo;
  const y = (Math.sin(no) * Math.cos(w) + Math.cos(no) * Math.sin(w) * Math.cos(i)) * xo
    + (-Math.sin(no) * Math.sin(w) + Math.cos(no) * Math.cos(w) * Math.cos(i)) * yo;
  const z = Math.sin(w) * Math.sin(i) * xo + Math.cos(w) * Math.sin(i) * yo;
  // Base do equador do planeta (coordenadas equatoriais J2000).
  const a = rotacaoDoPai.poloAr * RAD, d = rotacaoDoPai.poloDec * RAD;
  const polo = [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
  const nodo = [-Math.sin(a), Math.cos(a), 0];
  const lado = vetorial(polo, nodo);
  return equatorialParaEclipticoVetor([0, 1, 2].map((k) => nodo[k] * x + lado[k] * y + polo[k] * z));
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

/** Vetor unitário equatorial (J2000) de ascensão reta e declinação em graus. */
export function vetorEquatorial(arGraus, decGraus) {
  const ra = arGraus * RAD, dec = decGraus * RAD;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}

/** Vetor equatorial → galáctico (x para o centro da galáxia, z para o polo norte galáctico). */
export function equatorialParaGalacticoVetor([x, y, z]) {
  return [
    -0.0548755604 * x - 0.8734370902 * y - 0.4838350155 * z,
    0.4941094279 * x - 0.4448296300 * y + 0.7469822445 * z,
    -0.8676661490 * x - 0.1980763734 * y + 0.4559837762 * z
  ];
}

const escalar = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const combinar = (a, ka, b, kb) => [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb];

/**
 * Direções no céu em volta de (ar, dec): norte, leste e a direção de um
 * ângulo de posição qualquer (graus, do norte para o leste), equatoriais.
 */
export function direcoesNoCeu(arGraus, decGraus) {
  const a = arGraus * RAD, d = decGraus * RAD;
  const norte = [-Math.sin(d) * Math.cos(a), -Math.sin(d) * Math.sin(a), Math.cos(d)];
  const leste = [-Math.sin(a), Math.cos(a), 0];
  return { norte, leste, angulo: (pa) => combinar(norte, Math.cos(pa * RAD), leste, Math.sin(pa * RAD)) };
}

/**
 * Geometria de uma galáxia de disco vista da Terra, a partir do que se mede
 * nas fotos e nos mapas de velocidade:
 *   pa          ângulo de posição do eixo maior (graus, do norte para o leste);
 *   inclinacao  0° = de frente, 90° = de lado;
 *   ladoProximo ângulo de posição do lado do disco mais perto de nós (pa ± 90°);
 *   giro        "horario" ou "anti-horario": o sentido do giro visto da Terra.
 * Devolve vetores unitários equatoriais: n (linha de visada, da Terra para a
 * galáxia), m (eixo maior, para o lado "pa"), giro (eixo de rotação, pela regra
 * da mão direita) e lateral = m × giro (completa a base do disco).
 * A normal do disco que aponta para longe de nós é n·cos i + u(ladoProximo)·sen i;
 * quem gira no sentido horário (visto daqui) tem o giro nessa direção.
 */
export function geometriaDoDisco({ ar, dec, pa, inclinacao, ladoProximo, giro }) {
  const n = vetorEquatorial(ar, dec);
  const ceu = direcoesNoCeu(ar, dec);
  const m = ceu.angulo(pa);
  const i = inclinacao * RAD;
  const normalParaLonge = combinar(n, Math.cos(i), ceu.angulo(ladoProximo), Math.sin(i));
  const eixo = giro === "horario" ? normalParaLonge : normalParaLonge.map((v) => -v);
  return { n, m, giro: eixo, lateral: vetorial(m, eixo), ceu };
}

/**
 * Coordenadas no referencial do disco (x = eixo maior, y = eixo de giro,
 * z = lateral) de um ponto do espaço dado em coordenadas equatoriais,
 * relativo ao centro da galáxia.
 */
export function noReferencialDoDisco(geometria, vetor) {
  return { x: escalar(vetor, geometria.m), y: escalar(vetor, geometria.giro), z: escalar(vetor, geometria.lateral) };
}

/**
 * Onde fica, no plano do disco, um ponto do céu (ar, dec) da galáxia: a linha
 * de visada até ele cruza o plano do disco (que passa pelo centro, a uma
 * distância "distancia"). Devolve x, y (≈ 0) e z no referencial do disco, na
 * unidade de "distancia".
 */
export function noPlanoDoDisco(geometria, distancia, arGraus, decGraus) {
  return noPlanoDoDiscoNaDirecao(geometria, distancia, vetorEquatorial(arGraus, decGraus));
}

/** O mesmo, para uma direção do céu dada como vetor equatorial unitário. */
export function noPlanoDoDiscoNaDirecao(geometria, distancia, p) {
  const centro = geometria.n.map((v) => v * distancia);
  const t = escalar(centro, geometria.giro) / escalar(p, geometria.giro);
  return noReferencialDoDisco(geometria, combinar(p, t, centro, -1));
}

/**
 * Direção (x, z unitários no plano do disco) que, vista da Terra, sai do
 * centro da galáxia no ângulo de posição "pa" do céu.
 */
export function direcaoNoDisco(geometria, pa) {
  const passo = 1e-4;
  const p = combinar(geometria.n, 1, geometria.ceu.angulo(pa), passo);
  const q = noPlanoDoDiscoNaDirecao(geometria, 1, p.map((v) => v / Math.hypot(...p)));
  const tamanho = Math.hypot(q.x, q.z);
  return { x: q.x / tamanho, z: q.z / tamanho };
}

/**
 * Ponto do céu (ar, dec) a uma distância própria, relativo ao centro da
 * galáxia, no referencial do disco (para satélites, fora do disco).
 */
export function noEspacoDaGalaxia(geometria, distanciaCentro, arGraus, decGraus, distanciaPonto) {
  const p = vetorEquatorial(arGraus, decGraus);
  return noReferencialDoDisco(geometria, combinar(p, distanciaPonto, geometria.n, -distanciaCentro));
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
