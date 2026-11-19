# Passagem do frontend — chat lateral (Claude, interface)

**Integração Codex em 17/11:** fast-forward até 629254c, sem conflito. Ajustes
de recuperação impedem novo UUID após HTTP 5xx ou consulta 404; smoke testa
perda/replay/restauração pendente. Contagens atuais e Windows em STATUS.md.
Registros históricos abaixo preservados.

Registro de 12/11/2026. Responsável: Claude (interface), conforme atribuição
explícita do usuário para `frontend/` e `desktop/ui/`. Base: `codex/browser-capture-clis`
em 4e6679e. Branch de entrega: `claude/friendly-curie-pxw81w`.
Sem alteração em backend, gateway, contratos ou persistência. Fora de `frontend/` e
`desktop/ui/`, a pedido explícito do usuário: remoção do suporte ao Firefox
(`extension/`, `native_host/install.py`), uma linha de ícone em `desktop/main.cjs`,
testes de interface (`desktop/tests/smoke.cjs`, `scripts/verify_ui.py`) e as skills
em `.agents/`. Tudo na PR #11, para integração pelo Codex.

## Markdown e “Página atual” (19/11/2026)

Base `f96ad93` (ajustes/downloads persistidos e imagens diretas na conversa) incorporada; conflito só no envio do `App.tsx`, resolvido mantendo texto colado e anexos.

- Respostas em Markdown (`AnswerMarkdown.tsx`, `markdown.mjs`, `react-markdown` 10.1.0 + `remark-gfm` 4.0.1): títulos, ênfase, listas, citações, tabelas roláveis no próprio bloco e código com “Copiar código”. HTML bruto aparece como texto; links só http(s)/mailto, com `noopener`; imagens da resposta não carregam (viram link). Sem `dangerouslySetInnerHTML` nem `rehype-raw`.
- `readableAnswer` não mexe em código nem no destino de links e escapa o título da fonte.
- Chip “Página atual” e vídeo: ver [PEDIDO_VISAO_E_NAVEGADOR.md §5](PEDIDO_VISAO_E_NAVEGADOR.md).
- Testes: `logic.test.mjs` (Markdown seguro/XSS, fontes, orçamento, erro de leitura, vídeo); `verify_chat_ui.py` (m1, p1, p2, v1); `smoke.cjs` (chip ligado, leitura só no envio, página no gateway, captura liberada).

## Cobertura de testes I1–I12 e F-4 (18/11/2026)

Base `ad39437` (integração do Codex até `629254c`) incorporada sem conflito.

| # | Situação | Onde |
| --- | --- | --- |
| I1 | Coberto pelo Codex: resposta perdida → “Consultar estado” → “Reenviar o mesmo pedido”, 1 turno e 1 geração | `desktop/tests/smoke.cjs` (`ad39437`) |
| I2 | Coberto pelo Codex: `yuki:pending-send` restaurado ao reabrir, sem geração automática | `smoke.cjs` (`ad39437`); bloqueio de troca/novo chat em `verify_chat_ui.py` (I10) |
| I3 | Chip “a aba mudou desde a captura” após `activePage` de outro documento; snapshot enviado mantém `document_id`, `tab_id`, `documentVersion` e o texto original | `scripts/verify_chat_ui.py` |
| I4 | `focusComposer` foca `#instruction` (também vindo de outra área); Ctrl+Shift+L real fecha/reabre o painel e foca o campo, sem envio | `verify_chat_ui.py`; `smoke.cjs` (`sendInputEvent`) |
| I5 | Rápido/Profundo → `response_profile`, sem `preferred_model_id`, sem Fable; modelo pelo nome → `preferred_model_id` e só ele; Fable só pelo nome, com aviso de créditos | `verify_chat_ui.py` |
| I6 | “Avançado” → revisão: `mode=review`, “Não perguntar de novo” desativado, nenhum `consent.set`; a próxima mensagem volta sem revisão | `verify_chat_ui.py` |
| I7 | Aceite da conversa com Sonnet → envio seguinte com `consent_id`, sem cartão; trocar para Opus reabre o cartão sem despachar; Cancelar preserva o texto | `verify_chat_ui.py` |
| I8 | Catálogo 1.2 com imagem: prévia, aceite visual obrigatório, `allow_visual_input=true`, `source_ids` e nada de base64 no corpo; duas imagens bloqueiam; sem visão, a Biblioteca não deixa escolher imagem | `verify_chat_ui.py` |
| I9 | Mensagens de créditos, modelo indisponível, taxa e teto sem código cru nem horário | `frontend/tests/logic.test.mjs` |
| I10 | Alternar duas conversas pelo “⋯”; com envio pendente, “Novo chat” e a troca ficam desativados e nada é reenviado | `verify_chat_ui.py` |
| I11 | 360 px com o aviso de aceite, texto colado e pergunta longa, sem rolagem horizontal e com o campo visível | `verify_chat_ui.py` (`artifacts/chat-360-consent.png`) |
| I12 | Pendente: repetir no Windows com X1 | Codex/usuário |
| F-4 | “+ → Colar texto” e, sem ponte, os atalhos abrem o campo “Texto colado”; vai como snapshot `kind: "text"` e a `instruction` fica só com o pedido | `ChatComposer.tsx`, `App.tsx`; `verify_chat_ui.py` e `logic.test.mjs` |

