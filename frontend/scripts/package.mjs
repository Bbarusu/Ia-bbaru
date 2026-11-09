import { cp, mkdir, rm } from 'node:fs/promises';
await rm('../extension/app', { recursive: true, force: true });
await mkdir('../extension/app', { recursive: true });
await cp('dist', '../extension/app', { recursive: true, force: true });
console.log('Extensão pronta em extension/. Carregue manifest.json no Firefox.');
