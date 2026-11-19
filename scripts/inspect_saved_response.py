"""Compare a saved gateway response and backend task without generation/content export."""
import argparse
from contextlib import closing
import hashlib
import json
from pathlib import Path
import sqlite3
from uuid import UUID


def read(path, sql, args):
    with closing(sqlite3.connect(Path(path).resolve().as_uri() + '?mode=ro', uri=True)) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(sql, args).fetchone()
        return dict(row) if row else None


def stats(value):
    if not isinstance(value, str):
        return None
    return {'characters': len(value), 'utf8_bytes': len(value.encode()),
            'sha256': hashlib.sha256(value.encode()).hexdigest()}


def inspect(backend, gateway, task_id, step=0):
    task_id = str(UUID(task_id))
    task_row = read(backend, 'SELECT body FROM tasks WHERE id=?', (task_id,))
    response_row = read(gateway, 'SELECT state,status_code,body FROM generate_requests WHERE request_id=?', (f'{task_id}:{step}',))
    if not task_row or not response_row:
        raise ValueError('Task or gateway request not found in the specified databases')
    task = json.loads(task_row['body'])
    response = json.loads(response_row['body']) if response_row['body'] else {}
    result = task.get('results', [])[step] if len(task.get('results', [])) > step else {}
    left, right = response.get('output'), result.get('output')
    return {'task_id': task_id, 'step': step, 'task_status': task['status'],
            'gateway_state': response_row['state'], 'http_status': response_row['status_code'],
            'gateway_output': stats(left), 'backend_step_output': stats(right), 'task_output': stats(task.get('output')),
            'gateway_equals_backend_step': left == right if isinstance(left, str) and isinstance(right, str) else None,
            'gateway_finish_reason': response.get('finish_reason'), 'usage': response.get('usage'),
            'note': 'Only lengths, hashes and execution metadata. No generation or database modification.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backend', required=True)
    parser.add_argument('--gateway', required=True)
    parser.add_argument('--task-id', required=True)
    parser.add_argument('--step', type=int, default=0)
    args = parser.parse_args()
    if args.step < 0:
        parser.error('step must be nonnegative')
    print(json.dumps(inspect(args.backend, args.gateway, args.task_id, args.step), indent=2))
