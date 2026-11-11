> Direção vigente: [Claude exclusivo](https://github.com/Bbarusu/Ia-bbaru/blob/codex/browser-capture-clis/docs/DIRECAO_CLAUDE_ONLY.md). As referências abaixo a outros provedores são histórico; não reinstalar suas integrações.

# Ia-bbaru — gateway de integrações (frente do Claude)

Serviço local separado do backend, em `http://127.0.0.1:8010`. Implementa o
contrato 1 (`docs/openapi-gateway.json`, inalterado) e o contrato **1.1** definido
em `docs/DECISAO_CAPACIDADES.md` (branch do Codex), com schema próprio em
[docs/openapi-gateway-1.1.json](docs/openapi-gateway-1.1.json). Tem **um** adaptador:
o **Claude Code oficial**, usando o login que o próprio usuário fez pela Anthropic.
O serviço não guarda projetos, fontes nem histórico: isso continua no `backend/`.

Estado: testes automatizados com um dublê do CLI
(`tests/integrations/fixtures/fake_claude.py`), todos passando no Linux e no
Windows do usuário. Com conta real: **uma** geração pequena, autorizada pelo
usuário, passou no Windows dele (Claude Code 2.1.307, login por assinatura).
Depois, o fluxo completo backend → gateway → Claude Code também passou com
uma tarefa real (modo `single`).
Esses testes reais usaram o contrato 1, **antes** das correções da revisão do Codex
(`docs/REVISAO_CLAUDE.md`) e do contrato 1.1. Depois das correções, o teste real pelo contrato 1.1 passou no Windows do usuário (Claude Code 2.1.307, `sonnet`, teto 64): resposta `laranja`, `usage` 913/5 e `finish_reason: stop`. Como a contagem de tokens não é mais usada, esse `stop` prova que o CLI informou `stop_reason` (`end_turn` ou `stop_sequence`).
O fluxo backend → gateway ainda precisa ser repetido depois que o backend adotar o 1.1.
Erros reais de cota, login expirado e timeout só foram exercitados com o dublê.
**Rodada atual (somente Claude):** [docs/PASSAGEM_CLAUDE_ONLY.md](docs/PASSAGEM_CLAUDE_ONLY.md).
**Passagem anterior ao Codex:** [docs/PASSAGEM_CODEX.md](docs/PASSAGEM_CODEX.md).
**Navegador (revisão e roteiro para o Gemini):** [docs/PASSAGEM_GEMINI_NAVEGADOR.md](docs/PASSAGEM_GEMINI_NAVEGADOR.md).
**Primeiro início no Windows:** [docs/PRIMEIRO_INICIO.md](docs/PRIMEIRO_INICIO.md)
(`integrations/scripts/iniciar-ia-bbaru.ps1`).
Ver [docs/CONEXOES.md](docs/CONEXOES.md), o registro em
[docs/VALIDACAO.md](docs/VALIDACAO.md) e os comandos do teste prático em
[docs/TESTE_PRATICO_1_1.md](docs/TESTE_PRATICO_1_1.md).

## O que já existe

| Item | Estado |
| --- | --- |
| `GET /v1/models`, `POST /v1/generate` | Contrato 1, legado. Formato inalterado. |
| `GET /v1.1/models` | Catálogo 1.1: disponibilidade do transporte, `capabilities` obrigatórias e `unavailable_reason`. Não chama modelo. |
| `POST /v1.1/generate` | Exige `allow_unenforced_output_limit: true` da tarefa; `finish_reason` pode ser `unknown`. |
| `GET /v1/connections` | **Experimental, fora dos contratos**: diagnóstico. |
| `python -m integrations diagnose` | Relatório local sem chamar modelos nem ler arquivos de credencial. |
| Deduplicação persistente | SQLite próprio (`data/integrations.sqlite3`, fora do Git). |
| ChatGPT (Codex CLI) e Gemini CLI | Adaptadores **só no contrato 1.1**, sem conta real testada. ChatGPT com `tools: restricted` (o backend ainda recusa no plano); Gemini com `tools: disabled`. Ver [docs/PASSAGEM_CLIS.md](docs/PASSAGEM_CLIS.md). |

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
| `IA_BBARU_CLAUDE_CODE_MODELS` | vazio → catálogo vazio | Modelos escolhidos pelo operador, separados por vírgula. Só `sonnet`, `haiku`, `opus`, `fable` (`[1m]` só em sonnet/opus/fable) ou um nome completo `claude-...`: o modelo que respondeu precisa ser conferível. `best`, `opusplan` e `default` são recusados na inicialização. |
| `IA_BBARU_CLAUDE_CODE_MODEL_TASK_KINDS` | perfil da família | JSON `{"modelo": ["tipo", ...]}`; ver [PASSAGEM_CLAUDE_ONLY.md](docs/PASSAGEM_CLAUDE_ONLY.md). |
| `IA_BBARU_CLAUDE_CODE_TASK_KINDS` | os cinco tipos | Adequação configurada, não ranking. |
| `IA_BBARU_CLAUDE_CODE_CONTEXT_CHARS` | 80000 | Limite de entrada em caracteres. |
| `IA_BBARU_CLAUDE_CODE_MAX_OUTPUT_TOKENS` | 4096 | Teto pedido ao CLI (não garantido, ver abaixo). |
| `IA_BBARU_CLAUDE_CODE_TIMEOUT_S` | 90 | Entre 5 e 110 s; o backend desiste em 120 s. |
| `IA_BBARU_CLAUDE_CODE_ACCEPT_UNENFORCED_OUTPUT_LIMIT` | desligado | Só contrato 1 (legado). Ver "Contratos 1 e 1.1". |

`ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`, as variáveis de
Bedrock/Vertex/Foundry, `GATEWAY_TOKEN` e `LAUNCHER_API_TOKEN` **são removidas** do
ambiente do processo do Claude Code. Em modo `-p`, a documentação oficial diz que
uma `ANTHROPIC_API_KEY` presente é sempre usada no lugar da assinatura; removê-la
evita trocar silenciosamente para cobrança de API.
Também são removidas as variáveis que redirecionam aliases ou o catálogo de modelos
(`ANTHROPIC_MODEL`, `ANTHROPIC_DEFAULT_{SONNET,OPUS,HAIKU,FABLE}_MODEL`,
`CLAUDE_CODE_MODEL_CATALOG(_URL)` e outras; lista em `integrations/runner.py`).

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
- Nenhum `--fallback-model` e `CLAUDE_CODE_NO_MODEL_FALLBACK=1` no processo: a CLI
  não pode trocar de modelo por sobrecarga, falta de acesso ou recusa. Mesmo assim, o
  `modelUsage` do resultado é conferido: saída de outro modelo → `provider_model_mismatch`;
  sem `modelUsage` → `provider_invalid_output` (502, finais, sem repetição).
- Timeout derruba a árvore de processos (`taskkill /T` no Windows).

## Contratos 1 e 1.1: limite de saída e término

O Claude Code não garante o teto de saída: só há a variável
`CLAUDE_CODE_MAX_OUTPUT_TOKENS`, documentada para "a maioria das requisições", e
matar o processo não limita a cota consumida. Capacidades reais declaradas no 1.1:

| Capacidade | Valor |
| --- | --- |
| `output_limit` | `best_effort` |
| `cancellation` | `local_process_only` |
| `finish_reason` | `reported`: vem do `stop_reason` do CLI; sem ele, `unknown` |
| `billing` | `subscription_quota` |
| `streaming` | `false` |
| `tools` | `disabled` |

**Contrato 1.1** (`/v1.1/*`):
- `available` indica só se o transporte está pronto; `unavailable_reason` explica
  quando não está (`not_logged_in`, `not_subscription_login`, `cli_not_installed`...).
- `/v1.1/generate` sem `allow_unenforced_output_limit: true` responde 422
  `output_limit_not_accepted` **antes** de iniciar o CLI. A variável
  `IA_BBARU_CLAUDE_CODE_ACCEPT_UNENFORCED_OUTPUT_LIMIT` não substitui esse aceite.
- Com o aceite, a saída é entregue mesmo se passar do teto indicativo.
- `finish_reason`: `stop` só com `stop_reason` `end_turn`/`stop_sequence`; `length`
  só com `max_tokens`; ausente, `null` ou outro valor (por exemplo `refusal`) →
  `unknown`. Contagem de tokens nunca é usada para adivinhar truncamento.

**Contrato 1** (`/v1/*`, legado):
1. Sem `IA_BBARU_CLAUDE_CODE_ACCEPT_UNENFORCED_OUTPUT_LIMIT=1`, os modelos vêm
   indisponíveis e `/v1/generate` responde 503 `provider_output_limit_not_enforced`.
   A instalação do aplicativo não deve ligar essa variável.
2. Com ela, `output_tokens` acima do teto vira 502 `output_limit_not_honored`.
3. O contrato 1 não tem valor para término não confirmado: nesse caso o gateway
   responde 502 `completion_unconfirmed` em vez de fabricar `stop` ou `length`.

`stop_reason` faz parte do schema de resultado embutido no CLI (visto na 2.1.319,
anulável), mas não da documentação pública do modo headless.

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
| 422 | `invalid_request`, `unknown_model`, `context_too_large`, `max_output_tokens_above_profile`, `missing_previous_output`, `output_limit_not_accepted` (1.1) |
| 409 | `request_id_conflict`, `request_in_progress`, `request_outcome_uncertain` (também na primeira resposta quando o gateway falha de forma inesperada depois de iniciar o CLI) |
| 429 | `gateway_busy` (já há uma geração em curso), `provider_quota_exceeded` |
| 502 | `provider_error`, `provider_invalid_output`, `provider_empty_output`, `provider_model_mismatch`, `output_limit_not_honored` (1), `completion_unconfirmed` (1) |
| 503 | `provider_cli_not_installed`, `provider_not_logged_in`, `provider_not_subscription_login`, `provider_output_limit_not_enforced`, `provider_not_authenticated`, ... |
| 504 | `provider_timeout` (a chamada pode ter consumido cota) |

Cada falha de geração grava uma assinatura **sanitizada** (sem texto da
CLI, pedido, fontes ou stderr) no banco do gateway. Consulta somente leitura:
`python -m integrations failures --limit 3`. Ver a seção P0 de
[PASSAGEM_CLAUDE_ONLY.md](docs/PASSAGEM_CLAUDE_ONLY.md).

A classificação de login expirado e limite de uso usa o texto devolvido pelo CLI
(heurística, testada só com o dublê).

## Deduplicação

Chave: `request_id` + SHA-256 do payload canônico.

- Concluída → mesma resposta, inclusive erros armazenados (502, cota 429, login
  503), sem nova chamada.
- Mesmo `request_id` com outro payload → 409 `request_id_conflict`.
- Em andamento → 409 `request_in_progress`.
- Timeout ou queda do processo durante a chamada → 409 `request_outcome_uncertain`
  para sempre; o gateway nunca repete por conta própria.
- Só libera o `request_id` o que acontece **antes** de o CLI iniciar: validação,
  falta de aceite, modelo indisponível ou processo que não chegou a abrir. Depois
  de iniciado, o texto de erro do CLI não prova que não houve consumo.
- A chave inclui a versão: o mesmo `request_id` em `/v1` e `/v1.1` dá 409.

## Testes

```powershell
python -m unittest discover -s tests -v                # backend (inalterado)
python -m unittest discover -s tests/integrations -v   # gateway, com dublê
```

As integrações rodam numa descoberta separada porque `tests/integrations/` teria
o mesmo nome do pacote `integrations`.

Com o navegador Chromium do Codex (`codex/chromium-browser`), numa pasta que junte
as duas branches e depois de `npm --prefix desktop ci` e `npm --prefix desktop run build`:
`node tests/integrations/desktop_gateway_smoke.cjs` (com `IA_BBARU_PYTHON` apontando
para o Python do projeto). Abre o Electron real ligado a este gateway, com o dublê do
CLI, e não gera nada. Guia completo do Windows em
[docs/TESTE_PRATICO_1_1.md](docs/TESTE_PRATICO_1_1.md).

Atualizar o schema 1.1 publicado depois de mudar `contracts_v1_1.py`:
`python -m integrations.export_openapi` (um teste falha se ele estiver desatualizado).

Teste real **opcional**, uma geração pequena pelo contrato 1.1 que consome cota da
assinatura. Mostra `finish: stop` se o CLI informou `stop_reason`, `unknown` se não.
Só rode depois de fazer login e decidir gastar esse uso:

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
