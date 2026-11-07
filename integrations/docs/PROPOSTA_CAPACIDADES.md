# Proposta: contrato do gateway por capacidades (v1.1, aditiva)

**Estado: proposta para o Codex. Nada aqui foi alterado em `backend/contracts.py`
nem em `docs/openapi-gateway.json`.** O gateway continua cumprindo o v1 sem
mudanças. O briefing pede que a evolução seja combinada antes de conectar um
transporte que não garante `max_output_tokens`. Este documento é esse pedido.

## Problema

O v1 trata `max_output_tokens` como teto garantido e `finish_reason` como um fato.
Os transportes por assinatura não garantem isso:

- Claude Code: teto só via `CLAUDE_CODE_MAX_OUTPUT_TOKENS` ("a maioria das
  requisições"); sem motivo de parada documentado; cancelamento só local.
- Sign in with ChatGPT (segundo `docs/ASSINATURAS.md`): sem `max_output_tokens`.

Hoje o gateway resolve isso de forma conservadora: modelos indisponíveis por padrão,
opção explícita do operador e erro 502 se o uso passar do teto. Funciona, mas o
backend não consegue **mostrar** ao usuário por que o modelo está indisponível nem
qual garantia ele tem.

## Mudanças propostas (todas opcionais para manter compatibilidade)

### 1. `ModelProfile.capabilities` (novo, opcional)

```json
{
  "id": "claude-code:sonnet",
  "provider": "claude-code",
  "label": "Claude Code (sonnet) - assinatura",
  "available": true,
  "task_kinds": ["general", "study"],
  "context_char_limit": 80000,
  "max_output_tokens": 4096,
  "capabilities": {
    "output_limit": "best_effort",
    "cancellation": "local_process_only",
    "finish_reason": "inferred",
    "billing": "subscription_quota",
    "streaming": false,
    "tools": "disabled"
  },
  "unavailable_reason": null
}
```

| Campo | Valores | Significado |
| --- | --- | --- |
| `output_limit` | `enforced` \| `best_effort` \| `none` | `enforced` = o provedor recebe e respeita o teto (APIs com chave). |
| `cancellation` | `provider` \| `local_process_only` \| `none` | `local_process_only` não deve ser apresentado como limite de cobrança. |
| `finish_reason` | `reported` \| `inferred` | Se o motivo de parada vem do provedor ou é deduzido. |
| `billing` | `api_key` \| `subscription_quota` \| `unknown` | Somente informativo; nunca muda automaticamente. |
| `streaming` | bool | |
| `tools` | `disabled` \| `restricted` | |
| `unavailable_reason` | string \| null | Código estável, por exemplo `not_logged_in`, `output_limit_not_enforced`. |

Ausência de `capabilities` = comportamento v1 atual (`enforced`, `reported`).

### 2. Política do backend (decisão do Codex/usuário)

- O backend só roteia para `output_limit != "enforced"` se o usuário aceitar isso
  explicitamente (por exemplo, `allow_unenforced_output_limit: true` na tarefa).
  Com isso, a variável `IA_BBARU_CLAUDE_CODE_ACCEPT_UNENFORCED_OUTPUT_LIMIT` do
  gateway deixa de ser necessária.
- A interface deve mostrar `billing` e `output_limit` ao escolher agentes.

### 3. `GenerateResponse.finish_reason` (opcional)

Acrescentar `"unknown"` ao enum quando `capabilities.finish_reason == "inferred"`
e não houver evidência. O backend trataria `unknown` como `stop`, com aviso
visível. **Isso quebra consumidores v1 estritos** (`Literal["stop","length"]`), então
só deve ser enviado quando o backend anunciar suporte (por exemplo, enviando
`protocol_version: "1.1"`). Até lá o gateway continua inferindo `stop`/`length`.

### 4. `GET /v1/connections` (já existe no gateway como experimental)

Diagnóstico por conexão: instalado, versão, login, motivo e próxima ação. Útil
para a tela de configuração do Gemini. Formato atual em `integrations/app.py`.
Pode virar parte do contrato ou continuar como extensão.

## Compatibilidade

- 1 e 4 são aditivos para o cliente atual (`HttpGateway` valida com
  `extra="forbid"`: **o campo novo em `ModelProfile` quebraria a validação atual**.
  Por isso o gateway só vai enviar `capabilities` depois que `backend/contracts.py`
  aceitar o campo).
- 2 é mudança de comportamento do backend.
- 3 exige negociação de versão.

## O que precisa mudar em cada lado, se aceito

| Lado | Arquivos |
| --- | --- |
| Codex | `backend/contracts.py`, `docs/openapi-gateway.json` (via `docs/export_contracts.py`), roteamento e testes do backend |
| Claude | `integrations/app.py` e `integrations/adapters/claude_code.py` passam a enviar `capabilities`; testes em `tests/integrations/` |
| Gemini | Exibir `billing`, `output_limit` e `unavailable_reason` |
