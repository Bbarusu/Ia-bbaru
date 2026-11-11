"""The cleanup inventory must not mistake nested folders or links for copies."""
import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "audit_copies.py"
spec = importlib.util.spec_from_file_location("audit_copies", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class CopyAuditTests(unittest.TestCase):
    def test_nested_directory_is_not_treated_as_a_checkout(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            subprocess.run(["git", "init", str(root)], check=True, capture_output=True)
            nested = root / "Ia-bbaru-old"
            nested.mkdir()
            self.assertIn("error", module.audit(nested, root))

    def test_local_state_is_identified_without_reading_contents(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "data").mkdir()
            (root / "data" / "private.sqlite3").write_text("private")
            (root / ".env").write_text("private credentials")
            (root / ".env.example").write_text("sample")
            (root / "node_modules").mkdir()
            (root / "node_modules" / ".env").write_text("dependency fixture")
            result = module.inventory(root)
            self.assertEqual(result["possible_local_data"], [".env", "data/"])
            self.assertTrue(result["scan_complete"])
            self.assertNotIn("private", str(result))
            self.assertEqual((root / ".env").read_text(), "private credentials")

    def test_uncommitted_file_and_local_commit_are_preserved(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            def git(*args):
                return subprocess.run(["git", "-C", str(root), *args], check=True, capture_output=True)
            git("init")
            git("-c", "user.name=Audit test", "-c", "user.email=audit@example.invalid",
                "commit", "--allow-empty", "-m", "local only")
            (root / "draft.txt").write_text("keep this")
            result = module.audit(root, root)
            self.assertFalse(result["working_tree_clean"])
            self.assertEqual(result["commits_not_in_local_remote_refs"], 1)
            self.assertFalse(result["deletion_authorized_by_report"])
            self.assertEqual((root / "draft.txt").read_text(), "keep this")


if __name__ == "__main__":
    unittest.main()
