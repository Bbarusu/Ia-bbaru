# Transporte Firefox → backend: protocolo v0 implementado

Implementado em `native_host/`, `extension/background.js` e
`frontend/src/transport.ts`. Instalação explícita em `INSTALAR_FIREFOX.md`.
A UI só informa conexão após respostas do host e backend, separadamente.

Identificadores:

- Extensão Firefox: `ia-bbaru@bbarusu.local`.
- Host Native Messaging: `ia_bbaru.bridge`.
- Transporte: UI interna → background → `runtime.connectNative` → host local.
- Backend: HTTP em loopback, com endereço e token definidos na instalação local.
  Não receber endereço, token, shell command ou caminho arbitrário da extensão.

## Envelope

Pedido:

```json
{
  "protocol_version": "0",
  "request_id": "uuid-gerado-pelo-cliente",
  "operation": "projects.list",
  "params": {}
}
```

Resposta de sucesso (exemplo vazio, não dados de uma conta):

```json
{
  "protocol_version": "0",
  "request_id": "uuid-gerado-pelo-cliente",
  "ok": true,
  "data": {"items": []}
}
```

Resposta de erro:

```json
{
  "protocol_version": "0",
  "request_id": "uuid-gerado-pelo-cliente",
  "ok": false,
  "error": {"code": "backend_unavailable", "message": "Backend local indisponível"}
}
```

`request_id` correlaciona mensagens; não é garantia de idempotência. Após timeout
de uma criação, consultar o estado antes de repetir para evitar duplicação.

## Operações do primeiro host

| Operação | Params | Mapeamento HTTP |
| --- | --- | --- |
| bridge.info | {} | Resposta do próprio host, com versão e capacidades |
| health.get | {} | GET /health |
| projects.list | {offset?} | GET /v1/projects?limit=30&offset=… |
| projects.create | {title} | POST /v1/projects |
| sources.list | {project_id,offset?} | GET /v1/projects/{id}/sources?summary=true&limit=20&offset=… |
| sources.create | {project_id,title,content} | POST /v1/projects/{id}/sources |
| sources.get | {project_id,source_id} | GET /v1/projects/{id}/sources/{source_id} |
| models.list | {} | GET /v1/models |
| tasks.list | {project_id,offset?} | GET /v1/projects/{id}/tasks?summary=true&limit=20&offset=… |
| tasks.plan | {project_id,task} | POST /v1/projects/{id}/tasks; task segue TaskInput |
| tasks.get | {task_id} | GET /v1/tasks/{id} |

O host informa em `bridge.info` as operações suportadas e `task_execution: false`.
Listagens retornam `items` e `next_offset` (null no fim). Fontes resumidas contêm
`preview` e `char_count`; tarefas resumidas omitem contexto e resultados extensos.
`tasks.execute` não faz parte desta versão: requer coordenação durável para
que fechar a sidebar não mate uma geração nem cause repetição de uso. Enquanto
isso, a execução síncrona atual continua disponível apenas ao cliente HTTP de
desenvolvimento, sem ser representada como execução suportada pela extensão.

## Garantias e limites implementados

O host valida envelopes estritos, UUIDs e parâmetros por operação. O framing usa
uint32 em ordem nativa + JSON UTF-8, com teto de 900.000 bytes por mensagem.
Respostas acima desse teto retornam erro; não são truncadas nem apresentadas como
resultado completo. Stdout é reservado ao protocolo. Diagnósticos usam stderr.

Somente páginas internas da extensão podem enviar pedidos ao background. O host
não aceita URL, token, comando de shell ou caminho vindo da UI. A configuração
local permite somente HTTP em loopback. O cliente desabilita proxy de ambiente
para essas requisições locais e não segue redirects.

Timeout no host: 15 s. Timeout no background: 20 s. Nenhum deles repete operações
automaticamente. Após timeout, a criação pode ter ocorrido; consultar as listas
antes de repetir. IDs de correlação não são chaves de idempotência do backend.

O instalador autoriza somente `ia-bbaru@bbarusu.local` e só registra o host quando
executado explicitamente com `--register`. A extensão não instala programas.
Framing parcial, subprocesso real, envelopes inválidos e allowlist são testados.
A integração nativa completa no Firefox/Windows permanece uma validação manual.
