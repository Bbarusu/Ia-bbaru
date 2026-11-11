"""Consolidate the four audited Windows worktrees, with verified local backups.

Default: inspect/plan only. --apply replaces the primary's Git link with an
independent repository, verifies it, then removes the three archived checkouts.
No network, model calls, dependency installs or AppData modifications.
"""
import argparse
from datetime import datetime
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import zipfile

NAMES = ("Ia-bbaru", "Ia-bbaru-chromium", "Ia-bbaru-inicio", "Ia-bbaru-validacao-pr7")
GENERATED = {".venv", "frontend/node_modules", "desktop/node_modules", "frontend/dist",
             "extension/app", "playwright-report", "test-results", "desktop/releases"}


def git(root, *args):
    try:
        result = subprocess.run(
            ["git", "-C", str(root), *args], capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=300,
            env={**os.environ, "GIT_OPTIONAL_LOCKS": "0", "GIT_TERMINAL_PROMPT": "0"},
        )
    except (OSError, subprocess.TimeoutExpired):
        raise RuntimeError(f"Não foi possível executar Git {args[0]} em {root.name}.") from None
    if result.returncode:
        # Never print config values or remote URLs (they can contain credentials).
        raise RuntimeError(f"Git {args[0]} falhou em {root.name} (código {result.returncode}).")
    return result.stdout.strip()


def linked(path):
    return path.is_symlink() or (hasattr(path, "is_junction") and path.is_junction())


def files(root, *, repository=False):
    stack = [root]
    while stack:
        for path in sorted(stack.pop().iterdir()):
            relative = path.relative_to(root).as_posix()
            if not repository and (relative == ".git" or relative in GENERATED
                                   or "__pycache__" in path.relative_to(root).parts):
                continue
            if linked(path):
                raise RuntimeError(f"Link não previsto em {root.name}/{relative}; revisão manual necessária.")
            if path.is_dir():
                stack.append(path)
            elif path.is_file():
                yield path, relative
            else:
                raise RuntimeError("Tipo de arquivo não suportado; nenhuma exclusão autorizada.")


def snapshot(root, *, repository=False):
    return {name: (path.stat().st_size, path.stat().st_mtime_ns)
            for path, name in files(root, repository=repository)}


def archive(root, target, *, repository=False):
    before = snapshot(root, repository=repository)
    with zipfile.ZipFile(target, "x", compression=zipfile.ZIP_DEFLATED,
                         compresslevel=3, strict_timestamps=False) as output:
        for path, name in files(root, repository=repository):
            output.write(path, name)
    if before != snapshot(root, repository=repository):
        raise RuntimeError(f"Arquivos mudaram durante o backup de {root.name}; feche o aplicativo.")
    with zipfile.ZipFile(target) as saved:
        if set(saved.namelist()) != set(before) or saved.testzip() is not None:
            raise RuntimeError(f"Falha ao verificar {target.name}.")
    with target.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    return before, digest


def references(root):
    rows = git(root, "for-each-ref", "--format=%(refname) %(objectname) %(symref)")
    return [line.split() for line in rows.splitlines()]


def preflight(parent):
    roots = [parent / name for name in NAMES]
    common = roots[0] / ".git"
    for root in roots:
        if not root.is_dir() or linked(root):
            raise RuntimeError(f"Pasta ausente ou link: {root.name}.")
        if Path(git(root, "rev-parse", "--show-toplevel")).resolve() != root.resolve():
            raise RuntimeError(f"{root.name} não é a raiz de um checkout.")
        if (root / git(root, "rev-parse", "--git-common-dir")).resolve() != common.resolve():
            raise RuntimeError("A estrutura Git difere do relatório; é necessário auditar novamente.")
        if git(root, "status", "--porcelain=v1", "--untracked-files=all"):
            raise RuntimeError(f"{root.name} tem alterações locais; preservá-las antes da consolidação.")
        for state in ("MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply"):
            if (root / git(root, "rev-parse", "--git-path", state)).exists():
                raise RuntimeError(f"Operação Git pendente em {root.name}.")
        for generated in GENERATED:
            if git(root, "ls-files", "--", generated):
                raise RuntimeError(f"Há arquivos versionados em {generated}; não serão descartados.")
    if not common.is_dir() or linked(common) or not (roots[-1] / ".git").is_file():
        raise RuntimeError("O vínculo Git da cópia principal não é o esperado.")
    if (common / "objects" / "info" / "alternates").exists():
        raise RuntimeError("O Git usa armazenamento externo de objetos; migração manual necessária.")
    registered = {Path(line[9:]).resolve() for line in git(roots[0], "worktree", "list", "--porcelain").splitlines()
                  if line.startswith("worktree ")}
    if registered != {root.resolve() for root in roots}:
        raise RuntimeError("Há worktrees adicionais; não é seguro remover o repositório compartilhado.")
    return roots, common


