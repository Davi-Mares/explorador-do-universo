# Changelog - Wiki do Universo

## [v4.2.0] - Viagem da luz, linha do tempo, constelações, animações e PWA

### ✨ Principais Mudanças

#### 1. 💡 Viagem da luz (`viagem-da-luz.html`)
- **Descrição**: simulação de um fóton saindo do Sol a 299.792 km/s. Mostra tempo de viagem, distância, quantas voltas na Terra a luz já daria e a próxima parada; marca a chegada em cada planeta com uma curiosidade. Duas trilhas: o Sistema Solar interno (até Marte) e o inteiro (até Netuno). A velocidade da simulação vai de tempo real (4 h até Netuno) a 1 hora por segundo.
- **Arquivos**: `viagem-da-luz.html`, `js/viagem-da-luz.js`, `css/paginas.css`; distâncias (`distanciaUA`) adicionadas em `js/dados.js`

#### 2. 🕰️ Linha do tempo (`linha-do-tempo.html`)
- **Descrição**: 18 marcos da exploração espacial, de Galileu (1610) à Artemis I (2022), incluindo Marcos Pontes, o primeiro brasileiro no espaço. Etiquetas por tipo (voo tripulado, sondas, telescópios, descobertas) e links para as páginas relacionadas do site.
- **Arquivos**: `linha-do-tempo.html`, `css/paginas.css`

#### 3. ✨ Constelações (`constelacoes.html`)
- **Descrição**: Cruzeiro do Sul, Órion, Escorpião, Leão, Ursa Maior e Cassiopeia desenhadas em SVG a partir das coordenadas reais das estrelas (ascensão reta e declinação), com o tamanho de cada estrela pelo brilho. As linhas se desenham quando o card aparece, as estrelas cintilam e o nome aparece ao passar o mouse, tocar ou usar o Tab. Inclui quando ver cada uma no Brasil e dicas de observação.
- **Arquivos**: `constelacoes.html`, `js/constelacoes.js`, `css/paginas.css`

#### 4. 🎬 Animações ao rolar
- **Descrição**: cards, seções, parágrafos, imagens e marcos surgem com um leve deslize quando entram na tela (cards em cascata). Desligadas para quem prefere "reduzir movimento".
- **Arquivos**: `js/app.js`, `css/componentes.css`

#### 5. 📲 PWA (app instalável e offline)
- **Descrição**: `manifest.webmanifest` com ícones (inclusive "maskable") e atalhos; `sw.js` guarda páginas, estilos, scripts e imagens para o site funcionar offline. Páginas, CSS e JS buscam primeiro na rede (sempre a versão mais nova); imagens e Bootstrap saem do cache. Botão "📲 Instalar o app" no rodapé quando o navegador permite.
- **Importante**: ao publicar mudanças, aumentar `VERSAO` em `pwa/service-worker.js`; ao criar arquivos novos, incluí-los em `ARQUIVOS_ESSENCIAIS`.
- **Organização**: manifesto e service worker ficam em `pwa/`. O `sw.js` da raiz tem uma linha só (`importScripts`) porque um service worker só controla a pasta onde está: se ficasse dentro de `pwa/`, o modo offline valeria apenas para essa pasta.
- **Arquivos**: `pwa/manifest.webmanifest`, `pwa/service-worker.js`, `sw.js`, `img/icones/icone-*.png`, `js/app.js`, todas as páginas

#### 6. 🪐 Saturno sem anéis na animação
- **Descrição**: no Sistema Solar animado, Saturno agora usa uma foto do planeta sem anéis (`img/planetas/saturno-sem-aneis.webp`, recortada no planeta), e o anel fica só o desenhado em CSS por fora. A página de Saturno continua com a foto original, com anéis. Cada astro pode ter uma foto própria para a animação com `orbita.imagem` em `js/dados.js`.

#### 7. 🗂️ Pastas organizadas
- **Descrição**: `img/` foi dividida em `icones/`, `planetas/`, `universo/` e `site/`, e as fotos de cada astro passaram a começar pelo nome dele (ex.: `monte-olimpo.webp` → `planetas/marte-monte-olimpo.webp`, `planeta-jupiter.webp` → `planetas/jupiter.webp`). `audios/this-is-interstellar-on-4k.mp3` virou `audio/som-ambiente-interestelar.mp3`. As páginas `.html` continuam na raiz para os endereços do site não mudarem.

