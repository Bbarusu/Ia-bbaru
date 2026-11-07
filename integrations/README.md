# Ia-bbaru — gateway de integrações (frente do Claude)

Serviço local separado do backend. Implementa o contrato HTTP v1
(`docs/openapi-gateway.json`) em `http://127.0.0.1:8010` e tem **um** adaptador:
o **Claude Code oficial**, usando o login que o próprio usuário fez pela Anthropic.
O serviço não guarda projetos, fontes nem histórico: isso continua no `backend/`.

Estado: testes automatizados com um dublê do CLI
(`tests/integrations/fixtures/fake_claude.py`), todos passando no Linux e no
Windows do usuário. Com conta real: **uma** geração pequena, autorizada pelo
usuário, passou no Windows dele (Claude Code 2.1.307, login por assinatura).
Depois, o fluxo completo backend → gateway → Claude Code também passou com
uma tarefa real (modo `single`).
Erros reais de cota, login expirado e timeout só foram exercitados com o dublê.
Ver [docs/CONEXOES.md](docs/CONEXOES.md).

## O que já existe

| Item | Estado |
| --- | --- |
| `GET /v1/models` | Catálogo a partir da configuração do operador + estado local. Não chama modelo. |
| `POST /v1/generate` | Uma execução de `claude -p --output-format json`, sem ferramentas. |
| `GET /v1/connections` | **Experimental, fora do v1**: diagnóstico e capacidades reais. |
| `python -m integrations diagnose` | Relatório local sem chamar modelos nem ler arquivos de credencial. |
| Deduplicação persistente | SQLite próprio (`data/integrations.sqlite3`, fora do Git). |
| ChatGPT / Gemini | **Não implementados**; o diagnóstico só informa se o CLI está instalado. |

## Requisitos (Windows)

- Python 3.12 e as dependências de `requirements.txt` (as mesmas do backend).
- Claude Code oficial instalado e no PATH. Confirme no PowerShell: `claude --version`.
  O adaptador foi conferido contra as opções da versão 2.1.319; versões sem
  alguma opção necessária aparecem como `cli_version_unsupported`.
- Login feito por você no fluxo oficial: abra `claude` e use `/login` com a conta
  Claude (Pro/Max/etc.). Confirme com `claude auth status --text`.

## Instalação e inicialização (PowerShell, na raiz do repositório)

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt

# 1) Diagnóstico: não consome cota, não lê tokens.
python -m integrations diagnose

# 2) Configuração (somente variáveis de ambiente; nenhum arquivo .env é lido).
$env:GATEWAY_TOKEN = python -c "import secrets; print(secrets.token_urlsafe(32))"
$env:IA_BBARU_CLAUDE_CODE_MODELS = "sonnet"   # escolha sua; nomes completos são mais estáveis
# Necessário enquanto o contrato não declarar capacidades (ver abaixo):
$env:IA_BBARU_CLAUDE_CODE_ACCEPT_UNENFORCED_OUTPUT_LIMIT = "1"

