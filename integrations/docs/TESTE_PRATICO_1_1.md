# Windows: gateway com o navegador Chromium

> Para o **primeiro início** com as três frentes juntas, use
> [PRIMEIRO_INICIO.md](PRIMEIRO_INICIO.md). Este roteiro detalha os testes por partes.

Base do navegador: `codex/chromium-browser` (Electron). O app **inicia o próprio
backend** em porta livre, com token interno. Não é preciso subir backend na porta
8000 nem definir `LAUNCHER_API_TOKEN` para usar o navegador. O gateway continua
um processo separado, normalmente em `127.0.0.1:8010`.

| Parte | O quê | Conta real |
| --- | --- | --- |
| 1 | Testes automáticos (fixtures, dublê do CLI, Electron) | Não |
| 2 | Navegador + gateway com o seu Claude Code: catálogo, seleção, aceite, plano | Só lê login; **não gera** |
| 3 | Geração real por HTTP (etapa separada, opcional) | Sim, com autorização |

A execução de IA **pelo painel** continua bloqueada até a fila/worker durável do
Codex. Abrir o navegador, ver o catálogo, diagnosticar ou criar plano nunca gera.

Pastas (ajuste se quiser outras):

| Pasta | Conteúdo |
| --- | --- |
| `W:\Projeto\Ia-bbaru` | Repositório existente |
| `W:\Projeto\Ia-bbaru-chromium` | Worktree do navegador (`teste/chromium`, como no guia do Codex) |
| `W:\Projeto\ia-gateway` | Worktree do gateway (`claude/vibrant-meitner-ksbzgf`) |
| `W:\Projeto\ia-integracao-chromium` | Os dois juntos, só para os testes automáticos |
| `W:\Projeto\ia-teste-local` | Tokens e bancos de teste, fora do Git |

Requisitos: Git, Python 3.12 e **Node.js 24 LTS** (`node --version`).

## Parte 1 — testes automáticos (sem conta)

```powershell
cd W:\Projeto\Ia-bbaru
git status                      # precisa estar limpo
git fetch origin

# Navegador (se a pasta já existir, pule esta linha)
git worktree add -b teste/chromium W:\Projeto\Ia-bbaru-chromium origin/codex/chromium-browser
# Gateway (se já existir da rodada anterior: git -C W:\Projeto\ia-gateway checkout --detach origin/claude/vibrant-meitner-ksbzgf)
git worktree add --detach W:\Projeto\ia-gateway origin/claude/vibrant-meitner-ksbzgf
# Integração local (não fazer push)
git worktree add --detach W:\Projeto\ia-integracao-chromium origin/codex/chromium-browser
git -C W:\Projeto\ia-integracao-chromium merge --no-edit origin/claude/vibrant-meitner-ksbzgf

git -C W:\Projeto\Ia-bbaru-chromium rev-parse HEAD
git -C W:\Projeto\ia-gateway rev-parse HEAD
git -C W:\Projeto\ia-integracao-chromium rev-parse HEAD
```

Ambiente do navegador (uma vez; mesmos passos do `start-browser.ps1 -Install`,
sem abrir o app):

```powershell
cd W:\Projeto\Ia-bbaru-chromium
py -3.12 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
$py = (Resolve-Path .venv\Scripts\python.exe).Path
Remove-Item Env:IA_BBARU_REAL_TEST -ErrorAction SilentlyContinue
```

Testes na pasta de integração:

```powershell
cd W:\Projeto\ia-integracao-chromium
npm.cmd --prefix frontend ci
npm.cmd --prefix desktop ci
npm.cmd --prefix desktop run build
$env:IA_BBARU_PYTHON = $py

& $py -m unittest discover -s tests -v                 # 1. backend: 48 OK
& $py -m unittest discover -s tests/integrations -v    # 2. gateway: 53 executados, 52 OK + 1 pulado
npm.cmd --prefix frontend test                          # 3. painel: 6 OK
npm.cmd --prefix desktop test                           # 4. política Electron: 3 OK
npm.cmd --prefix desktop run test:ui                    # 5. Electron real, catálogo sintético
node tests/integrations/desktop_gateway_smoke.cjs       # 6. Electron + este gateway por HTTP, dublê do CLI
```