`verify_chat_ui.py` roda o painel compilado no Chromium com uma ponte de **teste**
que grava cada corpo enviado (confere o que a interface manda ao contrato). Regras
do backend seguem nos testes de `tests/` e no smoke com backend real. Comando:
`npm --prefix frontend run build` e `python scripts/verify_chat_ui.py`
(`IA_BBARU_CHROMIUM_PATH` opcional). Sugestão ao Codex: incluir no roteiro Windows.

Controles “Em integração”: nenhuma API nova de D1/D2/N2/N5 foi publicada até
`ad39437`; continuam desativados e serão ligados quando existirem.

## Captura simplificada e pedidos aos outros agentes (17/11/2026)

Fora da Biblioteca, “Capturar trecho” e o menu de contexto não abrem mais o diálogo
de material: o painel pergunta “Enviar este trecho no chat?” (prévia, “Usar no chat”,
“Descartar”). Na Biblioteca, o fluxo de material segue igual. Leitura visual da
página, ampliação das capacidades da IA e as páginas do navegador no modelo do
Safari estão designadas em [PEDIDO_VISAO_E_NAVEGADOR.md](PEDIDO_VISAO_E_NAVEGADOR.md);
o desenho dessas páginas está no Canvas, para aprovação.

## Guia da Frente 3 — ajustes (17/11/2026)

- Shell: `#panel` com `aria-keyshortcuts` e atalho Ctrl+Shift+L no título; Ctrl+L
  no shell não captura mais Ctrl+Shift+L. Minimizar já chama `win.minimize()` e o
  rótulo é “Minimizar janela” (ponto do STATUS resolvido). Na barra “⋯”, “Largura”
  e “Início” encurtados para caber em 900 px (nomes acessíveis completos).
- Os chips `data-context` do shell **não voltaram**: foram retirados a pedido do
  usuário (redundância). Resumir/print/imagem continuam no “⋯” e no painel.
- Painel: “Novo chat”; sugestões “Resumir página” e “Principais pontos”/“Questões
  de estudo” anexam a página (`capture.page`), “Explicar seleção” anexa o trecho;
  “+” → “Usar página atual” / “Usar seleção da aba”. Chip em alerta quando a aba
  mudou desde a captura. Modelo junto à resposta (servido pela CLI, ou o pedido
  quando o contrato não informa). Aviso de créditos ao escolher Fable. Imagens:
  o texto do menu diz se o modelo escolhido as analisa (1.2 experimental) ou não.
- Flocos decorativos retirados de trás de textos e controles (cabeçalho do shell,
  painel, menu lateral, diálogos). Ficam só na nova aba (`home.css`) e na ilustração
  do guia.
- Conferido em Electron: janela 900×640 sem estouro no shell nem na barra “⋯”;
  painel 440 e 360 px sem rolagem horizontal e com o compositor visível; Tab chega
  ao compositor com anel de foco de 2 px; novas cores de texto com contraste ≥ 4,5:1.

## Ligação do contrato de conversas (17/11/2026)

