# Proposta: entrada visual no gateway (contrato 1.2)

**Estado: proposta. Nada aqui está implementado.** Atualizada em 11/11/2026
para somente Claude Code (seção 6). Os contratos 1 e 1.1 continuam
textuais e não enviam pixels. Pedido do Codex em `docs/PROMPT_CLAUDE_CLIS.md`:
suporte visual só por contrato versionado, nunca por base64 dentro de
`ContextItem.content`. Base: `docs/CONTRATO_CAPTURAS.md` (branch
`codex/browser-capture-clis`), que já guarda imagens separadas do texto.

## 1. Princípios

- Versão própria: rotas `/v1.2/models` e `/v1.2/generate`, `protocol_version: "1.2"`.
  Os schemas 1 e 1.1 não mudam; sem fallback entre versões.
- Imagem é anexo tipado, com limite próprio. Texto continua nos limites atuais.
- Só vai imagem para modelo que **declara** entrada de imagem e só de material do
  **mesmo projeto**, escolhido pelo usuário.
- Aceite por tarefa, separado do aceite de limite de saída.
- Sem evidência de que a imagem chegou ao provedor, a etapa falha. Nunca trocar
  imagem por descrição automática nem ignorar o anexo em silêncio.

## 2. Catálogo 1.2

`ModelProfile` ganha `input` (obrigatório em 1.2):

```json
"input": {
  "image": {
    "supported": true,
    "mime_types": ["image/png", "image/jpeg"],
    "max_images": 4,
    "max_bytes_per_image": 480000,
    "max_total_bytes": 1500000,
    "max_pixels": 16000000,
    "transport": "cli_file_argument"
  }
}
```

- `supported: false` ou ausência de `image` = modelo só de texto.
- Os limites nunca passam dos do backend (480.000 bytes, 16 megapixels, 8.000 px
  por lado); o gateway pode declarar menos.
- `transport` é informativo: `cli_file_argument`, `cli_stream_input` ou `none`.

## 3. Requisição 1.2

`ContextItem` continua só com texto. Novo campo de topo `attachments` (máx. 8):

```json
{
  "id": "uuid-do-material",
  "project_id": "uuid-do-projeto",
  "kind": "screenshot",
  "mime_type": "image/png",
  "byte_count": 183220,
  "width": 1280,
  "height": 720,
  "sha256": "hex de 64 caracteres",
  "data_base64": "..."
}
```

Mais `allow_visual_input: true` na requisição (padrão `false`).

Validação no gateway, antes de iniciar qualquer CLI (422 se falhar):

| Regra | Código proposto |
| --- | --- |
| Modelo sem `input.image.supported` | `visual_input_not_supported` |
| `allow_visual_input` ausente/false com anexos | `visual_input_not_accepted` |
| MIME fora da lista, assinatura do arquivo diferente do MIME, base64 inválido | `invalid_attachment` |
| `byte_count`/`sha256` não conferem com os bytes; limites excedidos | `invalid_attachment` / `attachment_too_large` |
| `project_id` dos anexos diferente entre si | `invalid_attachment` |

- O gateway decodifica, confere assinatura PNG/JPEG e dimensões **sem** reprocessar
  a imagem, e grava cada anexo numa pasta temporária própria, apagada ao fim.
- Deduplicação: o hash do corpo passa a incluir `sha256` de cada anexo (o corpo
  gravado para repetição guarda os metadados e o hash, não os bytes; a repetição
  exige os mesmos bytes).
- Logs e erros nunca contêm bytes, base64 ou nome de arquivo original.

## 4. Resposta 1.2

Igual à 1.1, mais `attachments_used: [{"id": "...", "sha256": "..."}]`: os anexos
que o adaptador entregou ao provedor. Se não for possível afirmar isso, a etapa
termina com erro `visual_input_unconfirmed` (502), não com resposta de texto.

## 5. Backend e painel (Codex e Gemini)

- Tarefa: `attachment_ids` (materiais com imagem do **mesmo projeto**) e
  `allow_visual_input`. O plano copia `input.image` do modelo, como já faz com
  `capabilities`, e revalida antes de executar.
- Planejamento recusa: modelo sem visão, anexo de outro projeto, limites excedidos,
  ausência de aceite. Mantém `visual_context_not_supported` para versões 1/1.1.
- Fila: o corpo persistido guarda ids e hashes; os bytes são relidos de
  `source_media` na hora, conferindo o hash (material alterado → novo planejamento).
- Painel: mostrar a imagem que será enviada, o agente, e o aceite desmarcado.
  Imagem enviada pode conter dados pessoais visíveis na tela.

