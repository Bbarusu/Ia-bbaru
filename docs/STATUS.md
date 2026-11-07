# Estado do Ia-bbaru

Atualizado em 6 de novembro de 2026 (horário de Brasília). Entrega na branch `codex/frontend-firefox`.

## Implementado

- Backend local Python/FastAPI com SQLite, token para uso pessoal, projetos,
  fontes de texto e tarefas com cópia do contexto selecionado.
- Planejamento por categorias/preferências e revisão opcional por segundo modelo.
- Execução HTTP síncrona de desenvolvimento, proteção contra repetição, registro
  de respostas parciais/truncadas e recuperação após reinício.
- Interface React/TypeScript inspirada no KInfo: área de trabalho, biblioteca,
  atividade e conexões, com layouts amplo e estreito e rascunhos por projeto.
- Extensão Firefox com painel lateral, página ampla e menu de captura de seleção.
  Prévia e confirmação antes de salvar título, URL e texto como fonte.
- Host Native Messaging com allowlist, framing limitado, validação estrita e
  autenticação do backend fora da extensão. Instalador explícito por usuário.
- Listagens paginadas/resumidas para manter mensagens pequenas; detalhe de fonte
  validando vínculo com o projeto.
- Estados distintos de host/backend/provedores; demonstração apenas com `?demo=1`.
- Testes automatizados do backend, ponte e lógica/interface. Consulte as evidências
  e limites de validação em `INSTALAR_FIREFOX.md`.

## Integração do Claude

A PR [#1](https://github.com/Bbarusu/Ia-bbaru/pull/1) propõe um gateway com Claude Code.
Foi revisada em worktree separada: **33 testes passaram e 1 foi ignorado**.
Há ajustes de deduplicação, término da resposta e declaração de capacidades antes
de integrá-la. Ver `REVISAO_CLAUDE.md`. Nenhuma conta real foi utilizada na revisão.

## Ainda pendente

- Conta de IA autenticada e assinatura validada em execução real.
- Contrato por capacidades compatível com transportes sem teto rígido de saída.
- Fila/worker durável, progresso e execução pelo painel. O host recusa `tasks.execute`.
- Importação automática NotebookLM, projetos Claude/ChatGPT ou arquivos binários.
- Instalação Windows e fluxo completo de menu nativo→host no computador de uso.
- Extensão assinada/distribuída e navegador próprio baseado em Firefox.
- Login multiusuário e deploy público. A aplicação continua exclusivamente local.

## Responsabilidades e próximo marco

- **Codex:** implementou a primeira interface e mantém extensão, backend,
  persistência e ponte local.
- **Gemini:** a pedido do usuário, nova tentativa de evolução do frontend existente;
  base `codex/frontend-firefox`, branch `gemini/frontend-v2`. Ver o novo briefing.
- **Claude:** integrações oficiais em `integrations/`, correções da revisão e
  proposta coordenada de evolução do contrato. O usuário está testando com Claude;
  a revisão documentada se limita ao commit nela identificado.

Próximo marco: validar a instalação no computador do usuário, resolver os pontos
da integração e implementar execução durável antes de habilitar geração no painel.
Gecko é usado pelo Firefox instalado; ainda não há fork de navegador.

Repositório público por configuração do usuário: https://github.com/Bbarusu/Ia-bbaru.
Código, contratos e decisões ficam no GitHub; bancos, sessões, segredos e materiais
pessoais ficam fora do versionamento.
