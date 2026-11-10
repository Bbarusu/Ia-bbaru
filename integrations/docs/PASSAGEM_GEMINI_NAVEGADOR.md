# Navegador Yuki — revisão da entrega do Gemini e roteiro funcional

Revisão do Claude em 10/11/2026, a pedido do usuário: "verifique a parte do Gemini,
levando em inspiração o OpenAI Atlas, e faça o registro para ele fazer os ajustes;
pedir também para ele focar mais na parte do navegador, para deixá-lo o mais
funcional possível". Nada fora de `integrations/` foi alterado pelo Claude.

| Revisado | SHA |
| --- | --- |
| `gemini/chromium-ui` | `fd2a574` ("remove subtabs, add real browser tools, print/image/text capture and Atlas agent triggers"), base `638e681` |
| `main` | `1c72ffa` (inclui a fila durável do Codex e o gateway) |
| Gateway | `claude/vibrant-meitner-ksbzgf` `e6afc0c` (ChatGPT e Gemini CLI) |

**Parecer:** o visual evoluiu bem (tema claro, barra organizada, favoritos,
histórico, reabrir aba). Mas **várias ferramentas novas são só aparência**: o botão
existe e a mensagem diz que algo aconteceu, sem efeito real. Para um navegador
"o mais funcional possível", a próxima rodada deve trocar aparência por função,
começando pelo processo principal do Electron.

## 1. O que foi verificado

Pasta de teste com `main` + `gemini/chromium-ui` + gateway, sem alterar branches.

| Verificação | Resultado |
| --- | --- |
| Merge com o `main` | ⚠️ conflitos em `frontend/src/style.css` (blocos CSS dos dois lados) e `desktop/ui/index.html` (ver N-3) |
| `npm --prefix frontend test` / `desktop test` / build | ✅ 11 / 3 / ✅ |
| `tests/` Python | ✅ 60 OK |
| `desktop run test:ui` (Electron real, Linux/Xvfb) | ✅ |
| `tests/integrations/desktop_gateway_smoke.cjs` (painel + gateway real + dublê) | ✅ catálogo, aceite, plano, sem geração, motivo de indisponibilidade |
| Ferramentas da barra exercitadas no Electron real | ❌ ver N-1 |
| Conta real / Windows | não feito nesta revisão |

## 2. Achados para o Gemini

**N-1 (P1) — ferramentas que parecem funcionar, mas não funcionam.** Verificado no
Electron real:
- **Zoom:** o botão passa a mostrar "150%", mas `getZoomFactor()` da aba continua 1,0.
- **Buscar na página:** mostra "Buscando… na aba ativa", nada é encontrado nem destacado
  (não há `findInPage`).
- **Print e Imagem:** só exibem uma mensagem pedindo para colar à mão.
- **"Resumir página", "Analisar print", "Extrair imagem"** (barra e página inicial):
  apenas abrem o painel com uma mensagem; nenhum conteúdo da página é lido.

A causa é estrutural: o shell só pode pedir ao processo principal as ações
`navigate`, `new`, `activate`, `close`, `back`, `forward`, `reload`, `panel`,
`expand` e `capture` (`desktop/main.cjs`). Zoom, busca, impressão e captura de tela
precisam de ações novas lá (seção 3). Até existirem, **o botão não deve aparecer**
ou deve aparecer desativado com "em breve".

**N-2 (P1) — imagens viram texto base64 dentro das fontes.** `SourceModal.tsx` grava
`AnexoVisual: data:image/jpeg;base64,...` no conteúdo da fonte, cortado em ~32 mil
caracteres (o corte pode corromper a imagem). Nenhum agente recebe imagem: as CLIs
recebem esse base64 como texto. Isso ocupa quase metade do limite de 80 mil caracteres
da tarefa, gasta cota e faz o usuário acreditar que o agente "viu" a imagem.
Correção: não colocar base64 no texto. Mostrar a prévia só localmente e salvar apenas
as notas de texto, até existir suporte a anexos binários (mudança coordenada:
backend guardar arquivos, gateway e CLIs aceitarem imagem).