O passo 5 é o teste gráfico do Codex (catálogo sintético). O passo 6 é o deste
gateway: sobe o gateway real com o dublê, abre o navegador real e confere catálogo
1.1, seleção, aceite obrigatório, plano gravado com as capacidades do gateway (teto
128), `tasks.execute` recusado, nenhuma geração e, sem login, modelo indisponível.

Script do Codex e diagnóstico:

```powershell
cd W:\Projeto\Ia-bbaru-chromium
& $py scripts/verify_gateway_v11.py --gateway-checkout W:\Projeto\ia-gateway

cd W:\Projeto\ia-gateway
& $py -m integrations diagnose
```

Diagnóstico esperado no bloco `claude_code`: `logged_in: true`, `auth_method:
claude.ai`, `missing_flags: []`, `contract_1_1.available: true` e
`contract_1.available: false`.

## Parte 2 — navegador com o seu Claude Code (sem geração)

**Preparação (uma vez):**

```powershell
New-Item -ItemType Directory -Force W:\Projeto\ia-teste-local | Out-Null
$py = "W:\Projeto\Ia-bbaru-chromium\.venv\Scripts\python.exe"
& $py -c "import secrets;print(secrets.token_urlsafe(32))" | Set-Content W:\Projeto\ia-teste-local\gateway.token
```

**Terminal 1 — gateway:**

```powershell
cd W:\Projeto\ia-gateway
$py = "W:\Projeto\Ia-bbaru-chromium\.venv\Scripts\python.exe"
$env:GATEWAY_TOKEN = (Get-Content W:\Projeto\ia-teste-local\gateway.token -Raw).Trim()
$env:IA_BBARU_GATEWAY_DB = "W:\Projeto\ia-teste-local\gateway.sqlite3"
$env:IA_BBARU_CLAUDE_CODE_MODELS = "sonnet"
$env:IA_BBARU_CLAUDE_CODE_MAX_OUTPUT_TOKENS = "128"
Remove-Item Env:IA_BBARU_CLAUDE_CODE_ACCEPT_UNENFORCED_OUTPUT_LIMIT -ErrorAction SilentlyContinue
& $py -m integrations serve
```

**Terminal 2 — navegador:** só as três variáveis do gateway. Não defina
`LAUNCHER_API_TOKEN`: o app cria o próprio token interno.

```powershell
cd W:\Projeto\Ia-bbaru-chromium
$env:GATEWAY_URL = "http://127.0.0.1:8010"
$env:GATEWAY_TOKEN = (Get-Content W:\Projeto\ia-teste-local\gateway.token -Raw).Trim()
$env:GATEWAY_PROTOCOL_VERSION = "1.1"
# Primeira abertura desta pasta: instala frontend/desktop aqui (as dependências da
# parte 1 ficaram em ia-integracao-chromium; cada worktree precisa das suas).
.\scripts\start-browser.ps1 -Install
# Aberturas seguintes:
# .\scripts\start-browser.ps1
```

Se o PowerShell bloquear scripts locais, use os comandos equivalentes do guia do
Codex (`docs/TESTAR_NAVEGADOR_CHROMIUM.md`), mantendo as três variáveis acima.

**No navegador:**

1. Aguarde "Backend local ativo". Crie um projeto.
2. Em agentes, confira **Claude Code (sonnet) - assinatura** como disponível.
3. Selecione-o, escreva um pedido com acentos e clique em **Criar plano**.
   Esperado: aviso pedindo o aceite; nenhum plano criado.
4. Marque **Aceito o limite indicativo para esta tarefa** e crie o plano.
   Esperado: plano criado; a caixa volta desmarcada.
5. No terminal 1 só devem aparecer `GET /v1.1/models`. **Nenhum**
   `POST /v1.1/generate`: o plano não gera resposta.

Feche o navegador e Ctrl+C no terminal 1. O perfil do app fica em
`%APPDATA%\Ia-bbaru`; os dados de teste do gateway em `W:\Projeto\ia-teste-local`.

## Parte 3 — geração real por HTTP (etapa separada, opcional)

O painel ainda não executa tarefas. Para testar a geração real pelo backend 1.1,
use o fluxo HTTP de desenvolvimento descrito em `docs/TESTAR_GATEWAY_1_1.md`
(branch do Codex), com um backend próprio de teste e banco separado. Consome um
pouco da cota e só deve ser feito com sua autorização explícita; não faz parte da
validação do navegador.
