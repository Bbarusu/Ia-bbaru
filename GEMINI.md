# Ia-bbaru — frontend com Gemini

Repositório: https://github.com/Bbarusu/Ia-bbaru.

O usuário pediu uma nova tentativa com Gemini no frontend. **A interface já existe.**
Leia `docs/INSTRUCOES_GEMINI.md` antes de editar: ele contém a base correta,
responsabilidades, fluxos, critérios de aceite e testes.

Enquanto a entrega de Codex não estiver integrada na main, use
`origin/codex/frontend-firefox` como base e trabalhe em `gemini/frontend-v2`.
Não reinicie a interface a partir da antiga main. Preserve as alterações locais
antes de trocar de branch e não use force push.

Gemini mantém UI/UX e componentes em `frontend/`. Codex mantém backend, host local
e transporte da extensão. Claude está trabalhando nas integrações; o usuário está
executando testes com ele. Não alterar a branch de outra frente.

Siga a linguagem visual do KInfo. Não simule conexão ou geração de IA, não exponha
tokens e não habilite execução pelo painel enquanto a ponte não declarar suporte.
