# Explorador do Universo — documento do MVP

Documento de apoio ao TCC: o que o MVP faz, como foi construído, como é validado e o que fica para depois. Serve de base para os capítulos de desenvolvimento e de validação.

---

## 1. Contexto

A proposta inicial (exoplanetas) foi ampliada a pedido do orientador para algo mais "agregativo": **um ambiente para ensinar astronomia a crianças e adolescentes** em que se explora a galáxia navegando como num jogo, **mostrando as distâncias reais (e não fotos)**, com **uma plataforma que armazena o conhecimento**, para **criar cultura científica**. Realidade aumentada foi citada como possibilidade, não como obrigação.

O MVP responde a cada ponto:

| Pedido do orientador | Como o MVP atende |
|---|---|
| Explorar navegando como num jogo | Nave pilotável em 3D, piloto automático, salto, missões e desafios |
| Mostrar as distâncias reais | Tudo em escala real: posições calculadas dos planetas, estrelas pela paralaxe, galáxia pelas distâncias medidas; tempo-luz e tempo de viagem em cada destino |
| Plataforma que armazena o conhecimento | Diário de bordo (verbetes desbloqueados) + Biblioteca (textos e atividades) |
| Criar cultura científica | Comparações concretas (luz, Voyager, carro), curiosidades com contexto brasileiro (bandeira, céu do Brasil, calendários indígenas) |
| Realidade aumentada (opcional) | Planejada como próximo passo (seção 8) |

## 2. Escopo do MVP

**Dentro:** três níveis de escala; 52 objetos descobríveis; 10 missões; 24 desafios; progresso local; Biblioteca; PWA offline; validação automática.

**Fora (por enquanto):** contas de usuário e turmas, backend, realidade aumentada, catálogo estelar completo, narração por voz.

## 3. Requisitos

### Funcionais

| Código | Requisito |
|---|---|
| RF01 | Navegar livremente em 3D (teclado, mouse e toque). |
| RF02 | Oferecer três níveis de escala: Sistema Solar, estrelas vizinhas e Via Láctea. |
| RF03 | Posicionar os planetas nas posições reais para a data atual e permitir acelerar o tempo. |
| RF04 | Mostrar, para cada destino, a distância real, o tempo que a luz leva e o tempo de viagem na velocidade escolhida. |
| RF05 | Oferecer velocidades reais de referência (carro, avião, ISS, Voyager 1, Parker, luz) e velocidades fictícias identificadas como ficção. |
| RF06 | Viajar até um destino por piloto automático ou por salto. |
| RF07 | Registrar a descoberta de um objeto ao se aproximar dele. |
| RF08 | Manter um Diário de bordo com os verbetes desbloqueados. |
| RF09 | Propor missões e verificar quando são cumpridas. |
| RF10 | Liberar um desafio (quiz) por descoberta, com explicação da resposta. |
| RF11 | Exportar o progresso (JSON) e permitir recomeçar. |
| RF12 | Alternar entre tamanhos reais e ampliados, deixando claro que as distâncias continuam reais. |

### Não funcionais

| Código | Requisito |
|---|---|
| RNF01 | Funcionar em navegadores modernos com WebGL, em computador e celular. |
| RNF02 | Não coletar dados pessoais; progresso apenas local (adequado para crianças, LGPD). |
| RNF03 | Funcionar offline depois da primeira visita (PWA). |
| RNF04 | Precisão astronômica verificável automaticamente (seção 6). |
| RNF05 | Interface em português, acessível por teclado, respeitando "reduzir movimento". |
| RNF06 | Hospedagem estática gratuita (GitHub Pages), sem servidor. |

## 4. Arquitetura e decisões

```text
astronomia.js  ← cálculos puros (sem DOM, sem 3D): rodam no navegador e no Node
catalogo.js    ← base de conhecimento (dados + textos + missões + quiz)
cenas.js       ← monta cada nível com Three.js a partir do catálogo
texturas.js    ← texturas geradas por código (ruído 3D)
progresso.js   ← estado do estudante no localStorage + regras das missões
main.js        ← laço de animação, voo, piloto automático, interface
diario.js      ← página do Diário de bordo
```

Decisões principais:

1. **Um nível por escala, cada um com a sua unidade (UA, ano-luz, mil anos-luz).** As distâncias do universo vão de metros a 10²² metros; numa cena só, os números de ponto flutuante perdem precisão e a imagem "treme". Separar por escala resolve o problema técnico e é uma escolha didática: cada troca de nível é um salto de ordens de grandeza.
2. **Profundidade logarítmica** (`logarithmicDepthBuffer`) para desenhar, na mesma cena, a Terra a 30 mil km e estrelas a milhões de UA.
3. **Dados separados da lógica.** O catálogo é um módulo puro: dá para revisar o conteúdo, adicionar objetos e validar tudo sem abrir a parte 3D.
4. **Sem fotos nas cenas.** As texturas são procedurais (cores reais, padrões gerados), o que deixa o projeto leve, offline e coerente com o pedido de mostrar o espaço "como ele é", não como cartão-postal. As fotos ficam na Biblioteca.
5. **Progresso local, sem cadastro.** Evita coleta de dados de menores e dispensa backend. O professor pode pedir o JSON exportado.
6. **Velocidades fictícias explícitas.** Acima da luz, tudo é rotulado "(ficção)" e explicado na ajuda: o jogo precisa ser jogável sem ensinar errado.

