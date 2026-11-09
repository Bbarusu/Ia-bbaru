import json
import sqlite3
from contextlib import closing, contextmanager
from pathlib import Path


class Store:
    def __init__(self, path):
        self.path = str(path)
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS sources (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL REFERENCES projects(id),
                    title TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL REFERENCES projects(id),
                    status TEXT NOT NULL, body TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS sources_project ON sources(project_id);
                CREATE INDEX IF NOT EXISTS tasks_project ON tasks(project_id);
            """)

    @contextmanager
    def connect(self):
        with closing(sqlite3.connect(self.path, timeout=10)) as conn, conn:
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA foreign_keys=ON")
            yield conn

    def recover(self):
        # One process/worker only in this MVP. Never retry an uncertain paid call.
        with self.connect() as conn:
            for row in conn.execute("SELECT id, body FROM tasks WHERE status='running'").fetchall():
                body = json.loads(row["body"])
                if body.get("execution", {}).get("mode") == "durable":
                    step = body["execution"]["steps"][len(body["results"])]
                    if step["state"] == "in_flight":
                        step.update(state="uncertain", error_code="process_interrupted_outcome_unknown")
                        body.update(status="uncertain", error="process_interrupted_outcome_unknown")
                    else:
                        body["status"] = "queued"
                else:
                    body.update(status="interrupted", error="process_interrupted_outcome_unknown")
                conn.execute("UPDATE tasks SET status=?, body=? WHERE id=?",
                             (body["status"], json.dumps(body), row["id"]))

    def task(self, task_id):
        with self.connect() as conn:
            row = conn.execute("SELECT body FROM tasks WHERE id=?", (task_id,)).fetchone()
            return json.loads(row["body"]) if row else None

    def save_task(self, body):
        with self.connect() as conn:
            conn.execute("UPDATE tasks SET status=?, body=? WHERE id=?",
                         (body["status"], json.dumps(body), body["id"]))

    def claim(self, task_id):
        with self.connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            row = conn.execute("SELECT body FROM tasks WHERE id=? AND status='planned'", (task_id,)).fetchone()
            if row is None:
                return None
            body = json.loads(row["body"])
            body["status"] = "running"
            conn.execute("UPDATE tasks SET status='running', body=? WHERE id=?",
                         (json.dumps(body), task_id))
            return body

    def enqueue(self, task_id, resume=False):
        with self.connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            row = conn.execute("SELECT body FROM tasks WHERE id=?", (task_id,)).fetchone()
            if row is None:
                return None
            body = json.loads(row["body"])
            if resume:
                if body["status"] != "blocked" or body.get("execution", {}).get("mode") != "durable":
                    return None
                step = body["execution"]["steps"][len(body["results"])]
                step.update(state="pending", error_code=None)
            else:
                if body["status"] != "planned":
                    return None
                body["execution"] = {"mode": "durable", "steps": [
                    {"request_id": f"{body['id']}:{i}", "state": "pending", "attempts": 0}
                    for i in range(len(body["plan"]))]}
            body.update(status="queued", error=None)
            conn.execute("UPDATE tasks SET status='queued', body=? WHERE id=?", (json.dumps(body), task_id))
            return body

    def claim_job(self, now):
        with self.connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            rows = conn.execute("SELECT body FROM tasks WHERE status IN ('queued','waiting') ORDER BY rowid").fetchall()
            for row in rows:
                body = json.loads(row["body"])
                step = body["execution"]["steps"][len(body["results"])]
                if body["status"] == "waiting" and step.get("next_attempt_at", 0) > now:
                    continue
                body["status"] = "running"
                conn.execute("UPDATE tasks SET status='running', body=? WHERE id=?", (json.dumps(body), body["id"]))
                return body
        return None