#### 8. 🧭 Menu "Explorar"
- **Descrição**: as três páginas novas ficam num submenu "Explorar" da navbar, numa nova seção de cards da página inicial e na busca.
- **Arquivos**: `js/dados.js`, `js/app.js`, `css/layout.css`, `index.html`

## [v4.1.0] - Sistema Solar animado, foto do dia, busca e ficha técnica

### ✨ Principais Mudanças

#### 1. 🪐 Sistema Solar animado
- **Descrição**: nova seção na página inicial com o Sol e os oito planetas girando em suas órbitas (CSS puro, montado a partir de `CORPOS_CELESTES`). Passar o mouse num planeta pausa a animação e mostra o nome; clicar abre a página dele. Saturno ganhou anel desenhado em CSS. Com "reduzir movimento" ativado, os planetas ficam parados em ângulos diferentes.
- **Arquivos alterados**: `index.html`, `js/app.js`, `js/dados.js`, `css/componentes.css`

#### 2. 📋 Ficha técnica em cada astro
- **Descrição**: as páginas do Sol e dos planetas mostram um quadro com tipo, diâmetro, distância, rotação, ano, luas, temperatura e gravidade, com dados da NASA Science (Facts). Os dados ficam em `js/dados.js`. O texto de Netuno foi atualizado de 14 para 16 luas conhecidas.
- **Arquivos alterados**: `js/dados.js`, `js/app.js`, `css/componentes.css`, `netuno.html`

#### 3. 📸 Foto do dia da NASA (APOD)
- **Descrição**: a página inicial busca a *Astronomy Picture of the Day* na API da NASA e mostra imagem (ou vídeo), título, data, créditos e explicação. A resposta fica guardada no navegador até o dia seguinte. Se a API falhar ou devolver um registro sem foto, o site tenta de novo, depois usa a última foto guardada e, em último caso, mostra um link para o site do APOD.
- **Observação**: usa a `DEMO_KEY`, que tem limite de pedidos por hora. Uma chave gratuita pode ser criada em https://api.nasa.gov e colocada em `NASA_API_KEY` (`js/app.js`).
- **Arquivos alterados**: `index.html`, `js/app.js`, `css/componentes.css`

#### 4. 🔍 Busca no menu
- **Descrição**: botão de lupa na navbar (atalhos `/` e `Ctrl+K`) abre uma caixa de busca que procura em planetas e páginas pelo nome, pela descrição e por palavras-chave, ignorando acentos. Setas escolhem, `Enter` abre, `Esc` fecha.
- **Arquivos alterados**: `js/app.js`, `js/dados.js`, `css/componentes.css`

#### 5. ✉️ Formulário de contato envia e-mail
- **Descrição**: o formulário passou a enviar as mensagens por e-mail usando o FormSubmit (sem servidor próprio), com assunto automático, proteção simples contra spam e aviso de "mensagem enviada" ao voltar para a página. No primeiro envio, o FormSubmit manda um e-mail de ativação que precisa ser confirmado.
- **Arquivos alterados**: `pagina-de-contato.html`, `js/app.js`

#### 6. 🖼️ Imagens em WebP e créditos da NASA
- **Descrição**: todas as imagens foram convertidas para `.webp` e redimensionadas (de 6,2 MB para cerca de 2 MB no total); o GIF da faixa brilhante virou WebP animado. Nomes confusos foram trocados (`interstellar-black-hole-...jpg` → `buraco-negro-gargantua.webp`, `imagem_da_Terra_menu.jpeg` → `terra-vista-do-espaco.webp`) e a imagem não usada `estrelas.webp` foi removida. Os créditos na página de contato agora apontam para a NASA (e para o filme *Interestelar*, no caso de Gargantua).
- **Arquivos alterados**: `img/`, todas as páginas, `css/`, `js/dados.js`

#### 7. 🔗 Favicon e prévia de link
- **Descrição**: novo ícone (`img/favicon.svg` e `img/apple-touch-icon.png`) e tags Open Graph/Twitter em todas as páginas, com a imagem `img/preview.jpg` (1200×630) para a prévia ao compartilhar no WhatsApp, Instagram, Discord etc. Os títulos das abas foram padronizados como "Página | Wiki do Universo".
- **Arquivos alterados**: todas as páginas, `img/`

