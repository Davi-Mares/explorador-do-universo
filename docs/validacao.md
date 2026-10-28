# Como validar o Explorador do Universo (sem testes com pessoas)

Este documento organiza a validação do MVP com base na literatura. A ideia central: o TCC constrói um **artefato** (o software), e a área de Sistemas de Informação tem um método consolidado para isso — a **Design Science Research (DSR)** — que aceita avaliações **artificiais**, ou seja, feitas sem usuários reais. Cada frente abaixo traz o que fazer, o que já existe no repositório e em quais artigos se apoiar.

> Referências completas no fim, no formato ABNT.

---

## 1. Enquadramento metodológico: Design Science Research

**Por que DSR.** Hevner et al. (2004) definem a DSR como a pesquisa que cria e avalia artefatos de TI para resolver problemas identificados. O artigo propõe sete diretrizes; a terceira exige que a utilidade, a qualidade e a eficácia do artefato sejam demonstradas por uma avaliação rigorosa. No Brasil, Dresch, Lacerda e Antunes Júnior (2015) explicam o método em português.

**Etapas (Peffers et al., 2007)** — o TCC pode seguir as seis atividades do DSRM:

| Atividade | No Explorador do Universo |
|---|---|
| 1. Identificar o problema e a motivação | Livros didáticos mostram o Sistema Solar fora de escala (Langhi; Nardi, 2007); estudantes subestimam muito as distâncias até as estrelas e galáxias (Miller; Brewer, 2010) |
| 2. Definir os objetivos da solução | Ambiente que mostre as distâncias reais, como um jogo, e guarde o conhecimento (requisitos em [`MVP-TCC.md`](MVP-TCC.md)) |
| 3. Projetar e desenvolver | O MVP deste repositório |
| 4. Demonstrar | Cenários de uso (seção 2.5) e o site publicado |
| 5. Avaliar | As frentes da seção 2 |
| 6. Comunicar | O texto do TCC e este repositório |

**Estratégia de avaliação: "puramente técnica".** O framework FEDS (Venable; Pries-Heje; Baskerville, 2016) cruza duas dimensões: avaliação formativa × somativa e **artificial × naturalística**. A naturalística usa usuários reais; a artificial usa simulações, análise por critérios e argumentos teóricos, com mais controle e menor custo. Para artefatos avaliados sem pessoas, o FEDS indica a estratégia **Purely Technical**, só com avaliações artificiais. É exatamente o caso deste TCC. A versão anterior do framework (Venable et al., 2012) ajuda a justificar a escolha pelo contexto e pelos recursos disponíveis.

**Métodos aceitos.** A tabela de métodos de avaliação de Hevner et al. (2004) inclui vários que não precisam de pessoas:

| Categoria (Hevner et al., 2004) | Método | Uso aqui |
|---|---|---|
| Analítico | Análise estática e de arquitetura | Estrutura em módulos, dados separados da lógica |
| Analítico | Análise dinâmica | Desempenho (FPS, Lighthouse) |
| Experimental | Simulação | Rodar o modelo com datas de referência (seção 2.1) |
| Teste | Caixa-preta e caixa-branca | `npm run validar` e roteiro de testes funcionais |
| Descritivo | Argumento informado | Literatura de ensino de astronomia + BNCC (seção 2.5) |
| Descritivo | Cenários | Cenários de uso em sala de aula (seção 2.5) |

---

## 2. Frentes de avaliação

### 2.1 Acurácia científica do modelo (verificação e validação de simulação)

**Base:** Sargent (2013) separa **verificação** (o programa implementa o modelo corretamente) de **validação** (o modelo é preciso o bastante para o seu propósito) e lista técnicas. As que se aplicam aqui:

| Técnica (Sargent, 2013) | Como é aplicada | Onde |
|---|---|---|
| Validade de eventos | Datas de equinócios, solstícios, periélio e oposições comparadas com o calendário publicado | `testes/validar-dados.mjs` |
| Validação por dados históricos | Oposições já ocorridas (Marte 2025, Júpiter 2026…) reproduzidas pelo modelo | idem |
| Comparação com outros modelos | 3ª lei de Kepler; precisão esperada da tabela de Standish e Williams (JPL) | idem |
| Testes de condição extrema / degenerados | Ex.: um objeto na direção l = 0°, b = 0° à distância R0 tem de cair no centro da galáxia | idem |
| Validade dos dados | Ids únicos, coordenadas dentro dos limites, ficha técnica coerente com a órbita | idem |