**N-3 (P2) — branch desatualizada.** Base `638e681`, anterior à fila durável e ao
gateway no `main`. O merge conflita, e `index.html` volta `#tabs` para
`role="tablist"`, desfazendo a correção de acessibilidade C-4 do Codex
(`role="group"` + `aria-pressed`). Atualizar a branch a partir do `main` e manter a C-4.

**N-4 (P2) — nome de produto de terceiros na interface.** Textos e rótulos de
acessibilidade usam "Atlas" e "OpenAI" ("inspirado no Atlas da OpenAI", "estilo
Atlas", "Ações rápidas com agentes (Atlas)", selo "MODO ATLAS", classes `atlas-*`).
A inspiração pode ficar na documentação; a interface do Yuki deve usar nomes
próprios ("Ações rápidas", "Perguntar ao Yuki").

**N-5 (P2) — textos que prometem mais do que o sistema faz.** "Pergunte sobre a
página aberta" e "Resumir pontos essenciais da página" sugerem que o agente lê a aba.
Hoje ele recebe só o que foi capturado e salvo como fonte. Ajustar o texto até a
captura de página da seção 3 existir.

**N-6 (P3) — "🔒 HTTPS verificado".** Decidido só pelo prefixo do endereço. Trocar por
"Conexão HTTPS" ou usar o estado real fornecido pelo processo principal (erros de
certificado são tratados lá).

**N-7 (P3) — ajustes do gateway ainda não refletidos na UI.** Ver
`integrations/docs/PASSAGEM_CLIS.md`, seção 4 (UI-1 a UI-5): rótulos de
`output_limit: none`, `finish_reason: inferred`, `tools: restricted`, motivos do
ChatGPT/Gemini e resultado "não confirmado" sem parecer erro.

## 3. Roteiro: navegador funcional, com inspiração em navegadores com assistente

O usuário pediu foco no navegador. A referência é a experiência de navegadores com
assistente integrado, como o ChatGPT Atlas: uma barra lateral que conversa sobre a
página, com permissão por página, e uma nova aba pensada para pedir algo. A
implementação é própria, sem copiar nome, marca ou visual de outro produto, e
respeita as regras do Ia-bbaru (seção 4).

**Escopo nesta rodada:** como o Codex está sem créditos, o usuário pede que o Gemini
assuma também a parte funcional do navegador em `desktop/` (`main.cjs`, preloads,
`policy.cjs`), além de `desktop/ui/` e `frontend/`. Cada ação nova entra na lista
fechada de comandos, com validação da origem, e ganha teste no Electron real. O Codex
revisa quando voltar. `backend/`, `native_host/` e `integrations/` continuam fora.

### Fase 1 — funções básicas de navegador (prioridade)

| Função | Como fazer no Electron | Aceite (teste no Electron real) |
| --- | --- | --- |
| Buscar na página | `webContents.findInPage` / `stopFindInPage`, evento `found-in-page`; Ctrl+F, Enter, Shift+Enter, Esc | contador "2 de 5" correto na página de teste |
| Zoom | `setZoomFactor` por aba, lembrado por site; Ctrl+= / Ctrl+- / Ctrl+0 | `getZoomFactor()` muda e o rótulo bate |
| Imprimir / salvar PDF | `webContents.print` e `printToPDF`, com diálogo de onde salvar | PDF gerado no caminho escolhido |
| Captura de tela da aba | `webContents.capturePage` → arquivo PNG escolhido pelo usuário (como material, só quando houver anexos; N-2) | arquivo PNG válido |
| Restaurar sessão | gravar abas abertas no perfil; reabrir ao iniciar (opção) | abas voltam após reiniciar |
| Reabrir aba fechada | mover para o processo principal (Ctrl+Shift+T), com histórico de navegação da aba | volta com voltar/avançar |
| Atalhos | Ctrl+Tab / Ctrl+Shift+Tab, Ctrl+1..9, Alt+←/→, F5, Ctrl+Shift+T | navegação por teclado no teste |
| Menu de contexto | abrir link em nova aba, copiar link, copiar imagem; "salvar imagem" só com downloads | itens funcionam e nenhum acesso privilegiado é criado |
| Página de erro | página própria com motivo e "tentar de novo" | endereço inválido mostra a página |
| Sugestões na barra de endereço | histórico + favoritos locais, sem enviar nada à rede | sugestões aparecem ao digitar |
| Ícone, carregamento e som | favicon, barra de progresso, aba com áudio e botão de silenciar | estados visíveis |
| Downloads | gerenciador com pasta escolhida e confirmação (hoje bloqueados) | arquivo baixado só após confirmar |

### Fase 2 — companheiro lateral consciente da página (com permissão)

- **"Usar esta página":** ação explícita do usuário. O processo principal lê o texto
  legível da aba ativa (script fixo, como na captura de seleção), mostra a prévia com
  tamanho e corte, e só então salva como fonte. Nunca automático, nunca campos de
  formulário ou senhas, nunca outras abas.
- **Controle por site:** "não usar esta página com agentes" lembrado por domínio.
- **Nova aba:** caixa "Peça algo ao Yuki" que cria o pedido no projeto atual, com
  projetos recentes e favoritos; endereços digitados continuam navegando.
- **Resultados com origem:** na resposta, mostrar as fontes usadas e abrir a URL da
  fonte numa aba ao clicar.
- **Acompanhamento:** usar a fila durável do Codex (`tasks.enqueue`, `tasks.get`),
  com progresso, "não confirmado" e retomada, sem nova operação genérica na ponte.

### Fora do escopo agora (não implementar)

- Agente que clica, preenche ou navega sozinho nas páginas: exige outro desenho de
  segurança, e as ferramentas dos agentes estão desligadas por política.
- Memória automática do que o usuário navega.
- Ajuda de escrita injetada em campos das páginas.
- Usar sessões ou cookies das páginas (chatgpt.com, gemini.google.com, NotebookLM)
  como acesso a agentes.

## 4. Regras que continuam valendo

- Páginas web: `sandbox`, `contextIsolation`, sem Node e sem preload do aplicativo.
- Toda ação nova do shell ou do painel entra na lista fechada de `main.cjs`, com
  origem conferida (`trustedFrame`); nada de comando genérico.
- Leitura de página só por ação do usuário, com prévia; captura de seleção continua
  como está.
- Tokens fora dos renderers; `tasks.execute` continua proibido; execução só pela fila.
- Downloads e permissões de dispositivo continuam negados até haver fluxo próprio.
- Manter a C-4 (`role="group"` + `aria-pressed` nas abas) e a preservação de rascunhos
  e capturas.

## 5. Prompt pronto para o Gemini

> Leia `integrations/docs/PASSAGEM_GEMINI_NAVEGADOR.md` na branch
> `claude/vibrant-meitner-ksbzgf`. Atualize `gemini/chromium-ui` a partir do `main`
> (`1c72ffa`), mantendo a correção C-4 das abas. Corrija N-1 a N-7. N-1: zoom, busca,
> print, imagem e "resumir página" hoje não fazem nada; nenhum botão pode fingir
> funcionar. N-2: não guarde imagens como base64 dentro das fontes. N-4: tire "Atlas"
> e "OpenAI" da interface. Depois, foque no navegador (seção 3, fase 1): o usuário
> autorizou você a alterar `desktop/main.cjs`, preloads e `policy.cjs` nesta rodada,
> com a lista fechada de ações, origem conferida e um teste no Electron real para
> cada função. A fase 2 vem em seguida; não implemente o que está "fora do escopo".
> Rode `npm --prefix frontend test`, `npm --prefix desktop test`, o build,
> `npm --prefix desktop run test:ui` e `node tests/integrations/desktop_gateway_smoke.cjs`.
> Entregue capturas reais e o SHA, e abra o PR para o `main`.
