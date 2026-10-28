# Explorador do Universo — documento do MVP

Apoio à escrita do TCC: o que o MVP faz, como foi construído e o que fica para depois. A estratégia de validação, com as referências, está em [`validacao.md`](validacao.md).

---

## 1. Contexto

A proposta inicial (exoplanetas) foi ampliada a pedido do orientador: **um ambiente para ensinar astronomia a crianças e adolescentes**, explorando o espaço **como num jogo**, **com as distâncias reais (e não fotos)**, e com **uma plataforma que armazena o conhecimento**, para **criar cultura científica**. Realidade aumentada é opcional.

| Pedido do orientador | Como o MVP atende |
|---|---|
| Explorar navegando como num jogo | Nave pilotável em 3D, piloto automático, missões e desafios |
| Mostrar as distâncias reais | Planetas nas posições calculadas para hoje, estrelas pelas distâncias medidas, galáxia em escala; tempo-luz e tempo de viagem em cada destino |
| Plataforma que armazena o conhecimento | Diário de bordo: um verbete por astro descoberto, com ficha técnica, distâncias e desafio |
| Criar cultura científica | Comparações concretas (carro, Voyager, luz) e curiosidades ligadas ao Brasil |
| Realidade aumentada (opcional) | Próximo passo (seção 6) |

## 2. Escopo

**Dentro:** três níveis de escala; 52 objetos descobríveis; 10 missões; 24 desafios; Diário de bordo; app instalável e offline; validação automática. O site tem quatro páginas: Início, Explorar, Diário de bordo e Sobre.

**Fora (por enquanto):** contas de usuário, turmas, servidor, realidade aumentada, catálogo estelar completo, narração por voz.

## 3. Requisitos

### Funcionais

| Código | Requisito |
|---|---|
| RF01 | Navegar livremente em 3D (teclado, mouse e toque). |
| RF02 | Oferecer três níveis de escala: Sistema Solar, estrelas vizinhas e Via Láctea. |
| RF03 | Posicionar os planetas nas posições reais da data atual e permitir acelerar o tempo. |
| RF04 | Mostrar, para cada destino, a distância real, o tempo-luz e o tempo de viagem na velocidade escolhida. |
| RF05 | Oferecer velocidades reais de referência e velocidades fictícias identificadas como ficção. |
| RF06 | Viajar até um destino por piloto automático ou por salto. |
| RF07 | Registrar a descoberta de um objeto quando a nave se aproxima dele. |
| RF08 | Manter o Diário de bordo com os verbetes desbloqueados (distâncias, ficha técnica, curiosidade). |
| RF09 | Propor missões, uma de cada vez, e reconhecer quando são cumpridas. |
| RF10 | Liberar um desafio por descoberta, com explicação da resposta. |
| RF11 | Exportar o progresso (JSON) e permitir recomeçar. |

### Não funcionais

| Código | Requisito |
|---|---|
| RNF01 | Funcionar em navegadores modernos com WebGL, no computador e no celular. |
| RNF02 | Não coletar dados pessoais; progresso só local (adequado para crianças e à LGPD). |
| RNF03 | Funcionar offline depois da primeira visita (PWA). |
| RNF04 | Precisão astronômica verificável automaticamente. |
| RNF05 | Interface simples, em português, acessível por teclado e que respeite "reduzir movimento". |
| RNF06 | Hospedagem estática gratuita (GitHub Pages). |

## 4. Arquitetura e decisões

```text
astronomia.js  ← cálculos puros (sem tela, sem 3D): rodam no navegador e no Node
catalogo.js    ← base de conhecimento: astros, fichas, missões e desafios
cenas.js       ← monta cada nível com Three.js a partir do catálogo
texturas.js    ← texturas dos astros geradas por código
progresso.js   ← progresso do estudante (localStorage) e regras das missões
main.js        ← voo, piloto automático e interface do explorador
diario.js      ← página do Diário de bordo
```

1. **Um nível por escala, cada um com a sua unidade (UA, ano-luz, mil anos-luz).** O universo vai de metros a 10²² metros; numa cena só, os números de ponto flutuante perdem precisão e a imagem treme. Separar resolve o problema técnico e é didático: cada troca de nível é um salto de ordens de grandeza.
2. **Profundidade logarítmica** para desenhar, na mesma cena, a Terra a 30 mil km e estrelas a milhões de UA.
3. **Dados separados da lógica.** O catálogo é um módulo puro: dá para revisar o conteúdo e validar tudo sem abrir o 3D.
4. **Interface mínima.** Na tela ficam só a nave, o nível e a velocidade; destinos, opções e detalhes aparecem quando pedidos, e os nomes só surgem depois das descobertas. Squires e Preece (1999) lembram que, em software educacional, usabilidade e aprendizado precisam andar juntos.
5. **Sem fotos nas cenas.** Texturas geradas por código deixam o projeto leve e offline. As fotos ficam só nos verbetes.
6. **Progresso local, sem cadastro.** Evita coletar dados de menores e dispensa servidor.
7. **Ficção explícita.** Velocidades acima da luz são sempre rotuladas "(ficção)".

## 5. Modelo astronômico

| Item | Método | Precisão esperada |
|---|---|---|
| Planetas | Elementos keplerianos de Standish e Williams (JPL); equação de Kepler por Newton | segundos a minutos de arco (1800–2050) |
| Lua | Fórmula de baixa precisão do *Astronomical Almanac* | ~0,3° e ~0,2% na distância |
| Voyager 1 | Linha reta a partir da heliopausa (2012, 121,6 UA), 3,58 UA/ano | ±1 UA |
| Estrelas | AR/Dec J2000 + distância → coordenadas eclípticas; brilho pela magnitude absoluta | distâncias com a incerteza do catálogo |
| Galáxia | R0 = 8,178 kpc; objetos por coordenadas galácticas; braços espirais esquemáticos | posições dos objetos reais |

**Limitações:** órbitas válidas de 1800 a 2050; braços da Via Láctea esquemáticos; 30 estrelas de catálogo (as outras são fundo ilustrativo, com a faixa da Via Láctea no lugar certo do céu); distâncias de supergigantes incertas (Betelgeuse: 500–650 anos-luz); sem sombras nem eclipses.

## 6. Próximos passos

1. **Realidade aumentada (WebXR):** o Sistema Solar em escala sobre a mesa, usando o mesmo catálogo.
2. **Modo turma:** missões criadas pelo professor e acompanhamento (exigiria servidor e cuidado com a LGPD).
3. **Catálogo maior:** milhares de estrelas e exoplanetas (retomando a ideia original) como novos verbetes.
4. **Avaliação com estudantes,** se houver aprovação do CEP, usando o MEEGA+ (ver `validacao.md`).

---

Referências citadas neste documento: ver a lista completa em [`validacao.md`](validacao.md#referências).
