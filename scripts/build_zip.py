#!/usr/bin/env python3
"""Package extension/ into dist/bouncer.zip (manifest.json at the zip root).

Stdlib only: python3 scripts/build_zip.py
"""
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "extension"
OUT = ROOT / "dist" / "bouncer.zip"

if __name__ == "__main__":
    version = json.loads((SRC / "manifest.json").read_text())["version"]
    OUT.parent.mkdir(exist_ok=True)
    files = sorted(p for p in SRC.rglob("*") if p.is_file() and not p.name.startswith("."))
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
        for p in files:
            # Fixed timestamp so rebuilding unchanged sources gives the same zip.
            info = zipfile.ZipInfo(str(p.relative_to(SRC)), date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, p.read_bytes())
    print(f"wrote {OUT.relative_to(ROOT)} (v{version}, {len(files)} files)")
