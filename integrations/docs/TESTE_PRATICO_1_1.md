# Windows: validação sem conta e teste prático 1.1

Comandos para o PowerShell do usuário. A **parte 1** não usa conta real.
A **parte 2** é a etapa seguinte, com o usuário, e consome um pouco da cota.

Pastas usadas (ajuste se quiser outras):

| Pasta | Conteúdo |
| --- | --- |
| `W:\Projeto\Ia-bbaru` | Repositório existente com o `.venv` (Python 3.12) |
| `W:\Projeto\ia-backend` | Worktree do backend `codex/frontend-firefox` |
| `W:\Projeto\ia-gateway` | Worktree do gateway `claude/vibrant-meitner-ksbzgf` |
| `W:\Projeto\ia-integracao` | Worktree local que junta os dois, só para os testes do gateway |
| `W:\Projeto\ia-teste-local` | Tokens e bancos de teste, fora do Git |

Worktrees não mexem nas branches existentes nem no trabalho em andamento.
Não fazer `git push` da worktree de integração.

## Parte 1 — validação sem conta real

```powershell
cd W:\Projeto\Ia-bbaru
git status            # precisa estar limpo; senão, pare e avise
git fetch origin
git worktree add --detach W:\Projeto\ia-backend origin/codex/frontend-firefox
git worktree add --detach W:\Projeto\ia-gateway origin/claude/vibrant-meitner-ksbzgf
git worktree add --detach W:\Projeto\ia-integracao origin/codex/frontend-firefox
git -C W:\Projeto\ia-integracao merge --no-edit origin/claude/vibrant-meitner-ksbzgf

# SHAs usados (copiar para o registro)
git -C W:\Projeto\ia-backend rev-parse HEAD
git -C W:\Projeto\ia-gateway rev-parse HEAD
git -C W:\Projeto\ia-integracao rev-parse HEAD

$py = "W:\Projeto\Ia-bbaru\.venv\Scripts\python.exe"
Remove-Item Env:IA_BBARU_REAL_TEST -ErrorAction SilentlyContinue

# 1. Backend atual: 48 testes (inclui fechamento do SQLite no Windows)
cd W:\Projeto\ia-backend
& $py -m unittest discover -s tests -v

# 2. Gateway com o backend atual: 52 executados, 51 OK + 1 pulado (teste real)
cd W:\Projeto\ia-integracao
& $py -m unittest discover -s tests -v
& $py -m unittest discover -s tests/integrations -v

# 3. Backend -> HTTP -> gateway -> CLI de teste (bancos temporários, sem conta)
cd W:\Projeto\ia-backend
& $py scripts/verify_gateway_v11.py --gateway-checkout W:\Projeto\ia-gateway

# 4. Diagnóstico, sem gerar resposta
cd W:\Projeto\ia-gateway
& $py -m integrations diagnose
```

Esperado no passo 4, bloco `claude_code`: `"ready": true`,
`"contract_1_1": {"available": true, "requires_task_acceptance": true}` e
`"contract_1": {"available": false, "reason": "output_limit_not_enforced"}`.

## Parte 2 — teste prático 1.1 (consome cota; só com autorização)

Uma tarefa `single`, fonte sintética com acentos, perfil do gateway pedindo 128
tokens (indicativo), aceite `true`. Banco de teste separado, para não misturar com
dados pessoais.

**Preparação (uma vez):**

```powershell
New-Item -ItemType Directory -Force W:\Projeto\ia-teste-local | Out-Null
$py = "W:\Projeto\Ia-bbaru\.venv\Scripts\python.exe"
& $py -c "import secrets;print(secrets.token_urlsafe(32))" | Set-Content W:\Projeto\ia-teste-local\gateway.token
& $py -c "import secrets;print(secrets.token_urlsafe(32))" | Set-Content W:\Projeto\ia-teste-local\launcher.token
```

**Janela 1 — gateway (8010):**

```powershell
cd W:\Projeto\ia-gateway
$py = "W:\Projeto\Ia-bbaru\.venv\Scripts\python.exe"
$env:GATEWAY_TOKEN = (Get-Content W:\Projeto\ia-teste-local\gateway.token -Raw).Trim()
$env:IA_BBARU_GATEWAY_DB = "W:\Projeto\ia-teste-local\gateway.sqlite3"
$env:IA_BBARU_CLAUDE_CODE_MODELS = "sonnet"
$env:IA_BBARU_CLAUDE_CODE_MAX_OUTPUT_TOKENS = "128"
# O 1.1 não usa a flag legada; deixe-a desligada:
Remove-Item Env:IA_BBARU_CLAUDE_CODE_ACCEPT_UNENFORCED_OUTPUT_LIMIT -ErrorAction SilentlyContinue
& $py -m integrations serve
```

