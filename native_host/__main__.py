import argparse
import json
import os
import sys
from urllib.parse import urlparse

import httpx

from .bridge import Bridge, serve


def load_config(path):
    with open(path, encoding="utf-8") as file:
        config = json.load(file)
    url = urlparse(config["backend_url"])
    if (url.scheme != "http" or url.hostname not in {"127.0.0.1", "localhost", "::1"}
            or url.username or url.password or url.path not in {"", "/"} or url.query or url.fragment):
        raise ValueError("Backend must be loopback HTTP")
    if not isinstance(config["token"], str) or len(config["token"]) < 32:
        raise ValueError("Invalid local token")
    return config


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    args, _browser_args = parser.parse_known_args()
    if sys.platform == "win32":
        import msvcrt
        msvcrt.setmode(sys.stdin.fileno(), os.O_BINARY)
        msvcrt.setmode(sys.stdout.fileno(), os.O_BINARY)
    try:
        config = load_config(args.config)
        with httpx.Client(base_url=config["backend_url"], timeout=15, follow_redirects=False,
                          trust_env=False, headers={"Authorization": f"Bearer {config['token']}"}) as client:
            serve(Bridge(client), sys.stdin.buffer, sys.stdout.buffer)
    except (ValueError, OSError, KeyError):
        print("Ia-bbaru: configuração ou mensagem inválida; confira a instalação local.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
