# Passagem para o Codex — estado em 9/11/2026

Escrito pelo Claude enquanto o Codex estava sem créditos. O Claude revisou e testou
as frentes do Codex e do Gemini **sem alterar as branches delas**. Este documento
diz em que ponto paramos, o que o Codex precisa corrigir e o que foi testado.

## 1. Onde paramos

**O primeiro início funcionou no Windows do usuário**, com a conta real dele e
sem gerar respostas: navegador Chromium aberto, catálogo com **Claude Code (sonnet)
- assinatura** disponível, plano criado pelo painel no contrato 1.1 com o aceite
e as capacidades copiadas, e o aviso de que o painel ainda não executa.

| Frente | Branch / PR | SHA atual | Situação |
| --- | --- | --- | --- |
| Codex | `codex/chromium-browser` / #4 | `33fc1ea` | Sem bloqueio. Correções na seção 2 |
| Gemini | `gemini/chromium-ui` / #5 | `ff5f7d7` | Corrigiu os 3 pontos da revisão do Claude; resta só o item pré-existente de `#tabs` |
| Claude | `claude/vibrant-meitner-ksbzgf` / #1 | este commit | Gateway pronto para 1 e 1.1; inicializador do primeiro início |

As três se juntam sem conflito (sobre `codex/chromium-browser`). No PC do usuário,
o primeiro início usa a branch local `inicio/local`, em `W:\Projeto\Ia-bbaru-inicio`,
aberta com `integrations/scripts/iniciar-ia-bbaru.ps1`
(guia: [PRIMEIRO_INICIO.md](PRIMEIRO_INICIO.md)). Essa branch não foi enviada ao GitHub.

**Próximo marco: execução durável (Codex).** Até lá, o painel planeja mas não executa,
e a ponte continua recusando `tasks.execute`. Geração real só pelo fluxo HTTP de
desenvolvimento, com autorização do usuário.

## 2. Correções e tarefas para o Codex

### C-1 (P1 para a execução durável) — o backend perde o código de erro do gateway

`backend/gateway.py`: `HttpGateway._request` chama `raise_for_status()` e transforma
**todo** erro HTTP em `GatewayUnavailable("gateway_request_failed")`. Depois,
`backend/main.py` grava `gateway_failed_outcome_may_be_unknown` na execução e responde
503 `gateway_unavailable` no catálogo/plano.

Com isso, situações diferentes ficam iguais para o backend e para o painel: login
expirado, cota esgotada, gateway ocupado, resultado incerto, modelo desconhecido.
O painel não consegue mostrar "faça login" ou "cota esgotada", e o worker durável
não consegue saber se pode tentar de novo.

Correção sugerida: ler o corpo sanitizado do gateway,
`{"error": {"code": "...", "message": "...", "next_action": "..."}}`, aceitar só
códigos de uma lista conhecida (texto curto, sem repassar mensagens livres) e
gravá-lo na etapa da tarefa. Testes com o gateway real e o dublê
(`tests/integrations/fixtures/fake_claude.py`, modos `auth_error`, `usage_limit`, `sleep`).

### C-2 — regras do gateway que o worker durável precisa seguir

| Resposta do gateway | Gerou algo? | O worker deve |
| --- | --- | --- |
| 200 | Sim | Gravar o resultado. `unknown` = incompleto, sem revisão |
| 422 (validação, `output_limit_not_accepted`, `unknown_model`) | Não | Falhar a etapa; não repetir com o mesmo corpo |
| 503 antes de iniciar (`provider_not_logged_in`, `provider_cli_not_installed`, ...) | Não | Mostrar o motivo; pode repetir depois de o usuário corrigir |
| 429 `gateway_busy` | Não (recusado antes de reservar) | Esperar e tentar de novo, com o **mesmo** `request_id` |
| 409 `request_in_progress` | Em andamento | Esperar e consultar de novo; não criar outro `request_id` |
| 409 `request_outcome_uncertain` (depois de timeout ou queda) | **Talvez** | Nunca repetir. Marcar a etapa como incerta e avisar o usuário |
| 504 `provider_timeout` | **Talvez** | Igual ao anterior; a repetição devolve 409 `request_outcome_uncertain` |
| 429 `provider_quota_exceeded`, 503 `provider_not_authenticated` depois de iniciar | Recusado pelo provedor | Mostrar o motivo. A repetição com o mesmo `request_id` devolve o mesmo erro, sem chamar de novo |
| 502 (`provider_error`, `completion_unconfirmed` no contrato 1, ...) | Sim ou talvez | Final para esse `request_id` |

- O `request_id` da etapa (`<task_id>:<índice>`) precisa ser estável entre tentativas.
  É ele que impede gerar duas vezes.
- O gateway executa **uma** geração por vez. O timeout dele (90 s) é menor que o do
  cliente do backend (120 s).
- Não expor `/v1.1/generate` ao renderer. A ponte só deve ganhar uma operação de
  execução quando houver fila, estado durável e acompanhamento.

### C-3 (P3) — `scripts/start-browser.ps1` sem BOM

