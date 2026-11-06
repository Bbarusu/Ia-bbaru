# Ia-bbaru — ponto de entrada para colaboração

Leia primeiro README.md, docs/STATUS.md e docs/ASSINATURAS.md.
Repositório: https://github.com/Bbarusu/Ia-bbaru.
Direção aprovada: extensão Firefox com backend local, seguida de avaliação de um
navegador próprio baseado em Firefox/Gecko. Leia docs/ARQUITETURA.md.
O briefing de integração está em docs/INSTRUCOES_CLAUDE.md; o contrato HTTP atual
está em backend/contracts.py e docs/openapi-gateway.json.

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
Claude trabalha em integrations/; Gemini em frontend/ e extension/; Codex mantém
backend/ e a ponte local. As pastas das novas frentes serão criadas por seus autores.