def consolidate(parent, apply=False):
    parent = parent.resolve()
    roots, common = preflight(parent)
    primary = roots[-1]
    heads = {root.name: git(root, "rev-parse", "HEAD") for root in roots}
    refs = references(roots[0])
    plan = {"apply": apply, "keep": str(primary), "remove_after_backup": [str(p) for p in roots[:-1]],
            "backup_parent": str(parent / "Backups-Ia-bbaru"),
            "preserve_primary_dependencies_and_data": True, "heads": heads}
    if not apply:
        # Check accessibility and unexpected links, without writing anything.
        for root in roots:
            snapshot(root)
        snapshot(common, repository=True)
        return plan

    backup_parent = parent / "Backups-Ia-bbaru"
    if linked(backup_parent):
        raise RuntimeError("O destino de backup não pode ser um link.")
    backup_parent.mkdir(exist_ok=True)
    backup = backup_parent / datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    backup.mkdir()
    print(f"Backup local: {backup}", flush=True)
    saved, digests = {}, {}
    for root in roots:
        print(f"Arquivando {root.name} (sem dependências reconstruíveis)...", flush=True)
        saved[root], digests[root.name + ".zip"] = archive(root, backup / (root.name + ".zip"))
    git_before, digests["shared-git.zip"] = archive(common, backup / "shared-git.zip", repository=True)
    manifest = {**plan, "backup": str(backup), "sha256": digests, "phase": "backups_verified"}
    manifest_path = backup / "manifest.json"

    def record(phase):
        manifest["phase"] = phase
        manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=True), encoding="utf-8")

    record("backups_verified")
    stage = backup / "independent-checkout"
    # Local clone copies objects; --no-hardlinks prevents dependence on old files.
    git(parent, "clone", "--no-hardlinks", "--no-checkout", "--", str(roots[0]), str(stage))
    for row in references(stage):
        git(stage, "update-ref", "--no-deref", "-d", row[0])
    for row in refs:
        if len(row) == 2:
            git(stage, "update-ref", row[0], row[1])
    for row in refs:
        if len(row) == 3:
            git(stage, "symbolic-ref", row[0], row[2])
    # Preserve all four checkout tips, including detached/unpublished commits.
    for name, head in heads.items():
        git(stage, "update-ref", f"refs/archive/windows/{name}", head)
    branch = "local/windows"
    if any(row[0] == f"refs/heads/{branch}" for row in refs):
        branch += "-" + backup.name
    git(stage, "update-ref", f"refs/heads/{branch}", heads[primary.name])
    git(stage, "symbolic-ref", "HEAD", f"refs/heads/{branch}")
    git(stage, "read-tree", heads[primary.name])
    git(stage, "remote", "set-url", "origin", git(roots[0], "remote", "get-url", "origin"))
    if any(row[0] == "refs/remotes/origin/codex/browser-capture-clis" for row in refs):
        git(stage, "config", f"branch.{branch}.remote", "origin")
        git(stage, "config", f"branch.{branch}.merge", "refs/heads/codex/browser-capture-clis")
    # Preserve per-repository line-ending/working-tree semantics on Windows.
    value = git(primary, "config", "--get-regexp", "^core\\.")
    for key in ("core.autocrlf", "core.eol", "core.safecrlf", "core.filemode", "core.ignorecase", "core.symlinks"):
        for line in value.splitlines():
            setting, _, configured = line.partition(" ")
            if setting == key:
                git(stage, "config", key, configured)
    if snapshot(common, repository=True) != git_before or references(roots[0]) != refs:
        raise RuntimeError("O Git compartilhado mudou durante a operação; nenhuma cópia foi removida.")
    for root in roots:
        if snapshot(root) != saved[root] or git(root, "status", "--porcelain=v1", "--untracked-files=all"):
            raise RuntimeError(f"{root.name} mudou durante a operação; nenhuma cópia foi removida.")

    old_link = backup / "primary-original.git-link"
    os.replace(primary / ".git", old_link)
    try:
        os.replace(stage / ".git", primary / ".git")
        if git(primary, "status", "--porcelain=v1", "--untracked-files=all"):
            raise RuntimeError("A cópia independente apresentou diferenças; vínculo anterior restaurado.")
        if (primary / git(primary, "rev-parse", "--git-common-dir")).resolve() != (primary / ".git").resolve():
            raise RuntimeError("O Git ainda depende da cópia antiga.")
        if git(primary, "rev-parse", "HEAD") != heads[primary.name]:
            raise RuntimeError("O commit da cópia principal mudou.")
    except BaseException:
        if (primary / ".git").is_dir():
            os.replace(primary / ".git", stage / ".git")
        os.replace(old_link, primary / ".git")
        record("activation_failed_original_restored")
        raise
    manifest["branch"] = branch
    record("primary_independent_verified")
    # Delete only exact, archived paths. The primary's .venv/node_modules stay put.
    removed = []
    try:
        for root in (roots[1], roots[2], roots[0]):
            if snapshot(root) != saved[root] or snapshot(common, repository=True) != git_before:
                raise RuntimeError("Uma cópia antiga mudou após o backup; sua exclusão foi interrompida.")
            print(f"Removendo cópia arquivada: {root.name}", flush=True)
            shutil.rmtree(root, onexc=remove_readonly)
            removed.append(str(root))
            manifest["removed"] = removed[:]
            record("removing_archived_copies")
    except (OSError, RuntimeError):
        record("primary_ready_cleanup_incomplete")
        raise RuntimeError(f"A principal já é independente, mas a limpeza foi interrompida por bloqueio ou mudança de arquivos. Consulte {manifest_path}.") from None
    stage.rmdir()
    record("completed")
    return manifest


def remove_readonly(function, path, error):
    """Git objects can be read-only on Windows; don't bypass open-file locks."""
    if isinstance(error, PermissionError) and Path(path).is_file() and not linked(Path(path)):
        os.chmod(path, stat.S_IREAD | stat.S_IWRITE)
        function(path)  # A genuine sharing violation still fails and is reported.
    else:
        raise error


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--parent", required=True, type=Path)
    parser.add_argument("--apply", action="store_true", help="Faz backups, migra o Git e remove as três cópias arquivadas")
    args = parser.parse_args()
    try:
        print(json.dumps(consolidate(args.parent, args.apply), ensure_ascii=True, indent=2))
    except (OSError, RuntimeError, subprocess.TimeoutExpired, zipfile.BadZipFile) as exc:
        parser.exit(1, f"Consolidação interrompida: {exc}\n")


if __name__ == "__main__":
    main()
