const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '../..');
const venv = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const python = process.env.IA_BBARU_PYTHON || (fs.existsSync(venv) ? venv : process.platform === 'win32' ? 'python' : 'python3');
const result = spawnSync(python, [path.join(root, 'scripts/build_icons.py')], { stdio: 'inherit', shell: false });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
