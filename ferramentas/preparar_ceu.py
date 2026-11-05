"""Prepara os dados do céu do Explorador do Universo (só para quem quiser refazer).

Gera, a partir das fontes originais:
  dados/estrelas.json            estrelas do catálogo HYG v4.0 (Hipparcos, Yale Bright Star e
                                 Gliese; CC BY-SA 4.0): as visíveis a olho nu (V <= 6,5) e todas
                                 as conhecidas a menos de 25 anos-luz.
  img/ceu/via-lactea-4096.webp   panorama da Via Láctea da ESO (S. Brunier, eso0932a, CC BY 4.0),
  img/ceu/via-lactea-2048.webp   em coordenadas galácticas, sem as estrelas mais brilhantes
                                 (o programa desenha as estrelas do catálogo no lugar delas).

Fontes:
  HYG:  https://codeberg.org/astronexus/hyg  (arquivo hygdata_v40.csv.gz)
  ESO:  https://www.eso.org/public/images/eso0932a/  (versão de 4096 x 2048 ou maior)

Uso:
  pip install numpy pandas pillow scipy opencv-python-headless
  python ferramentas/preparar_ceu.py --hyg hygdata_v40.csv.gz --eso eso0932a.jpg
"""
import argparse
import json
from pathlib import Path

import cv2
import numpy as np
import pandas as pd
from PIL import Image
from scipy.ndimage import maximum_filter, median_filter, uniform_filter

RAIZ = Path(__file__).resolve().parent.parent
ANOS_LUZ_POR_PARSEC = 3.26156


def estrelas(caminho_hyg):
    d = pd.read_csv(caminho_hyg, low_memory=False)
    d = d[d.id != 0]  # sem o Sol
    distancia = np.where(d.dist < 100000, d.dist * ANOS_LUZ_POR_PARSEC, 0)  # >= 100000 = sem paralaxe confiável
    escolhidas = (d.mag <= 6.5) | ((distancia > 0) & (distancia < 25))
    d = d[escolhidas].assign(dly=distancia[escolhidas.values]).sort_values("mag")

    def arredondar(valor, casas):
        valor = round(float(valor), casas)
        return int(valor) if valor == int(valor) else valor

    valores = []
    for ra, dec, dly, mag, ci in zip(d.ra * 15, d.dec, d.dly, d.mag, d.ci.fillna(0.6)):
        valores += [arredondar(ra, 2), arredondar(dec, 2), arredondar(dly, 1 if dly < 100 else 0), arredondar(mag, 2), arredondar(ci, 2)]
    saida = {
        "fonte": "HYG Database v4.0 (Astronexus, D. Nash), compilado do catálogo Hipparcos (ESA; nova redução de "
                 "van Leeuwen, 2007), do Yale Bright Star Catalogue e do Gliese Catalogue of Nearby Stars. "
                 "Licença CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/",
        "selecao": "Estrelas visíveis a olho nu (magnitude V até 6,5) e todas as conhecidas a menos de 25 anos-luz do Sol.",
        "campos": ["ascensao_reta_graus_J2000", "declinacao_graus_J2000", "distancia_anos_luz (0 = desconhecida)",
                   "magnitude_V", "indice_de_cor_B-V"],
        "estrelas": valores,
    }
    destino = RAIZ / "dados" / "estrelas.json"
    destino.write_text(json.dumps(saida, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(d)} estrelas -> {destino}")


def via_lactea(caminho_eso):
    rgb = np.asarray(Image.open(caminho_eso).convert("RGB").resize((4096, 2048), Image.LANCZOS))
    lum = rgb.astype(np.float32).mean(axis=2)
    altura, largura = lum.shape
    # Estrelas = picos de luz acima do fundo local; as mais brilhantes saem da foto.
    excesso = np.clip(lum - median_filter(lum, size=11, mode="wrap"), 0, None)
    fluxo = uniform_filter(excesso, size=5, mode="wrap") * 25
    picos = (maximum_filter(fluxo, size=9, mode="wrap") == fluxo) & (fluxo > 200)
    mascara = np.zeros((altura, largura), np.uint8)
    for y, x in zip(*np.nonzero(picos)):
        raio = 2.5 + 4.0 * np.log10(fluxo[y, x] / 200)
        latitude = abs((0.5 - y / altura) * np.pi)
        raio_x = min(raio / max(np.cos(latitude), 0.15), 40)  # perto dos polos a projeção estica
        cv2.ellipse(mascara, (int(x), int(y)), (int(np.ceil(raio_x)), int(np.ceil(raio))), 0, 0, 360, 255, -1)
    limpo = cv2.cvtColor(cv2.inpaint(cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), mascara, 5, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB)
    imagem = Image.fromarray(limpo)
    (RAIZ / "img" / "ceu").mkdir(parents=True, exist_ok=True)
    imagem.save(RAIZ / "img" / "ceu" / "via-lactea-4096.webp", quality=80, method=6)
    imagem.resize((2048, 1024), Image.LANCZOS).save(RAIZ / "img" / "ceu" / "via-lactea-2048.webp", quality=82, method=6)
    print(f"{int(picos.sum())} estrelas tiradas da foto -> img/ceu/")


if __name__ == "__main__":
    argumentos = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    argumentos.add_argument("--hyg", help="hygdata_v40.csv.gz (catálogo HYG)")
    argumentos.add_argument("--eso", help="foto panorâmica eso0932a (JPG)")
    lidos = argumentos.parse_args()
    if not (lidos.hyg or lidos.eso):
        argumentos.error("informe --hyg e/ou --eso")
    if lidos.hyg:
        estrelas(lidos.hyg)
    if lidos.eso:
        via_lactea(lidos.eso)
