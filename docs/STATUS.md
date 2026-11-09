# Estado do Ia-bbaru

Atualizado em 9 de novembro de 2026 (horário de Brasília). Entrega na branch `codex/frontend-firefox`.

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
- Apresentação das capacidades/aceite na interface pelo Gemini.
- Preservação de edições e de capturas recebidas durante salvamento/descarte no
  frontend da PR #3. A captura dupla e a lista ARIA anteriores já foram corrigidas.
- Fila/worker durável, progresso e execução pelo painel. O host recusa `tasks.execute`.
- Importação automática NotebookLM, projetos Claude/ChatGPT ou arquivos binários.
- Instalação Windows e fluxo completo de menu nativo→host no computador de uso.
- Extensão assinada/distribuída e navegador próprio baseado em Firefox.
- Login multiusuário e deploy público. A aplicação continua exclusivamente local.

## Responsabilidades e próximo marco

Revisão atual das duas frentes: [REVISAO_INTEGRADA_2026_11_09.md](REVISAO_INTEGRADA_2026_11_09.md).
Prompts para encaminhamento: [Gemini](PROMPT_GEMINI_PENDENCIAS.md) e
[Claude](PROMPT_CLAUDE_VALIDACAO.md).

- **Codex:** implementou a primeira interface e mantém extensão, backend,
  persistência e ponte local.
- **Gemini:** a pedido do usuário, nova tentativa de evolução do frontend existente;
  base `codex/frontend-firefox`, branch `gemini/frontend-v2`. Ver o novo briefing.
- **Claude:** integrações oficiais em `integrations/`, correções da revisão e
  proposta coordenada de evolução do contrato. O usuário está testando com Claude;
  a revisão documentada se limita ao commit nela identificado.

Próximo marco: validar o backend 1.1 no computador do usuário, conectar o frontend
às capacidades e implementar execução durável antes de habilitar geração no painel.
Gecko é usado pelo Firefox instalado; ainda não há fork de navegador.

Repositório público por configuração do usuário: https://github.com/Bbarusu/Ia-bbaru.
Código, contratos e decisões ficam no GitHub; bancos, sessões, segredos e materiais
pessoais ficam fora do versionamento.