**Critério de aceitação:** erro menor que a precisão declarada pela fonte das órbitas. A tabela de Standish e Williams (JPL) indica erros máximos de dezenas de segundos de arco para os planetas internos (até cerca de 10 minutos de arco para Saturno) no período 1800–2050. Para a finalidade didática, adotamos tolerâncias de 0,05° (calendário da Terra) e 1° (oposições).

**Resultado atual:** `npm run validar` → **177/177 verificações**. Erros obtidos: < 0,01° nos equinócios e solstícios, < 0,1° nas oposições, < 0,1% nos períodos orbitais. A validação roda sozinha no GitHub Actions a cada envio.

**Próximo passo sugerido:** exportar efemérides do JPL Horizons para algumas datas e comparar posição a posição ("comparação com outro modelo validado", na terminologia de Sargent).

### 2.2 Qualidade do produto (ISO/IEC 25010)

A ISO/IEC 25010:2023 define nove características de qualidade de produto. Cada uma vira um item de verificação com evidência:

| Característica | Evidência no MVP |
|---|---|
| Adequação funcional | Checklist dos requisitos RF01–RF11 com roteiro de teste |
| Eficiência de desempenho | FPS por nível e notas do Lighthouse (2.4) |
| Compatibilidade | Teste em Chrome, Firefox e Edge; celular e computador |
| Capacidade de interação (antiga usabilidade) | Avaliação heurística (2.3) |
| Confiabilidade | Funcionamento offline (PWA); console sem erros |
| Segurança | Nenhum dado pessoal coletado; progresso só local |
| Manutenibilidade | Módulos separados; validação automatizada |
| Flexibilidade (antiga portabilidade) | Site estático, instalável, hospedagem gratuita |
| Proteção (*safety*) | Não se aplica diretamente a este artefato |

### 2.3 Avaliação heurística (inspeção, sem usuários)

**Base:**
- **Nielsen e Molich (1990)** e as 10 heurísticas de Nielsen (1994): inspeção feita por avaliador, sem testes com usuários.
- **Pinelle, Wong e Stach (2008):** 10 heurísticas específicas para jogos, derivadas de problemas encontrados em 108 análises de jogos. As mais relevantes aqui são visão adequada, controles responsivos, estado do jogo claro, ajuda e treinamento, e visual fácil de ler.
- **Squires e Preece (1999):** heurísticas para software educacional, que avaliam juntos a **usabilidade** e o **aprendizado**. Útil para justificar que a interface ficou enxuta para não competir com o conteúdo.

**Procedimento:** percorrer o explorador com cada lista de heurísticas, registrar cada problema com a heurística violada, a gravidade (escala de 0 a 4 de Nielsen) e uma captura de tela. Depois, corrigir e reavaliar, o que configura uma avaliação formativa no FEDS. Como limitação, declare no texto que a inspeção foi feita pelo próprio autor.

### 2.4 Desempenho e acessibilidade (ferramentas automáticas)

- **Lighthouse:** a nota de desempenho combina First Contentful Paint (10%), Speed Index (10%), Largest Contentful Paint (25%), Total Blocking Time (30%) e Cumulative Layout Shift (25%); 90–100 é considerado bom. Rodar nas quatro páginas e anotar as notas de Desempenho, Acessibilidade e Boas práticas.
- **WCAG 2.2 (W3C, 2023):** verificar contraste, navegação por teclado, foco visível, textos alternativos e respeito a "reduzir movimento".
- **FPS:** medir em cada nível num notebook e num celular intermediário. Metas sugeridas: ≥ 60 FPS no notebook e ≥ 30 FPS no celular.

### 2.5 Adequação pedagógica (argumento informado e cenários)

**Argumento informado** (Hevner et al., 2004), apoiado na literatura:
- **O problema existe.** Livros didáticos trazem erros conceituais sobre astronomia e figuras fora de escala sem aviso (Langhi; Nardi, 2007). Estudantes superestimam a distância Terra–Lua e subestimam drasticamente as distâncias até a estrela e a galáxia mais próximas (Miller; Brewer, 2010). Tamanho e distância aparecem entre os temas menos estudados numa revisão de 34 anos de pesquisa em ensino de astronomia (Lelliott; Rollnick, 2010).
- **A abordagem tem respaldo.** Uma atividade de montar o Sistema Solar em escala real de distâncias e tamanhos aproximou as concepções dos alunos do conhecimento científico (Silva; Bisch, 2018). Objetos virtuais de aprendizagem, como o Stellarium, já são usados para ensinar astronomia com situações-problema (Longhini; Menezes, 2010). O explorador leva a ideia da escala real para um ambiente virtual navegável.
- **O conteúdo está alinhado ao currículo** (BNCC, Ciências, 9º ano):

