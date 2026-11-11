"""Entry point.

    python -m integrations diagnose   # local report, no model calls
    python -m integrations serve      # gateway on 127.0.0.1:8010
    python -m integrations failures   # sanitized signatures of recent failures
"""
import argparse


def main():
    parser = argparse.ArgumentParser(prog="python -m integrations")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("diagnose", help="Relatório local sem chamar modelos")
    failures = sub.add_parser("failures", help="Assinaturas sanitizadas das últimas falhas, sem conteúdo")
    failures.add_argument("--limit", type=int, default=5)
    serve = sub.add_parser("serve", help="Inicia o gateway local")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8010)
    args = parser.parse_args()

    if args.command == "diagnose":
        from .diagnostics import main as diagnose
        diagnose()
        return
    if args.command == "failures":
        import json
        import os
        import sys
        from pathlib import Path
        from .dedup import read_failures
        path = Path(os.environ.get("IA_BBARU_GATEWAY_DB", "data/integrations.sqlite3"))
        if not path.exists():
            parser.error(f"banco do gateway não encontrado: {path} (defina IA_BBARU_GATEWAY_DB)")
        rows = read_failures(path, max(1, min(args.limit, 50)))
        print(json.dumps(rows, ensure_ascii=not sys.stdout.isatty(), indent=2))
        return
    if args.host not in {"127.0.0.1", "localhost", "::1"}:
        parser.error("O gateway só escuta em loopback nesta versão.")
    import uvicorn
    from .app import create_app
    # No ANSI colours: on Windows the log goes to a file (see scripts/iniciar-ia-bbaru.ps1).
    uvicorn.run(create_app(), host=args.host, port=args.port, workers=1, log_level="info",
                use_colors=False)


if __name__ == "__main__":
    main()
