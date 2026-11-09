# Estado do Ia-bbaru

Atualizado em 9 de novembro de 2026 (horário de Brasília). Entrega do navegador na branch `codex/chromium-browser`.

## Navegador Chromium — versão inicial executável

- Electron 45.2.3 / Chromium 156.0.8078.80, com abas reais, endereço/pesquisa,
  voltar/avançar/recarregar, atalhos e painel React lateral ou ampliado.
- Páginas remotas isoladas, sem Node ou preload da aplicação. IPC local limitado
  por origem/frame/operação; token permanece fora dos renderers.
- Backend e ponte Python iniciados automaticamente; perfil próprio com SQLite,
  rascunhos e sessão web persistente. Captura explícita com prévia e origem.
- Aceite 1.1 no painel, desmarcado por padrão e persistido no plano; rascunho manual
  preservado quando chega uma captura. Captura pendente não é sobrescrita no desktop.
- Roteiro Windows e inicializador em `scripts/start-browser.ps1`.

Validação nesta entrega: 48 testes Python, 6 testes do frontend, 3 testes de política
Electron, build e teste gráfico no Electron real. O teste gráfico usou backend/ponte
reais e página/catálogo sintéticos; confirmou navegação, captura com acentos, aceite
1.1, isolamento, proteção de rascunhos e persistência após reiniciar. O teste gráfico
Firefox existente também passou após a adaptação de transporte. Nenhuma conta
real utilizada. Evidência: [JSON](reviews/chromium-smoke.json) e
[captura da janela](images/browser-chromium.png). Windows/PowerShell ainda precisam
ser validados no computador do usuário.

O contêiner Linux não tem o helper SUID configurado para a sandbox Chromium. O
teste gráfico usou explicitamente `IA_BBARU_TEST_NO_SANDBOX=1`, com perfil temporário
e páginas locais. Validou Node desativado, separação de preloads e operações IPC;
não valida a sandbox do sistema operacional. O app normal mantém sandbox habilitada.

Guia: [TESTAR_NAVEGADOR_CHROMIUM.md](TESTAR_NAVEGADOR_CHROMIUM.md).

## Base reaproveitada

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

A PR [#1](https://github.com/Bbarusu/Ia-bbaru/pull/1) implementa o gateway com Claude
Code e os endpoints 1.1. O commit `b4b2dcc` corrigiu deduplicação e término sem
evidência apontados na revisão anterior. A suíte do gateway combinada com este
backend passou: 50 testes e 1 teste real ignorado. A revisão histórica continua em
`REVISAO_CLAUDE.md`; não descreve o estado atual dessas correções.

O backend agora suporta `GATEWAY_PROTOCOL_VERSION=1.1`, aceite por tarefa persistido
e encaminhado, capacidades registradas no plano e `unknown` →
`incomplete/completion_unconfirmed`, sem iniciar revisão. Schemas/rotas coincidem
com o JSON publicado pelo gateway. 48 testes de backend passaram, além de uma
verificação por HTTP real usando o CLI de teste. Ver `TESTAR_GATEWAY_1_1.md`.

Claude registrou testes com a conta do usuário no Windows, inclusive geração pelo
contrato 1.1; os detalhes e limites estão na branch de integrações. Nesta entrega
Codex usou somente fixtures. O novo backend ainda precisa de validação no Windows.

## Ainda pendente

- Validação do novo backend 1.1 no Windows e no fluxo real com a conta do usuário.
- Refinamento da apresentação de capacidades e motivos de indisponibilidade pelo
  Gemini. O aceite necessário ao planejamento já está integrado nesta base.
- Portar seletivamente as melhorias visuais da PR #3 para a nova base, preservando
  transporte desktop e a proteção de capturas/rascunhos implementados aqui.
- Fila/worker durável, progresso e execução pelo painel. O host recusa `tasks.execute`.
- Importação automática NotebookLM, projetos Claude/ChatGPT ou arquivos binários.
- Validar a instalação Windows, logins nos sites oficiais e compatibilidade de páginas.
- Instalador do navegador, Python empacotado, assinatura de código e autoatualização.
- Gestão de downloads/permissões, restauração de abas e favoritos.
- Login multiusuário e deploy público. A aplicação continua exclusivamente local.

## Responsabilidades e próximo marco

- **Codex:** runtime Chromium, navegação, IPC, backend, persistência e execução durável.
- **Gemini:** `desktop/ui/` e `frontend/`, nova branch `gemini/chromium-ui` sobre
  `codex/chromium-browser`. [Prompt atual](PROMPT_GEMINI_CHROMIUM.md).
- **Claude:** `integrations/` e validação Windows do gateway com o navegador.
  [Prompt atual](PROMPT_CLAUDE_CHROMIUM.md).

Próximo marco: testar a versão gráfica no computador do usuário e implementar
execução durável antes de habilitar geração no painel. Navegação já usa Chromium
incorporado ao Electron; a extensão Firefox continua como alternativa anterior.

Revisão histórica das frentes: [REVISAO_INTEGRADA_2026_11_09.md](REVISAO_INTEGRADA_2026_11_09.md).
O gateway permanece em uma PR separada. A mudança de motor não altera sua API.

Repositório público por configuração do usuário: https://github.com/Bbarusu/Ia-bbaru.
Código e decisões ficam no GitHub; bancos, sessões, segredos e materiais pessoais
ficam fora do versionamento.
