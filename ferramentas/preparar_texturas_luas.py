"""Prepara os mapas das luas do Explorador do Universo (só para quem quiser refazer).

Projeção equirretangular, longitude 0° no meio, gravados em img/texturas/:
  - Io, Ganimedes, Titã, Tritão, Fobos e Deimos: mapas do Celestia (CelestiaContent,
    pasta textures/hires), feitos com dados da NASA/JPL/USGS — CC BY 3.0 / CC BY 4.0
    (Deimos: CC0). Aqui só são reduzidos e convertidos para WebP.
  - Europa, Calisto e Encélado: mapas de verdade do Simulador do Sistema Solar do JPL
    (NASA 3D Resources, pasta "Images and Textures"; sem direitos autorais), feitos
    com as fotos das sondas Voyager e Galileo. Vêm em tons de cinza: aqui ganham as
    cores das fotos e, onde as sondas não fotografaram de perto (trechos lisos), são
    completados com o mapa ilustrativo. Em Encélado, as "listras de tigre" do polo
    sul (descobertas depois, pela Cassini) também são ilustração.
  - Caronte: mapa ILUSTRATIVO gerado por este script (ruído e formas simples), com as
    cores e as marcas mais conhecidas das fotos da New Horizons.

Fontes: https://github.com/CelestiaProject/CelestiaContent (textures/hires)
        https://github.com/nasa/NASA-3D-Resources (Images and Textures)

Uso:
  pip install numpy pillow
  python ferramentas/preparar_texturas_luas.py --celestia CelestiaContent/textures/hires \
      --nasa "NASA-3D-Resources/Images and Textures"
"""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

L, A = 1024, 512
DESTINO = Path(__file__).resolve().parent.parent / "img" / "texturas"
ORIGEM = None
NASA = None