# 3) Iniciar (um único processo, só em loopback).
python -m integrations serve
```

No terminal do backend, use o **mesmo** `GATEWAY_TOKEN` e
`$env:GATEWAY_URL = "http://127.0.0.1:8010"`. Não reutilize o `LAUNCHER_API_TOKEN`.

Em bash, troque `$env:NOME = valor` por `export NOME=valor` e ative com
`source .venv/bin/activate`.

### Variáveis

| Variável | Padrão | Uso |
| --- | --- | --- |
| `GATEWAY_TOKEN` | — (obrigatório, ≥ 32 caracteres) | Segredo compartilhado com o backend. |
| `IA_BBARU_GATEWAY_DB` | `data/integrations.sqlite3` | Banco de deduplicação (não versionar). |
| `IA_BBARU_CLAUDE_CODE_BIN` | busca `claude` no PATH | Caminho explícito do executável. |
| `IA_BBARU_CLAUDE_CODE_MODELS` | vazio → catálogo vazio | Modelos escolhidos pelo operador, separados por vírgula. |
| `IA_BBARU_CLAUDE_CODE_TASK_KINDS` | os cinco tipos | Adequação configurada, não ranking. |
| `IA_BBARU_CLAUDE_CODE_CONTEXT_CHARS` | 80000 | Limite de entrada em caracteres. |
| `IA_BBARU_CLAUDE_CODE_MAX_OUTPUT_TOKENS` | 4096 | Teto pedido ao CLI (não garantido, ver abaixo). |
| `IA_BBARU_CLAUDE_CODE_TIMEOUT_S` | 90 | Entre 5 e 110 s; o backend desiste em 120 s. |
| `IA_BBARU_CLAUDE_CODE_ACCEPT_UNENFORCED_OUTPUT_LIMIT` | desligado | Ver "Limite de saída". |

`ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`, as variáveis de
Bedrock/Vertex/Foundry, `GATEWAY_TOKEN` e `LAUNCHER_API_TOKEN` **são removidas** do
ambiente do processo do Claude Code. Em modo `-p`, a documentação oficial diz que
uma `ANTHROPIC_API_KEY` presente é sempre usada no lugar da assinatura; removê-la
evita trocar silenciosamente para cobrança de API.

## Como a chamada é feita

```
claude --print "<pedido fixo>" --output-format json --model <modelo configurado>
       --system-prompt "<prompt do Ia-bbaru>" --tools "" --strict-mcp-config
       --safe-mode --no-session-persistence --disable-slash-commands
       --permission-prompts none
