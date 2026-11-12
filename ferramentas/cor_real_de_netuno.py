"""Devolve a Netuno a cor de verdade (só para quem quiser refazer o mapa).

O mapa de Netuno do Solar System Scope (2k_neptune.jpg, CC BY 4.0) usa o azul
forte das fotos famosas da Voyager 2 (1989). Essas fotos tiveram o contraste
aumentado para mostrar as nuvens e ficaram "azuis demais". Em 2024, Irwin e
colegas refizeram as imagens com dados do Hubble e do VLT: a cor de verdade é um
azul-esverdeado claro, só um pouco mais azul que Urano.

Fonte: Irwin et al. (2024), MNRAS 527, 11521 — https://doi.org/10.1093/mnras/stad3761

Este script mantém os desenhos do mapa (faixas, a Grande Mancha Escura, as
nuvens claras), mas com a cor medida e com menos contraste.

Uso:
  pip install numpy pillow
  python ferramentas/cor_real_de_netuno.py 2k_neptune.jpg
"""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image

L, A = 1024, 512
COR_REAL = np.array([143, 190, 216], dtype=np.float32) / 255  # azul-esverdeado claro
CONTRASTE = 0.42  # quanto das faixas e manchas do mapa original continua aparecendo
DESTINO = Path(__file__).resolve().parent.parent / "img" / "texturas" / "netuno.webp"


def cor_real(origem):
    mapa = np.asarray(Image.open(origem).convert("RGB").resize((L, A), Image.LANCZOS), dtype=np.float32) / 255
    brilho = mapa @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    relativo = (brilho - brilho.mean()) / brilho.mean()
    novo = COR_REAL[None, None] * (1 + CONTRASTE * relativo[..., None])
    # As nuvens altas de metano congelado são brancas: voltam a ser.
    nuvens = np.clip((brilho - np.percentile(brilho, 97)) / 0.12, 0, 1)[..., None]
    novo = novo * (1 - 0.6 * nuvens) + 0.6 * nuvens
    return Image.fromarray((np.clip(novo, 0, 1) * 255).astype(np.uint8))


if __name__ == "__main__":
    leitor = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    leitor.add_argument("origem", help="mapa original de Netuno (2k_neptune.jpg do Solar System Scope)")
    args = leitor.parse_args()
    cor_real(args.origem).save(DESTINO, "WEBP", quality=88, method=6)
    print("gravado", DESTINO)