Base `codex/browser-capture-clis` em 31c3d43 (PR #11 integrada pelo Codex).
Prompt: [PROMPT_CLAUDE_FRONTEND_CHAT.md](PROMPT_CLAUDE_FRONTEND_CHAT.md); contrato:
[ENTREGA_BACKEND_CHAT.md](ENTREGA_BACKEND_CHAT.md). Arquivos: `frontend/src/*`,
`desktop/ui/index.html|shell.js|shell.css`, testes de interface
(`frontend/tests/logic.test.mjs`, `desktop/tests/smoke.cjs`, `scripts/verify_ui.py`).
Backend, IPC e runtime não foram alterados. Nenhuma geração real.

| Item do prompt | Situação na interface |
| --- | --- |
| 1. Conversas | Envio por `conversations.turns.send`; `tasks.plan`/`tasks.enqueue` não são mais usados no chat. Seletor “Conversa” lista `conversations.list`; “Nova conversa” gera UUID real, criado no 1º envio com título da mensagem. Histórico vem de `turns.list` + `turns.get`; a conversa ativa volta após reiniciar. Sem filtro por data. |
| | Antes de enviar, o corpo inteiro e o `turn_id` ficam em `localStorage` (`yuki:pending-send`). Resposta perdida → “Consultar estado” (`turns.get`) ou “Reenviar o mesmo pedido” (mesmo corpo). Após reiniciar, o envio pendente volta para consulta, sem reenvio automático. Recusa definitiva não cria turno e devolve o texto ao campo. |
| 2. Aceite | Cartão: limite indicativo, autorização e “Não perguntar de novo nesta conversa” (`consent.set`). Com aceite válido e coberto (`consentCovers`), o envio usa `consent_id` sem cartão. Chip “Envio autorizado nesta conversa · Revogar” (`consent.revoke`). `conversation_consent_revoked/scope_changed` limpa o aceite e reabre o cartão. Imagem e revisão sempre pedem confirmação. |
| 3. Contexto | “+” → “Texto da página inteira” (`capture.page`) e “Trecho selecionado”. Viram `snapshots` do turno; o chat não cria mais material na biblioteca. Chip mostra título, “página”/“trecho” e “página anterior” quando `activePage.document_id` mudou. Remover descarta (`capture.clear`). |
| 4. Runtime | `focusComposer` foca `#instruction`; `activePage` atualiza o estado da página. Largura: “⋯” → “Largura do painel” (controle deslizante 320–800 px com `panel.resize`). |
| 5. Perfis | Seletor com “Perfil de resposta” (Rápido/Normal/Profundo → `response_profile`) e “Escolher modelo” (`preferred_model_id`). `kind=general`. Perfis não incluem Fable. Revisão em “Avançado” no cartão, explicando a segunda chamada e a política do revisor. |
| 6. Visão | Só quando o catálogo é 1.2 e todos os modelos autorizados declaram `input.image.supported`. A Biblioteca libera a seleção de uma imagem; o cartão mostra prévia e pede “Enviar esta imagem ao Claude (experimental)” (`allow_visual_input`). Mais de uma imagem bloqueia o envio. Sem base64 no texto. |
| 7. Detalhes/erros | “Detalhes técnicos”: modelo servido, duração (ausente não vira zero), impressão do pedido e perfil. Erros tipados do Codex preservados; corte sem texto não é anunciado como parcial. Sem “Parar” nem horário de renovação. |

Sem execução (`task_execution=false`, inclusive na demonstração), o envio fica
desativado com aviso e o rascunho permanece. Atividade continua por `tasks.list`.

### Dependências novas (Codex)

| # | Problema | Evidência / arquivos | Proposta |
| --- | --- | --- | --- |
| D1 | O estado do runtime não informa a largura atual do painel | `snapshot()` em `desktop/main.cjs`; o shell mostra a última largura escolhida nele (`shortcut:` em `shell.js`) | Incluir `panelWidth` efetivo no estado publicado |
| D2 | Alça de arrastar na borda do painel não é possível | A view do painel cobre a borda; `panel.resize` só existe em `navigatorApp` (shell) | Expor `panel.resize` ao workspace ou aceitar o controle na barra “⋯” como definitivo |
| D3 | O armazenamento do runtime aceita só `draft:*` até 8.000 caracteres | `workspace:storage` em `main.cjs`; corpo com snapshot chega a 38.000 | Hoje uso `localStorage` do painel; se preferir, chave própria `pending-send` com limite maior |
| D4 | Turno ou conversa inexistente volta como `http_404` genérico | `native_host/bridge.py`; a interface depende desse código para “não registrado” | Códigos explícitos `turn_not_found`/`conversation_not_found` |
| D5 | Reabrir uma conversa custa 1 + N chamadas | `turns.list` traz só prévia de 500 caracteres | Opção de lista com tarefa completa, se o custo aparecer |
| D6 | Seletor mostra só a 1ª página de conversas (30) | `conversations.list` | Paginação na interface, quando houver mais de 30 |

## Testes faltantes por responsável (17/11/2026)

Testes desta entrega, em Linux (Xvfb): backend 92, gateway 103 (1 real ignorado),
frontend 22, políticas desktop 3, `verify_ui.py` e smoke Electron aprovados. O smoke
cobre: aceites antes de gerar, 1ª resposta, aceite único da conversa, histórico
chegando ao gateway (`generations[1]` contém a 1ª pergunta), envio sem cartão com
aceite, revogação sem despacho, controle de largura, reabrir com a conversa
restaurada e sem nova geração.

### Claude de interface (frontend/ e desktop/ui/)

| # | Teste que falta | Por que | Como |
| --- | --- | --- | --- |
| I1 | Envio perdido de ponta a ponta: perder a resposta de `turns.send`, “Consultar estado” e “Reenviar o mesmo pedido” → um só turno e uma só geração | Só a regra (`sendOutcomeUnknown`) tem teste de unidade | Smoke com resposta descartada no IPC; depende de gancho de teste do Codex (X2) |
| I2 | Reiniciar com envio pendente em `localStorage` | Caminho de restauração sem teste | Smoke: gravar `yuki:pending-send`, reabrir, ver cartão e nenhuma geração automática |
| I3 | Contexto não troca ao navegar | Critério do prompt; só o runtime está testado | Anexar “Texto da página inteira”, recarregar, ver “página anterior” e conferir `turn.snapshots[0].document_id` igual ao original |
| I4 | Foco ao abrir o painel (botão e Ctrl+Shift+L) | `focusComposer` sem asserção | Smoke: fechar/abrir painel e `toBeFocused()` em `#instruction` |
| I5 | Perfis e escolha explícita | Só `buildTurn` testado | Smoke: “Profundo” envia `response_profile=deep`; modelo pelo nome envia `preferred_model_id`; Fable nunca entra por perfil |
| I6 | Revisão em “Avançado” | Sem teste de UI | Fixture com 2 modelos: `mode=review`, 2 gerações, “Não perguntar de novo” desativado |
| I7 | Mudança de escopo depois do aceite | Sem teste de UI | Aceitar com modelo A, trocar para B: cartão reaparece e nada é despachado |
| I8 | Visão na interface | Catálogo do smoke não declara imagem | Fixture 1.2 com `input.image.supported`: prévia, checkbox obrigatório, 1 imagem, `allow_visual_input=true` |
| I9 | Mensagens dos erros tipados | `provider_model_requires_credits`, `_unavailable`, `_rate_limited`, `_output_limit_reached` sem teste de `describeChatError` | Testes de unidade em `logic.test.mjs` |
| I10 | Várias conversas e troca | Seletor sem teste | Duas conversas, alternar, histórico certo em cada; “Nova conversa” bloqueada com envio pendente |
| I11 | 360 px com seletor de conversa e chip de aceite | `verify_ui.py` mede 360 px sem aceite ativo | Medir `scrollWidth` com o chip visível |
| I12 | Windows | Tudo acima rodou só em Linux | Repetir `test:ui` e `verify_ui.py` no Windows (com X1) |

### Codex (backend, contratos, runtime e integração)

| # | Teste ou validação que falta | Por que | Como |
| --- | --- | --- | --- |
| X1 | Validação Windows desta versão | `VALIDACAO_WINDOWS_ATUAL.md` ainda sem saída do usuário | Roteiro existente, sem geração real |
| X2 | Gancho para perder resposta de IPC/ponte em teste | Necessário para I1 | Variável só de teste que descarta a 1ª resposta de `conversations.turns.send` depois do backend gravar |
| X3 | Comparação da resposta cortada (C2) | `inspect_saved_response.py` ainda não rodou no PC | Tarefa `3ca05830-926f-47ca-96d8-0ccfe7399a4d`, leitura `mode=ro` |
| X4 | Largura após reiniciar | Smoke ajusta 520/320, mas não confere depois de reabrir | Conferir a largura da view na reabertura (com D1) |
| X5 | Códigos 404 explícitos na ponte | D4 | Teste de `bridge.py` para turno/conversa inexistentes |
| X6 | Geração real pequena após a correção do `stream-json` | Prova de que a resposta em vários blocos chega inteira; dublês não provam a CLI real | Só com o usuário, autorização explícita, teto 128 |
| X7 | Visão real | Validada só com dublês | `IA_BBARU_CLAUDE_CODE_VISION_MODELS=sonnet`, 1 PNG pequena, com autorização; falha explícita se a CLI resumir o eco |
| X8 | Erros reais da CLI | Código de saída/subtipo de teto, recusa de modelo e créditos só lidos no pacote | Observar quando ocorrerem; sem provocar gasto |
| X9 | Instalador | `.ico`/`.icns` existem, instalador assinado não foi gerado | Empacotar e abrir no Windows |

### Claude da CLI (análise, sem código)

| # | Pendência | Como |
| --- | --- | --- |
| A3 | Revisar a montagem `stream-json` do Codex (P-7) contra o pacote da CLI atual | Agrupamento por `message.id`, comparação com `result`, `system/model_fallback` |
| A4 | Eco da imagem por `--replay-user-messages` | Ler o pacote: o eco é completo ou resumido? O gateway exige eco exato (X7) |
| A5 | Efeito de `CLAUDE_CODE_NO_MODEL_FALLBACK` em execução | Hoje só `[P]`; indicar o que uma execução real precisa registrar |
| A6 | Raciocínio (effort/thinking) do Sonnet em `-p` e se conta no teto | Hipótese H2 da falha antiga |
| A7 | Atualização automática da CLI entre diagnóstico e execução | Propor como registrar a versão usada em cada etapa |

### Usuário

| # | Pendência | Como |
| --- | --- | --- |
| U1 | Rodar a leitura da resposta cortada | `scripts/inspect_saved_response.py` (VALIDACAO_WINDOWS_ATUAL.md); não gera |
| U2 | Inicialização de teste desta interface | Atualizar `W:\Projeto\Ia-bbaru-chat` com esta branch e seguir o roteiro do Codex; abrir e consultar não gera |
| U3 | Autorizar ou não X6/X7 | Só quando o Codex conduzir |

### Pendências de 16/11 já resolvidas

C1 (PR #11 integrada), C3 (prompt pede título), C4 (contrato de conversa), C5
(captura da página), C6 (foco/atalho/largura; cancelamento fora do contrato), C7
(visão experimental), C8 (`kind=general` e perfis), C9 (ícones), C10 (STATUS e
DIVISAO atualizados), A1/A2 (análise integrada). Continuam abertos: C2 (X3), C11 (X1/I12).

## O que foi entregue

A aba principal passou a ser uma conversa, usando só operações que já existem
(`projects.create`, `sources.create`, `tasks.plan`, `tasks.enqueue`, `tasks.resume`,
`tasks.get`, `tasks.list`). Cada tarefa do projeto é um turno.

- **Entrada:** botão do shell renomeado para “Conversar com Claude”. Ao abrir ou
  voltar ao painel, o foco vai para o campo de mensagem. Nada é enviado ao abrir.
- **Compositor fixo** no rodapé, em pílula: anexos, campo `#instruction`, envio por
  Enter (Shift+Enter quebra linha), modelo, tipo de tarefa e contador.
- **Conversa contínua:** mensagem à direita, resposta do Claude como conteúdo
  principal, modelo usado ao lado do nome, copiar resposta. Sem diálogo no envio
  nem na resposta.
- **Contexto visível e removível:** o trecho selecionado da aba vira um chip no
  compositor, com título, tamanho, prévia do texto e remoção. Materiais da
  biblioteca selecionados aparecem como outro chip.
- **Sem percurso obrigatório:** não é preciso criar projeto, material nem plano.
  Se não houver projeto, o primeiro envio cria “Conversas”.
- **Aceites preservados, dentro da conversa:** antes de salvar qualquer coisa, o
  envio pede os mesmos aceites de antes, por mensagem: “Aceito o limite
  indicativo para esta tarefa” (quando o modelo exige) e “Autorizo executar esta
  tarefa com minha conta”. Cancelar mantém o rascunho. A mensagem seguinte começa
  desmarcada. O frontend não marca `confirmed=true` sem essa ação.
- **Estados reais:** “Preparando o pedido…”, “Aguardando o gateway local…”,
  “Aguardando o Claude…”. Não há digitação simulada nem resposta parcial inventada;
  o contrato declara `streaming=false`.
- **Erros na conversa:** frase compreensível e orientação por causa conhecida
  (`describeChatError`). `provider_error` não sugere login, cota ou limite. O
  código técnico fica em “Detalhes técnicos”, recolhido. Saída parcial é preservada.
- **Sem repetição cega:** “Editar e enviar de novo” só recoloca o texto no campo;
  um novo envio exige novos aceites. Confirmação de enfileiramento perdida leva a
  “Consultar estado”, nunca a um segundo enfileiramento.
- **Detalhes técnicos recolhidos** por turno (estado, diagnóstico, modelo, limite,
  término, tentativas, contrato, identificador) e o diálogo de tarefa continua
  disponível por “Abrir detalhes da tarefa”.
- **Topo compacto no painel:** uma linha de 44 px (marca, projeto, estado da
  conexão, ampliar) e a linha de abas. Biblioteca, Atividade e Conexões saíram da
  tela de conversa e ficam nas abas.
- **Legibilidade:** o padrão de flocos não aparece atrás da conversa. Cores,
  raios, marca Yuki e o restante do tema foram mantidos.

## Revisão do trabalho anterior do Gemini (branch gemini/chromium-ui)

A branch não foi incorporada. Foi lida como referência e reaproveitada só a ideia
de estado inicial com sugestões, compositor em pílula e menu de anexos; o código é novo.

Não aproveitado, com motivo:
- O envio ainda abria o diálogo do plano e o botão se chamava “Criar plano”.
- As sugestões “Resumir esta página” preenchiam o texto sem capturar a página:
  o Claude receberia um pedido sobre uma página que não foi enviada.
- Emojis como ícones e decoração sobre o texto.
- Três cabeçalhos empilhados (barra, abas e título) antes da conversa.
- Seleção de modelos e papéis em painel aberto dentro do chat.
- Cores fora dos tokens do tema e variável `--text-secondary` inexistente.

## Dependências de backend/IPC (para o Codex)

Cada item descreve o que a interface faz hoje e o que falta. Nenhum foi contornado
com contrato alternativo, fila própria ou dado simulado.

1. **Aceite simplificado.** Hoje: dois aceites por mensagem. Falta: configuração
   inicial explícita e revogável, com escopo e versão, copiada para cada tarefa
   (AJUSTES_CHAT_LATERAL, “Estados, erros e aceite”). Arquivos: contrato de tarefas,
   backend. Enquanto não existir, a interface mantém os dois aceites.
2. **Continuidade entre turnos.** Hoje: cada mensagem é uma tarefa isolada; o
   compositor avisa “Sem histórico entre mensagens”. Falta: `conversation_id`,
   `turn_id` e montagem do histórico autorizado pelo backend.
3. **Nova conversa.** Hoje: marcador local `chat-start:<projeto>` no armazenamento
   de rascunhos; só esconde os turnos anteriores, que continuam em Atividade.
   Falta: conversas persistidas.
4. **Usar página atual.** Hoje: só o trecho selecionado (`capture.selection`).
   Falta: captura do texto da aba com identidade do documento, URL, título,
   instante e detecção de navegação; aviso de contexto antigo ao trocar de página.
5. **Contexto do turno.** Hoje: o chip vira um material do projeto
   (`sources.create`) no envio, para poder entrar em `source_ids`; por isso aparece
   na biblioteca. Falta: snapshot de contexto ligado ao turno, sem virar material.
6. **Projeto implícito.** Hoje: a interface cria o projeto “Conversas” no primeiro
   envio. Falta: vínculo interno do backend para conversas sem projeto.
7. **Envio idempotente.** Hoje: `tasks.plan` seguido de `tasks.enqueue`; se a
   segunda resposta se perde, o turno fica como “pedido salvo” e exige consulta de
   estado. Falta: uma operação única, persistida antes de despachar.
8. **Contexto nos turnos listados.** Os chips de fonte só aparecem quando
   `tasks.list`/`tasks.get` devolvem `context`. Conferir se a listagem inclui.
9. **Foco ao abrir o painel.** Hoje: evento `focus` da janela do painel. Falta:
   sinal do shell ao alternar `#panel`, se o foco da view não mudar.
10. **Revisão por outro modelo.** Saiu da conversa (o chat envia `mode: "single"`).
    O backend continua aceitando `review`. Decidir onde a opção avançada reaparece.
11. **Interromper.** Não há operação de cancelamento exposta; a interface não
    mostra o botão.
12. **Painel redimensionável e atalho de teclado.** Dependem do runtime Electron.
13. **Visão.** Prints e imagens continuam só armazenados; o menu de anexos avisa
    que o Claude ainda não os analisa.

## Testes e evidências

Tudo com dublês e fixtures. Nenhuma conta real, nenhuma geração real.

| Verificação | Resultado |
| --- | --- |
| `npm --prefix frontend test` | 18 de 18 (11 anteriores + 7 novos do chat) |
| `npm --prefix frontend run build` | aprovado, `tsc --noEmit` incluído |
| `npm --prefix desktop run test:ui` (Linux, Xvfb, sandbox desativada só no teste) | aprovado |
| `scripts/verify_ui.py` | aprovado (passou a usar Chromium; ver remoção do Firefox) |

Windows não foi testado.

### Testes de integração adaptados (revisar)

`desktop/tests/smoke.cjs` e `scripts/verify_ui.py` dependiam do fluxo antigo
(clicar no cartão do modelo, “Criar plano”, diálogo do plano). Foram adaptados
ao chat, mantendo as verificações de backend:

- Nada é salvo nem gerado antes dos dois aceites (0 tarefas, 0 gerações).
- O aceite do limite sozinho não habilita o envio.
- Uma única geração, `request_id` da tarefa, `allow_unenforced_output_limit` e
  contrato 1.1 persistidos; execução continua com o painel oculto.
- A resposta aparece na conversa, sem diálogo; detalhes técnicos recolhidos.
- Os selos do contrato 1.1 continuam verificados no diálogo de detalhes.
- Aceites desmarcados na mensagem seguinte; cancelar preserva o rascunho.
- “Adicionar texto” e as capturas com rascunho protegido passam a ser exercitados
  na aba Biblioteca. `#capture` do shell continua abrindo a revisão em diálogo.

Seletores mantidos: `#instruction`, `#project`, “Novo projeto”, “Backend local
ativo”, “Adicionar texto”, os dois textos de aceite, “Executar tarefa” (turno
salvo e ainda não enviado) e “Conexões”. Seletores alterados: o envio chama-se
“Enviar”; o modelo é escolhido em “Modelo Claude”; a aba chama-se “Chat”.

## Pendências da própria interface

Resolvido em 16/11: regras de CSS dos componentes removidos, `validateDraft` sem uso
e o rótulo "Perguntar ao Yuki" no guia. Continuam:
- Auditoria axe do painel não executada (o pacote não está instalado aqui).
- Menus nativos: sair com Tab deixa o menu aberto até um clique fora.
- No painel estreito, trocar de projeto exige voltar ao chat (o seletor fica no
  compositor).

## Remoção do suporte ao Firefox (12/11/2026)

Pedido explícito do usuário: trabalhar somente com o navegador Chromium. Entregue
em commit próprio para revisão separada, porque toca `extension/` e `native_host/`,
áreas do Codex.

Removido:
- `extension/` (manifesto, `background.js`, ícone) e o build copiado para `extension/app/`.
- `native_host/install.py` e o `EXTENSION_ID`/`HOST_NAME`: registravam o host de
  Native Messaging no Firefox. O desktop cria a própria configuração.
- No frontend: `inFirefox`, `window.browser`, o link do guia Firefox e
  `frontend/scripts/package.mjs`; `npm run build` não copia mais para `extension/`.
- `frontend/tests/background.test.mjs` (testava o `background.js` da extensão).
- `docs/INSTALAR_FIREFOX.md` e as referências no README.

Mantido, porque o Chromium usa: `native_host/bridge.py`, `__main__.py` e
`service.py` (`desktop/local-service.cjs` sobe `native_host.service` e a ponte
`native_host`). Os testes da ponte continuam; o teste do instalador virou teste de
`load_config` (backend só em loopback e token longo), e o teste do processo nativo
gera a configuração no próprio teste.

`scripts/verify_ui.py` passou a rodar em Chromium com a ponte simulada no formato
de `desktop/workspace-preload.cjs` (`window.iaDesktop`). Aceita
`IA_BBARU_CHROMIUM_PATH` para usar um Chromium já instalado.

Não alterado: documentos históricos (briefings e revisões antigas que citam o
Firefox), `scripts/audit_copies.py` e `scripts/consolidate_copies.py`.

Evidências após a remoção: `python -m unittest discover -s tests` 75 de 75;
frontend 15 de 15 (os 3 testes do `background.js` saíram com a extensão); build
aprovado; `desktop` 3 de 3; teste gráfico Chromium e `verify_ui.py` aprovados.

## Alinhamento ao design aprovado no canvas (12/11/2026)

O usuário apontou diferenças entre o app e a proposta do canvas ("Proposta · chat
lateral"). Ajustado para seguir a proposta:

- **Painel (até 700 px):** um topo de 44 px com pílula do modelo (ponto de
  conexão), pílula do projeto, nova conversa, menu "Mais opções" (Chat,
  Biblioteca, Atividade, Conexões, Novo projeto, Conhecendo o Yuki) e ampliar.
  Saem a barra superior, as abas e o título "Chat com Claude" do painel.
- **Página ampla:** mantém a barra lateral e a barra superior; acima da conversa,
  pílula do modelo e "Nova conversa".
- **Estado inicial:** marca Yuki, "Como posso ajudar hoje?" e quatro sugestões
  com ✨ 🔍 💡 ✍; atalhos acima do campo.
- **Confirmação dentro da conversa:** a mensagem aparece como balão e, abaixo, o
  cartão "Enviar ao Claude?" com os mesmos dois aceites por mensagem.
- **Resposta:** avatar ❄, nome do modelo curto (ex.: Sonnet), texto alinhado ao
  nome, "Copiar", "Tentar novamente" e "Detalhes técnicos" à direita.
- **Espera:** três pontos e "Claude está pensando…" (fila: "Preparando o pedido…").
- **Erro:** cartão com "Tentar novamente"; `provider_error` em âmbar, como no canvas.
- **Fontes citadas:** quando o Claude cita o id de uma fonte do turno, a
  interface mostra o título (só na exibição; o texto salvo não muda).

Diferenças mantidas de propósito em relação ao canvas:
- "Resumir esta página" virou "Resumir a seleção": o app só envia o trecho
  selecionado, não lê a página inteira (dependência 4).
- Sem "Sempre enviar neste projeto": o aceite continua por mensagem (dependência 1).
- Os dois aceites aparecem no cartão de confirmação.
- "Tentar novamente" recoloca o texto no campo; o reenvio pede os aceites de novo.

Testes: frontend 17 de 17; build; desktop 3 de 3; teste gráfico Chromium e
`verify_ui.py` aprovados. Os testes passaram a abrir Biblioteca, Conexões e
"Novo projeto" pelo menu "Mais opções" no painel.

### Primeira geração real (12/11/2026, Windows, conta do usuário)

Executada pelo usuário com este frontend e `-Models "sonnet"`, uma mensagem com
um trecho de página anexado. Estado "Concluída", 1 tentativa, término informado
pelo provedor, contrato 1.1. A interface funcionou (projeto criado no envio,
contexto enviado e exibido, resposta na conversa sem diálogo).

Achado para o Codex: o texto exibido como resposta foi apenas
"-48dc-b51a-4c4ebcb0da4e).", o final de um identificador. O prompt do gateway pede
"cite o id da fonte" (`integrations/prompt.py`), o que sugere uma frase que
terminava citando o id. A interface mostra `task.output` inteiro, então a saída
parece ter chegado cortada ao backend. Falta confirmar com o texto completo do
diálogo de detalhes da tarefa, já solicitado ao usuário.

## Revisão com o modern-web-guidance (12/11/2026)

Suporte: só o Chromium do Electron 45 (Chromium 156), sem fallback para outros
navegadores. Aplicado:
- Menus "Mais opções" e "Anexar contexto" (`components/Menu.tsx`): popover nativo
  com `command="toggle-popover"` (Esc, clique fora e retorno do foco pelo navegador),
  `focusgroup="menu"` (setas, Home/End e papéis menu/menuitem) e anchor positioning.
  Antes usavam `role="menu"` sem setas e código próprio de fechamento.
- Campo de mensagem cresce com `field-sizing: content`, sem JavaScript.
- Os testes acham os itens como botões dentro de `.header-menu`: o Playwright
  calcula papéis sozinho e não infere os do focusgroup.

Mantido: Enter com IME já checava `isComposing`; diálogos de edição continuam sem
fechar por clique fora, para não perder rascunho.

## Ícone principal (14/11/2026)

Novo ícone aprovado pelo usuário: floco de seis braços com ramos e centro
hexagonal, preto em quadrado branco com degradê gelo. Arquivos em
`desktop/ui/icon.svg` e `desktop/ui/icon.png` (512 px). Aplicado no favicon do
shell, da página inicial e do frontend, na marca do shell, da página inicial e
no `YukiMark`. Fora da área de interface, a pedido do usuário: uma linha em
`desktop/main.cjs` (`icon` do `BrowserWindow`) para a janela e a barra de tarefas.
Ícones de instalador (`.ico`/`.icns`) ainda não existem.

## Menos botões e chat no estilo Atlas (16/11/2026)

Pedido do usuário, com captura do painel lateral do Atlas como referência.

- **Barra do navegador:** visíveis só voltar, avançar, recarregar, endereço (com
  segurança e favorito), "⋯", "❄ Perguntar ao Claude" e ampliar. "⋯" troca os
  favoritos pelas ações menos usadas (capturar trecho, print, imagem, buscar, zoom,
  histórico, página inicial, reabrir aba). Não é menu suspenso porque a página web
  cobre o shell abaixo de 106 px. Saíram os atalhos "Resumir página / Analisar
  print / Extrair imagem" (repetiam o "+" do chat). Ids e handlers mantidos.
- **Nova aba:** só marca, título, uma frase e o atalho do Claude. Saíram os quatro
  cartões sem ação e o guia de 5 passos (continua em "Conhecendo o Yuki").
- **Painel:** topo só com ampliar, nova conversa e "⋯". Modelo e projeto foram para
  a barra do compositor ("+", modelo, projeto, enviar). Saíram a fileira de atalhos,
  o tipo de tarefa (fixo em "study", marcado com `shortcut:`) e a dica de teclado.
  Mensagens: trechos acima do balão, resposta em texto corrido sem avatar, ações em
  ícones, espera em uma linha. O modelo usado aparece em "Detalhes técnicos".