No PowerShell 5.1, a mensagem com "código" aparece com acento trocado. Salvar como
UTF-8 com BOM (o `integrations/scripts/iniciar-ia-bbaru.ps1` já está assim).

### C-4 (P3) — `#tabs` com estrutura ARIA incompleta

`role="tablist"` com filhos `div` em vez de elementos `role="tab"` diretos (axe
`aria-required-children`). Já existia na base `e1ff8b9`. A estrutura vem de
`desktop/ui/shell.js`; como o Gemini cuida do visual de `desktop/ui/`, combinar
com ele quem corrige.

### C-5 — ordem de merge e consolidação

- As três PRs se juntam sem conflito. Ordem sugerida: #4 (Codex), depois #5 (Gemini,
  baseada em `e1ff8b9`), depois #1 (Claude). Rodar as suítes da seção 3 depois de
  cada merge.
- Depois do merge: o gateway passa a importar `backend/contracts_v1_1.py` em vez
  da cópia `integrations/contracts_v1_1.py`. Os dois são iguais hoje
  (`components` e `paths` do OpenAPI conferidos). O formato do contrato não muda.
- O inicializador `integrations/scripts/iniciar-ia-bbaru.ps1` chama
  `scripts/start-browser.ps1`. Se o nome ou os parâmetros desse script mudarem,
  avisar o Claude.

### C-6 (observação, sem ação imediata) — limite de 20 s da ponte

A primeira consulta ao catálogo faz o gateway rodar três comandos do Claude Code
(versão, ajuda e login). No primeiro início no Windows o catálogo carregou
normalmente. Medir só se aparecer "A operação demorou" no painel.

## 3. Testes realizados

Detalhes por rodada em [VALIDACAO.md](VALIDACAO.md). Nenhum teste automático usa
conta real: o Claude Code é substituído pelo dublê `fake_claude.py`.

### Linux (contêiner do Claude)

| Combinação | Testes | Resultado |
| --- | --- | --- |
| Codex `33fc1ea` sozinho | Python 48, frontend 6, desktop 3, build, `test:ui` (Electron real, catálogo sintético) | ✅ |
| Gemini `00e2c8f` sozinho | Python 48, frontend 10, desktop 3, build, `test:ui` | ✅ |
| Codex + Gemini `ff5f7d7` + gateway | Python 48, gateway 52 + 1 pulado, frontend 11, desktop 3, build, `test:ui`, `verify_gateway_v11.py` (backend → HTTP → gateway → dublê), `desktop_gateway_smoke.cjs` (Electron real + gateway real + dublê) | ✅ |
| Mesma combinação, janela 900×640 | Sem rolagem horizontal na barra nem no painel (estreito e ampliado); axe WCAG A/AA: painel sem violações, barra só com C-4 | ✅ / ⚠️ C-4 |
| Esquemas 1.1 | OpenAPI do backend × do gateway | ✅ iguais |

Os testes gráficos usaram Xvfb e `IA_BBARU_TEST_NO_SANDBOX=1`; não validam a
sandbox do sistema operacional.

### Windows do usuário

| Data | O quê | Conta real | Resultado |
| --- | --- | --- | --- |
| 7/11 | Diagnóstico; 34 testes do gateway; backend + gateway com a branch Firefox do Codex | Só diagnóstico | ✅ (revelou o SQLite sem `close`, corrigido pelo Codex em `f921651`) |
| 7/11 | Geração direta pelo gateway (contrato 1); fluxo backend → gateway por HTTP | Sim, autorizado | ✅ (antes da revisão do Codex) |
| 7/11 | Geração direta pelo contrato 1.1, depois das correções | Sim, autorizado | ✅ `stop` informado pelo CLI 2.1.307 |
| 9/11 | **Primeiro início** do navegador (três frentes juntas) | Login e catálogo, **sem geração** | ✅ catálogo, seleção, aceite e plano 1.1 pelo painel |

O primeiro início no Windows revelou um problema do inicializador, já corrigido
(`e6819d3`): a janela do gateway entrava no modo "Selecionar" do console, que pausa
o processo ao escrever no log. Agora o gateway roda sem janela, com log em
`%LOCALAPPDATA%\Ia-bbaru-gateway`.

**Ainda não testado no Windows:** a versão `ff5f7d7` do Gemini, a geração pelo
backend 1.1 (HTTP) e o modo `review` com dois modelos.

## 4. Pendências por frente

- **Codex:** C-1 e a execução durável (C-2); C-3; C-4, combinado com o Gemini; merges (C-5).
- **Gemini:** C-4, se ficar com ele. As correções de `ff5f7d7` foram verificadas
  no Linux; falta vê-las no Windows.
- **Claude:** consolidar os schemas 1.1 depois do merge. Avaliar Codex CLI e
  Gemini CLI como transportes oficiais para novos agentes. Acompanhar a geração
  real pelo backend 1.1, quando o usuário autorizar.
- **Usuário:** atualizar `inicio/local` com os commits novos e reabrir pelo
  inicializador. Decidir quando fazer a geração real de teste.