**Janela 2 — backend (8000), contrato 1.1:**

```powershell
cd W:\Projeto\ia-backend
$py = "W:\Projeto\Ia-bbaru\.venv\Scripts\python.exe"
$env:LAUNCHER_API_TOKEN = (Get-Content W:\Projeto\ia-teste-local\launcher.token -Raw).Trim()
$env:LAUNCHER_DB_PATH = "W:\Projeto\ia-teste-local\backend.sqlite3"
$env:GATEWAY_URL = "http://127.0.0.1:8010"
$env:GATEWAY_TOKEN = (Get-Content W:\Projeto\ia-teste-local\gateway.token -Raw).Trim()
$env:GATEWAY_PROTOCOL_VERSION = "1.1"
& $py -m uvicorn backend.main:create_app --factory --host 127.0.0.1 --port 8000 --workers 1
```

**Janela 3 — cliente.** Parte A, sem custo:

```powershell
$h = @{ Authorization = "Bearer " + (Get-Content W:\Projeto\ia-teste-local\launcher.token -Raw).Trim() }
$api = "http://127.0.0.1:8000/v1"
function Show($r) { [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()) }
function Req($method, $url, $obj) {
  $params = @{ Uri = $url; Method = $method; Headers = $h; UseBasicParsing = $true }
  if ($obj) { $params.ContentType = "application/json; charset=utf-8"
              $params.Body = [Text.Encoding]::UTF8.GetBytes(($obj | ConvertTo-Json -Depth 6)) }
  Invoke-WebRequest @params
}

Show (Req GET "$api/models")      # protocol_version 1.1, capabilities.output_limit best_effort, max_output_tokens 128

$p = (Req POST "$api/projects" @{ title = "Teste prático 1.1" }).Content | ConvertFrom-Json
$s = (Req POST "$api/projects/$($p.id)/sources" @{ title = "Aula sintética"; content = "A fotossíntese converte luz, água e gás carbônico em glicose e oxigênio. Ocorre nos cloroplastos das células vegetais." }).Content | ConvertFrom-Json

# Sem aceite: deve falhar com 422, sem gerar nada
try { Req POST "$api/projects/$($p.id)/tasks" @{ instruction = "Resuma em duas frases."; kind = "study"; source_ids = @($s.id); allowed_model_ids = @("claude-code:sonnet"); mode = "single" } } catch { $_.Exception.Response.StatusCode.value__ }

# Com aceite booleano true
$tr = Req POST "$api/projects/$($p.id)/tasks" @{ instruction = "Resuma em duas frases e cite a fonte."; kind = "study"; source_ids = @($s.id); allowed_model_ids = @("claude-code:sonnet"); mode = "single"; allow_unenforced_output_limit = $true }
Show $tr
$t = $tr.Content | ConvertFrom-Json
```

Conferir no plano: `"status": "planned"`, `"gateway_protocol_version": "1.1"`,
`"allow_unenforced_output_limit": true` e `plan[0].capabilities` com
`output_limit: best_effort`.

Parte B — **a geração real** (uma chamada):

```powershell
Show (Req POST "$api/tasks/$($t.id)/execute")
```

| Resultado | Leitura |
| --- | --- |
| `completed`, `finish_reason: stop` | Término confirmado pelo CLI |
| `incomplete` / `completion_unconfirmed` | `unknown`: saída guardada, **não é sucesso** e não deve ser repetida |
| `incomplete` / `output_token_limit_reached` | `length`: saída parcial guardada |

Parte C — persistência e repetição, sem custo:

```powershell
Show (Req GET "$api/tasks/$($t.id)")                       # aceite, capacidades e resultado persistidos
try { Req POST "$api/tasks/$($t.id)/execute" } catch { $_.Exception.Response.StatusCode.value__ }   # 409
```

Encerrar: Ctrl+C nas janelas 1 e 2. Os tokens e bancos ficam em
`W:\Projeto\ia-teste-local` (fora do Git); apague a pasta quando quiser.
Remover as worktrees depois: `git worktree remove W:\Projeto\ia-integracao` (e as outras).