#### 8. 🐛 Correção: céu estrelado invisível
- **Descrição**: o fundo do `<body>` estava sendo pintado por cima do canvas das estrelas. O fundo foi movido para o `<html>` e o `<body>` ficou transparente.
- **Arquivos alterados**: `css/base.css`

## [v4.0.0] - Céu estrelado e reorganização do código

### ✨ Principais Mudanças

#### 1. ✨ Céu estrelado animado
- **Descrição**: fundo com estrelas piscando em ritmos e cores diferentes e uma estrela cadente de vez em quando, desenhado num `<canvas>` atrás do conteúdo (`js/estrelas.js`). Respeita a preferência de "reduzir movimento" do sistema.

#### 2. 🧹 Código reorganizado
- **CSS**: `sistema-solar.css` e `menu.css` foram substituídos por `base.css` (variáveis, reset, tipografia, fundo), `layout.css` (navbar, cabeçalhos, conteúdo, rodapé) e `componentes.css` (cards, citação, navegação, botões). Regras duplicadas e os `!important` foram removidos; o Bootstrap é ajustado pelas próprias variáveis e pelo tema escuro (`data-bs-theme="dark"`).
- **JavaScript**: dados (planetas, menu, cards, citações) separados em `js/dados.js`; o script do formulário saiu do HTML e foi para `js/app.js`.
- **HTML**: todas as páginas seguem a mesma estrutura, com `<main id="conteudo">` e link "Pular para o conteúdo"; textos alternativos das imagens corrigidos; `menu.html` (não usado) removido.

## [v3.1.0] - Fontes confiáveis e ajuste de menu

### ✨ Principais Mudanças

#### 1. 📚 Fontes confiáveis citadas em cada página
- **Descrição**: cada página de planeta, o Sol, a Via Láctea, "O Universo" e "Curiosidades" agora têm uma seção "Fontes" no rodapé do conteúdo, linkando para NASA Science, NASA Space Place ou ESA — no lugar de citar só "Wikipedia" genericamente na página de contato.
- **Dados revisados**: o texto sobre a colisão Via Láctea–Andrômeda foi atualizado com o resultado de 2025 (Hubble + Gaia), que reduziu a certeza da fusão de "praticamente certa" para cerca de 50% de chance em 10 bilhões de anos. O trecho sobre buracos negros em `universo.html` passou a mencionar também a imagem de 2022 de Sagitário A* pelo Event Horizon Telescope (antes só citava M87 em 2019).
- **Arquivos alterados**: todas as páginas de conteúdo, `pagina-de-contato.html`, `css/sistema-solar.css`

#### 2. 🧭 Ajuste fino da navbar
- **Descrição**: em larguras entre 992px e 1250px, o item "Via Láctea" (duas palavras) quebrava em duas linhas dentro do próprio link. Ajustado com `white-space: nowrap` e um leve ajuste de padding/tamanho de fonte nessa faixa de largura.
- **Arquivos alterados**: `css/menu.css`

## [v3.0.0] - Unificação da Navegação, Limpeza e Som Ambiente

### ✨ Principais Mudanças

#### 1. 🧭 Navbar e rodapé unificados em todas as páginas
- **Descrição**: a navbar Bootstrap (antes só em `index.html` e `pagina-de-contato.html`) e o rodapé agora são montados por JavaScript (`montarNavbar()`/`montarRodape()`) e aparecem em **todas** as 15 páginas, incluindo as 9 de planetas, `universo.html`, `via-lactea.html`, `curiosidades.html` e `sobre.html`.
- **Benefícios**: antes, sair da página inicial deixava o visitante sem menu (só um link "Voltar"); agora dá para navegar entre qualquer seção do site a partir de qualquer página. Um novo item "Universo" foi adicionado ao menu (a página existia mas não tinha link).
- **Arquivos alterados**: `js/app.js`, todas as páginas `.html`
- **Status**: ✅ Concluído

#### 2. 🧹 Limpeza de CSS duplicado e JS morto
- **Descrição**: o `sistema-solar.css` tinha um segundo `body`/`header`/`a` conflitando com o primeiro (fontes e cores disputando); removido, mantendo as variáveis de cor em um único `:root`. O menu antigo (`.site-nav`, `.menu-toggle`, usado só em `sobre.html`) e as funções `configurarMenu()`/`marcarPaginaAtual()` (que não encontravam mais elemento nenhum) foram removidos. O arquivo órfão `menu.html` (não referenciado em lugar nenhum) foi excluído.
- **Arquivos alterados**: `css/sistema-solar.css`, `css/menu.css`, `js/app.js`
- **Status**: ✅ Concluído

