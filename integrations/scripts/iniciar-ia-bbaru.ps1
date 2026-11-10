<#
Inicia o Ia-bbaru com o gateway das CLIs oficiais (Claude Code; opcionalmente
ChatGPT pela Codex CLI e Gemini CLI): primeiro início e aberturas seguintes.

Uso, na raiz de um checkout que junte o navegador (Codex), a interface (Gemini)
e o gateway (Claude):

    powershell -ExecutionPolicy Bypass -File .\integrations\scripts\iniciar-ia-bbaru.ps1

Opcional (cada provedor só aparece se receber um modelo):
    ... -ChatGptModel gpt-5.5                        # Codex CLI com Sign in with ChatGPT
    ... -GeminiModel gemini-2.5-pro -GeminiLoginGoogle   # depois de fazer Login with Google na Gemini CLI

O que faz:
  1. Na primeira vez, cria .venv (Python 3.12) e instala requirements.txt.
  2. Guarda um token de gateway fora do repositório (%LOCALAPPDATA%\Ia-bbaru-gateway).
  3. Mostra o diagnóstico das CLIs configuradas (sem gerar resposta).
  4. Abre o gateway sem janela (porta 8010), com log em %LOCALAPPDATA%\Ia-bbaru-gateway.
  5. Abre o navegador com GATEWAY_URL, GATEWAY_TOKEN e GATEWAY_PROTOCOL_VERSION=1.1,
     usando scripts\start-browser.ps1 (com -Install na primeira vez).
  6. Ao fechar o navegador, encerra o gateway.

Nunca gera respostas de IA: abrir, consultar o catálogo e criar planos não consome
geração. Não lê cookies nem arquivos de credencial. Não liga a flag legada do contrato 1.
#>
param(
    [string]$Model = 'sonnet',
    [int]$MaxOutputTokens = 128,
    [int]$Port = 8010,
    [string]$ChatGptModel = '',
    [string]$GeminiModel = '',
    [switch]$GeminiLoginGoogle
)
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$startBrowser = Join-Path $root 'scripts\start-browser.ps1'
if (-not (Test-Path $startBrowser)) {
    throw 'Este checkout não tem scripts\start-browser.ps1. Use a pasta que junta o navegador do Codex com o gateway.'
}
$python = Join-Path $root '.venv\Scripts\python.exe'

# 1. Python do projeto (o gateway precisa dele antes do navegador).
if (-not (Test-Path $python)) {
    Write-Host 'Primeiro início: criando o ambiente Python 3.12...'
    & py -3.12 -m venv (Join-Path $root '.venv')
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível criar .venv. Instale o Python 3.12 (py -3.12).' }
    & $python -m pip install -r (Join-Path $root 'requirements.txt')
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar requirements.txt.' }
}
$firstRun = -not (Test-Path (Join-Path $root 'desktop\node_modules'))

# 2. Token do gateway, fora do repositório.
$stateDir = Join-Path $env:LOCALAPPDATA 'Ia-bbaru-gateway'
New-Item -ItemType Directory -Force $stateDir | Out-Null
$tokenFile = Join-Path $stateDir 'gateway.token'
if (-not (Test-Path $tokenFile)) {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $newToken = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
    Set-Content -Path $tokenFile -Value $newToken -NoNewline -Encoding ascii
}
$token = (Get-Content $tokenFile -Raw).Trim()

# Configuração do gateway (herdada pelo processo que será aberto).
$env:GATEWAY_TOKEN = $token
$env:IA_BBARU_GATEWAY_DB = Join-Path $stateDir 'gateway.sqlite3'
$env:IA_BBARU_CLAUDE_CODE_MODELS = $Model
$env:IA_BBARU_CLAUDE_CODE_MAX_OUTPUT_TOKENS = "$MaxOutputTokens"
Remove-Item Env:IA_BBARU_CLAUDE_CODE_ACCEPT_UNENFORCED_OUTPUT_LIMIT -ErrorAction SilentlyContinue
$env:IA_BBARU_CHATGPT_CODEX_MODELS = $ChatGptModel
$env:IA_BBARU_CHATGPT_CODEX_MAX_OUTPUT_TOKENS = "$MaxOutputTokens"
$env:IA_BBARU_GEMINI_CLI_MODELS = $GeminiModel
$env:IA_BBARU_GEMINI_CLI_MAX_OUTPUT_TOKENS = "$MaxOutputTokens"
# A Gemini CLI não tem comando de status de login: você declara que fez Login with Google.
if ($GeminiLoginGoogle) { $env:IA_BBARU_GEMINI_CLI_LOGIN = 'google' } else { Remove-Item Env:IA_BBARU_GEMINI_CLI_LOGIN -ErrorAction SilentlyContinue }
Remove-Item Env:IA_BBARU_REAL_TEST -ErrorAction SilentlyContinue

