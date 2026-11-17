# Validar a integração no Windows — 16/11/2026

Esta versão foi testada em Linux. Não marcar Windows como aprovado sem a saída
do usuário. Usar a cópia atual W:\Projeto\Ia-bbaru-chat, preservando perfil e bancos.
Fechar navegador/gateway antes de atualizar. Não apagar bancos nem repetir geração
para investigar a resposta anterior. O teste real permanece desativado nesta etapa.

## Atualizar e testar sem consumir cota

```powershell
cd W:\Projeto\Ia-bbaru-chat
git status --short
# Se aparecer alteração local, preservar antes de continuar. Não usar reset --hard.
git fetch origin
git merge --no-edit origin/codex/browser-capture-clis
if ($LASTEXITCODE -ne 0) { throw 'Resolva o merge antes de testar.' }
Remove-Item Env:IA_BBARU_REAL_TEST -ErrorAction SilentlyContinue
Remove-Item Env:IA_BBARU_TEST_NO_SANDBOX -ErrorAction SilentlyContinue
$env:IA_BBARU_PYTHON = (Resolve-Path .\.venv\Scripts\python.exe).Path
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
.\.venv\Scripts\python.exe -m unittest discover -s tests/integrations -v
npm.cmd --prefix frontend ci
npm.cmd --prefix desktop ci
npm.cmd --prefix frontend test
npm.cmd --prefix desktop test
npm.cmd --prefix desktop run build
npm.cmd --prefix desktop run test:ui
```

Cada comando precisa terminar sem falha antes de avançar. O único skip esperado
no gateway é test_one_small_real_generation. Os testes de imagem usam pixels
sintéticos e dublês; nenhum consome cota. Confirmar .ico/.icns em desktop/build.

Teste de layout separado (dependência opcional de desenvolvimento):

```powershell
.\.venv\Scripts\python.exe -m pip install playwright
.\.venv\Scripts\python.exe -m playwright install chromium
.\.venv\Scripts\python.exe scripts\verify_ui.py
```

## Comparar a resposta salva, somente leitura

```powershell
.\.venv\Scripts\python.exe scripts\inspect_saved_response.py `
  --backend "$env:LOCALAPPDATA\Ia-bbaru-teste-chat\local\launcher.sqlite3" `
  --gateway "$env:LOCALAPPDATA\Ia-bbaru-gateway\gateway.sqlite3" `
  --task-id 3ca05830-926f-47ca-96d8-0ccfe7399a4d
```

Enviar esse JSON: não contém texto da resposta, página ou credenciais. Compara
output do gateway, resultado da etapa e output final da tarefa por tamanho/hash.
Não cria banco faltante, não altera registro e não chama Claude. Se não encontrar
o registro, conferir os caminhos; não criar outra tarefa para substituí-lo.

## Abrir a versão integrada

```powershell
$env:IA_BBARU_PROFILE_DIR = "$env:LOCALAPPDATA\Ia-bbaru-teste-chat"
powershell -ExecutionPolicy Bypass -File .\integrations\scripts\iniciar-ia-bbaru.ps1 -Models "sonnet"
```

Abrir/consultar não gera. Scripts usam protocolo1.2 e teto2048 para novos pedidos.
Aceites/planos1.1 continuam históricos e precisam ser refeitos; sem migração
silenciosa de tarefas. A UI da PR11 ainda usa tarefas independentes até o Claude
frontend ligar o contrato de conversa documentado. Não anunciar continuidade
entre mensagens nem visão ativa na interface antes dessa ligação.

Visão real e nova geração textual exigem etapa posterior com a conta disponível,
prévia e autorização. Configuração experimental da visão, somente quando for
validar: IA_BBARU_CLAUDE_CODE_VISION_MODELS=sonnet, com modelo também em Models.
Não executar geração agora só para obter um teste verde.
