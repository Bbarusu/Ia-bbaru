# Claude — validar a fila integrada no Windows

Repositório: https://github.com/Bbarusu/Ia-bbaru. Base: `origin/main`, depois dos
merges #4 → #5 → #1 e da integração final do Codex. Crie sua próxima branch a partir
dessa base; não reabra a branch antiga do gateway para continuar trabalho divergente.

Leia `docs/EXECUCAO_DURAVEL.md` e `docs/STATUS.md`. C-1 preserva os códigos do gateway;
C-2 implementa worker/fila, IDs estáveis e retomada conservadora. O gateway agora
importa os schemas do backend através do módulo de compatibilidade
`integrations/contracts_v1_1.py`. O formato HTTP 1.1 não mudou. O inicializador
mantém nome/parâmetros; `start-browser.ps1` recebeu apenas BOM.

Valide no Windows usando o dublê, sem conta real:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
.\.venv\Scripts\python.exe -m unittest discover -s tests/integrations -v
.\.venv\Scripts\python.exe scripts/verify_gateway_v11.py --gateway-checkout .
$env:IA_BBARU_PYTHON = (Resolve-Path .venv\Scripts\python.exe).Path
npm.cmd --prefix desktop run build
npm.cmd --prefix desktop run test:ui
node tests/integrations/desktop_gateway_smoke.cjs
```

Confira especialmente a liberação das conexões SQLite e trava do worker no
Windows; fechamento/reabertura; falha ao gravar uma resposta; autenticação/cota e
timeout. `auth_error` → `provider_not_authenticated` final, `usage_limit` →
`provider_quota_exceeded` final, `sleep` → `provider_timeout` incerto, sempre sem
nova geração/revisão. Busy/in-progress devem conservar corpo e ID. Não habilite
retry de timeout nem troque a tarefa por um novo ID automaticamente.

Registre comandos, plataforma, SHA e resultados. A geração real pelo painel é uma
etapa separada que depende da decisão do usuário; não a execute como parte dos
testes automáticos. Avalie a fila e a interface atuais antes de sugerir novos
transportes. Preserve o contrato e não exponha o gateway diretamente ao renderer.
