# Wiki do Universo

Projeto desenvolvido por **Davi Alves Mares** apartir da disciplina de Desenvolvimento Web do curso de Sistemas de Informação da UNEMAT.

## Sobre o projeto

A Wiki do Universo reúne conteúdos introdutórios sobre astronomia em páginas HTML simples, organizadas para facilitar a exploração do Sistema Solar e de outros temas do espaço.

Na área dos astros, cada página apresenta uma navegação na ordem em que os corpos estão organizados a partir do Sol:

**Sol → Mercúrio → Vênus → Terra → Marte → Júpiter → Saturno → Urano → Netuno**

É possível acessar diretamente qualquer astro pela página inicial ou avançar e voltar entre páginas usando os controles de navegação. O astro atual fica destacado na sequência.

## Conteúdo

- Página inicial com acesso ao Sistema Solar, Universo, Via Láctea e curiosidades.
- Sistema Solar animado: os planetas giram em volta do Sol e levam à página de cada um.
- Foto do dia da NASA (API do APOD).
- Ficha técnica (diâmetro, distância, luas, temperatura, gravidade…) em cada página de astro.
- Busca no menu (atalhos `/` e `Ctrl+K`).
- Viagem da luz: simulação de um raio de luz indo do Sol até Netuno.
- Linha do tempo da exploração espacial.
- Constelações desenhadas com as posições reais das estrelas.
- Animações ao rolar a página.
- PWA: dá para instalar o site como app e usar offline.
- Páginas individuais para o Sol e os oito planetas.
- Conteúdos sobre o Universo e a Via Láctea.
- Página de curiosidades, informações sobre o projeto e formulário de contato que envia e-mail (FormSubmit).
- Menu responsivo, botão para voltar ao topo e som ambiente.
- Fundo com estrelas piscando e estrelas cadentes (respeita a preferência de menos movimento do sistema).

## Tecnologias

- HTML5
- CSS3
- JavaScript
- Bootstrap 5
- Git e GitHub

## Framework Escolhido

**Bootstrap 5** foi escolhido como framework CSS por ser confiável, amplamente utilizado na indústria, com excelente suporte responsivo via grid e componentes prontos (navbar, cards, forms). Mantém a estrutura semântica HTML intacta, integrando-se via classes nos elementos existentes.

## Estrutura

```text
.
├── index.html
├── sol.html, mercurio.html, venus.html, terra.html
├── marte.html, jupiter.html, saturno.html, urano.html, netuno.html
├── universo.html e via-lactea.html
├── curiosidades.html, sobre.html e pagina-de-contato.html
├── viagem-da-luz.html, linha-do-tempo.html e constelacoes.html
├── sw.js                 # só carrega pwa/service-worker.js (precisa ficar na raiz)
├── css/
│   ├── base.css          # variáveis de cor, reset, tipografia e fundo
│   ├── layout.css        # navbar, cabeçalho das páginas, conteúdo e rodapé
│   ├── componentes.css   # cards, citação, navegação entre planetas, botões...
│   ├── paginas.css       # estilos só das páginas interativas
│   └── extras.css        # estilos dos efeitos extras
├── js/
│   ├── dados.js          # planetas, menu, cards e citações
│   ├── estrelas.js       # céu estrelado animado no fundo
│   ├── viagem-da-luz.js  # simulação da viagem da luz
│   ├── constelacoes.js   # dados e desenho das constelações
│   ├── app.js            # monta navbar/rodapé e liga os comportamentos
│   └── extras.js         # efeitos extras
├── pwa/
│   ├── manifest.webmanifest  # nome, ícones e cores do app instalável
│   └── service-worker.js     # cache e modo offline
├── img/
│   ├── icones/           # favicon e ícones do app
│   ├── planetas/         # fotos de cada astro (nome do astro na frente)
│   ├── universo/         # galáxias, buraco negro, estrelas, luz
│   ├── site/             # fundo do cabeçalho, faixa brilhante, prévia de link
│   └── extras/           # imagens dos efeitos extras
└── audio/                # som ambiente
```

## Créditos das imagens

Fotos do Sol, dos planetas e das galáxias: NASA. A imagem de Gargantua é do filme *Interestelar* (2014).

## Como executar

Abra o arquivo `index.html` no navegador. Como o projeto usa apenas HTML, CSS e JavaScript, não é necessário instalar dependências.

Só o modo offline (PWA) precisa de um servidor, porque service workers não funcionam em `file://`: rode `python3 -m http.server` na pasta e acesse `http://localhost:8000`.

> Projeto desenvolvido como parte das atividades da disciplina de Desenvolvimento Web.