def salvar(img, nome, largura=L):
    if img.size[0] != largura:
        img = img.resize((largura, largura // 2), Image.LANCZOS)
    img.save(DESTINO / f"{nome}.webp", quality=82, method=6)


def converter():
    for arquivo, nome, largura in (("io.png", "io", L), ("ganymede.jpg", "ganimedes", L), ("titan.png", "tita", L),
                                   ("triton.jpg", "tritao", L), ("phobos.jpg", "fobos", 512), ("deimos.jpg", "deimos", 512)):
        img = Image.open(Path(ORIGEM) / arquivo)
        if img.mode == "L":
            # Fobos e Deimos: mapas em tons de cinza; leve tom marrom-acinzentado das fotos.
            g = np.asarray(img.resize((largura, largura // 2), Image.LANCZOS)).astype(np.float32) / 255
            g = np.clip(g * 1.35, 0, 1)
            cor = np.stack([g * 1.0, g * 0.9, g * 0.8], axis=-1)
            img = Image.fromarray((np.clip(cor, 0, 1) * 255).astype(np.uint8))
        else:
            img = img.convert("RGB")
        salvar(img, nome, largura)


# ---------- Ruído 3D na esfera (sem costura) ----------

def coordenadas():
    lon = (np.arange(L) + 0.5) / L * 2 * np.pi - np.pi
    lat = np.pi / 2 - (np.arange(A) + 0.5) / A * np.pi
    lon, lat = np.meshgrid(lon, lat)
    x, y, z = np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)
    return lon, lat, np.stack([x, y, z], axis=-1)


def ruido(p, semente, oitavas=5, escala=3.0):
    rng = np.random.default_rng(semente)
    tabela = rng.random((64, 64, 64)).astype(np.float32)
    total = np.zeros(p.shape[:2], np.float32); amp = 1.0; soma = 0.0; f = escala
    for _ in range(oitavas):
        q = (p * f + 17.0) % 64
        i = np.floor(q).astype(int); t = q - i; t = t * t * (3 - 2 * t)
        def v(dx, dy, dz):
            return tabela[(i[..., 0] + dx) % 64, (i[..., 1] + dy) % 64, (i[..., 2] + dz) % 64]
        x0 = v(0, 0, 0) * (1 - t[..., 0]) + v(1, 0, 0) * t[..., 0]
        x1 = v(0, 1, 0) * (1 - t[..., 0]) + v(1, 1, 0) * t[..., 0]
        x2 = v(0, 0, 1) * (1 - t[..., 0]) + v(1, 0, 1) * t[..., 0]
        x3 = v(0, 1, 1) * (1 - t[..., 0]) + v(1, 1, 1) * t[..., 0]
        y0 = x0 * (1 - t[..., 1]) + x1 * t[..., 1]
        y1 = x2 * (1 - t[..., 1]) + x3 * t[..., 1]
        total += (y0 * (1 - t[..., 2]) + y1 * t[..., 2]) * amp
        soma += amp; amp *= 0.5; f *= 2.03
    return total / soma


def hexa(c):
    return np.array([int(c[i:i + 2], 16) for i in (1, 3, 5)], np.float32) / 255


def crateras(p, rng, quantidade, raio_min, raio_max):
    """Máscara de crateras claras (centro brilhante que some na borda)."""
    m = np.zeros(p.shape[:2], np.float32)
    centros = rng.normal(size=(quantidade, 3)); centros /= np.linalg.norm(centros, axis=1, keepdims=True)
    raios = raio_min * (raio_max / raio_min) ** (rng.random(quantidade) ** 2.5)
    for c, r in zip(centros, raios):
        ang = np.arccos(np.clip(p @ c, -1, 1))
        m = np.maximum(m, np.clip(1 - ang / r, 0, 1) ** 1.6)
    return m


def europa():
    lon, lat, p = coordenadas(); rng = np.random.default_rng(2)
    base = hexa("#dfd3bd")[None, None] * (0.88 + 0.2 * ruido(p, 1, 5, 2.5)[..., None])
    # Hemisfério de trás (centrado em 270° oeste) mais avermelhado.
    tras = np.clip(np.cos(lon - np.pi / 2), 0, 1)[..., None] * 0.35
    caos = (ruido(p, 3, 5, 4.0) > 0.58)[..., None] * 0.5
    cor = base * (1 - tras - caos * 0.4) + hexa("#a86a42") * (tras + caos * 0.4)
    # "Lineae": rachaduras avermelhadas, arcos de grandes círculos.
    for _ in range(90):
        n = rng.normal(size=3); n /= np.linalg.norm(n)
        meio = rng.normal(size=3); meio -= n * (meio @ n); meio /= np.linalg.norm(meio)
        largura = 0.0015 + rng.random() * 0.0035
        perto = np.clip(1 - np.abs(p @ n) / largura, 0, 1)
        ao_longo = np.arccos(np.clip(p @ meio, -1, 1)) < 0.2 + rng.random() * 0.7
        mascara = (perto * ao_longo)[..., None] * 0.35
        cor = cor * (1 - mascara) + hexa("#8a4a2a") * mascara
    return cor


def calisto():
    lon, lat, p = coordenadas(); rng = np.random.default_rng(4)
    base = hexa("#4d4338")[None, None] * (0.75 + 0.5 * ruido(p, 5, 5, 3.0)[..., None])
    claras = crateras(p, rng, 2600, 0.004, 0.035)[..., None]
    cor = base * (1 - claras) + hexa("#d9d1c3") * claras
    # Bacia de Valhalla (14° N, 56° O): miolo claro e anéis concêntricos.
    c = np.array([np.cos(np.radians(14)) * np.cos(np.radians(-56)), np.cos(np.radians(14)) * np.sin(np.radians(-56)), np.sin(np.radians(14))])
    ang = np.arccos(np.clip(p @ c, -1, 1))
    miolo = np.clip(1 - ang / 0.09, 0, 1)[..., None] ** 1.2
    aneis = (np.clip(1 - np.abs(np.sin(ang * 34)), 0, 1) ** 6 * (ang < 0.5) * 0.35)[..., None]
    cor = cor * (1 - miolo * 0.7 - aneis) + hexa("#c9bfae") * (miolo * 0.7 + aneis)
    return cor


def encelado():
    lon, lat, p = coordenadas(); rng = np.random.default_rng(6)
    cor = hexa("#eef1f3")[None, None] * (0.9 + 0.12 * ruido(p, 7, 5, 4.0)[..., None])
    # Crateras suaves no norte; sulcos no resto.
    sombra = crateras(p, rng, 500, 0.01, 0.05)[..., None] * (lat > 0.2)[..., None] * 0.18
    cor = cor * (1 - sombra)
    # "Listras de tigre": quatro fraturas paralelas perto do polo sul
    # (vistas de cima do polo, são riscos retos e paralelos).
    x = np.cos(lat) * np.cos(lon); y = np.cos(lat) * np.sin(lon)
    for k in range(4):
        desloc = (k - 1.5) * 0.14
        perto = (np.abs(x * np.sin(0.8) - y * np.cos(0.8) - desloc) < 0.012) & (lat < -np.radians(62)) & (np.abs(x * np.cos(0.8) + y * np.sin(0.8)) < 0.26)
        cor = np.where(perto[..., None], hexa("#7f9fb4"), cor)
    return cor


def caronte():
    lon, lat, p = coordenadas(); rng = np.random.default_rng(8)
    cor = hexa("#a39d94")[None, None] * (0.78 + 0.35 * ruido(p, 9, 5, 3.0)[..., None])
    claras = crateras(p, rng, 220, 0.008, 0.04)[..., None] * 0.6
    cor = cor * (1 - claras) + hexa("#d8d4cc") * claras
    # Mordor Macula: mancha escura avermelhada no polo norte.
    borda = np.radians(68) + 0.12 * (ruido(p, 10, 4, 3.0) - 0.5)
    capa = np.clip((lat - borda) / 0.08, 0, 1)[..., None]
    cor = cor * (1 - capa * 0.85) + hexa("#6b4232") * capa * 0.85
    # Cinturão de cânions perto do equador (Serenity e Mandjet Chasma).
    canion = np.clip(1 - np.abs(lat - 0.05 - 0.08 * np.sin(lon * 2)) / 0.05, 0, 1)[..., None] * ruido(p, 11, 3, 4)[..., None]
    cor = cor * (1 - canion * 0.35)
    return cor


# ---------- Mapas de verdade da NASA (Europa, Calisto e Encélado) ----------

def mapa_nasa(nome):
    """Mapa em tons de cinza do Simulador do Sistema Solar do JPL (longitude 0° no meio, leste à direita)."""
    img = Image.open(Path(NASA) / nome / f"{nome}.jpg").convert("L").resize((L, A), Image.LANCZOS)
    return np.asarray(img).astype(np.float32) / 255


def borrar(m, raio):
    """Desfoque que dá a volta no mapa (a borda esquerda continua na direita)."""
    margem = int(raio * 3) + 1
    largo = np.concatenate([m[:, -margem:], m, m[:, :margem]], axis=1)
    img = Image.fromarray((np.clip(largo, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(raio))
    return np.asarray(img).astype(np.float32)[:, margem:-margem] / 255


def onde_ha_fotos(g, minimo, maximo):
    """1 onde o mapa tem detalhe fino (fotos de perto); 0 onde é liso (nunca fotografado de perto)."""
    detalhe = borrar(np.clip(np.abs(g - borrar(g, 2.5)) * 10, 0, 1), 7)
    t = np.clip((detalhe - minimo) / (maximo - minimo), 0, 1)
    return borrar(t * t * (3 - 2 * t), 5)[..., None]


def europa_real():
    g = mapa_nasa("Jupiter - Europa")[..., None]
    # Cores das fotos: gelo claro; rachaduras e terrenos manchados em marrom-avermelhado.
    escuro, medio, claro = hexa("#6b4530"), hexa("#c8b092"), hexa("#f3eee4")
    return np.where(g < 0.62, escuro + (medio - escuro) * (g / 0.62), medio + (claro - medio) * ((g - 0.62) / 0.38))


def calisto_real():
    g = mapa_nasa("Jupiter - Callisto")
    fotos = onde_ha_fotos(g, 0.26, 0.42)
    # Tira o clarão liso das faixas sem fotos, para a emenda não aparecer.
    plano = np.clip(g - borrar(g, 22) + 0.46, 0, 1)
    real = hexa("#8a7c68")[None, None] * (0.05 + 1.0 * plano[..., None])
    # Onde ninguém fotografou de perto: ilustração com o mesmo grão e o mesmo tom do terreno de verdade.
    _, _, p = coordenadas()
    grao = ruido(p, 23, 4, 42.0)[..., None]
    fundo = calisto() * (0.62 + 0.62 * grao)
    return real * fotos + fundo * (1 - fotos)


def encelado_real():
    g = mapa_nasa("Saturn - Enceladus")
    fotos = onde_ha_fotos(g, 0.04, 0.12)
    real = hexa("#f4f7f9")[None, None] * (0.5 + 0.55 * g[..., None])
    return real * fotos + encelado() * (1 - fotos)


if __name__ == "__main__":
    argumentos = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    argumentos.add_argument("--celestia", help="pasta textures/hires do CelestiaContent (Io, Ganimedes, Titã, Tritão, Fobos e Deimos)")
    argumentos.add_argument("--nasa", help='pasta "Images and Textures" do NASA 3D Resources (Europa, Calisto e Encélado de verdade)')
    opcoes = argumentos.parse_args()
    ORIGEM, NASA = opcoes.celestia, opcoes.nasa
    DESTINO.mkdir(parents=True, exist_ok=True)
    if ORIGEM:
        converter()
    # Sem a pasta da NASA, as três luas saem só como ilustração.
    luas = (("europa", europa_real, europa), ("calisto", calisto_real, calisto), ("encelado", encelado_real, encelado), ("caronte", None, caronte))
    for nome, real, ilustracao in luas:
        funcao = real if (real and NASA) else ilustracao
        salvar(Image.fromarray((np.clip(funcao(), 0, 1) * 255).astype(np.uint8)), nome)
    print("mapas das luas ->", DESTINO)
