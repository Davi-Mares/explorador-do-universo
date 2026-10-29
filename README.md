# 🔭 Explorador do Universo

**Astronomia em escala real.** Um ambiente para ensinar astronomia a crianças e adolescentes: você pilota uma nave do Sistema Solar até a Via Láctea, sempre com as **distâncias reais**, compara os astros lado a lado e guarda o que descobre no **Diário de bordo**.

> MVP do Trabalho de Conclusão de Curso de **Sistemas de Informação — UNEMAT, campus Sinop**. Autor: **Davi Alves Mares**.

[![Validação dos dados](https://github.com/Davi-Mares/explorador-do-universo/actions/workflows/validar.yml/badge.svg)](https://github.com/Davi-Mares/explorador-do-universo/actions/workflows/validar.yml)

🌐 **Acesse:** https://davi-mares.github.io/explorador-do-universo/

## O que tem

| Página | O que faz |
|---|---|
| **Explorar** | A nave em 3D, em três níveis de escala: **Sistema Solar** (planetas onde estão hoje, com o lado de dia e de noite certos, Plutão, Ceres e o Cinturão de Asteroides), **Estrelas vizinhas** (30 estrelas nas posições reais) e **Via Láctea** (girando, bem acelerada, com nebulosas, aglomerados e galáxias vizinhas em 3D). |
| **Comparar** | Dois astros lado a lado, na mesma escala, numa lista em ordem crescente: de Ceres até Andrômeda, passando por estrelas, pelo Sistema Solar inteiro (até Netuno) e pelos buracos negros Sagitário A* e TON 618, desenhados com o desvio da luz da relatividade geral. Tamanho, massa, gravidade, rotação, translação, distância, temperatura e quanto a balança marcaria lá. |
| **Diário de bordo** | Cada descoberta libera um verbete com distância real, tempo-luz, ficha técnica, curiosidade e um desafio. |

Sem cadastro: o progresso fica no navegador, e o site pode ser instalado como app e usado offline.

## Como rodar

O site é estático, mas usa módulos JavaScript, então precisa de um servidor:

```bash
python3 -m http.server 8080      # ou: npm run servir
```

Abra **http://localhost:8080**. Não há dependências para instalar.

## Validação automática

```bash
npm run validar     # ou: node testes/validar-dados.mjs
```

Confere o modelo contra eventos reais e leis físicas: equinócios, solstícios e periélio de 2026, oposições de Marte a Netuno, periélios de Plutão (1989) e Ceres (2018), a ressonância 3:2 entre Plutão e Netuno, 3ª lei de Kepler, a rotação da Terra (Sol a pino no lugar certo), a inclinação dos eixos, a Lua, a Voyager 1, coordenadas galácticas, o raio dos buracos negros (2GM/c²), a sombra e o desvio da luz perto de um buraco negro (a mesma conta do desenho) e a coerência da base de conhecimento. O GitHub Actions roda tudo a cada envio.

## Estrutura

```text
├── index.html · explorador.html · comparar.html · diario.html · sobre.html
├── js/
│   ├── explorador/
│   │   ├── astronomia.js   # cálculos: Kepler, rotação (IAU), coordenadas, Lua
│   │   ├── catalogo.js     # base de conhecimento: astros, fichas, missões, desafios
│   │   ├── astros3d.js     # planetas, atmosferas, anéis, o Sol e buracos negros em 3D
│   │   ├── galaxias3d.js   # galáxias, nebulosas e aglomerados (pontos de gás, poeira e estrelas)
│   │   ├── cinturao3d.js   # Cinturão de Asteroides (órbitas de Kepler na placa de vídeo)
│   │   ├── cenas.js        # as três cenas (níveis de escala)
│   │   ├── progresso.js    # descobertas, missões e respostas (localStorage)
│   │   └── main.js         # voo e interface do explorador
│   ├── comparar.js · diario.js · site.js
├── css/  ·  img/  ·  pwa/
└── testes/validar-dados.mjs
```

## Fontes

- **Órbitas:** Standish e Williams (JPL/NASA), elementos keplerianos aproximados (1800–2050).
- **Planetas, Lua, Sol, Plutão e Ceres:** NASA (fichas técnicas do NSSDC); polos e rotação: IAU (Archinal et al., 2018).
- **Estrelas:** coordenadas J2000 (SIMBAD) e distâncias por paralaxe (Hipparcos/Gaia).
- **Galáxia:** distância Sol–centro de 8,178 kpc (GRAVITY, 2019); Sagitário A*: ESO/EHT (2022); Andrômeda e Via Láctea: NASA; TON 618: Shemmer et al. (2004).
- **Buracos negros:** cada raio de luz é seguido com a relatividade geral (buraco negro de Schwarzschild), como nas imagens de Luminet (1979), da NASA (2019) e do filme Interstellar (James et al., 2015). No explorador, Sagitário A* aparece ampliado mais de 1 milhão de vezes, como ilustração.
- **Mapas das superfícies:** [Solar System Scope](https://www.solarsystemscope.com/textures/) (CC BY 4.0), feitos com dados da NASA; Terra: NASA Blue Marble e Earth at Night (domínio público); Plutão: mosaico da New Horizons (NASA/JHUAPL/SwRI), com o sul completado por código. Nuvens da Terra, Ceres, buracos negros, nebulosas e galáxias são ilustrações geradas por código.
- A lista completa de referências fica num documento à parte, fora do repositório.
- **Three.js** (MIT) para o 3D.

---

<sub>Começou a partir da Wiki do Universo, trabalho da disciplina de Desenvolvimento Web ([aula-de-desenvolvimento-web](https://github.com/Davi-Mares/aula-de-desenvolvimento-web)).</sub>
