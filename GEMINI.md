# Ia-bbaru — interface do navegador Chromium

Repositório: https://github.com/Bbarusu/Ia-bbaru.
O usuário escolheu Chromium/Electron em 9/11/2026. Base atual obrigatória:
`origin/codex/chromium-browser`. Trabalhe em `gemini/chromium-ui`.

Leia primeiro `docs/PROMPT_GEMINI_CHROMIUM.md`, `docs/ARQUITETURA.md` e
`docs/TESTAR_NAVEGADOR_CHROMIUM.md`. Preserve as mudanças de transporte, aceite
1.1 e captura ao reaproveitar componentes da PR #3. Não volte à base Firefox antiga.

Gemini mantém `frontend/` e `desktop/ui/`. Codex mantém runtime, preloads, IPC,
backend e ponte. Claude mantém `integrations/`. Não simule conexões, não exponha
segredos e não habilite execução enquanto a ponte não declarar suporte.
Preserve alterações locais e trabalhe em branch própria, sem force push.