# 3. Diagnóstico (não gera resposta).
Push-Location $root
try {
    $diagnostic = (& $python -m integrations diagnose | Out-String) | ConvertFrom-Json
} finally { Pop-Location }
$agents = @(
    @{ Name = 'Claude Code'; Data = $diagnostic.claude_code; Configured = $true },
    @{ Name = 'ChatGPT (Codex CLI)'; Data = $diagnostic.chatgpt_codex; Configured = [bool]$ChatGptModel },
    @{ Name = 'Gemini CLI'; Data = $diagnostic.gemini_cli; Configured = [bool]$GeminiModel }
)
foreach ($agent in $agents) {
    if (-not $agent.Configured) { continue }
    $info = $agent.Data
    if ($info.contract_1_1.available) {
        Write-Host "$($agent.Name) $($info.version): pronto (login $($info.auth_method))." -ForegroundColor Green
        if ($info.capabilities.tools -ne 'disabled') {
            Write-Host '  Aviso: esta CLI não permite desligar todas as ferramentas; o planejamento ainda a recusa.' -ForegroundColor Yellow
        }
    } else {
        Write-Host "$($agent.Name) indisponível: $($info.reason)." -ForegroundColor Yellow
        if ($info.next_action) { Write-Host "  O que fazer: $($info.next_action)" -ForegroundColor Yellow }
    }
}
Write-Host '  O navegador abre mesmo assim; agentes indisponíveis aparecem como indisponíveis.'

# 4. Gateway.
$url = "http://127.0.0.1:$Port"
$alreadyRunning = $false
try {
    $null = Invoke-WebRequest "$url/health" -UseBasicParsing -TimeoutSec 2
    $alreadyRunning = $true
} catch {}
if ($alreadyRunning) {
    throw "Já existe um serviço na porta $Port (talvez um gateway antigo). Feche-o e rode este script de novo."
}
# Sem janela: um clique no console do Windows (modo "Selecionar") pausa o processo
# quando ele escreve no log. O log vai para arquivo (só método, rota e status).
$logFile = Join-Path $stateDir 'gateway.log'
$errFile = Join-Path $stateDir 'gateway-erros.log'
$env:PYTHONUNBUFFERED = '1'  # linhas do log aparecem na hora
$gateway = Start-Process -FilePath $python -ArgumentList @('-m', 'integrations', 'serve', '--port', "$Port") `
    -WorkingDirectory $root -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput $logFile -RedirectStandardError $errFile
$ready = $false
for ($i = 0; $i -lt 60 -and -not $gateway.HasExited; $i++) {
    try {
        $response = Invoke-WebRequest "$url/health" -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
    Start-Sleep -Milliseconds 500
}
if (-not $ready) {
    if (-not $gateway.HasExited) { Stop-Process -Id $gateway.Id -Force }
    throw "O gateway não iniciou. Veja $errFile."
}
Write-Host "Gateway ativo em $url."
Write-Host "  Para acompanhar as requisições em outro PowerShell: Get-Content `"$logFile`" -Wait"

# 5. Navegador; 6. encerra o gateway ao sair.
$env:GATEWAY_URL = $url
$env:GATEWAY_PROTOCOL_VERSION = '1.1'
try {
    if ($firstRun) {
        Write-Host 'Primeiro início: instalando a interface e o navegador (pode demorar alguns minutos)...'
        & $startBrowser -Install
    } else {
        & $startBrowser
    }
} finally {
    if (-not $gateway.HasExited) { Stop-Process -Id $gateway.Id -Force }
    Write-Host 'Gateway encerrado.'
}
