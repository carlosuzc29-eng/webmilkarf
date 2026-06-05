#!/usr/bin/env python3
"""Convierte imágenes JPG/JPEG/PNG a WebP en un directorio.

Uso:
    python3 convert_images.py /ruta/al/directorio

También puede usar la opción --quality para ajustar la calidad de salida.
"""

import argparse
from pathlib import Path
from PIL import Image


def convert_images_to_webp(source_dir: Path, quality: int = 85, overwrite: bool = False):
    source_dir = source_dir.expanduser().resolve()
    if not source_dir.exists() or not source_dir.is_dir():
        raise FileNotFoundError(f"El directorio '{source_dir}' no existe o no es un directorio.")

    image_files = sorted(source_dir.rglob('*.jpg'))
    image_files += sorted(source_dir.rglob('*.jpeg'))
    image_files += sorted(source_dir.rglob('*.png'))

    if not image_files:
        print(f"No se encontraron archivos JPG/JPEG/PNG en {source_dir}")
        return

    for image_path in image_files:
        webp_path = image_path.with_suffix('.webp')
        if webp_path.exists() and not overwrite:
            print(f"Saltando existente: {webp_path}")
            continue

        try:
            with Image.open(image_path) as img:
                rgb_image = img.convert('RGB')
                rgb_image.save(webp_path, 'WEBP', quality=quality, method=6)
            print(f"Convertido: {image_path.name} -> {webp_path.name}")
        except Exception as exc:
            print(f"Error al convertir {image_path}: {exc}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Convierte imágenes JPG/JPEG/PNG a WebP.')
    parser.add_argument('directory', type=Path, help='Directorio donde buscar archivos JPG/JPEG/PNG.')
    parser.add_argument('--quality', type=int, default=85, help='Calidad de salida WebP (0-100).')
    parser.add_argument('--overwrite', action='store_true', help='Reemplazar archivos .webp existentes.')
    args = parser.parse_args()

    convert_images_to_webp(args.directory, quality=args.quality, overwrite=args.overwrite)
