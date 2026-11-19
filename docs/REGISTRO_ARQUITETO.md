# Registro para o arquiteto-chefe — Yuki / Ia-bbaru

Data: 17/11/2026. Autor: Claude de interface (`frontend/`, `desktop/ui/`).
Objetivo: dar o ponto atual do projeto, o que está provado, o que falta e quais
decisões dependem de arquitetura ou do usuário. Fontes primárias ao final.
Níveis de evidência: **[T]** teste automatizado com dublês, **[V]** conferência
visual automatizada, **[R]** execução real com conta, **[—]** não verificado.

## 1. Resumo

O Yuki é um navegador Electron/Chromium com um painel lateral de chat com o Claude.
O Claude Code roda pela assinatura do usuário, sem chave de API e com ferramentas
desligadas. Backend, contrato de conversas, gateway 1.2 e runtime estão
implementados e testados em Linux com dublês. A interface do chat já usa conversas
reais, aceite revogável, snapshots da página e páginas do navegador
(Histórico/Downloads/Ajustes), mas **ainda não foi integrada na branch do Codex**.
Nenhuma parte foi validada no Windows nesta rodada. Depois da correção do parser,
não houve geração real nova. A única geração real anterior teve a resposta exibida
cortada, com causa não confirmada.

## 2. Branches e integração

