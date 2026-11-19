# Pedido do usuário — leitura visual, capacidades da IA e navegador (17/11/2026)

**Atualização de 18/11.** O pedido abaixo registra o estado anterior à implementação. Consulte a resolução por item, incluindo V2/V3, W1, migração do histórico e a decisão sobre downloads e extensões em [RESPOSTA_VISAO_E_NAVEGADOR.md](RESPOSTA_VISAO_E_NAVEGADOR.md).

Registrado pelo Claude de interface a pedido explícito do usuário ("caso seja tarefa
dos outros agentes, faça o documento designando"). Formato de
[DIVISAO_RESPONSABILIDADES.md](DIVISAO_RESPONSABILIDADES.md): problema, evidência,
arquivos, proposta e responsável. Este documento **não transfere** arquivos de
runtime/contrato ao Claude de interface; cada item indica quem implementa.
Base: `claude/friendly-curie-pxw81w` sobre `codex/browser-capture-clis` (31c3d43).

## Já feito na interface (sem depender de ninguém)

Captura de trecho simplificada: fora da Biblioteca, o texto capturado pelo botão
“Capturar trecho” ou pelo menu de contexto não abre mais o diálogo de material
(título, projeto, salvar). Aparece um cartão “Enviar este trecho no chat?” com a
origem e a prévia; “Usar no chat” vira o chip do compositor e segue como snapshot do
turno; “Descartar” chama `capture.clear`. Na Biblioteca, o fluxo de material continua.

## 1. Leitura visual da página — Codex (implementação) e Claude da CLI (análise)

**Pedido:** o Claude deve “ler” a página como ela aparece (layout, imagens,
gráficos) e devolver um resumo, não só o texto visível.

**Hoje:** `capture.page` lê só texto visível (até 38.000 caracteres; sem PDF,
iframe ou imagem). Visão 1.2 é experimental: uma PNG/JPEG até 480 KB, só como
material da biblioteca (`source_ids` + `allow_visual_input`), habilitada por
`IA_BBARU_CLAUDE_CODE_VISION_MODELS`, validada só com dublês. Print atual =
área visível (`capturePage`). “Snapshot visual direto no turno ainda não existe”
(ENTREGA_BACKEND_CHAT.md).

| # | Responsável | Proposta |
| --- | --- | --- |
| V1 | Codex | `capture.page.visual`: print da página inteira (CDP `Page.captureScreenshot` com `captureBeyondViewport`, ou rolagem e junção), reduzido ou dividido em partes dentro do limite por imagem, com `document_id`, URL e título. Mesma regra da captura textual: ação explícita, página HTTP(S), documento conferido |
| V2 | Codex | Snapshot visual no turno (`attachments` tipado), sem obrigar salvar na biblioteca; texto da página + imagens no mesmo turno |
| V3 | Codex | Contrato 1.3 com `max_images` > 1 (partes da página), limites por conversa e custo explicado no aceite |
| V4 | Claude da CLI | Levantar no pacote oficial: limite de imagens e de bytes por mensagem em `stream-json`, eco de várias imagens em `--replay-user-messages`, quais aliases aceitam imagem, impacto em cota |
| V5 | Codex + usuário | Teste real pequeno com 1 imagem, autorizado, antes de ligar a visão por padrão |
| V6 | Claude de interface | Depois de V1–V3: ação “Ler página (visual)”, miniaturas no chip, aceite visual e estado experimental até V5 |

## 2. Ampliação das capacidades da IA — decisão do usuário, depois Codex/CLI

O projeto proíbe hoje ferramentas na CLI (`--tools ""`, `init.tools=[]`,
CLAUDE.md: “Ferramentas desativadas ... devem permanecer”). Qualquer item abaixo
que exija ferramenta muda essa regra e precisa de decisão explícita do usuário.

| # | Capacidade | Situação | Responsável |
| --- | --- | --- | --- |
| C1 | Visão da página (seção 1) | Possível sem ferramentas | Codex / CLI |
| C2 | Texto progressivo (streaming) | HTTP do gateway é não incremental; `stream-json` já é lido internamente | Codex (contrato SSE) |
| C3 | Botão “Parar” | Fora do contrato; revogar aceite não é “Parar” | Codex |
| C4 | Ler PDF aberto na aba | `capture.page` não lê PDF | Codex (extração no runtime) |
| C5 | Busca/leitura web pelo Claude (WebSearch/WebFetch) | **Proibido pela regra atual**; risco de injeção por páginas e de custo | Usuário decide; se aprovado, CLI analisa e Codex implementa com lista fechada de ferramentas |
| C6 | Contexto maior que 80.000 caracteres / 20 itens | Limite do backend e do perfil do modelo | Codex |

## 3. Navegador no modelo do Safari — Codex (runtime) e Claude de interface (visual)

**Pedido:** finalizar abas, Ajustes, Extensões, Downloads, Histórico e
Personalização, tomando o Safari como modelo.

**Hoje (evidência em `desktop/main.cjs`):** downloads bloqueados para todos
(`will-download` → `preventDefault`); nenhuma extensão; permissões negadas a
todos os sites; histórico só no `localStorage` do shell (últimas visitas); a nova
aba (`home.html`) roda numa aba web sem preload e não lê ajustes; o shell só
desenha nos 106 px do topo (as views cobrem o resto). Páginas internas
funcionais dependem do runtime.

| # | Responsável | Proposta |
| --- | --- | --- |
| N1 | Codex | Páginas internas `yuki://ajustes`, `yuki://historico`, `yuki://downloads`, `yuki://extensoes` numa aba, com preload próprio e API mínima (`pages.*`), protegidas como `protectInternal` |
| N2 | Codex | Histórico no processo principal: listar, buscar, apagar item, limpar por período |
| N3 | Codex + usuário | Downloads: decidir a política (hoje bloqueados); gerenciador com pasta, progresso, cancelar e “Mostrar na pasta”, sem abrir arquivo sozinho |
| N4 | Codex + usuário | Extensões: Electron só carrega extensões descompactadas, com APIs parciais e sem Chrome Web Store. Decidir se entra; API listar/carregar/ativar/remover |
| N5 | Codex | Ajustes persistidos: página inicial, mecanismo de busca, zoom padrão, abrir ao iniciar, limpar dados do site (`persist:web`), permissões por site, pasta de downloads, largura do painel (D1 da passagem) |
| N6 | Codex | Abas: fixar aba, grupos de abas e visão geral das abas |
| N7 | Codex | Rótulo do menu de contexto “Adicionar seleção ao Ia-bbaru” → “Perguntar ao Claude sobre a seleção” (`main.cjs`), coerente com o novo cartão |
| N8 | Claude de interface | Desenho estilo Safari no Canvas para aprovação (Ajustes com abas, Histórico, Downloads, Extensões, Personalização da nova aba); implementação das páginas sobre N1–N6 depois do contrato |

Ordem sugerida: N7 (rótulo) → N1/N2/N5 (base das páginas e histórico) → N3/N4
(decisões do usuário) → N6. Visão: V4 em paralelo, depois V1–V3 e V5.

## 4. Páginas do navegador no painel — entregue na interface (17/11/2026)

Aprovado pelo usuário: Ajustes, Histórico e Downloads no desenho do Canvas, mais a
seção Personalização; visão geral das abas e personalização por cima da nova aba
foram reprovadas. Abertas pelo menu “⋯” do painel (grupo Navegador), pelo menu
lateral da página ampla e pela barra (“⋯ → Downloads / Ajustes”, “Histórico → Ver
tudo”). A barra e o painel compartilham o `localStorage` de `file://`; o evento
`storage` sincroniza os dois sem tocar no runtime.

Já funcionam: lista, busca, apagar item e limpar o histórico (entradas novas
guardam `at`); prazo “Remover itens do histórico” (aplicado pelo painel e pela
barra); mostrar/ocultar a barra de favoritos; remover favoritos; abrir item do
histórico em nova aba (`window.open` → `newTab`).

### Botões e controles para o Codex preencher

Todos estão na interface, desativados com “Em integração” ou ligados a um comando
que o runtime ainda recusa. Identificador = atributo `data-codex`.

| `data-codex` | Onde | O que falta no runtime |
| --- | --- | --- |
| ~~`window.maximize`~~ | Bolinha verde (`#maximize`) | **Entregue** pelo Codex (`maximize`) e ligada na barra em 17/11 |
| — | Bolinhas da barra | Janela sem a barra do sistema (`titleBarStyle`/`frame` + área arrastável), para as bolinhas substituírem os botões do Windows (W1) |
| `settings.startup` | Ajustes → Geral → “Ao abrir o Yuki” | Restaurar abas da última sessão (N5) |
| `settings.newTab` | Ajustes → Geral → “Novas abas abrem com” | Página da nova aba configurável (N5) |
| `settings.downloadFolder` | Ajustes → Geral → “Pasta dos downloads” | Política e pasta de downloads (N3) |
| `settings.newTabBackground` | Ajustes → Personalização → “Fundo da nova aba” | A nova aba (`home.html`, partição `persist:web`) precisa ler a preferência (N5) |
| `settings.newTabSections` | Ajustes → Personalização → “Na nova aba, mostrar” | Idem (N5) |
| `privacy.clearSiteData` | Ajustes → Privacidade → “Limpar dados de sites…” | `session.fromPartition("persist:web").clearStorageData` com confirmação (N5) |
| `extensions.loadUnpacked` | Ajustes → Extensões | Decisão do usuário e API de extensões (N4) |
| `downloads.clear` | Downloads → “Limpar” | Lista de downloads, progresso, “Mostrar na pasta” e “Cancelar” (N3) |

Quando um item do runtime existir, o Claude de interface liga o controle e tira o
“Em integração”; o desenho já está no lugar.

### Ligado depois da resposta do Codex (RESPOSTA_VISAO_E_NAVEGADOR.md)

- Bolinha verde → `navigatorApp.command("maximize")` (alterna maximizar/restaurar).
- “+” do compositor → “Print da página inteira” (`capture.page.visual`): abre a
  revisão da biblioteca com o aviso de que a página inteira inclui o que está fora
  da área visível e pode não ter PDFs, iframes ou conteúdo carregado ao rolar.
  Depois de salvo, volta ao chat; se o modelo escolhido declarar imagem (1.2), a
  imagem já fica selecionada e o envio pede o aceite visual. Sem envio direto no
  turno nem várias imagens (V2/V3 pendentes).
- Snapshots enviam também `tab_id` e `documentVersion`, só os campos tipados.
- Erros novos (`source_snapshot_conflict`, `context_too_large`,
  `no_model_fits_context`) são recusas definitivas: o texto volta ao campo, sem
  outro `turn_id` automático.

## 5. Vídeo da aba e “Página atual” — proposta ao Codex (19/11/2026)

**Feito na interface (`claude/friendly-curie-pxw81w`):** chip “Página atual: [título]”
no compositor, ligado por padrão (1 clique desliga; escolha em `draft:read-page`).
A aba só é lida no envio, depois do cartão/aceite, por `capture.page`. Vai como
snapshot `page` (dado não confiável, separado do pedido), e a captura é liberada
com `capture.clear`. Erro de leitura ou excesso de orçamento (80.000 caracteres
no turno) aborta com orientação, sem corte silencioso. Abrir o painel ou navegar
não lê nada.

**Falta no runtime (Codex) para o vídeo:** a interface já mostra o chip e o botão
quando estes campos existirem. Sem eles, nada aparece. Os nomes são proposta; se
mudarem, a interface acompanha.

| Item | Proposta |
| --- | --- |
| `context.status` / `activePage` | Campo aditivo `video: {current_time, duration, captions, frame_capture} \| null` do `<video>` principal da aba ativa (o que está tocando ou o maior visível). `captions: true` quando há faixa de legenda com texto no DOM (`textTracks` com cues). `frame_capture: true` quando o quadro pode ser capturado |
| `capture.page` | Incluir o texto das legendas já carregadas (com tempo) no `text`, dentro do limite de 38.000 |
| `capture.video.frame` | Mensagem do painel que devolve `{ok, capture:{id, title, url, document_id, media:{kind:"screenshot", data_url}}}` com o quadro atual em PNG/JPEG de até 480 KB (ou o limite da visão 2.000 px quando publicado). Mesma conferência de documento de `capture.page.visual`. A interface anexa como imagem direta (`attachments`) e chama `capture.clear` |
| Visão 2.000 px / captura rica | Aguardando o contrato. Quando sair, a interface troca os limites fixos (480 KB, 1 ou 4 imagens) pelos do catálogo |
