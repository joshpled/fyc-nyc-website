"""
Rebuild the self-hosted font files in public/fonts from the Fontsource originals.
Keeps only the characters and weights the site uses, which roughly halves the bytes.

  pip install fonttools brotli
  python3 scripts/subset-fonts.py
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'node_modules/@fontsource-variable'
OUT = ROOT / 'public/fonts'

# Basic Latin + Latin-1 + the punctuation used in copy (’ “ ” – — • … → · ★ é à etc.)
UNICODES = (
    list(range(0x20, 0x7F)) + list(range(0xA0, 0x100)) +
    [0x0152, 0x0153, 0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2026, 0x2032, 0x2033, 0x2122, 0x2192, 0x2190, 0x20AC, 0x2605, 0x25C6]
)

JOBS = [
    # (source file, output name, axis limits)
    (SRC / 'fraunces/files/fraunces-latin-opsz-normal.woff2', 'fraunces-latin-opsz-normal.woff2', {'wght': (300, 500)}),
    (SRC / 'fraunces/files/fraunces-latin-opsz-italic.woff2', 'fraunces-latin-opsz-italic.woff2', {'wght': (300, 400)}),
    (SRC / 'manrope/files/manrope-latin-wght-normal.woff2', 'manrope-latin-wght-normal.woff2', {'wght': (400, 800)}),
]

for src, name, limits in JOBS:
    font = TTFont(src)
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['kern', 'liga', 'calt', 'ccmp', 'locl', 'mark', 'mkmk', 'onum', 'lnum', 'tnum', 'pnum']
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    opts.notdef_glyph = True
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=UNICODES)
    sub.subset(font)
    font = instancer.instantiateVariableFont(font, limits)
    out = OUT / name
    font.flavor = 'woff2'
    font.save(out)
    print(f'{name}: {src.stat().st_size // 1024}KB -> {out.stat().st_size // 1024}KB')
