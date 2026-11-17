"""Encode the approved PNG into Windows/macOS installer icon containers."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def main():
    target = ROOT / 'desktop/build'
    target.mkdir(exist_ok=True)
    with Image.open(ROOT / 'desktop/ui/icon.png') as source:
        image = source.convert('RGBA')
        image.save(target / 'icon.ico', sizes=[(n, n) for n in (16, 24, 32, 48, 64, 128, 256)])
        image.save(target / 'icon.icns')
    with Image.open(target / 'icon.ico') as icon:
        assert (256, 256) in icon.info['sizes']
        icon.load()
    with Image.open(target / 'icon.icns') as icon:
        icon.load()
    print('Installer icons ready: desktop/build/icon.ico and icon.icns')


if __name__ == '__main__':
    main()
