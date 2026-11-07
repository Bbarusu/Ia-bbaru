import sqlite3
import tempfile
import unittest
from pathlib import Path

from backend.store import Store


class StoreConnectionTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.store = Store(Path(self.directory.name) / "test.sqlite3")

    def test_success_commits_and_closes_connection(self):
        with self.store.connect() as conn:
            conn.execute("INSERT INTO projects VALUES (?, ?, ?)",
                         ("saved", "Projeto", "2026-11-06"))

        # Keep a reference alive: closure must not depend on garbage collection.
        with self.assertRaises(sqlite3.ProgrammingError):
            conn.execute("SELECT 1")
        with self.store.connect() as check:
            self.assertEqual(check.execute("SELECT title FROM projects WHERE id='saved'").fetchone()[0],
                             "Projeto")

    def test_exception_rolls_back_and_closes_connection(self):
        with self.assertRaisesRegex(RuntimeError, "abort transaction"):
            with self.store.connect() as conn:
                conn.execute("INSERT INTO projects VALUES (?, ?, ?)",
                             ("discarded", "Projeto", "2026-11-06"))
                raise RuntimeError("abort transaction")

        with self.assertRaises(sqlite3.ProgrammingError):
            conn.execute("SELECT 1")
        with self.store.connect() as check:
            self.assertEqual(check.execute("SELECT COUNT(*) FROM projects").fetchone()[0], 0)


if __name__ == "__main__":
    unittest.main()