## 5. Modelo astronômico

| Item | Método | Precisão esperada |
|---|---|---|
| Planetas | Elementos keplerianos de Standish (JPL), equação de Kepler por Newton | minutos de arco (1800–2050) |
| Lua | Fórmula de baixa precisão do *Astronomical Almanac* | ~0,3° e ~0,2% na distância |
| Voyager 1 | Linha reta a partir da heliopausa (2012, 121,6 UA), 3,58 UA/ano | ±1 UA |
| Estrelas | AR/Dec J2000 + distância → coordenadas eclípticas; brilho por magnitude absoluta | posições exatas; distâncias com a incerteza do catálogo |
| Galáxia | R0 = 8,178 kpc; objetos por coordenadas galácticas; braços como espirais logarítmicas de 12° | posições dos objetos reais; braços esquemáticos |

## 6. Validação sem testes com pessoas

O TCC pode ser validado sem participantes humanos (e, portanto, em geral sem passar pelo Comitê de Ética em Pesquisa — **confirme com o orientador** o enquadramento nas Resoluções CNS 466/2012 e 510/2016). A proposta combina cinco frentes:

### 6.1 Acurácia científica (automática)

`npm run validar` executa 179 verificações (ver README). Resultado atual: **179/179**. Destaques:

| Teste | Referência | Erro obtido |
|---|---|---|
| Equinócios e solstícios de 2026 | Calendário astronômico | < 0,01° |
| Periélio de 2026 | 03/01/2026 | < 1 h; distância 0,98330 UA |
| Oposições de Marte, Júpiter, Saturno, Urano e Netuno | Efemérides publicadas | < 0,1° |
| Períodos orbitais | 3ª lei de Kepler × período sideral real | < 0,1% |
| Voyager 1 | 1 dia-luz da Terra em nov/2026 (NASA) | 0,07% |

### 6.2 Desempenho

Medir com o Lighthouse (Chrome DevTools) e com o painel de FPS:
- Meta: ≥ 30 FPS em celular intermediário e ≥ 60 FPS em notebook, nos três níveis.
- Registrar o tempo até a primeira renderização e o peso total da página.

### 6.3 Acessibilidade e qualidade web

- Lighthouse (Acessibilidade, Boas práticas, PWA) e verificação manual por teclado.
- Contraste, rótulos ARIA, diálogos nativos, respeito a `prefers-reduced-motion`.

### 6.4 Adequação pedagógica — mapeamento com a BNCC

| Habilidade (Ciências) | Resumo | Onde aparece |
|---|---|---|
| EF09CI14 | Composição e estrutura do Sistema Solar; localização do Sistema Solar na Via Láctea e dela no Universo | Os três níveis; missões "Três escalas" e "Além da Via Láctea" |
| EF09CI16 | Viabilidade de viver fora da Terra considerando distâncias e tempos de viagens interplanetárias e interestelares | Tempos de viagem em cada destino; desafio da Voyager até Proxima |
| EF09CI17 | Ciclo evolutivo das estrelas e do Sol | Verbetes de Betelgeuse, Antares, Arcturo, Sírius B; Biblioteca |
| EF09CI15 | Leituras do céu por diferentes culturas | Plêiades nos calendários indígenas; estrelas da bandeira |
| EF05CI10 | Identificar constelações e quando são visíveis | Página de constelações da Biblioteca |

> Conferir os códigos e textos no documento oficial da BNCC antes de citar no TCC.

### 6.5 Avaliação heurística e comparação

- **Heurísticas de Nielsen** aplicadas pelo próprio autor, com checklist documentado (não envolve participantes).
- **Comparação de funcionalidades** com ferramentas existentes (por exemplo NASA Eyes on the Solar System, Stellarium Web e Celestia): escala real, foco em ensino, funcionamento offline, português, missões, ausência de cadastro.

## 7. Limitações conhecidas

- As órbitas valem de 1800 a 2050; fora disso o erro cresce.
- Os braços da Via Láctea são uma representação; só as posições dos objetos marcados são medidas.
- O nível das estrelas tem 30 estrelas de catálogo; as demais são fundo ilustrativo (com a faixa da Via Láctea no lugar certo do céu).
- Distâncias de supergigantes têm incerteza grande (Betelgeuse: 500–650 anos-luz).
- Sem sombras nem eclipses; a rotação dos planetas é aproximada.

## 8. Próximos passos

1. **Realidade aumentada (WebXR):** Sistema Solar em escala sobre a mesa, usando o mesmo catálogo.
2. **Modo turma:** missões criadas pelo professor e acompanhamento (backend + LGPD).
3. **Catálogo maior:** HYG para milhares de estrelas; exoplanetas (retomando a ideia original) como novos verbetes.
4. **Acessibilidade:** narração, alto contraste e modo lista.
5. **Testes de desempenho automatizados** no GitHub Actions (Lighthouse CI).