| Branch | Papel | Ponto | Situação |
| --- | --- | --- | --- |
| `main` | Produção | — | Não recebe nada desta frente. PR #10 (Gemini → main) continua aberta, sem decisão |
| `codex/browser-capture-clis` (PR #7) | Integração (Codex) | `93b44f6` | Backend/runtime atuais; a interface parou na PR #11 (`b2735ca`) |
| `claude/friendly-curie-pxw81w` | Interface (Claude) | `629254c` | Contém a base inteira até `93b44f6` e mais 7 commits de interface. **Aguarda integração**: deve entrar por fast-forward |

Risco: as duas linhas andam em paralelo. Enquanto a integração não acontece, quem
testar pela branch do Codex vê a interface antiga, com tarefas avulsas e aceite
por mensagem.

## 3. Arquitetura em vigor

```
Shell Electron (desktop/ui: index.html, shell.js)  ── navigatorApp (IPC browser:command)
 ├─ Abas web (WebContentsView, partição persist:web, sandbox, sem preload)
 └─ Painel (frontend React, WebContentsView, preload iaDesktop)
       │  runtime.sendMessage: bridge.request · capture.* · context.status
       ▼
 desktop/main.cjs (processo principal: abas, capturas, CDP privado, políticas)
       │  stdio, envelope protocol_version "0"
       ▼
 native_host/bridge.py ── HTTP local com Bearer ──► backend FastAPI
                                                    (SQLite launcher.sqlite3,
                                                     fila durável única + worker,
                                                     conversas/turnos/aceites)
                                                          │ HTTP 1 / 1.1 / 1.2
                                                          ▼
                                    gateway integrations (porta 8010, gateway.sqlite3,
                                    deduplicação por request_id, diagnóstico sanitizado)
                                                          │ subprocesso
                                                          ▼
                    Claude Code CLI (--print, stream-json interno, --tools "",
                    --safe-mode, sem fallback de modelo, assinatura do usuário)
```

Regras fixas, que o código impõe hoje:
- Só Claude Code e só assinatura. Sem fallback para API, sem troca automática de
  modelo, e Fable só entra por escolha explícita.
- Ferramentas da CLI desligadas (`tools=[]`).
- Toda execução exige aceite da pessoa (`confirmed` ou `consent_id`). Nada se
  repete sozinho depois de cota, teto, timeout ou resultado incerto.
- Envio idempotente por `turn_id`. Resposta perdida só permite consultar ou
  reenviar o mesmo corpo.
- Uma fila durável e um worker. Sem sessões persistentes da CLI: o backend monta
  o histórico.
- Abas web isoladas: permissões de site negadas, downloads bloqueados, nenhuma
  extensão.

## 4. O que está pronto

### Backend, gateway e runtime (Codex, em `codex/browser-capture-clis`)

| Item | Evidência |
| --- | --- |
| Conversas: create/list/get, turns.send/get/list, consent set/get/revoke; histórico com fontes únicas; orçamento de contexto igual no backend e no gateway (inclui revisão); migração não destrutiva `chat_turns` → `conversation_turns` | [T] backend 96 |
| Gateway 1.2: modelo servido, `duration_ms`, `request_fingerprint`, erros tipados (créditos, modelo indisponível, teto, taxa, cota) | [T] gateway 108 (1 real ignorado) |
| Parser `stream-json` recompõe vários blocos de texto (correção provável da resposta cortada) | [T] com dublê; [—] na CLI real |
| Visão experimental: 1 PNG/JPEG ≤ 480 KB vinda da biblioteca, aceite visual, conferência de hash e do eco | [T]; desligada por padrão; [—] real |
| Runtime: `capture.page` (texto ≤ 38.000), `capture.page.visual` (página inteira ≤ 8.000 px/16 MP/480 KB), identidade do documento (`document_id`, `tab_id`, `documentVersion`), `focusComposer`, `panel.resize`, `maximize`, menu “Perguntar ao Claude sobre a seleção” | [T] smoke Electron |
| Ícones `.ico`/`.icns` | Gerados; instalador assinado não produzido |

### Interface (Claude, em `claude/friendly-curie-pxw81w@629254c`)

| Item | Evidência |
| --- | --- |
| Chat por `conversations.*`; corpo e `turn_id` persistidos antes do envio; cartão de envio perdido (“Consultar estado”, “Reenviar o mesmo pedido”); restauração depois de reiniciar sem reenvio | [T] lógica; [T] smoke: reabrir não gera |
| Aceite único revogável por conversa; revisão e imagem sempre pedem confirmação | [T] smoke: aceite → envio sem cartão → revogar → nenhum despacho |
| Histórico real: a 2ª mensagem leva a 1ª ao gateway | [T] smoke |
| Contexto: “Usar página atual”, “Usar seleção”, “Print da página inteira”; trecho do navegador pede só “Enviar este trecho no chat?”; aviso “a aba mudou desde a captura” | [T] smoke (trecho → chat); [V] |
| Perfis Rápido/Normal/Profundo + modelo explícito; revisão em “Avançado”; aviso de créditos do Fable | [T] lógica |
| Detalhes: modelo servido, duração, impressão do pedido; erros tipados sem inventar parcial | [T] lógica; [V] |
| Páginas no painel: Histórico (busca, apagar, limpar), Downloads (vazio, explicando o bloqueio), Ajustes (Geral, Personalização, Privacidade, Extensões) | [T] smoke: Ajustes ↔ barra; [V] 360/440 px e página ampla |
| Barra: bolinhas fechar/minimizar/ampliar à direita; “⋯” com Largura, Downloads e Ajustes; atalho Ctrl+Shift+L | [T]; [V] em 900×640 |
| Layout: 360–440 px e 900×640 sem rolagem horizontal, foco visível, contraste ≥ 4,5:1 nas cores novas | [V] |

Testes da branch de interface (Linux/Xvfb, só dublês): backend 96, gateway 108
executados (1 real ignorado), frontend 22, desktop 6, `verify_ui.py` e smoke
Electron aprovados. **[—] Windows.**

### Análise da CLI (Claude da CLI)

`integrations/docs/ANALISE_CLI_CLAUDE.md`, seção 8 (base `31c3d43`): todas as flags
do adaptador conferidas nas versões 2.1.307 e 2.1.322. A CLI no Windows se atualiza
sozinha, então a versão real hoje é desconhecida.

## 5. Pendências por responsável

### Codex (backend, ponte, runtime, integração)

| Prioridade | Item | Referência |
| --- | --- | --- |
| 1 | Integrar `claude/friendly-curie-pxw81w@629254c` (fast-forward), atualizar STATUS/DIVISAO | Prompt de integração; PASSAGEM |
| 1 | Conduzir a validação no Windows desta versão, sem geração | VALIDACAO_WINDOWS_ATUAL.md (X1) |
| 1 | Rodar `inspect_saved_response.py` da tarefa `3ca05830-…` para fechar a causa da resposta cortada | X3 / C2 |
| 2 | Base persistente no processo principal para histórico e ajustes (N1/N2/N5) e migração do `localStorage` sem perda nem duplicação | PEDIDO §3–4 |
| 2 | `capture.clear` publicar `pendingCapture: null` (o painel não fecha a revisão sozinho) | PASSAGEM / smoke |
| 2 | Expor a largura efetiva do painel (D1); `panel.resize` para o painel (D2); chave própria para envio pendente acima de 8.000 caracteres (D3); códigos 404 explícitos (D4, X5) | PASSAGEM D1–D6 |
| 3 | Imagem direta no turno (V2); várias imagens/1.3 (V3); W1 (janela sem barra do sistema) | RESPOSTA_VISAO |
| 3 | Streaming SSE (C2), “Parar” durável (C3), PDF (C4) | RESPOSTA_VISAO |
| 3 | Gancho de teste para perder a resposta do IPC (X2) e testes de largura após reiniciar (X4) | PASSAGEM |
| — | Geração real pequena (X6) e visão real (X7), só com autorização do usuário | — |

### Claude de interface (frontend/, desktop/ui/)

| Item | Referência |
| --- | --- |
| Testes que faltam: envio perdido de ponta a ponta (depende de X2), reinício com envio pendente, contexto que não troca ao navegar, foco ao abrir, perfis, revisão, troca de escopo do aceite, visão, mensagens dos erros tipados, várias conversas, 360 px com aceite | PASSAGEM I1–I12 |
| Ligar cada controle “Em integração” (`data-codex`) quando o runtime existir | PEDIDO §4 |
| Dívida: `App.tsx` com ~1.670 linhas; separar conversa, capturas e envio em hooks | Este registro, §6 |

### Claude da CLI (só análise)

V4: limites de imagem, eco de várias imagens e custo em cota. A3–A7: revisar a
montagem do `stream-json`, efeito de `CLAUDE_CODE_NO_MODEL_FALLBACK`, raciocínio
contando no teto e atualização automática da CLI.

### Usuário (decisões)

- Política de downloads (N3) e se extensões entram (N4).
- Se ferramentas web (WebSearch/WebFetch) podem ser habilitadas. Isso muda a
  regra `tools=[]` (C5).
- Autorizar uma geração real pequena e um teste de visão real (X6/X7).
- Fechar ou não a PR #10 (Gemini → main). Critério para levar a PR #7 à `main`.

## 6. Riscos e dívidas técnicas para avaliação

1. **Acoplamento por `localStorage` compartilhado (atalho deliberado).** A barra
   (`shell.js`) e o painel compartilham o armazenamento de `file://` na sessão
   padrão. O evento `storage` sincroniza histórico, favoritos, prazo do histórico
   e o pedido de área (`yuki:history`, `yuki:bookmarks`,
   `yuki:history-retention`, `yuki:show-bookmarks`, `yuki:open-area`).
   Funciona e não toca o runtime, mas:
   - depende das duas views ficarem na mesma sessão e origem;
   - o histórico fica limitado às últimas 25 visitas e não chega às abas.
   Destino: API no processo principal (N2/N5).
2. **Envio pendente no `localStorage` do painel.** O armazenamento do runtime
   aceita 8.000 caracteres e um snapshot chega a 38.000. Se o perfil for
   apagado, o envio pendente se perde, mas a idempotência no backend evita
   duplicar a geração.
3. **Causa da resposta cortada ainda aberta.** O parser foi corrigido com dublês,
   mas não há prova na CLI real nem leitura dos bancos do Windows.
4. **Visão.** O caminho é longo: captura → biblioteca → seleção → aceite → envio.
   Não há anexo direto, a imagem é única e o eco da CLI real não foi verificado.
   Não deve ser ligada por padrão.
5. **Janela.** A barra nativa do sistema convive com as bolinhas (botões
   duplicados) até W1.
6. **Desempenho do chat.** Reabrir uma conversa custa 1 + N chamadas (D5), e o
   seletor mostra só as 30 conversas mais recentes (D6).
7. **Manutenção.** `App.tsx` concentra estado de chat, capturas, biblioteca e
   envio. Recomenda-se dividir antes de crescer mais.
8. **Validação.** Toda a evidência desta rodada vem de Linux/Xvfb com dublês.
   Faltam o Windows, o empacotamento e a CLI atualizada.
9. **Escopo de capacidades.** Os pedidos de “ler a página visualmente” e
   “ampliar as capacidades” pressionam a regra de ferramentas desligadas e o
   custo em cota. Precisam de decisão de arquitetura antes de qualquer contrato.

## 7. Documentos de referência

- Estado e divisão: [STATUS.md](STATUS.md), [DIVISAO_RESPONSABILIDADES.md](DIVISAO_RESPONSABILIDADES.md), [ARQUITETURA.md](ARQUITETURA.md)
- Contrato do chat: [ENTREGA_BACKEND_CHAT.md](ENTREGA_BACKEND_CHAT.md), [openapi-backend.json](openapi-backend.json), [openapi-gateway-1.2.json](openapi-gateway-1.2.json)
- Interface: [PASSAGEM_CLAUDE_FRONTEND.md](PASSAGEM_CLAUDE_FRONTEND.md) (entregas, D1–D6, testes I/X)
- Pedidos e respostas: [PEDIDO_VISAO_E_NAVEGADOR.md](PEDIDO_VISAO_E_NAVEGADOR.md), [RESPOSTA_VISAO_E_NAVEGADOR.md](RESPOSTA_VISAO_E_NAVEGADOR.md)
- CLI: [../integrations/docs/ANALISE_CLI_CLAUDE.md](../integrations/docs/ANALISE_CLI_CLAUDE.md), [RESPOSTA_ANALISE_CLI.md](RESPOSTA_ANALISE_CLI.md)
- Windows: [VALIDACAO_WINDOWS_ATUAL.md](VALIDACAO_WINDOWS_ATUAL.md)
- Desenho aprovado: Canvas “Yuki — Frontend” (https://claude.ai/code/artifact/d240d1a9-ba7e-4908-b635-58f1ad5382aa, privado; o dono precisa compartilhar)
