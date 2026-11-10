# Proposta: entrada visual no gateway (contrato 1.2)

**Estado: proposta. Nada aqui está implementado.** Os contratos 1 e 1.1 continuam
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

## 6. Cada CLI (a verificar antes de implementar)

| CLI | Caminho oficial provável | O que falta verificar |
| --- | --- | --- |
| ChatGPT (Codex CLI) | `codex exec --image <arquivo>` (opção `-i, --image <FILE>...` listada no `exec --help` da 0.167.0) | Continua bloqueado por `tools: restricted`; formatos e limites aceitos; evidência no JSONL de que a imagem foi anexada |
| Gemini CLI | menção `@arquivo` para um arquivo **dentro** da pasta temporária de trabalho | Hoje o gateway neutraliza `@` de propósito; seria preciso permitir só os caminhos criados pelo gateway; `read_many_files`/política de ferramentas não pode ser aberta; evidência nas estatísticas |
| Claude Code | entrada `--input-format stream-json` com bloco de imagem em base64 | Exige `--output-format stream-json`; conferir se funciona com `--tools ""`, login por assinatura e sem persistir sessão; mudar o analisador de saída |

Nenhum desses caminhos foi testado. Para cada CLI: conferir com o pacote oficial,
dublê de teste e só então uma geração real autorizada pelo usuário.

## 7. Ordem sugerida

1. Codex e Claude fecham os schemas 1.2 (este documento) e publicam o OpenAPI dos
   dois lados, com teste de igualdade.
2. Gateway: rotas 1.2 recusando tudo que não for suportado; um adaptador por vez.
3. Backend: tarefa, plano, fila e revalidação. Painel: seleção, prévia e aceite.
4. Teste real, com imagem sintética, só com autorização do usuário.