| Habilidade | Tema | No MVP |
|---|---|---|
| EF09CI14 | Composição e estrutura do Sistema Solar; localização na Via Láctea e no Universo | Os três níveis; missões "Três escalas" e "Além da Via Láctea" |
| EF09CI16 | Viabilidade da vida humana fora da Terra, considerando distâncias e tempos de viagem | Tempo-luz e tempo de viagem em cada destino; desafio da Voyager até Proxima |
| EF09CI17 | Ciclo evolutivo do Sol e das estrelas | Verbetes de Betelgeuse, Antares, Arcturo e Sírius B |
| EF09CI15 | Leituras do céu por diferentes culturas | Plêiades nos calendários indígenas; estrelas da bandeira |

**Cenários de uso** (método descritivo de Hevner et al., 2004). Descrever duas ou três aulas possíveis:
- *Quanto demora a luz?* A turma faz a missão "Oito minutos de luz" e compara com "A vizinha mais próxima".
- *Cabe tudo entre a Terra e a Lua?* A turma confere a distância real e responde o desafio.
- *Onde estamos?* A turma vai do Sistema Solar à Via Láctea e localiza o Sol no Braço de Órion.

---

## 3. Ética: por que não é preciso passar pelo CEP

A Resolução CNS 466/2012 define pesquisa envolvendo seres humanos como aquela que envolve o participante, direta ou indiretamente, inclusive o manejo de seus dados, e determina que essas pesquisas sejam analisadas pelo sistema CEP/Conep. A Resolução CNS 510/2016, detalhada pelo Ofício-Circular nº 17/2022/CONEP, lista ainda exceções para alguns tipos de pesquisa com pessoas.

Como a validação proposta aqui **não tem participantes humanos** (nem questionários, nem testes de uso, nem dados de pessoas), ela fica fora desse escopo. Confirme com o orientador e com o CEP da UNEMAT, porque instituições podem ter regras próprias.

## 4. Como apresentar os resultados no TCC

Uma tabela-resumo por frente ajuda a banca:

| Frente | Método | Base | Critério | Resultado |
|---|---|---|---|---|
| Acurácia | Validade de eventos e dados históricos | Sargent (2013) | Erro < tolerância | 177/177 ✔ |
| Qualidade | Checklist ISO/IEC 25010 | ISO (2023) | Evidência por característica | … |
| Interação | Avaliação heurística | Nielsen (1994); Pinelle et al. (2008); Squires e Preece (1999) | Problemas graves corrigidos | … |
| Desempenho e acessibilidade | Lighthouse, WCAG 2.2, FPS | Google; W3C (2023) | Nota ≥ 90; ≥ 30 FPS | … |
| Pedagogia | Argumento informado e cenários | Hevner et al. (2004); BNCC | Cobertura das habilidades | … |

## 5. Trabalhos futuros (com pessoas)

Se depois surgir a chance de testar numa escola, com aprovação do CEP, o **MEEGA+** (Petri; Gresse von Wangenheim; Borgatto, 2019) é um instrumento brasileiro validado para avaliar jogos educacionais, medindo experiência do jogador e usabilidade. Seria a avaliação naturalística que completa a estratégia do FEDS.

---

## Referências

BRASIL. Conselho Nacional de Saúde. **Resolução nº 466, de 12 de dezembro de 2012**. Brasília, 2012.

BRASIL. Conselho Nacional de Saúde. **Resolução nº 510, de 7 de abril de 2016**. Brasília, 2016.

BRASIL. Ministério da Educação. **Base Nacional Comum Curricular**. Brasília: MEC, 2018.

COMISSÃO NACIONAL DE ÉTICA EM PESQUISA (CONEP). **Ofício-Circular nº 17/2022/CONEP/SECNS/MS**: orientações acerca do Artigo 1º da Resolução CNS nº 510/2016. Brasília, 5 jul. 2022.

DRESCH, A.; LACERDA, D. P.; ANTUNES JÚNIOR, J. A. V. **Design Science Research**: método de pesquisa para avanço da ciência e tecnologia. Porto Alegre: Bookman, 2015.

GOOGLE. **Lighthouse performance scoring**. Chrome for Developers. Disponível em: https://developer.chrome.com/docs/lighthouse/performance/performance-scoring.

HEVNER, A. R.; MARCH, S. T.; PARK, J.; RAM, S. Design science in information systems research. **MIS Quarterly**, v. 28, n. 1, p. 75-105, 2004.