#### 3. ✅ Validação do formulário de contato unificada
- **Descrição**: `pagina-de-contato.html` tinha dois validadores rodando ao mesmo tempo no mesmo formulário (o `needs-validation` nativo do Bootstrap e uma função antiga em `app.js`). Mantido apenas o validador Bootstrap.
- **Arquivos alterados**: `js/app.js`
- **Status**: ✅ Concluído

#### 4. 🪐 Fotos reais nos cards do Sistema Solar
- **Descrição**: os círculos em SVG gerados nos cards da página inicial foram substituídos por fotos reais de cada planeta (já existentes em `img/`), em moldura circular com destaque ao passar o mouse.
- **Arquivos alterados**: `js/app.js`, `css/sistema-solar.css`

#### 5. 🎧 Player de som ambiente
- **Descrição**: implementado o player de áudio que só existia como CSS esboçado (`.audio-player`, nunca usado). Botão flutuante liga/pausa a trilha ambiente (`audios/this-is-interstellar-on-4k.mp3`, em loop e volume baixo); a preferência é lembrada entre páginas via `localStorage`.
- **Observação**: navegadores podem bloquear a retomada automática do som ao mudar de página sem uma interação recente; nesse caso o botão volta ao estado pausado e basta um clique.
- **Arquivos alterados**: `js/app.js`, `css/menu.css`
- **Status**: ✅ Concluído

#### 6. 🔒 Dados de contato revisados
- **Descrição**: removido o telefone pessoal da página "Sobre"; a seção de contato agora traz apenas e-mail (institucional) e Instagram.
- **Arquivos alterados**: `sobre.html`

#### 7. 🏷️ Outras melhorias
- Tag `<center>` (obsoleta) removida das páginas de planeta.
- `<meta name="description">` adicionada em todas as páginas.

## [v2.0.0] - Refatoração Completa com Bootstrap 5 e Design Melhorado

### ✨ Principais Mudanças

#### 1. 🎯 Integração do Bootstrap 5
- **Descrição**: Refatoração completa para usar Bootstrap 5 via CDN
- **Benefícios**: Grid responsivo automático, componentes prontos, melhor acessibilidade
- **Arquivos alterados**: `index.html`, `pagina-de-contato.html`
- **Status**: ✅ Concluído

#### 2. 📱 Navbar Responsiva
- **Descrição**: Menu substituído por navbar Bootstrap com hamburger menu automático
- **Features**:
  - Collapse automático em dispositivos móveis
  - Toggler com ícone hamburger
  - Logo RGB mantido e melhorado
  - Sticky-top para permanecer visível ao scroll
- **Breakpoint**: Responsivo até 992px (lg)
- **Arquivos alterados**: `index.html`, `css/menu.css`
- **Status**: ✅ Concluído

#### 3. 🎨 Grid Responsivo com Cards
- **Descrição**: Sistema de cards auto-responsivo usando Bootstrap Grid
- **Breakpoints**:
  - Desktop (lg): 3 colunas
  - Tablet (sm): 2 colunas
  - Mobile: 1 coluna
- **Aplicações**: Sistema Solar (9 cards), Universo (2 cards), Outros (3 cards)
- **Arquivos alterados**: `index.html`, `css/sistema-solar.css`
- **Status**: ✅ Concluído

#### 4. 📋 Formulário de Contato Estilizado
- **Descrição**: Refatoração completa do formulário com classes Bootstrap
- **Features**:
  - Validação Bootstrap integrada
  - Classes: `form-control`, `form-label`, `form-check`, `form-select`
  - Layout responsivo automático
  - Feedback visual para erros
- **Arquivo alterado**: `pagina-de-contato.html`
- **Status**: ✅ Concluído

#### 5. 🖼️ Melhorias Visuais - Espaçamento e Bordas
- **Descrição**: Ajustes de espaçamento e bordas para melhor legibilidade
- **Mudanças**:
  - Imagem da Terra: borda ciano (3px), sombra aprimorada
  - Efeito hover na imagem (zoom 1.02)
  - Seção intro com fundo, borda e espaçamento
  - Cards com background custom e borda ciano
  - Sombras harmonizadas
