# Pedido do usuário — leitura visual, capacidades da IA e navegador (17/11/2026)

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
