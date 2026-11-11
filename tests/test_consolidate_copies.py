"""Exercise migration/removal only in disposable repositories, never user files."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "consolidate_copies.py"
spec = importlib.util.spec_from_file_location("consolidate_copies", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ConsolidationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.parent = Path(self.tmp.name)
        self.roots = [self.parent / name for name in module.NAMES]
        self.root, self.primary = self.roots[0], self.roots[-1]
        self.root.mkdir()
        module.git(self.root, "init")
        (self.root / ".gitignore").write_text("data/\n.venv/\nfrontend/node_modules/\n.env\n")
        (self.root / "app.py").write_text("version = 1\n")
        module.git(self.root, "add", ".")
        self.commit(self.root, "base")
        module.git(self.root, "remote", "add", "origin", "https://github.com/Bbarusu/Ia-bbaru.git")
        for i, path in enumerate(self.roots[1:]):
            module.git(self.root, "worktree", "add", "-b", f"test-{i}", str(path))
        (self.primary / "app.py").write_text("version = 2\n")
        module.git(self.primary, "add", ".")
        self.commit(self.primary, "unpublished primary")
        self.head = module.git(self.primary, "rev-parse", "HEAD")
        (self.root / "data").mkdir()
        (self.root / "data" / "old.sqlite3").write_bytes(b"saved local data")
        (self.root / ".env").write_text("private configuration")
        for root in self.roots:
            (root / ".venv").mkdir()
            (root / ".venv" / "dependency").write_text("keep in primary")

    def tearDown(self):
        # Git may set read-only bits on Windows.
        module.shutil.rmtree(self.parent, onexc=module.remove_readonly)
        self.tmp.cleanup()

    @staticmethod
    def commit(path, message):
        module.git(path, "-c", "user.name=Test", "-c", "user.email=test@example.invalid",
                   "commit", "-m", message)

    def test_preview_does_not_write_or_remove(self):
        plan = module.consolidate(self.parent)
        self.assertFalse(plan["apply"])
        self.assertFalse((self.parent / "Backups-Ia-bbaru").exists())
        self.assertTrue(all(p.is_dir() for p in self.roots))
        self.assertTrue((self.primary / ".git").is_file())

    def test_migration_preserves_commits_data_and_dependencies(self):
        refs = module.references(self.root)
        result = module.consolidate(self.parent, apply=True)
        self.assertEqual(result["phase"], "completed")
        self.assertTrue((self.primary / ".git").is_dir())
        self.assertFalse(any(p.exists() for p in self.roots[:-1]))
        self.assertEqual(module.git(self.primary, "status", "--porcelain"), "")
        self.assertEqual(module.git(self.primary, "rev-parse", "HEAD"), self.head)
        self.assertEqual((self.primary / ".venv" / "dependency").read_text(), "keep in primary")
        for name, sha, *symbolic in refs:
            self.assertEqual(module.git(self.primary, "rev-parse", name), sha)
        backup = Path(result["backup"])
        with zipfile.ZipFile(backup / "Ia-bbaru.zip") as saved:
            self.assertEqual(saved.read("data/old.sqlite3"), b"saved local data")
            self.assertEqual(saved.read(".env"), b"private configuration")
            self.assertFalse(any(name.startswith(".venv/") for name in saved.namelist()))
        with zipfile.ZipFile(backup / "shared-git.zip") as saved:
            self.assertIn("HEAD", saved.namelist())
            self.assertIsNone(saved.testzip())
        self.assertFalse((self.primary / ".git" / "objects" / "info" / "alternates").exists())
        self.assertEqual(module.git(self.primary, "worktree", "list", "--porcelain").count("worktree "), 1)

    def test_dirty_or_extra_worktrees_prevent_deletion(self):
        (self.roots[1] / "app.py").write_text("local edit")
        with self.assertRaisesRegex(RuntimeError, "alterações locais"):
            module.consolidate(self.parent, apply=True)
        self.assertTrue(all(p.exists() for p in self.roots))
        module.git(self.roots[1], "restore", "app.py")
        extra = self.parent / "another-worktree"
        module.git(self.root, "worktree", "add", "-b", "extra", str(extra))
        with self.assertRaisesRegex(RuntimeError, "worktrees adicionais"):
            module.consolidate(self.parent, apply=True)
        self.assertFalse((self.parent / "Backups-Ia-bbaru").exists())

    def test_failed_activation_restores_original_link(self):
        real_git = module.git
        def fail_after_swap(path, *args):
            if path == self.primary and (self.primary / ".git").is_dir() and args[0] == "status":
                raise RuntimeError("simulated verification failure")
            return real_git(path, *args)
        with patch.object(module, "git", side_effect=fail_after_swap), self.assertRaises(RuntimeError):
            module.consolidate(self.parent, apply=True)
        self.assertTrue((self.primary / ".git").is_file())
        self.assertTrue(all(p.exists() for p in self.roots))
        self.assertEqual(module.git(self.primary, "rev-parse", "HEAD"), self.head)

    def test_cleanup_failure_keeps_independent_primary_and_backups(self):
        with patch.object(module.shutil, "rmtree", side_effect=PermissionError("locked")), \
                self.assertRaisesRegex(RuntimeError, "principal já é independente"):
            module.consolidate(self.parent, apply=True)
        self.assertTrue((self.primary / ".git").is_dir())
        self.assertEqual(module.git(self.primary, "status", "--porcelain"), "")
        self.assertTrue(all(p.exists() for p in self.roots))
        import json
        manifest = next((self.parent / "Backups-Ia-bbaru").glob("*/manifest.json"))
        report = json.loads(manifest.read_text())
        self.assertEqual(report["phase"], "primary_ready_cleanup_incomplete")
        self.assertTrue((manifest.parent / "shared-git.zip").is_file())


if __name__ == "__main__":
    unittest.main()
