# Frontend do navegador Ia-bbaru

Leia README.md, docs/STATUS.md e docs/DIRECAO_CLAUDE_ONLY.md.
Leia docs/DIVISAO_RESPONSABILIDADES.md; Codex integra contratos e runtime,
Gemini mantém a interface. Documente dependências fora do seu escopo.
Prompt vigente: docs/PROMPT_GEMINI_CLAUDE_ONLY.md.
Base de integração: codex/browser-capture-clis; preserve seu trabalho local
antes de integrá-la na sua branch gemini/chromium-ui.

Você continua como colaborador do frontend. O produto integra exclusivamente
Claude Code; não reintroduzir sua CLI ou outros provedores. A seleção é entre
modelos Claude configurados pelo usuário. Não presumir acesso/cota ilimitada.

Escopo principal: frontend/ e desktop/ui/. Preserve o estilo escolhido pelo
usuário, rascunhos, capturas reais, fila e aceites. Não simular funcionalidades.
Mudanças de runtime/IPC precisam de contrato e coordenação. Não sobrescrever
as ligações de busca/zoom/captura já implementadas. Use context-* / data-context.
Não apagar dados pessoais ou histórico. Não usar force push.
