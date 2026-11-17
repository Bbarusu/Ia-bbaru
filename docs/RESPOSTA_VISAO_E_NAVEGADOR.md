# Resposta da Frente 2 — visão e navegador

17/11/2026. Base de integração: `codex/browser-capture-clis` (PR #7).
Pedido lido de `claude/friendly-curie-pxw81w`, commit `1224556`; cópia em
[PEDIDO_VISAO_E_NAVEGADOR.md](PEDIDO_VISAO_E_NAVEGADOR.md).
Atualização: interface integrada até `629254c`, inclusive controles de captura
integral e maximize. A tabela abaixo registra pendências de runtime após essa
integração; downloads gerenciados aprovados e extensões adiadas pelo usuário.

## Disponível para a Frente 3

- `navigatorApp.command("maximize")`: alterna maximizar/restaurar a janela.
  Retorno `{ok:true}`. Continua restrito ao frame principal do shell. O comando
  não remove a barra nativa nem altera o desenho da janela.
- Menu de seleção: **Perguntar ao Claude sobre a seleção** (N7).
  Texto de um menu aberto antes de navegar/recarregar não pode virar uma captura
  da nova página. O runtime exige o mesmo documento e a mesma aba ativa.
- Capturas textuais e visuais publicam `document_id`, `documentVersion`, `tab_id`,
  `url`, `title`, `captured_at`. `context.status`/`activePage` permitem comparar o
  documento atual, inclusive após recarregar a mesma URL. Importações locais têm
  identidade de documento nula. O timestamp pertence à captura, não à navegação.
- `capture.page.visual`: print **da página inteira**, via CDP temporário e privado
  no processo principal, além do viewport. Página HTTP(S), carregada e visível;
  conferência da identidade antes/depois dos awaits; sem sessão de depuração
  concorrente. Limites: 8.000 px por lado, 16 MP, JPEG até 480.000 bytes.
  Acima disso há erro explícito; não recorta nem reduz silenciosamente a imagem.
  A implementação cobre V1 com uma imagem limitada, não a divisão em partes.

Chamada pelo painel:

```js
const result = await window.iaDesktop.runtime.sendMessage({type: "capture.page.visual"});
// sucesso: {ok: true, capture: {id, title, url, text, kind: "screenshot",
//   document_id, tab_id, documentVersion, captured_at,
//   media: {kind: "screenshot", data_url: "data:image/jpeg;base64,..."}}}
// falha: {ok: false, error: {message: "..."}}
```

O shell também aceita `navigatorApp.command("capture.page.visual")`; recebe
`{ok:true}` e o painel recebe `pendingCapture` pelo evento existente. Só executar
após ação explícita. Captura não chama o gateway. Revisar/salvar o print usa o
fluxo atual da biblioteca; enviar exige o modelo com visão configurada, contrato
1.2, fonte do mesmo projeto e aceite visual. A prévia deve explicar que página
inteira inclui conteúdo fora da área visível; não anunciar leitura de todos os
PDFs/iframes ou conteúdo ainda não carregado por rolagem infinita/lazy loading.

## Análise e próximos contratos

| Pedido | Estado e próximo passo |
| --- | --- |
| V2: imagem direta no turno | Pendente. Hoje somente snapshots de texto são aceitos; imagem tipada vem de `source_ids`. Não colocar base64 em `instruction`/`content`. Precisará armazenamento de anexos de conversa, UUID/hash imutáveis, replay e autorização antes do envio. |
| V3: várias imagens/1.3 | Pendente. Não anunciar 1.3 nem aumentar `max_images` no frontend. Exige limites de quantidade/bytes totais, histórico e transporte/eco ordenado, com testes dos dois lados. |
| V4: evidência da CLI | Frente 1 documenta em `ANALISE_CLI_CLAUDE.md`: várias imagens, limites, aliases, eco e cota; sem editar o adaptador nem executar geração real implícita. |
| V5: validação real | Pendente no Windows, com uma imagem pequena e autorização explícita para consumir cota. Visão permanece experimental e desativada por padrão. |
| V6: ação visual | Frente 3 pode ligar captura/prévia agora, com os limites acima. Envio direto e várias miniaturas aguardam V2/V3; não marcar compreensão visual comprovada. |
| C2: streaming | Pendente. `stream-json` interno recompõe resposta completa; não equivale a SSE. Não simular streaming nem criar nova chamada por reconexão. |
| C3: Parar | Pendente. Precisa estado durável de cancelamento e distinção entre parar antes/depois do despacho. Revogar aceite não cancela execução em curso nem estorna cota. |
| C4: PDF | Pendente extração dedicada no runtime. Não tratar a tela do visualizador como texto de todas as páginas. |
| C5: ferramentas web | Não habilitadas. O pedido é de análise; não muda a regra atual `tools=[]`. Uma mudança de capacidade exige escopo explícito e contrato próprio. |
| C6: contexto maior | Mantidos os limites atuais. Corrigido o orçamento comum backend/gateway, incluindo JSON e reserva de saída. Excesso é recusado antes de criar o turno. |
| N1/N2/N5: páginas, histórico e ajustes | Pendente base persistente no processo principal. A seção 4 do pedido substitui o desenho preliminar: preservar o painel já aprovado. Migrar o histórico do localStorage sem perda/duplicação e publicar API mínima antes de ligar os controles. Não criar simultaneamente outra UI `yuki://` sem necessidade. |
| N3: downloads | Pendente. O documento pede uma decisão de política; o bloqueio atual permanece. Gerenciador futuro deverá manter progresso/cancelamento, escolher pasta e não abrir arquivos automaticamente. |
| N4: extensões | Pendente decisão de inclusão e escopo. Não prometer Chrome Web Store ou compatibilidade completa em Electron. |
| N6: abas | Fixação e grupos pendentes. Visão geral sobre a nova aba foi reprovada na seção 4; não implementar esse desenho. |
| W1: barra nativa | Pendente integração visual/runtime em conjunto. Apenas `maximize` entregue; arraste, controles de janela e acessibilidade precisam validação específica no Windows. |
| Demais `data-codex` | Continuam “Em integração”; não ligar a mocks nem persistir configurações locais como se tivessem efeito no runtime. |

Não há mudança de responsável: Codex implementa backend/ponte/runtime; Claude da
interface liga controles e preserva o desenho aprovado; Claude da CLI documenta
as evidências. Contrato de conversa e exemplos de payload em
[ENTREGA_BACKEND_CHAT.md](ENTREGA_BACKEND_CHAT.md).
