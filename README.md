# 🔭 Explorador do Universo

**Astronomia em escala real.** Você pilota uma nave do Sistema Solar até a Via Láctea, com distâncias, tamanhos e posições de verdade, e guarda o que descobre no **Diário de bordo**.

> MVP do Trabalho de Conclusão de Curso de **Sistemas de Informação — UNEMAT, campus Sinop** · **Davi Alves Mares**

[![Validação dos dados](https://github.com/Davi-Mares/explorador-do-universo/actions/workflows/validar.yml/badge.svg)](https://github.com/Davi-Mares/explorador-do-universo/actions/workflows/validar.yml)

🌐 **Acesse:** https://davi-mares.github.io/explorador-do-universo/

## O que tem

- **Explorar**, em três níveis de escala:
  - **Sistema Solar** — os planetas onde estão hoje (com o dia e a noite certos), a Lua e mais 10 luas, Plutão, Ceres, o Cinturão de Asteroides e a Voyager 1, com o céu de verdade ao fundo.
  - **Estrelas vizinhas** — 30 estrelas para visitar, as 9 mil visíveis a olho nu nas posições 3D reais e uma régua de distâncias.
  - **Via Láctea** — os braços espirais medidos, a barra, nebulosas, aglomerados, Sagitário A* e as galáxias vizinhas.

  Ao chegar num astro, a nave entra em órbita: arrastar gira em volta e a rodinha (ou W/S, ou dois dedos) aproxima.
- **Comparar** — dois astros lado a lado, na mesma escala: de luas e planetas até galáxias e buracos negros.
- **Diário de bordo** — verbetes do que você descobriu, missões e desafios. Dá para **baixar em PDF**.

Sem cadastro: o progresso fica no navegador, e o site funciona offline (PWA).

## Como rodar

```bash
python3 -m http.server 8080      # ou: npm run servir
```

Abra **http://localhost:8080**. Não há dependências para instalar.

## Validação automática

```bash
npm run validar     # ou: node testes/validar-dados.mjs
```

Confere o modelo contra eventos reais e leis físicas — equinócios, oposições, periélios, 3ª lei de Kepler para planetas e luas, rotação pela IAU, coordenadas galácticas, buracos negros — e a coerência da base de conhecimento. O GitHub Actions roda tudo a cada envio.

## Estrutura

```text
├── index.html · explorador.html · comparar.html · diario.html · sobre.html
├── js/explorador/   # cálculos (astronomia.js), base de conhecimento (catalogo.js), cenas 3D e voo (main.js)
├── js/              # comparador, diário e o PDF (pdf.js, diario-pdf.js)
├── dados/           # estrelas do catálogo HYG (Hipparcos)
├── ferramentas/     # scripts Python que refazem os dados e os mapas (opcional)
├── testes/          # validação automática
└── css/ · img/ · pwa/
```

## Dados e imagens

- **Órbitas e fichas:** JPL/NASA (elementos orbitais, luas) e NASA NSSDC; eixos e rotação: IAU (Archinal et al., 2018).
- **Estrelas:** catálogo HYG v4.0, a partir do Hipparcos (ESA) — `dados/estrelas.json` está sob CC BY-SA 4.0.
- **Via Láctea:** braços medidos por Reid et al. (2019), barra de Wegg et al. (2015), disco de Bland-Hawthorn e Gerhard (2016), distância ao centro do GRAVITY (2019).
- **Céu:** foto panorâmica da ESO/S. Brunier (CC BY 4.0).
- **Mapas:** [Solar System Scope](https://www.solarsystemscope.com/textures/) (CC BY 4.0), NASA (Blue Marble, New Horizons) e [Celestia](https://github.com/CelestiaProject/CelestiaContent) (CC BY) para as luas. Nebulosas, galáxias, buracos negros e os mapas de Europa, Calisto, Encélado e Caronte são ilustrações feitas por código.
- **Three.js** (MIT) para o 3D. As referências completas estão no documento do TCC.

---

<sub>Começou a partir da Wiki do Universo, trabalho da disciplina de Desenvolvimento Web ([aula-de-desenvolvimento-web](https://github.com/Davi-Mares/aula-de-desenvolvimento-web)).</sub>
