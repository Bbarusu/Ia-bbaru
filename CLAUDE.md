# Ia-bbaru — ponto de entrada para colaboração

Leia primeiro README.md, docs/STATUS.md e docs/ASSINATURAS.md.
Repositório: https://github.com/Bbarusu/Ia-bbaru.
Direção atual (9/11/2026): navegador Chromium via Electron com backend local.
Base: `codex/chromium-browser`. Leia `docs/ARQUITETURA.md` e o novo prompt
`docs/PROMPT_CLAUDE_CHROMIUM.md`. O briefing Firefox anterior é histórico.
O briefing de integração está em docs/INSTRUCOES_CLAUDE.md; o contrato HTTP atual
está em backend/contracts.py (1) e backend/contracts_v1_1.py (1.1), com OpenAPI
publicados em docs/. O backend já implementa docs/DECISAO_CAPACIDADES.md.
Veja docs/TESTAR_GATEWAY_1_1.md para configurar e testar a integração.
Não emitir objetos 1.1 para consumidores do contrato 1.

O usuário definiu que o KInfo é a referência de design e quer aproveitar suas
contas e assinaturas. Não presumir APIs pagas como requisito do produto. Não
copiar código do repositório do KInfo para este projeto.

O backend de projetos/tarefas/histórico já existe. Trabalhe nas integrações em
uma pasta separada, sem duplicar esses recursos. Alterações no contrato devem
atualizar schemas, documentação e testes dos dois lados.

Não versionar chaves, cookies, tokens, bancos de uso pessoal ou material da
faculdade. Documentar claramente o que foi testado com mocks e o que foi
validado com uma conta real. Não cadastrar planos, comprar créditos ou realizar
chamadas cobradas como passo implícito de instalação.

Ao colaborar em sessões simultâneas, usar branches próprias e verificar o remoto
antes de enviar commits. Não sobrescrever mudanças de outra sessão com force push.
Claude trabalha em integrations/; Codex mantém extension/, backend/ e native_host/.
Atualização de 11/11/2026: o usuário definiu Claude como novo responsável por
frontend/ e desktop/ui/ (antes com Gemini). Propostas de interface são elaboradas
primeiro no Canvas e só entram no código após aprovação e ajustes do usuário.
Após a implementação inicial por Codex, o usuário pediu nova tentativa com Gemini
na evolução de frontend/. Veja docs/INSTRUCOES_GEMINI.md. Consulte também
docs/REVISAO_CLAUDE.md, vinculada ao commit revisado da PR #1; ela não substitui
a validação das alterações e testes posteriores em andamento com o usuário.
