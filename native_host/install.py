"""Explicit local install; nothing runs during import or extension installation."""
import argparse
import json
import os
from pathlib import Path
import secrets
import shlex
import sys

from .bridge import HOST_NAME, EXTENSION_ID


def prepare(state_dir, port=8000):
    state = Path(state_dir).resolve()
    state.mkdir(parents=True, exist_ok=True)
    root = Path(__file__).resolve().parents[1]
    config_path = state / "config.json"
    # Preserve an existing token so reinstalling doesn't break the running backend.
    if not config_path.exists():
        fd = os.open(config_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as file:
            json.dump({"backend_url": f"http://127.0.0.1:{port}",
                       "token": secrets.token_urlsafe(32),
                       "db_path": str(state / "launcher.sqlite3")}, file)
    if sys.platform == "win32":
        # Avoid cmd variable expansion in unusual installation paths.
        if any(any(char in str(path) for char in '%!\r\n') for path in (root, config_path, sys.executable)):
            raise ValueError("Use an installation path without %, ! or newlines")
        launcher = state / "run-host.bat"
        launcher.write_text(f'@echo off\nchcp 65001 >nul\ncd /d "{root}"\n"{sys.executable}" -m native_host --config "{config_path}"\n', encoding="utf-8")
    else:
        launcher = state / "run-host"
        launcher.write_text(f'#!/bin/sh\ncd {shlex.quote(str(root))} || exit 1\nexec {shlex.quote(sys.executable)} -m native_host --config {shlex.quote(str(config_path))}\n')
        launcher.chmod(0o700)
    manifest = state / f"{HOST_NAME}.json"
    manifest.write_text(json.dumps({"name": HOST_NAME, "description": "Ia-bbaru local bridge",
                                   "path": str(launcher), "type": "stdio",
                                   "allowed_extensions": [EXTENSION_ID]}, indent=2), encoding="utf-8")
    return config_path, manifest


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--state-dir", required=True)
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--register", action="store_true", help="Register for the current OS user")
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        parser.error("port must be between 1024 and 65535")
    config, manifest = prepare(args.state_dir, args.port)
    if args.register:
        if sys.platform == "win32":
            import winreg
            with winreg.CreateKey(winreg.HKEY_CURRENT_USER, rf"Software\Mozilla\NativeMessagingHosts\{HOST_NAME}") as key:
                winreg.SetValueEx(key, "", 0, winreg.REG_SZ, str(manifest))
        else:
            folder = (Path.home() / "Library/Application Support/Mozilla/NativeMessagingHosts" if sys.platform == "darwin"
                      else Path.home() / ".mozilla/native-messaging-hosts")
            folder.mkdir(parents=True, exist_ok=True)
            (folder / manifest.name).write_bytes(manifest.read_bytes())
    print(f"Configuração local: {config}")
    print(f"Manifesto: {manifest}")
    print("Inicie o backend: python -m native_host.service --config <caminho-da-configuração>")


if __name__ == "__main__":
    main()
