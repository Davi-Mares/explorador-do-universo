// Atualiza, na página Sobre, a lista com todas as fontes citadas nas fichas.
// A lista fica entre as marcas "fontes:inicio" e "fontes:fim" do sobre.html e é
// conferida por testes/validar-dados.mjs (npm run validar).
//
// Uso: node ferramentas/atualizar_fontes_do_sobre.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as cat from "../js/explorador/catalogo.js";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const escapar = (texto) => texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** As fontes de um grupo de astros, sem repetir endereço: [{ url, rotulo, astros }]. */
export function fontesDoGrupo(objetos) {
  const porEndereco = new Map();
  for (const objeto of objetos) {
    for (const { rotulo, url } of cat.fontesDoObjeto(objeto)) {
      if (!porEndereco.has(url)) porEndereco.set(url, { url, rotulo, astros: [] });
      porEndereco.get(url).astros.push(objeto.nome);
    }
  }
  return [...porEndereco.values()];
}

export const GRUPOS_DE_FONTES = [
  ["Sistema Solar", [cat.SOL, ...cat.PLANETAS, cat.LUA, ...cat.LUAS, ...cat.PLANETAS_ANOES, cat.CINTURAO, ...cat.SONDAS]],
  ["Estrelas", cat.ESTRELAS],
  ["Via Láctea e galáxias vizinhas", cat.OBJETOS_GALAXIA],
  ["Comparador de tamanhos", [...cat.GIGANTES, cat.SISTEMA_SOLAR]]
];

export function blocoDeFontes() {
  const linhas = [];
  for (const [titulo, objetos] of GRUPOS_DE_FONTES) {
    const fontes = fontesDoGrupo(objetos);
    linhas.push(`      <details class="lista-de-fontes">`);
    linhas.push(`        <summary>${escapar(titulo)} (${fontes.length} ${fontes.length === 1 ? "fonte" : "fontes"})</summary>`);
    linhas.push(`        <ul>`);
    for (const { url, rotulo, astros } of fontes) {
      linhas.push(`          <li>${escapar(astros.join(", "))}: <a href="${escapar(url)}" target="_blank" rel="noopener">${escapar(rotulo)}</a></li>`);
    }
    linhas.push(`        </ul>`);
    linhas.push(`      </details>`);
  }
  return linhas.join("\n");
}

const INICIO = "<!-- fontes:inicio -->";
const FIM = "<!-- fontes:fim -->";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arquivo = join(raiz, "sobre.html");
  const pagina = readFileSync(arquivo, "utf8");
  const [antes, resto] = pagina.split(INICIO);
  const depois = resto?.split(FIM)[1];
  if (depois === undefined) throw new Error(`Faltam as marcas ${INICIO} e ${FIM} no sobre.html`);
  writeFileSync(arquivo, `${antes}${INICIO}\n${blocoDeFontes()}\n      ${FIM}${depois}`);
  console.log("Lista de fontes do sobre.html atualizada.");
}