- **Arquivo alterado**: `css/sistema-solar.css`
- **Status**: ✅ Concluído

#### 6. 📐 Seção Intro Centralizada
- **Descrição**: Refatoração da seção de boas-vindas com layout melhorado
- **Features**:
  - Imagem e texto lado a lado (desktop), empilhados (mobile)
  - Badges de estatísticas (9 Planetas, 1 Sol, ∞ Estrelas)
  - Legenda da imagem ("🌍 Planeta Terra - Nossa Casa")
  - Tipografia melhorada com `clamp()`
  - Links destacados com efeitos hover
- **Arquivo alterado**: `index.html`, `css/sistema-solar.css`
- **Status**: ✅ Concluído

#### 7. 🧹 Consolidação e Limpeza do CSS
- **Descrição**: Remoção de duplicações e organização do código CSS
- **Mudanças**:
  - Removidas 3 definições duplicadas de `.card`
  - Removidas 3 definições duplicadas de `.card:hover`
  - Grid consolidado em uma única definição
  - CSS organizado em seções claras comentadas
  - Sem impacto funcional, apenas limpeza
- **Arquivo alterado**: `css/sistema-solar.css`
- **Status**: ✅ Concluído

#### 8. 🎨 Menu Melhorado com Cores RGB
- **Descrição**: Redesign completo da navbar com cores, gradientes e efeitos
- **Features**:
  - Navbar com gradiente azul escuro e brilho
  - Borda inferior com gradiente ciano/roxo
  - Efeito glassmorphism com blur
  - Links com cores vivas: ciano (#63f4ff)
  - Animação shimmer ao passar
  - Link ativo com borda inferior animada
  - Ícone hamburger customizado em ciano
  - Botão topo com gradiente e glow
- **Logo**: RGB animado mantido intacto
- **Arquivo alterado**: `css/menu.css`
- **Status**: ✅ Concluído

### 📊 Resumo Técnico

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Framework | Sem framework | Bootstrap 5 |
| Navbar | Personalizada | Bootstrap + customizações |
| Grid | Flex/Grid manual | Bootstrap Grid (12 cols) |
| Formulário | Estilo customizado | Bootstrap forms |
| Responsividade | Parcial | Completa (mobile-first) |
| CSS duplicado | Sim | Não |
| Cores/Efeitos | Básicas | RGB + gradientes + glow |

### 🔄 Fluxo de Trabalho

1. **Commit 1**: Bootstrap integrado, navbar responsiva, grid com cards
   - ```
     Refatoração com Bootstrap 5: navbar responsiva, grid com cards e formulário estilizado
     ```

2. **Commit 2**: Melhorias visuais, espaçamento e bordas
   - ```
     Melhorias visuais: espaçamento, bordas e cards estilizados
     ```

3. **Commit 3**: Seção intro centralizada, CSS consolidado
   - ```
     Refatoração: Seção intro centralizada com stats e CSS consolidado
     ```

4. **Commit 4**: Menu melhorado com cores e efeitos
   - ```
     🎨 Menu melhorado: cores, gradientes e efeitos RGB harmonizados
     ```

### 📋 Compatibilidade

- ✅ Bootstrap 5.3.0 (CDN)
- ✅ HTML5
- ✅ CSS3 (com fallbacks)
- ✅ JavaScript (vanilla)
- ✅ Responsive (320px - 2560px)
- ✅ Navegadores modernos (Chrome, Firefox, Safari, Edge)

### 🎯 Próximas Sugestões

- [ ] Adicionar animações de scroll reveal
- [ ] Dark/Light mode toggle
- [ ] Busca por planeta
- [ ] Sistema de comentários
- [ ] Página 404 customizada
- [ ] PWA - Progressive Web App

### 📝 Notas

- Toda estrutura semântica HTML foi mantida (header/main/footer)
- CSS antigo compatível, não foi removido
- JavaScript original funcionando perfeitamente
- Bootstrap integrado via CDN, sem build necessário
- Sem quebra de funcionalidade existente

---

**Última atualização**: 2026-09-01
**Desenvolvido por**: Davi Alves Mares
**Disciplina**: Desenvolvimento Web - UNEMAT
