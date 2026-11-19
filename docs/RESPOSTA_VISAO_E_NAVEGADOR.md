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
| V2: imagem direta no turno | Implementado. O compositor aceita arquivo PNG/JPEG e a fila conserva os pixels privados da conversa. O print integral ainda oferece revisão na biblioteca. |
| V3: várias imagens/1.3 | Implementado no contrato opcional 1.3. Até quatro imagens incluindo histórico, 480.000 bytes cada, 1.920.000 bytes e 32 MP ao todo. Cada envio com imagem pede confirmação. |
| V4: evidência da CLI | Frente 1 documenta em `ANALISE_CLI_CLAUDE.md`: várias imagens, limites, aliases, eco e cota; sem editar o adaptador nem executar geração real implícita. |
| V5: validação real | Pendente no Windows, com uma imagem pequena e autorização explícita para consumir cota. Visão permanece experimental e desativada por padrão. |
| V6: ação visual | O compositor oferece prévias dos anexos novos. A captura integral continua limitada a uma imagem. |
| C2: streaming | Pendente. `stream-json` interno recompõe resposta completa; não equivale a SSE. Não simular streaming nem criar nova chamada por reconexão. |
| C3: Parar | Pendente. Precisa estado durável de cancelamento e distinção entre parar antes/depois do despacho. Revogar aceite não cancela execução em curso nem estorna cota. |
| C4: PDF | Pendente extração dedicada no runtime. Não tratar a tela do visualizador como texto de todas as páginas. |
| C5: ferramentas web | Não habilitadas. O pedido é de análise; não muda a regra atual `tools=[]`. Uma mudança de capacidade exige escopo explícito e contrato próprio. |
| C6: contexto maior | Mantidos os limites atuais. Corrigido o orçamento comum backend/gateway, incluindo JSON e reserva de saída. Excesso é recusado antes de criar o turno. |
| N1/N2/N5: páginas, histórico e ajustes | Painel aprovado ligado ao processo principal. Histórico, retenção, favoritos, preferências, restauração de abas HTTP(S), busca, zoom, nova aba e limpeza de dados funcionais. Permissões de sites continuam bloqueadas. |
| N3: downloads | Downloads HTTP(S) com diálogo de destino, progresso, cancelamento, lista persistente e Mostrar na pasta. Reiniciar marca transferências em curso como interrompidas. |
| N4: extensões | Decisão encerrada pelo usuário. Extensões adiadas. |
| N6: abas | Fixação e grupos pendentes. Visão geral sobre a nova aba foi reprovada na seção 4; não implementar esse desenho. |
| W1: barra nativa | Janela sem moldura no Windows com área de arraste e três controles próprios. Validação nativa pendente. |
| Demais `data-codex` | A seção 4 do pedido registra a interface original. Use esta tabela para consultar a implementação vigente. |

Não há mudança de responsável: Codex implementa backend/ponte/runtime; Claude da
interface liga controles e preserva o desenho aprovado; Claude da CLI documenta
as evidências. Contrato de conversa e exemplos de payload em
[ENTREGA_BACKEND_CHAT.md](ENTREGA_BACKEND_CHAT.md).
