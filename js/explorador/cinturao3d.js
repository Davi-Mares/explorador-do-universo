// ---------------------------------------------------------------------------
// Explorador do Universo — Cinturão de Asteroides e asteroides troianos.
// Cada ponto tem uma órbita de Kepler própria (semieixo, excentricidade,
// inclinação, nodo, periélio e longitude média). A posição de cada um na
// data simulada é calculada na placa de vídeo (equação de Kepler no shader),
// então milhares de asteroides se movem sem pesar no processador.
//
// Distribuição inspirada no cinturão real: entre ≈ 2,1 e 3,3 UA, com as
// lacunas de Kirkwood (ressonâncias com Júpiter em 2,50, 2,82 e 2,95 UA) e
// os dois enxames de troianos 60° à frente e atrás de Júpiter. Os pontos são
// muito maiores que os asteroides de verdade, que ficariam invisíveis.
// ---------------------------------------------------------------------------

import * as THREE from "three";
import { aleatorioComSemente, gaussiana } from "./galaxias3d.js";

const RAD = Math.PI / 180;
const LACUNAS = [[2.502, 0.028], [2.825, 0.018], [2.958, 0.014]];

function semieixoDoCinturao(aleatorio) {
  for (;;) {
    const a = 2.08 + aleatorio() * 1.2;
    let chance = a < 2.5 ? 1 : a < 2.82 ? 0.9 : a < 2.96 ? 0.55 : 0.7;
    for (const [centro, largura] of LACUNAS) chance *= 1 - 0.92 * Math.exp(-(((a - centro) / largura) ** 2));
    if (aleatorio() < chance) return a;
  }
}

/**
 * Cria os pontos. "jupiter" = elementos de Júpiter em J2000 (para os
 * troianos andarem junto com ele). Devolve { objeto, material, atualizar(dias) }.
 */
export function criarCinturao({ jupiter, principal = 9000, troianos = 1400, semente = 1801 } = {}) {
  const aleatorio = aleatorioComSemente(semente);
  const orbitaA = [], orbitaB = [], brilhos = [];
  const adicionar = (a, e, i, nodo, perielio, longitude, brilho) => {
    orbitaA.push(a, e, i * RAD);
    orbitaB.push(nodo * RAD, perielio * RAD, longitude * RAD);
    brilhos.push(brilho);
  };
  for (let k = 0; k < principal; k++) {
    const e = Math.min(0.32, Math.abs(0.13 + gaussiana(aleatorio) * 0.07));
    const i = Math.min(32, Math.abs(gaussiana(aleatorio) * 8.5));
    adicionar(semieixoDoCinturao(aleatorio), e, i, aleatorio() * 360, aleatorio() * 360, aleatorio() * 360, 0.5 + aleatorio() * 0.5);
  }
  if (jupiter) {
    for (let k = 0; k < troianos; k++) {
      const lado = k % 2 ? 60 : -60;
      const e = Math.min(0.2, Math.abs(gaussiana(aleatorio) * 0.07));
      const i = Math.min(35, Math.abs(gaussiana(aleatorio) * 12));
      adicionar(jupiter.a, e, i, aleatorio() * 360, aleatorio() * 360, jupiter.L + lado + gaussiana(aleatorio) * 11, 0.45 + aleatorio() * 0.4);
    }
  }

  const geometria = new THREE.BufferGeometry();
  // A posição verdadeira sai do shader; este atributo só define a contagem.
  geometria.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(brilhos.length * 3), 3));
  geometria.setAttribute("orbitaA", new THREE.Float32BufferAttribute(orbitaA, 3));
  geometria.setAttribute("orbitaB", new THREE.Float32BufferAttribute(orbitaB, 3));
  geometria.setAttribute("brilho", new THREE.Float32BufferAttribute(brilhos, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      dias: { value: 0 },
      escalaPixel: { value: 1 },
      escalaProjecao: { value: 800 },
      cor: { value: new THREE.Color("#c9b79b") }
    },
    vertexShader: /* glsl */ `
      attribute vec3 orbitaA;   // a (UA), e, inclinação (rad)
      attribute vec3 orbitaB;   // nodo, longitude do periélio, longitude média em J2000 (rad)
      attribute float brilho;
      uniform float dias;
      uniform float escalaPixel;
      uniform float escalaProjecao;
      varying float vBrilho;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main() {
        float a = orbitaA.x, e = orbitaA.y, inc = orbitaA.z;
        float nodo = orbitaB.x, perielio = orbitaB.y;
        float n = 0.01720209895 / pow(a, 1.5);               // movimento médio (rad/dia)
        float M = mod(orbitaB.z + n * dias - perielio, 6.2831853);
        float E = M + e * sin(M);
        for (int k = 0; k < 4; k++) E -= (E - e * sin(E) - M) / (1.0 - e * cos(E));
        float xo = a * (cos(E) - e);
        float yo = a * sqrt(1.0 - e * e) * sin(E);
        float w = perielio - nodo;
        float cw = cos(w), sw = sin(w), cn = cos(nodo), sn = sin(nodo), ci = cos(inc), si = sin(inc);
        vec3 p = vec3(
          (cw * cn - sw * sn * ci) * xo + (-sw * cn - cw * sn * ci) * yo,
          (cw * sn + sw * cn * ci) * xo + (-sw * sn + cw * cn * ci) * yo,
          (sw * si) * xo + (cw * si) * yo);
        vec4 mv = modelViewMatrix * vec4(p.x, p.z, -p.y, 1.0);   // eclíptica → cena
        gl_Position = projectionMatrix * mv;
        // Mais perto, ponto maior (até 5 px): de dentro do cinturão dá para
        // ver os asteroides passando. De longe, 1,6 px.
        float px = clamp(0.004 * escalaProjecao / max(-mv.z, 1e-6), 1.6, 5.0);
        vBrilho = brilho * (0.8 + 0.2 * smoothstep(1.6, 5.0, px));
        gl_PointSize = px * escalaPixel;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 cor;
      varying float vBrilho;
      #include <common>
      #include <logdepthbuf_pars_fragment>
      void main() {
        #include <logdepthbuf_fragment>
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c) * 2.0;
        if (d > 1.0) discard;
        gl_FragColor = vec4(cor, (1.0 - d * d) * 0.8 * vBrilho);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const objeto = new THREE.Points(geometria, material);
  objeto.frustumCulled = false;
  return {
    objeto,
    material,
    atualizar(dias) { material.uniforms.dias.value = dias; }
  };
}
