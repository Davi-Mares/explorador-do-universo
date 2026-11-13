// ---------------------------------------------------------------------------
// Explorador do Universo — fundo da página inicial: a Terra vista da órbita,
// com o Sol nascendo atrás do horizonte.
//
// A câmera está a uns 1.600 km de altura, sobre Mato Grosso, olhando para o
// leste. Lá embaixo ainda é noite (aparecem as luzes das cidades); no
// horizonte, sobre o Atlântico, o dia está chegando. Como numa estação
// espacial, o Sol nasce porque a nave anda na órbita: o chão desliza e o Sol
// sobe acima da borda da Terra.
//
// O que é de verdade: os mapas da Terra (dia, luzes da noite, nuvens e
// oceanos, da NASA via Solar System Scope, CC BY 4.0) e a geometria (altura,
// curvatura e direção). O céu é calculado: a luz do Sol atravessa uma
// atmosfera simulada que espalha mais o azul (por isso o céu é azul) e deixa
// passar o vermelho quando atravessa muito ar (por isso o nascer é laranja).
// A atmosfera foi engrossada umas três vezes para aparecer nesta tela.
// ---------------------------------------------------------------------------

import * as THREE from "three";

const RAD = Math.PI / 180;
const ALTURA = 0.25;                       // em raios da Terra (≈ 1.600 km)
const PARTIDA = { latitude: -13.5, longitude: -55.5 };
const ESCALA_ATMOSFERA = 0.004;            // escala de altura do ar, em raios (a real é 0,0013)
const RAIO_ATMOSFERA = 1 + ESCALA_ATMOSFERA * 9;
const SOL_COMECO = -2.4;                   // graus do Sol acima da borda da Terra, no começo…
const SOL_FIM = 3;                       // …e depois de nascer
const DURACAO_DO_NASCER = 22;              // segundos

// ---------- Shaders ----------

const VERTICE_MUNDO = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPos;
  void main() {
    vUv = uv;
    vec4 mundo = modelMatrix * vec4(position, 1.0);
    vPos = mundo.xyz;
    gl_Position = projectionMatrix * viewMatrix * mundo;
  }
`;

// Luz do Sol que chega a um ponto, depois de atravessar o ar. A conta usa a
// "coluna de ar" até o Sol, em unidades da coluna vertical ao nível do chão:
// perto do horizonte a luz atravessa dezenas de vezes mais ar e fica vermelha.
const LUZ_DO_SOL = /* glsl */ `
  uniform float H;
  const vec3 TAU = vec3(0.07, 0.16, 0.38);                  // espessura óptica vertical (ar, com um pouco de poeira)
  const float TAU_POEIRA = 0.05;
  float colunaAteOSol(float r, float mu) {
    float lado = sqrt(1.5707963 * r / H);                   // meia coluna horizontal
    float densidade = exp(-(r - 1.0) / H);
    if (mu >= 0.0) return densidade / (mu + 1.0 / lado);
    float tangente = r * sqrt(1.0 - mu * mu) - 1.0;         // altura mais baixa que o raio de luz alcança
    if (tangente < 0.0) return 1e4;                          // a Terra está na frente: sombra
    return exp(-tangente / H) * 2.0 * lado - densidade / (-mu + 1.0 / lado);
  }
  vec3 luzQueChega(float r, float mu) {
    float coluna = colunaAteOSol(r, mu);
    return exp(-(TAU + TAU_POEIRA) * coluna);
  }
