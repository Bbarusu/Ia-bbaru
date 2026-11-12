# Passagem do frontend — chat lateral (Claude, interface)

Registro de 12/11/2026. Responsável: Claude (interface), conforme atribuição
explícita do usuário para `frontend/` e `desktop/ui/`. Base: `codex/browser-capture-clis`
em 4e6679e. Branch de entrega: `claude/friendly-curie-pxw81w`.
Nenhuma alteração em backend, gateway, contratos, Electron/IPC ou persistência.

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

- `frontend/src/style.css` ainda tem regras dos componentes removidos
  (`WorkspaceComposer`, `AgentsSection`, `ContextGuideCard`); limpeza em entrega própria.
- `validateDraft` em `logic.mjs` ficou sem uso na interface (continua testada).
- A página inicial e o guia ainda dizem “Perguntar ao Yuki”; alinhar ao novo rótulo.
- Acessibilidade do painel verificada por papéis e nomes nos testes; auditoria
  axe do painel não foi executada (o pacote não está instalado aqui).

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