INTERNATIONAL ORGANIZATION FOR STANDARDIZATION. **ISO/IEC 25010:2023**: Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE) — Product quality model. Genebra: ISO, 2023.

LANGHI, R.; NARDI, R. Ensino de astronomia: erros conceituais mais comuns presentes em livros didáticos de ciências. **Caderno Brasileiro de Ensino de Física**, v. 24, n. 1, p. 87-111, 2007.

LELLIOTT, A.; ROLLNICK, M. Big ideas: a review of astronomy education research 1974–2008. **International Journal of Science Education**, v. 32, n. 13, p. 1771-1799, 2010. DOI: 10.1080/09500690903214546.

LONGHINI, M. D.; MENEZES, L. D. D. Objeto virtual de aprendizagem no ensino de astronomia: algumas situações problemas propostas a partir do software Stellarium. **Caderno Brasileiro de Ensino de Física**, v. 27, n. 3, p. 433-448, 2010. DOI: 10.5007/2175-7941.2010v27n3p433.

MILLER, B. W.; BREWER, W. F. Misconceptions of astronomical distances. **International Journal of Science Education**, v. 32, n. 12, 2010. DOI: 10.1080/09500690903144099.

NIELSEN, J. **10 usability heuristics for user interface design**. Nielsen Norman Group, 1994. Disponível em: https://www.nngroup.com/articles/ten-usability-heuristics/.

NIELSEN, J.; MOLICH, R. Heuristic evaluation of user interfaces. In: CONFERENCE ON HUMAN FACTORS IN COMPUTING SYSTEMS (CHI '90), 1990, Seattle. **Proceedings** [...]. New York: ACM, 1990. p. 249-256.

PEFFERS, K.; TUUNANEN, T.; ROTHENBERGER, M. A.; CHATTERJEE, S. A design science research methodology for information systems research. **Journal of Management Information Systems**, v. 24, n. 3, p. 45-77, 2007.

PETRI, G.; GRESSE VON WANGENHEIM, C.; BORGATTO, A. F. MEEGA+: um modelo para a avaliação de jogos educacionais para o ensino de computação. **Revista Brasileira de Informática na Educação**, v. 27, n. 3, p. 52-81, 2019. DOI: 10.5753/rbie.2019.27.03.52.

PINELLE, D.; WONG, N.; STACH, T. Heuristic evaluation for games: usability principles for video game design. In: CONFERENCE ON HUMAN FACTORS IN COMPUTING SYSTEMS (CHI 2008), 2008, Florença. **Proceedings** [...]. New York: ACM, 2008. p. 1453-1462.

SARGENT, R. G. Verification and validation of simulation models. **Journal of Simulation**, v. 7, n. 1, p. 12-24, 2013. DOI: 10.1057/jos.2012.20.

SILVA, T. P.; BISCH, S. M. Desenvolvimento e resultados de uma atividade de confecção do Sistema Solar em escala real de distâncias e tamanhos em uma escola de ensino médio da rede pública estadual do Espírito Santo. In: SIMPÓSIO NACIONAL DE EDUCAÇÃO EM ASTRONOMIA, 5., 2018, Londrina. **Anais** [...]. Londrina: SAB, 2018.

SQUIRES, D.; PREECE, J. Predicting quality in educational software: evaluating for learning, usability and the synergy between them. **Interacting with Computers**, v. 11, n. 5, p. 467-483, 1999.

STANDISH, E. M.; WILLIAMS, J. G. **Keplerian elements for approximate positions of the major planets**. Pasadena: JPL Solar System Dynamics. Disponível em: https://ssd.jpl.nasa.gov/planets/approx_pos.html.

VENABLE, J.; PRIES-HEJE, J.; BASKERVILLE, R. A comprehensive framework for evaluation in design science research. In: DESIGN SCIENCE RESEARCH IN INFORMATION SYSTEMS AND TECHNOLOGY (DESRIST 2012). Berlin: Springer, 2012. (Lecture Notes in Computer Science, v. 7286). DOI: 10.1007/978-3-642-29863-9_31.

VENABLE, J.; PRIES-HEJE, J.; BASKERVILLE, R. FEDS: a framework for evaluation in design science research. **European Journal of Information Systems**, v. 25, p. 77-89, 2016. DOI: 10.1057/ejis.2014.36.

W3C. **Web Content Accessibility Guidelines (WCAG) 2.2**. W3C Recommendation, 2023. Disponível em: https://www.w3.org/TR/WCAG22/.

> Antes de usar no texto final, confira cada referência nas bases (Google Acadêmico, Periódicos CAPES) e ajuste o formato às normas da UNEMAT.
