"""Extract selected members of a remote zip via HTTP range requests.

Usage:
    python3 zip_range_extract.py URL OUT_DIR PREFIX [PREFIX ...]

Only the central directory and the requested members are downloaded, so a
single scene can be pulled out of a multi-gigabyte dataset archive.
"""

import io
import sys
import time
import urllib.request
import zipfile
from pathlib import Path


class HttpRangeFile(io.RawIOBase):
    """Seekable read-only file backed by HTTP range requests."""

    def __init__(self, url: str) -> None:
        self.url = url
        self.pos = 0
        req = urllib.request.Request(url, method="HEAD")
        with urllib.request.urlopen(req) as resp:
            self.size = int(resp.headers["Content-Length"])

    def seekable(self) -> bool:
        return True

    def readable(self) -> bool:
        return True

    def tell(self) -> int:
        return self.pos

    def seek(self, offset: int, whence: int = 0) -> int:
        base = {0: 0, 1: self.pos, 2: self.size}[whence]
        self.pos = base + offset
        return self.pos

    def read(self, n: int = -1) -> bytes:
        if n is None or n < 0:
            n = self.size - self.pos
        if n == 0 or self.pos >= self.size:
            return b""
        end = min(self.pos + n, self.size) - 1
        req = urllib.request.Request(self.url, headers={"Range": f"bytes={self.pos}-{end}"})
        for attempt in range(5):
            try:
                with urllib.request.urlopen(req, timeout=120) as resp:
                    if resp.status != 206:
                        raise OSError(f"server ignored the range request (HTTP {resp.status})")
                    data = resp.read()
                break
            except OSError:
                if attempt == 4:
                    raise
                time.sleep(2 ** attempt)
        self.pos += len(data)
        return data

    def readinto(self, buf) -> int:
        data = self.read(len(buf))
        buf[: len(data)] = data
        return len(data)


def main(url: str, out_dir: str, prefixes: list[str]) -> None:
    """Download zip members whose names start with any of the prefixes."""
    remote = io.BufferedReader(HttpRangeFile(url), buffer_size=1 << 20)
    with zipfile.ZipFile(remote) as zf:
        members = [i for i in zf.infolist() if any(i.filename.startswith(p) for p in prefixes) and not i.is_dir()]
        total = sum(i.compress_size for i in members)
        print(f"{len(members)} members, {total / 1e6:.1f} MB", flush=True)
        root = Path(out_dir).resolve()
        for k, info in enumerate(members):
            dest = (root / info.filename).resolve()
            if root not in dest.parents:                        # absolute or ../ member names stay outside
                raise ValueError(f"unsafe member path: {info.filename}")
            if dest.exists() and dest.stat().st_size == info.file_size:
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(zf.read(info))
            if k % 25 == 0:
                print(f"{k + 1}/{len(members)} {info.filename}", flush=True)
    print("done", flush=True)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3:])
