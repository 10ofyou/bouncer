#!/usr/bin/env python3
"""Draw Bouncer's toolbar icons (a red shield with a white bar) as PNGs.

Stdlib only, so it runs anywhere Python 3 does. Re-run after changing the
shape: python3 scripts/make_icons.py
"""
import math
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "extension" / "icons"
RED = (217, 48, 37)
WHITE = (255, 255, 255)
SS = 4  # supersampling factor for smooth edges


def in_shield(x, y):
    # x, y in 0..1. Flat top with rounded corners, sides curve to a point.
    if y < 0.08 or y > 0.95:
        return False
    if y < 0.55:
        half = 0.40
    else:
        t = (y - 0.55) / 0.40
        half = 0.40 * math.cos(t * math.pi / 2)
    return abs(x - 0.5) <= half


def in_mark(x, y):
    # A white "stop" bar across the shield.
    return 0.27 <= x <= 0.73 and 0.36 <= y <= 0.50


def render(size):
    rows = []
    n = size * SS
    for py in range(size):
        row = bytearray([0])
        for px in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(SS):
                for sx in range(SS):
                    x = (px * SS + sx + 0.5) / n
                    y = (py * SS + sy + 0.5) / n
                    if in_shield(x, y):
                        c = WHITE if in_mark(x, y) else RED
                        acc[0] += c[0]
                        acc[1] += c[1]
                        acc[2] += c[2]
                        acc[3] += 255
            k = SS * SS
            a = acc[3] // k
            if a:
                cov = acc[3] / 255
                row += bytes([int(acc[0] / cov), int(acc[1] / cov), int(acc[2] / cov), a])
            else:
                row += bytes([0, 0, 0, 0])
        rows.append(bytes(row))
    return b"".join(rows)


def png(size, raw):
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for s in (16, 32, 48, 128):
        (OUT / f"{s}.png").write_bytes(png(s, render(s)))
        print(f"wrote icons/{s}.png")
