#!/usr/bin/env python3
"""Assemble the public site into _site/ for a Cloudflare Pages deploy.

The repository is the source of truth. Nothing here is duplicated by hand: the
guide and routing come from site/, and the simulations come from
dummy-phishing-pages/, so each file is edited in exactly one place.

Layout produced, which is what the canonical URLs depend on:

    /bouncer            the install and safety guide (site/bouncer.md via _redirects)
    /bouncer/<brand>    a phishing simulation, one per brand
    /bouncer/styles.css the simulations' stylesheet   (referenced as ../styles.css)
    /bouncer/training.js the simulations' script       (referenced as ../training.js)
    /dist/bouncer.zip   the download the simulations link to (../../dist/bouncer.zip)

The _redirects rules for /bouncer and /bouncer/ are exact matches, so they do
not shadow /bouncer/<brand>.

Usage:  python3 scripts/build_site.py [outdir]
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
SIMS = ROOT / "dummy-phishing-pages"
BRANDS = ["google", "microsoft", "linkedin", "facebook", "apple", "paypal"]


def main() -> int:
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "_site"
    if out.exists():
        shutil.rmtree(out)
    (out / "bouncer").mkdir(parents=True)

    # The guide plus the routing and header rules.
    for name in ("bouncer.md", "_redirects", "_headers"):
        shutil.copy2(SITE / name, out / name)

    # One directory per brand, so /bouncer/<brand> resolves to its index.html.
    for brand in BRANDS:
        src = SIMS / brand / "index.html"
        if not src.is_file():
            sys.exit(f"missing simulation: {src}")
        dest = out / "bouncer" / brand
        dest.mkdir()
        shutil.copy2(src, dest / "index.html")

    # Shared assets, referenced from each simulation as ../
    for asset in ("styles.css", "training.js"):
        shutil.copy2(SIMS / asset, out / "bouncer" / asset)

    # The simulations link to the packaged extension at ../../dist/bouncer.zip
    zip_src = ROOT / "dist" / "bouncer.zip"
    if zip_src.is_file():
        (out / "dist").mkdir()
        shutil.copy2(zip_src, out / "dist" / "bouncer.zip")
    else:
        print("warning: dist/bouncer.zip missing, the download link will 404")

    files = sum(1 for p in out.rglob("*") if p.is_file())
    print(f"built {out} with {files} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
