<#
Inicia o Ia-bbaru com o gateway do Claude Code: primeiro início e aberturas seguintes.

Uso, na raiz de um checkout que junte o navegador (Codex), a interface (Gemini)
e o gateway (Claude):

    powershell -ExecutionPolicy Bypass -File .\integrations\scripts\iniciar-ia-bbaru.ps1

O que faz:
  1. Na primeira vez, cria .venv (Python 3.12) e instala requirements.txt.
  2. Guarda um token de gateway fora do repositório (%LOCALAPPDATA%\Ia-bbaru-gateway).
  3. Mostra o diagnóstico do Claude Code (sem gerar resposta).
  4. Abre o gateway numa janela minimizada (porta 8010).
  5. Abre o navegador com GATEWAY_URL, GATEWAY_TOKEN e GATEWAY_PROTOCOL_VERSION=1.1,
     usando scripts\start-browser.ps1 (com -Install na primeira vez).
  6. Ao fechar o navegador, encerra o gateway.

Nunca gera respostas de IA: abrir, consultar o catálogo e criar planos não consome
geração. Não lê cookies nem arquivos de credencial. Não liga a flag legada do contrato 1.
#>
param(
    [string]$Model = 'sonnet',
    [int]$MaxOutputTokens = 128,
    [int]$Port = 8010
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
Remove-Item Env:IA_BBARU_REAL_TEST -ErrorAction SilentlyContinue

# 3. Diagnóstico (não gera resposta).
Push-Location $root
try {
    $diagnostic = (& $python -m integrations diagnose | Out-String) | ConvertFrom-Json
} finally { Pop-Location }
$claude = $diagnostic.claude_code
if ($claude.contract_1_1.available) {
    Write-Host "Claude Code $($claude.version): pronto (login $($claude.auth_method))." -ForegroundColor Green
} else {
    Write-Host "Claude Code indisponível: $($claude.reason)." -ForegroundColor Yellow
    if ($claude.next_action) { Write-Host "  O que fazer: $($claude.next_action)" -ForegroundColor Yellow }
    Write-Host '  O navegador abre mesmo assim; o agente aparece como indisponível.'
}

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
$gateway = Start-Process -FilePath $python -ArgumentList @('-m', 'integrations', 'serve', '--port', "$Port") `
    -WorkingDirectory $root -WindowStyle Minimized -PassThru
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
    throw 'O gateway não iniciou. Rode ".venv\Scripts\python.exe -m integrations serve" para ver o erro.'
}
Write-Host "Gateway ativo em $url (janela minimizada)."

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
