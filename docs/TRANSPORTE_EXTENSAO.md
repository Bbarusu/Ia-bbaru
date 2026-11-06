# Transporte Firefox → backend: proposta v0

**Proposta para implementação por Codex. Não existe host Native Messaging nesta
entrega.** Gemini pode implementar o cliente desacoplado e o estado indisponível;
não deve mostrar a ponte como conectada até a troca real de mensagens funcionar.

Identificadores propostos:

- Extensão Firefox: `ia-bbaru@bbarusu.local`.
- Host Native Messaging: `ia_bbaru.bridge`.
- Transporte: UI interna → background → `runtime.connectNative` → host local.
- Backend: HTTP em loopback, com endereço e token definidos na instalação local.
  Não receber endereço, token, shell command ou caminho arbitrário da extensão.

## Envelope proposto

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

## Operações propostas para o primeiro host

| Operação | Params | Mapeamento HTTP |
| --- | --- | --- |
| bridge.info | {} | Resposta do próprio host, com versão e capacidades |
| health.get | {} | GET /health |
| projects.list | {} | GET /v1/projects |
| projects.create | {title} | POST /v1/projects |
| sources.list | {project_id} | GET /v1/projects/{id}/sources |
| sources.create | {project_id,title,content} | POST /v1/projects/{id}/sources |
| models.list | {} | GET /v1/models |
| tasks.list | {project_id} | GET /v1/projects/{id}/tasks |
| tasks.plan | {project_id,task} | POST /v1/projects/{id}/tasks; task segue TaskInput |
| tasks.get | {task_id} | GET /v1/tasks/{id} |

O host deve informar em `bridge.info` quais operações realmente suporta.
`tasks.execute` não faz parte da proposta inicial: requer coordenação durável para
que fechar a sidebar não mate uma geração nem cause repetição de uso. Enquanto
isso, a execução síncrona atual continua disponível apenas ao cliente HTTP de
desenvolvimento, sem ser representada como execução suportada pela extensão.

## Requisitos de implementação

Validar envelopes estritos, IDs, allowlist de operações, tamanho de mensagem e
respostas correlacionadas. O framing de Native Messaging usa tamanho uint32 na
ordem de bytes nativa e JSON UTF-8. Stdout é reservado ao protocolo; diagnósticos
vão para stderr sem segredos. Definir teto próprio abaixo dos limites do navegador,
incluindo listagens grandes; paginar no backend antes de prometer histórico ilimitado.

O manifesto do host autoriza apenas a identidade da extensão. Testar framing
parcial, desconexão, dados inválidos e recusa de comandos desconhecidos. O instalador
local deve explicar registro/remoção do host no Windows, sem modificar perfis de
outros navegadores. Não instalar nem alterar registro no computador do usuário
como efeito de simplesmente abrir a página do projeto.
