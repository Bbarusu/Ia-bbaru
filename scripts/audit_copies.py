"""Read-only inventory before consolidating local Ia-bbaru checkouts.

No fetch, cleanup, credentials, model calls or file contents are read. Git remote
coverage uses existing local refs; it is not proof that a copy can be deleted.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess

GENERATED = (
    ".venv", "frontend/node_modules", "desktop/node_modules",
    "frontend/dist", "extension/app", "playwright-report", "test-results",
)
SKIP = {".git", "node_modules", ".venv", "__pycache__"}
STATE_DIRS = {"data", ".local-state", ".claude", ".codex", ".gemini"}


def git(path, *args):
    try:
        result = subprocess.run(
            ["git", "-C", str(path), *args], capture_output=True,
            text=True, encoding="utf-8", errors="replace", timeout=20,
            env={**os.environ, "GIT_OPTIONAL_LOCKS": "0", "GIT_TERMINAL_PROMPT": "0"},
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    return result.stdout.strip() if result.returncode == 0 else None


def linked(path):
    return path.is_symlink() or (hasattr(path, "is_junction") and path.is_junction())


def inventory(root):
    """Names only; don't traverse dependency trees, state directories or links."""
    state, links, stack = [], [], [root]
    entries = 0
    complete = True
    while stack:
        directory = stack.pop()
        try:
            children = list(directory.iterdir())
        except OSError:
            complete = False
            continue
        for path in children:
            entries += 1
            if entries > 20000:
                return {"possible_local_data": sorted(state), "links_not_followed": sorted(links),
                        "scan_complete": False}
            relative = path.relative_to(root).as_posix()
            try:
                if linked(path):
                    links.append(relative)
                    continue
                if path.is_dir():
                    if path.name in STATE_DIRS:
                        state.append(relative + "/")
                    elif path.name not in SKIP:
                        stack.append(path)
                elif (path.suffix.lower() in {".db", ".sqlite", ".sqlite3", ".token", ".pem", ".key"}
                      or (path.name.startswith(".env") and path.name != ".env.example")
                      or (path.suffix.lower() == ".json"
                          and path.name.lower().startswith(("credentials", "token")))):
                    state.append(relative)
            except OSError:
                complete = False
    return {"possible_local_data": sorted(state), "links_not_followed": sorted(links),
            "scan_complete": complete}


def audit(root, primary):
    report = {"path": str(root), "role": "primary_candidate" if root.resolve() == primary.resolve()
              else "review_before_removal", "deletion_authorized_by_report": False}
    if linked(root):
        return {**report, "error": "directory_is_a_link"}
    top = git(root, "rev-parse", "--show-toplevel")
    if top is None or Path(top).resolve() != root.resolve():
        return {**report, "error": "not_a_checkout_root_or_git_unavailable"}
    common = git(root, "rev-parse", "--git-common-dir")
    status = git(root, "status", "--porcelain=v1", "--untracked-files=normal")
    uncovered = git(root, "rev-list", "--count", "HEAD", "--branches", "--tags", "--not", "--remotes")
    report.update(
        head=git(root, "rev-parse", "HEAD"),
        branch=git(root, "symbolic-ref", "--short", "-q", "HEAD"),
        shared_git_directory=str((root / common).resolve()) if common else None,
        working_tree_clean=status == "" if status is not None else None,
        changed_paths_count=len(status.splitlines()) if status else (0 if status == "" else None),
        conflict=git(root, "diff", "--name-only", "--diff-filter=U"),
        commits_not_in_local_remote_refs=int(uncovered) if uncovered and uncovered.isdigit() else None,
        remote_refs_may_be_stale=True,
        generated_directories_present=[name for name in GENERATED if (root / name).exists()],
        **inventory(root),
    )
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--parent", required=True, type=Path)
    parser.add_argument("--primary", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    if not args.parent.is_dir():
        parser.error("A pasta principal informada não existe.")
    roots = sorted(path for path in args.parent.iterdir()
                   if path.name.lower().startswith("ia-bbaru") and path.is_dir())
    reports = [audit(root, args.primary) for root in roots]
    # A linked worktree may rely on .git inside a seemingly obsolete checkout.
    for report in reports:
        common = report.get("shared_git_directory")
        report["shares_git_with"] = [other["path"] for other in reports
                                    if common and other["path"] != report["path"]
                                    and other.get("shared_git_directory") == common]
    print(json.dumps({
        "read_only": True,
        "note": "Inventário local; nenhum arquivo apagado. Commits exigem conferência com refs remotas atualizadas.",
        "copies": reports,
    }, ensure_ascii=True, indent=2))


if __name__ == "__main__":
    main()
