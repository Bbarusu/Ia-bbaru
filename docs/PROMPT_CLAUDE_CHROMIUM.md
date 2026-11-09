# Prompt para o Claude — gateway no navegador Chromium

Copie o texto abaixo para a sessão do Claude.

---

O usuário mudou a direção do Ia-bbaru para navegador desktop Chromium, via Electron.
Repositório: https://github.com/Bbarusu/Ia-bbaru. A nova base de integração está
em `origin/codex/chromium-browser`. Leia nessa branch `docs/ARQUITETURA.md`,
`docs/STATUS.md` e `docs/TESTAR_NAVEGADOR_CHROMIUM.md` antes de trabalhar.

O navegador já abre abas reais e integra o painel React, captura de seleção e
backend Python. O processo principal inicia backend e ponte local com token
interno e porta livre, usando um perfil separado. O gateway continua um serviço
separado em loopback, normalmente porta 8010. A arquitetura Electron não muda os
contratos HTTP 1/1.1 nem concede acesso a cookies/sessões das páginas.

Mantenha seu trabalho de `integrations/` na branch da PR #1 (incluindo a entrega
`dfbc570`) e use uma worktree local própria para validar com a nova base. Preserve
arquivos de outras frentes. Não faça merge das PRs na main nem use force push.
Codex mantém runtime Electron/preloads, backend, ponte e execução durável. Gemini
refina `frontend/` e `desktop/ui/`. Não modifique esses componentes para contornar
incompatibilidades; reporte o problema com reprodução.

Tarefas desta rodada:

1. Validar os testes de `integrations/` com o backend da nova branch. Manter as
   correções de deduplicação, schemas 1.1, aceite por tarefa e `unknown` sem sucesso
   fabricado. Verificar novamente a equivalência dos schemas se fizer alterações.
2. Atualizar o guia de Windows para iniciar o gateway e, em outro terminal,
   configurar `GATEWAY_URL`, `GATEWAY_TOKEN` e `GATEWAY_PROTOCOL_VERSION=1.1` antes
   de `scripts/start-browser.ps1`. Não pedir ao usuário para iniciar outro backend
   na porta 8000: o app já provisiona sua própria instância. Não substituir o token
   interno do navegador pelo token do gateway.
3. Com o usuário, validar diagnóstico e catálogo real na interface Chromium,
   seleção do modelo, aceite e criação de plano. Primeiro execute as suítes com
   fixtures. O teste gráfico `desktop/tests/smoke.cjs` usa catálogo sintético e não
   gera resposta; separe essa evidência da conta real.
4. Mostrar indisponibilidade/login/cota fielmente nas informações já suportadas
   pelo contrato. Não inventar disponibilidade por existir uma aba Claude aberta.
   Manter autenticação pelo CLI oficial. Uma assinatura web de ChatGPT/Gemini não
   vira API de geração por causa do Electron; documente transportes oficiais
   realmente disponíveis antes de propor outro adaptador.
5. Registrar resultados Windows e eventuais incompatibilidades de instalação,
   subprocessos, UTF-8 ou SQLite em `integrations/docs/VALIDACAO.md`. Não atribuir
   testes Linux ao Windows nem testes simulados à conta real.

Execução gráfica de IA ainda depende da fila/worker durável do Codex. Não habilite
`tasks.execute` na ponte ou exponha `/v1.1/generate` diretamente ao renderer. O
teste real por HTTP existente pode continuar em etapa própria com o usuário;
não iniciar chamadas de geração como efeito colateral de abrir o navegador,
diagnosticar login, consultar catálogo ou criar plano. Não exportar cookies/tokens.

Entregue documentação atualizada, testes, comandos e SHA da sua própria branch.
Explique o que já funciona graficamente e o que continua dependendo do próximo
marco de execução durável, sem prometer importação automática do NotebookLM.