## 6. Caminho do Claude Code (único provedor desde 10/11/2026)

A direção `docs/DIRECAO_CLAUDE_ONLY.md` removeu os outros provedores; esta proposta
vale só para o Claude Code. `transport` passa a ter um valor útil:
`cli_stream_input`.

### O que o pacote oficial mostra (2.1.322, lido sem conta e sem gerar)

| Ponto | Evidência | Nível |
| --- | --- | --- |
| `--input-format stream-json` exige `--print` | texto de erro no binário: "--input-format=stream-json requires --print" | binário |
| Saída `stream-json` com `--print` exige `--verbose` | "When using --print, --output-format=stream-json requires --verbose" | binário |
| Mensagem de entrada | schema `SDKUserMessage`: `{"type":"user","message":<MessageParam da API>,"parent_tool_use_id":null}` | binário |
| Imagem | bloco tipado da API `{"type":"image","source":{"type":"base64","media_type":"image/png","data":"..."}}` dentro de `message.content`, ao lado de um bloco `{"type":"text"}`. Os schemas do binário usam PNG, JPEG, GIF e WebP | binário + API |
| Confirmação de recebimento | `--replay-user-messages` devolve na saída as mensagens lidas da entrada | `--help` |
| Ferramentas desligadas | `--tools ""` é aceito junto com `stream-json`. O evento `system/init` lista `"tools": []` | ver nota abaixo |
| Modelo efetivo | `system/init` traz `model` (o alias já resolvido) e `result.modelUsage` traz o modelo que gerou. Trocas aparecem como eventos `system/model_fallback` | binário + nota abaixo |

Nota: em 11/11/2026, numa verificação de aliases, uma execução **não intencional**
no ambiente de nuvem do Claude (conta do ambiente, não a do usuário; entrada só de
texto, sem imagem) mostrou `init.tools: []` e `init.model` resolvido nos quatro
aliases. Isso confirma o formato de saída e as ferramentas desligadas. **Não**
confirma o envio de imagem nem nada sobre a conta do usuário. Detalhes em
[PASSAGEM_CLAUDE_ONLY.md](PASSAGEM_CLAUDE_ONLY.md).

### Como o adaptador faria (quando o contrato 1.2 for fechado)

- Argumentos atuais mais `--input-format stream-json --output-format stream-json
  --verbose --replay-user-messages`. O prompt vai inteiro pela entrada: uma única
  mensagem `user` com o bloco de texto atual e um bloco `image` por anexo.
- O base64 vai **só** no campo `source.data` do bloco de imagem, que é o formato
  tipado da API. Nunca dentro do texto, de `ContextItem.content` ou de argumentos.
- Saída: ler linha a linha, guardar `init` (modelo resolvido e `tools` vazio,
  senão é falha), conferir que a mensagem devolvida por `--replay-user-messages`
  tem o mesmo número de blocos `image` e os mesmos `media_type`, e usar `result`
  como hoje (`stop_reason`, `modelUsage`, `usage`). `attachments_used` só sai
  dessa conferência. Sem ela, `visual_input_unconfirmed`.
- `CLAUDE_CODE_NO_MODEL_FALLBACK=1` e a checagem de `modelUsage` continuam
  valendo. Qualquer `system/model_fallback` também é falha.
- `input.image.supported` só fica `true` para modelos configurados pelo operador
  como de visão. O login não prova que o modelo aceita imagem na conta.

### Falta verificar (com dublê, depois com geração autorizada)

1. Se `--replay-user-messages` devolve os blocos `image` completos ou resumidos.
   Se resumir, a conferência passa a ser só de quantidade e tipo.
2. Se `--safe-mode`, `--strict-mcp-config` e `--no-session-persistence` se
   comportam igual em `stream-json`.
3. Limite de tamanho por imagem aceito pela CLI/conta, para o catálogo declarar
   o menor dos dois.
4. Comportamento no Windows com entrada grande pela entrada padrão (o mesmo
   caminho de hoje, só que maior).

Nada disso foi implementado. Um dublê `stream-json` só faz sentido junto com as
rotas 1.2, para não testar um formato que o contrato ainda não tem.

## 7. Ordem sugerida

1. Codex e Claude fecham os schemas 1.2 (este documento) e publicam o OpenAPI dos
   dois lados, com teste de igualdade.
2. Gateway: rotas 1.2 recusando tudo que não for suportado; um adaptador por vez.
3. Backend: tarefa, plano, fila e revalidação. Painel: seleção, prévia e aceite.
4. Teste real, com imagem sintética, só com autorização do usuário.
