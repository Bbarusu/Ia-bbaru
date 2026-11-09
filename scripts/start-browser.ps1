param([switch]$Install)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
function Run-Checked([string]$Executable, [string[]]$Arguments) {
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Falha ao executar $Executable (código $LASTEXITCODE)." }
}
Push-Location $projectRoot
try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Instale Node.js 24 LTS antes de continuar.' }
    $nodeVersion = [version](& node -p 'process.versions.node')
    if ($nodeVersion -lt [version]'22.12.0') { throw 'Atualize o Node.js; recomendado: 24 LTS.' }
    $pythonPath = Join-Path $projectRoot '.venv\Scripts\python.exe'
    if ($Install) {
        if (-not (Test-Path $pythonPath)) { Run-Checked 'py' @('-3.12', '-m', 'venv', '.venv') }
        Run-Checked $pythonPath @('-m', 'pip', 'install', '-r', 'requirements.txt')
        Run-Checked 'npm.cmd' @('--prefix', 'frontend', 'ci')
        Run-Checked 'npm.cmd' @('--prefix', 'desktop', 'ci')
    }
    if (-not (Test-Path $pythonPath)) { throw 'Execute scripts\start-browser.ps1 -Install para preparar o ambiente.' }
    if (-not (Test-Path 'desktop\node_modules')) { throw 'Execute scripts\start-browser.ps1 -Install para instalar o navegador.' }
    $env:IA_BBARU_PYTHON = $pythonPath
    if (-not $env:GATEWAY_PROTOCOL_VERSION) { $env:GATEWAY_PROTOCOL_VERSION = '1.1' }
    Run-Checked 'npm.cmd' @('--prefix', 'desktop', 'run', 'build')
    Run-Checked 'npm.cmd' @('--prefix', 'desktop', 'start')
} finally { Pop-Location }