```

- Executado numa pasta temporária vazia (nenhum CLAUDE.md, configuração de projeto
  ou arquivo do usuário fica ao alcance). Sem ferramentas, MCP, plugins nem hooks.
- Pedido, fontes e resposta anterior vão pela entrada padrão como **um documento
  JSON**; o prompt de sistema declara fontes e resposta anterior como dados não
  confiáveis. Nada disso aparece na linha de comando nem em logs.
- `--bare` **não** é usado: segundo a documentação, ele ignora o login por assinatura.
- Nenhum `--fallback-model`: o modelo vem só do `model_id` pedido.
- Timeout derruba a árvore de processos (`taskkill /T` no Windows).

## Limite de saída: por que o modelo vem `available: false` por padrão

O contrato v1 trata `max_output_tokens` como teto. O Claude Code só oferece a
variável `CLAUDE_CODE_MAX_OUTPUT_TOKENS`, documentada para "a maioria das
requisições", e matar o processo não limita a cota consumida. Por isso:

1. Sem `IA_BBARU_CLAUDE_CODE_ACCEPT_UNENFORCED_OUTPUT_LIMIT=1`, o catálogo lista os
   modelos configurados como indisponíveis e `/v1/generate` responde 503 com
   `provider_output_limit_not_enforced`. Não há chamada.
2. Com a opção ligada, o gateway passa o teto ao CLI e confere o uso devolvido:
   se `output_tokens` passar do teto, responde 502 `output_limit_not_honored` em vez
   de entregar como se o limite tivesse sido respeitado.
3. `finish_reason` é inferido: `length` quando o uso alcança o teto (ou se o CLI
   devolver `stop_reason: max_tokens`, campo não documentado), senão `stop`.

A evolução proposta do contrato está em
[docs/PROPOSTA_CAPACIDADES.md](docs/PROPOSTA_CAPACIDADES.md) e precisa ser acordada
com o Codex antes de ser consumida pelo backend.

## Exemplos completos (gerados com o dublê de teste, não com a conta real)

`GET /v1/models` com `IA_BBARU_CLAUDE_CODE_MODELS=sonnet`, login ativo e a opção
de limite aceita (`sonnet` é um exemplo de configuração, não um catálogo do provedor):

```json
{
  "protocol_version": "1",
  "models": [{
    "id": "claude-code:sonnet",
    "provider": "claude-code",
    "label": "Claude Code (sonnet) - assinatura",
    "available": true,
    "task_kinds": ["general", "study", "writing", "coding", "analysis"],
    "context_char_limit": 80000,
    "max_output_tokens": 4096
  }]
}
```

`POST /v1/generate`:

```json
{
  "protocol_version": "1",
  "request_id": "uuid-da-tarefa:0",
  "model_id": "claude-code:sonnet",
  "role": "answer",
  "instruction": "Explique o conteúdo da aula",
  "context": [{"id": "uuid-da-fonte", "title": "Aula 1", "content": "Texto da fonte selecionada"}],
  "previous_output": null,
  "max_output_tokens": 4096
}
```

Resposta (texto e números vêm do dublê):

```json
{
  "protocol_version": "1",
  "request_id": "uuid-da-tarefa:0",
  "model_id": "claude-code:sonnet",
  "output": "Resposta do dublê de teste",
  "usage": {"input_tokens": 120, "output_tokens": 42},
  "provider_request_id": null,
  "finish_reason": "stop"
}
```

## Erros

Corpo sempre `{"error":{"code":"...","message":"...","next_action":"..."}}`
(`next_action` só quando há algo a fazer). Nenhum texto do provedor, prompt ou
caminho local é devolvido.

| HTTP | Códigos |
| --- | --- |
| 401 | `invalid_gateway_token` |
| 422 | `invalid_request`, `unknown_model`, `context_too_large`, `max_output_tokens_above_profile`, `missing_previous_output` |
| 409 | `request_id_conflict`, `request_in_progress`, `request_outcome_uncertain` |
| 429 | `gateway_busy` (já há uma geração em curso), `provider_quota_exceeded` |
| 502 | `provider_error`, `provider_invalid_output`, `provider_empty_output`, `output_limit_not_honored`, `provider_model_mismatch` |
| 503 | `provider_cli_not_installed`, `provider_not_logged_in`, `provider_not_subscription_login`, `provider_output_limit_not_enforced`, `provider_not_authenticated`, ... |
| 504 | `provider_timeout` (a chamada pode ter consumido cota) |

A classificação de login expirado e limite de uso usa o texto devolvido pelo CLI
(heurística, testada só com o dublê).

## Deduplicação

Chave: `request_id` + SHA-256 do payload canônico.

- Concluída → mesma resposta (inclusive erros 502 armazenados), sem nova chamada.
- Mesmo `request_id` com outro payload → 409 `request_id_conflict`.
- Em andamento → 409 `request_in_progress`.
- Timeout ou queda do processo durante a chamada → 409 `request_outcome_uncertain`
  para sempre; o gateway nunca repete por conta própria.
- Erros antes de iniciar o CLI (validação, não configurado) e recusas sem geração
  (sem login, cota esgotada) liberam o `request_id`.

## Testes

```powershell
python -m unittest discover -s tests -v                # backend (inalterado)
python -m unittest discover -s tests/integrations -v   # gateway, com dublê
```

As integrações rodam numa descoberta separada porque `tests/integrations/` teria
o mesmo nome do pacote `integrations`.

Teste real **opcional**, uma geração pequena que consome cota da assinatura. Só
rode depois de fazer login e decidir gastar esse uso:

```powershell
$env:IA_BBARU_REAL_TEST = "claude-code"
$env:IA_BBARU_CLAUDE_CODE_MODELS = "sonnet"
python -m unittest discover -s tests/integrations -p "test_real_*.py" -v
```

## Uso pessoal: condição importante

Os termos atuais do Claude Code permitem que o usuário final use o **binário
oficial, sem modificações, com a própria assinatura**. Eles também dizem que
desenvolvedores não podem oferecer login Claude.ai em produtos próprios nem
encaminhar requisições usando credenciais de planos Free/Pro/Max/Ultra em nome
de outros usuários, e recomendam chave de API para produtos que usam o Claude.
Este gateway foi feito para **uso local e pessoal**: cada pessoa roda o próprio
Claude Code com o próprio login. Não publique este serviço para terceiros nem
o use para atender outras contas. Fonte:
https://code.claude.com/docs/en/legal-and-compliance (consultado em 7/11/2026).
