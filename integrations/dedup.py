"""Persistent request deduplication (briefing rule 4).

One row per request_id with the SHA-256 of the canonical payload:
- completed: repeated calls get the stored response (success or provider error);
- running: another call with the same ID gets 409, no second provider call;
- uncertain: timeout or crash after the provider started; 409, never re-run.
Rows are reserved only right before the provider is invoked, so validation
errors and "not configured" answers do not burn a request_id.
"""
import hashlib
import json
import sqlite3
import threading
import time
from contextlib import closing, contextmanager
from dataclasses import dataclass
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS generate_requests (
    request_id TEXT PRIMARY KEY,
    payload_hash TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('running', 'completed', 'uncertain')),
    status_code INTEGER,
    body TEXT,
    created_at REAL NOT NULL,
    updated_at REAL NOT NULL
)
"""
# Sanitized failure signatures (integrations/failures.py), newest kept.
FAILURES_SCHEMA = """
CREATE TABLE IF NOT EXISTS failure_signatures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id TEXT NOT NULL,
    code TEXT NOT NULL,
    signature TEXT NOT NULL,
    created_at REAL NOT NULL
)
"""
FAILURES_KEPT = 200


def payload_hash(payload: dict) -> str:
    canonical = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


@dataclass
class Existing:
    payload_hash: str
    state: str
    status_code: int | None
    body: dict | None


class DedupStore:
    def __init__(self, path: Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        with self._connect() as conn:
            conn.execute(SCHEMA)
            conn.execute(FAILURES_SCHEMA)
            # A previous process died mid-call: the provider may have run.
            conn.execute(
                "UPDATE generate_requests SET state='uncertain', updated_at=? WHERE state='running'",
                (time.time(),),
            )

    @contextmanager
    def _connect(self):
        with closing(sqlite3.connect(self.path, timeout=10, isolation_level=None)) as conn:
            conn.execute("PRAGMA journal_mode=WAL")
            yield conn

    def get(self, request_id: str) -> Existing | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT payload_hash, state, status_code, body FROM generate_requests WHERE request_id=?",
                (request_id,),
            ).fetchone()
        if row is None:
            return None
        return Existing(row[0], row[1], row[2], json.loads(row[3]) if row[3] else None)

    def reserve(self, request_id: str, digest: str) -> bool:
        """Atomically mark as running. False if another call reserved it first."""
        now = time.time()
        with self._lock, self._connect() as conn:
            try:
                conn.execute(
                    "INSERT INTO generate_requests VALUES (?, ?, 'running', NULL, NULL, ?, ?)",
                    (request_id, digest, now, now),
                )
                return True
            except sqlite3.IntegrityError:
                return False

    def release(self, request_id: str):
        """Drop a reservation when the provider was never started."""
        with self._lock, self._connect() as conn:
            conn.execute("DELETE FROM generate_requests WHERE request_id=? AND state='running'", (request_id,))

    def complete(self, request_id: str, status_code: int, body: dict):
        self._finish(request_id, "completed", status_code, body)

    def mark_uncertain(self, request_id: str, status_code: int, body: dict):
        self._finish(request_id, "uncertain", status_code, body)

    def record_failure(self, request_id: str, code: str, signature: dict):
        with self._lock, self._connect() as conn:
            conn.execute(
                "INSERT INTO failure_signatures (request_id, code, signature, created_at) VALUES (?, ?, ?, ?)",
                (request_id, code, json.dumps(signature, ensure_ascii=False), time.time()),
            )
            conn.execute(
                "DELETE FROM failure_signatures WHERE id <= (SELECT MAX(id) FROM failure_signatures) - ?",
                (FAILURES_KEPT,),
            )

    def failures(self, limit: int = 20) -> list[dict]:
        return read_failures(self.path, limit)

    def _finish(self, request_id, state, status_code, body):
        with self._lock, self._connect() as conn:
            conn.execute(
                "UPDATE generate_requests SET state=?, status_code=?, body=?, updated_at=? WHERE request_id=?",
                (state, status_code, json.dumps(body, ensure_ascii=False), time.time(), request_id),
            )


def read_failures(path: Path, limit: int = 20) -> list[dict]:
    """Read-only view for `python -m integrations failures`. Safe while the
    gateway runs: it never touches generate_requests (opening a DedupStore
    would mark running rows as uncertain)."""
    uri = Path(path).resolve().as_uri() + "?mode=ro"
    with closing(sqlite3.connect(uri, uri=True, timeout=10)) as conn:
        try:
            rows = conn.execute(
                "SELECT request_id, code, signature, created_at FROM failure_signatures ORDER BY id DESC LIMIT ?",
                (limit,),
            ).fetchall()
        except sqlite3.OperationalError:  # database from before this table existed
            return []
    return [{"request_id": r[0], "code": r[1], "at": time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(r[3])),
             **json.loads(r[2])} for r in rows]
