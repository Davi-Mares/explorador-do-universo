# 🔭 Explorador do Universo

**Astronomia em escala real.** Um ambiente para ensinar astronomia a crianças e adolescentes: você pilota uma nave do Sistema Solar até a Via Láctea, sempre com as **distâncias reais**, e cada astro que descobre vira um verbete no seu **Diário de bordo**.

> MVP do Trabalho de Conclusão de Curso de **Sistemas de Informação — UNEMAT, campus Sinop**. Autor: **Davi Alves Mares**.

[![Validação dos dados](https://github.com/Davi-Mares/explorador-do-universo/actions/workflows/validar.yml/badge.svg)](https://github.com/Davi-Mares/explorador-do-universo/actions/workflows/validar.yml)

🌐 **Acesse:** https://davi-mares.github.io/explorador-do-universo/

---

## O que tem

| Página | O que faz |
|---|---|
| **Início** | Apresenta o projeto e leva para os três níveis. |
| **Explorar** | A nave em 3D. Três níveis de escala: **Sistema Solar** (planetas onde estão hoje), **Estrelas vizinhas** (30 estrelas nas posições reais) e **Via Láctea** (o Sol, o centro da galáxia, nebulosas e galáxias vizinhas). |
| **Diário de bordo** | A base de conhecimento: cada descoberta libera um verbete com distância real, tempo-luz, ficha técnica, curiosidade e um desafio. |
| **Sobre** | O projeto e o autor. |

No Explorador:
- **Velocidades reais** — de um carro até a luz, com o tempo que cada uma levaria. Acima da luz é ficção, e o jogo avisa.
- **Piloto automático e salto** — escolha um destino e vá.
- **Uma missão por vez** — 10 missões, como "Oito minutos de luz" e "A vizinha mais próxima".
- **Tempo e tamanhos** — acelere o tempo para ver as órbitas e alterne entre tamanhos reais e ampliados.
- **Sem cadastro e offline** — o progresso fica no navegador, e o site pode ser instalado como app.

## Como rodar

O site é estático, mas usa módulos JavaScript: precisa de um servidor (abrir o arquivo direto não funciona).

```bash
python3 -m http.server 8080      # ou: npm run servir
```

Abra **http://localhost:8080**. Não há dependências para instalar.

| Ação | Teclado / mouse | Celular |
|---|---|---|
| Voar | `W` `A` `S` `D` (`R` `F` sobem e descem) | botões ▲ ▼ |
| Olhar em volta | arrastar | arrastar |
| Velocidade | `+` `−` ou rodinha | botões − + |
| Parar | `Espaço` | ⏹ Parar |

## Validação

O TCC é validado **sem testes com pessoas**, como pesquisa em *Design Science Research* com avaliação puramente técnica. O plano completo, com os artigos de base (Hevner et al., 2004; Venable et al., 2016; Sargent, 2013; Pinelle et al., 2008, entre outros), está em **[`docs/validacao.md`](docs/validacao.md)**.

A parte automática confere o modelo astronômico contra eventos reais e leis físicas:

```bash
npm run validar     # ou: node testes/validar-dados.mjs
```

São **177 verificações**: equinócios e solstícios de 2026 e periélio (erro < 0,01°), oposições de Marte a Netuno (< 0,1°), 3ª lei de Kepler (< 0,1%), Lua, Voyager 1, coerência das fichas técnicas e integridade da base de conhecimento. O GitHub Actions roda tudo a cada envio.

## Estrutura

```text
.
├── index.html · explorador.html · diario.html · sobre.html
├── js/
│   ├── explorador/
│   │   ├── astronomia.js   # cálculos: Kepler, coordenadas, Lua, formatação
│   │   ├── catalogo.js     # base de conhecimento: astros, fichas, missões, desafios
│   │   ├── cenas.js        # as três cenas 3D (Three.js)
│   │   ├── texturas.js     # texturas geradas por código
│   │   ├── progresso.js    # descobertas, missões e respostas (localStorage)
│   │   └── main.js         # voo e interface do explorador
│   ├── diario.js           # Diário de bordo
│   └── site.js             # registro do app offline
├── css/                    # base, site, explorador, diario
├── testes/validar-dados.mjs
├── docs/
│   ├── MVP-TCC.md          # requisitos, arquitetura, modelo, próximos passos
│   └── validacao.md        # plano de validação com referências (ABNT)
└── pwa/                    # manifesto e service worker
```

## Fontes dos dados

- **Órbitas:** Standish e Williams (JPL/NASA), elementos keplerianos aproximados (1800–2050).
- **Planetas:** NASA (fichas técnicas e raios); eixos de rotação: IAU.
- **Lua:** fórmula de baixa precisão do *Astronomical Almanac*.
- **Estrelas:** coordenadas J2000 (SIMBAD) e distâncias por paralaxe (Hipparcos/Gaia).
- **Galáxia:** distância Sol–centro de 8,178 kpc (GRAVITY, 2019).

## Próximos passos

Realidade aumentada (WebXR), modo turma para professores, catálogo maior de estrelas e exoplanetas, e — se houver aprovação do CEP — avaliação com estudantes usando o MEEGA+.

---

<sub>O projeto começou a partir da Wiki do Universo, trabalho da disciplina de Desenvolvimento Web ([aula-de-desenvolvimento-web](https://github.com/Davi-Mares/aula-de-desenvolvimento-web)).</sub>
