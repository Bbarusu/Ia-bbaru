"""Read-only diagnostic must not export text or create missing databases."""
import json
from pathlib import Path
import sqlite3
from contextlib import closing
import tempfile
import unittest
from uuid import uuid4
from scripts.inspect_saved_response import inspect


class SavedResponseTests(unittest.TestCase):
    def test_compare_without_content_or_database_changes(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            backend, gateway = root/'backend.db', root/'gateway.db'
            task_id = str(uuid4())
            answer = 'PRIVATE-page-text-final-tail'
            with closing(sqlite3.connect(backend)) as conn, conn:
                conn.execute('CREATE TABLE tasks(id TEXT,body TEXT)')
                conn.execute('INSERT INTO tasks VALUES (?,?)', (task_id, json.dumps({
                    'status': 'completed', 'output': answer, 'results': [{'output': answer}]})))
            with closing(sqlite3.connect(gateway)) as conn, conn:
                conn.execute('CREATE TABLE generate_requests(request_id TEXT,state TEXT,status_code INTEGER,body TEXT)')
                conn.execute('INSERT INTO generate_requests VALUES (?,?,?,?)', (task_id+':0', 'completed', 200,
                    json.dumps({'output': answer, 'finish_reason': 'stop', 'usage': {'output_tokens': 20}})))
            before = (backend.read_bytes(), gateway.read_bytes())
            result = inspect(backend, gateway, task_id)
            self.assertTrue(result['gateway_equals_backend_step'])
            self.assertEqual(result['gateway_output']['characters'], len(answer))
            self.assertNotIn('PRIVATE', json.dumps(result))
            self.assertEqual(before, (backend.read_bytes(), gateway.read_bytes()))

    def test_missing_database_is_not_created(self):
        with tempfile.TemporaryDirectory() as folder:
            missing = Path(folder)/'missing.db'
            with self.assertRaises(sqlite3.OperationalError):
                inspect(missing, missing, str(uuid4()))
            self.assertFalse(missing.exists())