`;

const FRAGMENTO_TERRA = /* glsl */ `
  uniform sampler2D dia;
  uniform sampler2D noite;
  uniform sampler2D nuvens;
  uniform sampler2D oceano;
  uniform vec3 sol;
  uniform float giroNuvens;
  varying vec2 vUv;
  varying vec3 vPos;
  ${LUZ_DO_SOL}
  void main() {
    vec3 N = normalize(vPos);
    vec3 V = normalize(cameraPosition - vPos);
    float mu = dot(N, sol);

    vec3 chao = texture2D(dia, vUv).rgb;
    vec3 luzes = texture2D(noite, vUv).rgb;
    float nuvem = texture2D(nuvens, vUv + vec2(giroNuvens, 0.0)).r;
    float agua = texture2D(oceano, vUv).r;

    nuvem = smoothstep(0.12, 0.95, nuvem);
    vec3 albedo = mix(chao * 0.85, vec3(0.9), nuvem);

    // Luz do Sol (avermelhada perto do terminador), com a borda da sombra suave.
    vec3 luz = luzQueChega(1.0, mu) * smoothstep(-0.03, 0.03, mu);
    float crepusculo = smoothstep(-0.25, 0.0, mu) * (1.0 - smoothstep(0.0, 0.1, mu));
    vec3 cor = albedo * (luz * max(mu, 0.0) * 2.4 + vec3(0.9, 0.45, 0.25) * crepusculo * 0.03);

    // Reflexo do Sol no mar.
    vec3 Hm = normalize(sol + V);
    float nh = max(dot(N, Hm), 0.0);
    cor += luz * (pow(nh, 220.0) * 5.0 + pow(nh, 24.0) * 0.1) * agua * (1.0 - nuvem) * smoothstep(0.0, 0.04, mu);

    // Luzes das cidades no lado da noite.
    float noiteAqui = 1.0 - smoothstep(-0.1, 0.03, mu);
    cor += pow(luzes, vec3(1.7)) * vec3(1.0, 0.76, 0.45) * 1.1 * noiteAqui * (1.0 - nuvem * 0.8);

    // Um quase nada de luz no lado escuro (luar), para o relevo das nuvens não sumir.
    cor += albedo * vec3(0.009, 0.012, 0.02);

    gl_FragColor = vec4(cor, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// Céu: luz do Sol espalhada pelo ar ao longo do olhar (dispersão simples).
// As amostras ficam mais juntas onde o ar é mais denso (rente ao chão).
const FRAGMENTO_ATMOSFERA = /* glsl */ `
  uniform vec3 sol;
  uniform float raioAtm;
  uniform float forca;
  varying vec3 vPos;
  ${LUZ_DO_SOL}

  float ruido(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  void main() {
    vec3 o = cameraPosition;
    vec3 d = normalize(vPos - o);
    float b = dot(o, d);
    float c = dot(o, o);
    float deltaAr = b * b - c + raioAtm * raioAtm;
    if (deltaAr <= 0.0) discard;
    float entra = max(-b - sqrt(deltaAr), 0.0);
    float sai = -b + sqrt(deltaAr);
    float deltaChao = b * b - c + 1.0;
    bool bateNoChao = deltaChao > 0.0 && -b - sqrt(deltaChao) > 0.0;
    float chao = bateNoChao ? -b - sqrt(deltaChao) : 0.0;

    const int PASSOS = 32;
    float cosTheta = dot(d, sol);
    float faseR = 0.0596831 * (1.0 + cosTheta * cosTheta);
    const float G = 0.8;
    float faseM = 0.0795775 * (1.0 - G * G) / pow(1.0 + G * G - 2.0 * G * cosTheta, 1.5);
    vec3 betaR = TAU / H;
    float betaM = TAU_POEIRA / H;

    float jitter = ruido(gl_FragCoord.xy);
    float profundidade = 0.0;
    vec3 soma = vec3(0.0);
    float tAnterior = entra;
    for (int i = 0; i < PASSOS; i++) {
      float u = (float(i) + jitter) / float(PASSOS);
      float t;
      if (bateNoChao) {
        float v = 1.0 - u;
        t = chao - (chao - entra) * v * v;                    // mais amostras perto do chão
      } else {
        float s = 2.0 * u - 1.0;
        float meio = -b;
        t = meio + (sai - meio) * s * abs(s);                 // mais amostras perto do ponto mais baixo
        t = max(t, entra);
      }
      float ds = max(t - tAnterior, 0.0);
      tAnterior = t;
      vec3 p = o + d * t;
      float r = length(p);
      float densidade = exp(-(r - 1.0) / H);
      profundidade += densidade * ds;
      float mu = dot(p, sol) / r;
      vec3 chega = luzQueChega(r, mu);
      vec3 perde = exp(-(betaR + betaM) * profundidade);
      soma += densidade * ds * chega * perde * (betaR * faseR + betaM * faseM);
    }
    gl_FragColor = vec4(soma * forca, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const VERTICE_SOL = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv * 2.0 - 1.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENTO_SOL = /* glsl */ `
  uniform float visivel;
  varying vec2 vUv;
  void main() {
    float r = length(vUv);
    float disco = 1.0 - smoothstep(0.035, 0.045, r);
    float coroa = exp(-r * 14.0) * 1.4 + exp(-r * 5.0) * 0.12;
    float borda = 1.0 - smoothstep(0.4, 1.0, r);
    vec3 cor = (vec3(1.0, 0.95, 0.86) * disco * 50.0 + vec3(1.0, 0.68, 0.38) * coroa * 4.0) * borda;
    gl_FragColor = vec4(cor * visivel, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const VERTICE_ESTRELAS = /* glsl */ `
  attribute float brilho;
  attribute float fase;
  uniform float tempo;
  uniform float escala;
  varying float vBrilho;
  void main() {
    vBrilho = brilho * (0.82 + 0.18 * sin(tempo * (1.3 + fase) + fase * 20.0));
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (1.0 + brilho * 1.8) * escala;
  }
`;

const FRAGMENTO_ESTRELAS = /* glsl */ `
  uniform float visibilidade;
  varying float vBrilho;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float a = (1.0 - smoothstep(0.2, 1.0, r)) * vBrilho * visibilidade;
    gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * a, 1.0);
  }
`;

// ---------- Brilho do Sol na lente (raios e reflexos) ----------

function texturaDeRaios() {
  const lado = 512;
  const tela = document.createElement("canvas");
  tela.width = tela.height = lado;
  const g = tela.getContext("2d");
  const c = lado / 2;
  const fundo = g.createRadialGradient(c, c, 0, c, c, c);
  fundo.addColorStop(0, "rgba(255,250,235,1)");
  fundo.addColorStop(0.06, "rgba(255,225,170,0.85)");
  fundo.addColorStop(0.22, "rgba(255,160,80,0.22)");
  fundo.addColorStop(1, "rgba(255,120,40,0)");
  g.fillStyle = fundo;
  g.fillRect(0, 0, lado, lado);
  // Raios finos, como os de uma câmera.
  g.globalCompositeOperation = "lighter";
  let semente = 7;
  const sorteio = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 28; i++) {
    const angulo = (i / 28) * Math.PI * 2 + sorteio() * 0.12;
    const comprimento = c * (0.45 + sorteio() * 0.55) * (i % 7 === 0 ? 1 : 0.7);
    const largura = 1 + sorteio() * 2.2;
    const raio = g.createLinearGradient(c, c, c + Math.cos(angulo) * comprimento, c + Math.sin(angulo) * comprimento);
    raio.addColorStop(0, "rgba(255,240,210,0.55)");
    raio.addColorStop(1, "rgba(255,200,140,0)");
    g.strokeStyle = raio;
    g.lineWidth = largura;
    g.beginPath();
    g.moveTo(c, c);
    g.lineTo(c + Math.cos(angulo) * comprimento, c + Math.sin(angulo) * comprimento);
    g.stroke();
  }
  const textura = new THREE.CanvasTexture(tela);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

function texturaDeReflexo() {
  const lado = 128;
  const tela = document.createElement("canvas");
  tela.width = tela.height = lado;
  const g = tela.getContext("2d");
  const c = lado / 2;
  const anel = g.createRadialGradient(c, c, c * 0.55, c, c, c);
  anel.addColorStop(0, "rgba(255,255,255,0.05)");
  anel.addColorStop(0.8, "rgba(255,255,255,0.22)");
  anel.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = anel;
  g.fillRect(0, 0, lado, lado);
  const textura = new THREE.CanvasTexture(tela);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

// ---------- Cena ----------

/**
 * Desenha a Terra no canvas e anima o nascer do Sol.
 * Devolve uma promessa que resolve quando o primeiro quadro com os mapas foi desenhado.
 */
export function iniciarTerraDeFundo(canvas, { movimentoReduzido = false, telaPequena = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, telaPequena ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 1);

  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.001, 200);
  camera.position.set(0, 1 + ALTURA, 0);

  // A Terra gira por baixo da câmera (é a nave andando na órbita, para o leste).
  const terraGrupo = new THREE.Group();
  cena.add(terraGrupo);

  const solDireto = new THREE.Vector3();     // direção do Sol no começo, no referencial da Terra
  const solAgora = new THREE.Vector3();

  const carregador = new THREE.TextureLoader();
  const pasta = "img/texturas/";
  const carregar = (nome, cor = true) => new Promise((resolver) => {
    carregador.load(pasta + nome, (t) => {
      t.colorSpace = cor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      t.wrapS = THREE.RepeatWrapping;
      resolver(t);
    }, undefined, () => resolver(null));
  });

  const uniformesTerra = {
    dia: { value: null }, noite: { value: null }, nuvens: { value: null }, oceano: { value: null },
    sol: { value: solAgora }, giroNuvens: { value: 0 }, H: { value: ESCALA_ATMOSFERA }
  };
  const terra = new THREE.Mesh(
    new THREE.SphereGeometry(1, telaPequena ? 192 : 320, telaPequena ? 96 : 160),
    new THREE.ShaderMaterial({ uniforms: uniformesTerra, vertexShader: VERTICE_MUNDO, fragmentShader: FRAGMENTO_TERRA })
  );
  terraGrupo.add(terra);

  const atmosfera = new THREE.Mesh(
    new THREE.SphereGeometry(RAIO_ATMOSFERA, 192, 96),
    new THREE.ShaderMaterial({
      uniforms: { sol: { value: solAgora }, H: { value: ESCALA_ATMOSFERA }, raioAtm: { value: RAIO_ATMOSFERA }, forca: { value: 9 } },
      vertexShader: VERTICE_MUNDO,
      fragmentShader: FRAGMENTO_ATMOSFERA,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  cena.add(atmosfera);

  // Estrelas (somem quando o Sol aparece, como numa foto).
  const quantas = telaPequena ? 1600 : 2600;
  const posicoes = new Float32Array(quantas * 3);
  const brilhos = new Float32Array(quantas);
  const fases = new Float32Array(quantas);
  let semente = 42;
  const sorteio = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < quantas; i++) {
    const z = sorteio() * 2 - 1;
    const a = sorteio() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    posicoes.set([r * Math.cos(a) * 100, z * 100, r * Math.sin(a) * 100], i * 3);
    brilhos[i] = Math.pow(sorteio(), 3.2);
    fases[i] = sorteio();
  }
  const geometriaEstrelas = new THREE.BufferGeometry();
  geometriaEstrelas.setAttribute("position", new THREE.BufferAttribute(posicoes, 3));
  geometriaEstrelas.setAttribute("brilho", new THREE.BufferAttribute(brilhos, 1));
  geometriaEstrelas.setAttribute("fase", new THREE.BufferAttribute(fases, 1));
  const uniformesEstrelas = { tempo: { value: 0 }, escala: { value: renderer.getPixelRatio() }, visibilidade: { value: 1 } };
  const estrelas = new THREE.Points(geometriaEstrelas, new THREE.ShaderMaterial({
    uniforms: uniformesEstrelas, vertexShader: VERTICE_ESTRELAS, fragmentShader: FRAGMENTO_ESTRELAS,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  estrelas.renderOrder = -1;
  cena.add(estrelas);

  // Sol: o disco (escondido pela Terra) e o brilho na lente (por cima de tudo).
  const uniformesSol = { visivel: { value: 1 } };
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    uniforms: uniformesSol, vertexShader: VERTICE_SOL, fragmentShader: FRAGMENTO_SOL,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  sol.renderOrder = 2;
  cena.add(sol);

  const raios = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texturaDeRaios(), blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true, sizeAttenuation: false
  }));
  raios.renderOrder = 5;
  cena.add(raios);
  const reflexos = [-0.35, -0.7, 0.45, -1.15].map((posicao, i) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texturaDeReflexo(), color: ["#ffb070", "#8fd0ff", "#ffd08a", "#b9a0ff"][i],
      blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true, sizeAttenuation: false, opacity: 0
    }));
    sprite.userData = { posicao, tamanho: [0.06, 0.12, 0.035, 0.2][i] };
    sprite.renderOrder = 5;
    cena.add(sprite);
    return sprite;
  });

  // ---------- Geometria: onde está cada coisa ----------

  // Ponto da Terra embaixo da câmera e a direção do leste (mesma conta do Explorador).
  const lat = PARTIDA.latitude * RAD;
  const phi = (PARTIDA.longitude + 180) * RAD;
  const embaixo = new THREE.Vector3(-Math.cos(phi) * Math.cos(lat), Math.sin(lat), Math.sin(phi) * Math.cos(lat));
  const leste = new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi)).normalize();
  // Gira a Terra para esse ponto ficar embaixo (+Y) e o leste à frente (−Z).
  const base = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(embaixo, leste).negate(), embaixo, leste.clone().negate());
  const orientacao = new THREE.Quaternion().setFromRotationMatrix(base).invert();

  const quedaDoHorizonte = Math.acos(1 / (1 + ALTURA)); // quanto a borda da Terra fica abaixo da horizontal
  const eixoDaOrbita = new THREE.Vector3(1, 0, 0);
  const giro = new THREE.Quaternion();

  /** Direção do Sol (no referencial da câmera) para um ângulo acima da borda da Terra, antes de andar na órbita. */
  function direcaoDoSol(acimaDaBorda, azimute) {
    const elevacao = (acimaDaBorda * RAD) - quedaDoHorizonte;
    return new THREE.Vector3(Math.sin(azimute * RAD) * Math.cos(elevacao), Math.sin(elevacao), -Math.cos(azimute * RAD) * Math.cos(elevacao));
  }

  const ajustes = { solComeco: SOL_COMECO, solFim: SOL_FIM, alturaNaTela: null };
  let azimuteDoSol = 9;
  let alturaNaTela = -0.22;               // onde fica o topo da curva da Terra (−1 embaixo, 1 em cima)
  let inclinacaoBase = 0;

  function enquadrar() {
    const largura = canvas.clientWidth || window.innerWidth;
    const altura = canvas.clientHeight || window.innerHeight;
    renderer.setSize(largura, altura, false);
    const aspecto = largura / altura;
    // Em pé (celular), um campo de visão maior e o horizonte mais baixo.
    camera.fov = aspecto < 1 ? 66 : aspecto < 1.4 ? 56 : 48;
    camera.aspect = aspecto;
    camera.updateProjectionMatrix();
    alturaNaTela = ajustes.alturaNaTela ?? (aspecto < 1 ? -0.6 : -0.62);
    azimuteDoSol = aspecto < 1 ? 6 : 15;
    const meioCampo = (camera.fov / 2) * RAD;
    inclinacaoBase = quedaDoHorizonte - Math.atan(-alturaNaTela * Math.tan(meioCampo));
    solDireto.copy(direcaoDoSol(ajustes.solComeco, azimuteDoSol));
    uniformesEstrelas.escala.value = renderer.getPixelRatio();
  }

  // ---------- Animação ----------

  const ponteiro = { x: 0, y: 0, alvoX: 0, alvoY: 0 };
  let rolagem = 0;
  window.addEventListener("pointermove", (evento) => {
    ponteiro.alvoX = (evento.clientX / window.innerWidth) * 2 - 1;
    ponteiro.alvoY = (evento.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  const suave = (t) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);
  const auxiliar = new THREE.Vector3();
  const centroDoSol = new THREE.Vector3();
  let inicio = null;

  function quadro(agora) {
    if (inicio === null) inicio = agora;
    const segundos = movimentoReduzido ? DURACAO_DO_NASCER : (agora - inicio) / 1000;

    // A nave anda na órbita: rápido no começo, devagar depois que o Sol nasceu.
    const andou = (ajustes.solFim - ajustes.solComeco) * suave(segundos / DURACAO_DO_NASCER) + (movimentoReduzido ? 0 : Math.min(3, Math.max(0, segundos - DURACAO_DO_NASCER) * 0.004));
    giro.setFromAxisAngle(eixoDaOrbita, andou * RAD);
    terraGrupo.quaternion.copy(giro).multiply(orientacao);
    solAgora.copy(solDireto).applyQuaternion(giro);
    uniformesTerra.giroNuvens.value = movimentoReduzido ? 0 : segundos * 0.0000025;

    // Câmera: inclinada para o horizonte, com um leve movimento do mouse e da rolagem.
    ponteiro.x += (ponteiro.alvoX - ponteiro.x) * 0.04;
    ponteiro.y += (ponteiro.alvoY - ponteiro.y) * 0.04;
    const mexe = movimentoReduzido ? 0 : 1;
    camera.rotation.set(-(inclinacaoBase + rolagem * 9 * RAD) - ponteiro.y * 1.1 * RAD * mexe, -ponteiro.x * 1.6 * RAD * mexe, 0, "YXZ");
    camera.updateMatrixWorld();

    // Sol: longe, na direção certa. Quanto dele aparece acima da borda da Terra?
    centroDoSol.copy(solAgora).multiplyScalar(60);
    sol.position.copy(centroDoSol);
    sol.quaternion.copy(camera.quaternion);
    sol.scale.setScalar(60 * 0.6);
    const anguloDoNadir = Math.acos(-solAgora.y);
    const acimaDaBorda = (anguloDoNadir - Math.asin(1 / (1 + ALTURA))) / RAD; // em graus
    const visivel = THREE.MathUtils.smoothstep(acimaDaBorda, -0.35, 0.55);
    uniformesSol.visivel.value = 1;

    // Brilho na lente e reflexos (só quando o Sol aparece).
    auxiliar.copy(centroDoSol).project(camera);
    const naTela = auxiliar.z < 1 && Math.abs(auxiliar.x) < 1.4 && Math.abs(auxiliar.y) < 1.4;
    raios.visible = naTela && visivel > 0.001;
    raios.position.copy(centroDoSol);
    const pulso = 1 + 0.025 * Math.sin(segundos * 1.7) * mexe;
    raios.scale.setScalar((0.2 + 0.8 * visivel) * 0.62 * pulso);
    raios.material.opacity = visivel;
    for (const reflexo of reflexos) {
      const { posicao, tamanho } = reflexo.userData;
      auxiliar.copy(centroDoSol).project(camera);
      reflexo.position.set(auxiliar.x * posicao, auxiliar.y * posicao, 0.5).unproject(camera);
      reflexo.scale.setScalar(tamanho);
      reflexo.material.opacity = visivel * 0.3;
      reflexo.visible = raios.visible;
    }

    // Exposição: com o Sol no quadro a câmera "fecha" e as estrelas somem.
    uniformesEstrelas.visibilidade.value = 1 - 0.85 * visivel;
    uniformesEstrelas.tempo.value = movimentoReduzido ? 0 : segundos;
    renderer.toneMappingExposure = 1.15 - 0.25 * visivel;

    renderer.render(cena, camera);
  }

  // Só anima com a página visível e o fundo na tela.
  let rodando = false;
  let pedido = 0;
  // Qualidade adaptativa: se os quadros demoram (celular fraco), desenha com menos pixels.
  const medida = { quadros: 0, desde: 0 };
  function medirDesempenho(agora) {
    if (medida.quadros === 0) medida.desde = agora;
    if (++medida.quadros < 90) return;
    const msPorQuadro = (agora - medida.desde) / (medida.quadros - 1);
    medida.quadros = 0;
    const atual = renderer.getPixelRatio();
    if (msPorQuadro > 30 && atual > 0.6) {
      renderer.setPixelRatio(Math.max(0.6, atual * 0.75));
      enquadrar();
    }
  }
  function laco(agora) {
    quadro(agora);
    medirDesempenho(agora);
    if (rodando) pedido = requestAnimationFrame(laco);
  }
  function ligar() {
    if (rodando || movimentoReduzido) return;
    medida.quadros = 0;
    rodando = true;
    pedido = requestAnimationFrame(laco);
  }
  function desligar() {
    rodando = false;
    cancelAnimationFrame(pedido);
  }
  document.addEventListener("visibilitychange", () => (document.hidden ? desligar() : ligar()));
  let carregou = false;
  window.addEventListener("resize", () => {
    enquadrar();
    if (carregou && !rodando) quadro(performance.now());
  });

  if (new URLSearchParams(location.search).has("depurar")) {
    window.__terra = { uniformesTerra, atmosfera, renderer, camera, cena, solDireto, ajustes, quadro, enquadrar };
  }

  return {
    definirRolagem(fracao) {
      rolagem = fracao;
      if (carregou && !rodando) quadro(performance.now());
    },
    pronta: (async () => {
      const grande = !telaPequena && Math.max(window.screen.width, window.screen.height) * (window.devicePixelRatio || 1) > 2200;
      const [dia, noite, nuvens, oceano] = await Promise.all([
        carregar(grande ? "hd/terra.webp" : "terra.webp"),
        carregar("terra-noite.webp"),
        carregar("terra-nuvens.webp", false),
        carregar("terra-oceano.webp", false)
      ]);
      if (!dia) throw new Error("Sem o mapa da Terra");
      uniformesTerra.dia.value = dia;
      uniformesTerra.noite.value = noite || dia;
      uniformesTerra.nuvens.value = nuvens || dia;
      uniformesTerra.oceano.value = oceano || dia;
      carregou = true;
      enquadrar();
      quadro(performance.now());
      ligar();
      return true;
    })()
  };
}
