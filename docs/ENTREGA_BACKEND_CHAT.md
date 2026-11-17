# Contrato do chat e passagem para o Claude de interface

Entrega Codex, 16/11/2026. Base: `codex/browser-capture-clis`, incorporando a PR #11
(`b2735ca`) e a análise CLI (`eb6c671`). Produto exclusivamente Chromium/Electron.
Atualização 17/11: interface integrada até 629254c, com operações de conversa
ligadas e testadas. Os contratos abaixo permanecem vigentes.

## Conversa, aceite e envio

Todas as operações usam o envelope existente `protocol_version: "0"`, com UUID
novo em `request_id`. Esse UUID identifica o transporte; **turn_id** identifica o
envio idempotente. O backend continua com uma única fila durável e um worker.

| Operação | params | Retorno |
| --- | --- | --- |
| conversations.create | conversation_id UUID; project_id opcional; title opcional | conversa com id, project_id, datas e revision |
| conversations.list | offset opcional | items, next_offset |
| conversations.get | conversation_id | conversa |
| conversations.turns.send | conversation_id, turn | turno com task_id e task |
| conversations.turns.get | conversation_id, turn_id | turno com tarefa, contexto resumido e metadados de snapshots |
| conversations.turns.list | conversation_id, offset opcional | resumos em ordem, next_offset |
| conversations.consent.set | conversation_id, consent | consent com id |
| conversations.consent.get | conversation_id | consent ou null |
| conversations.consent.revoke | conversation_id | consent null |

HTTP correspondente em `/v1/conversations`: POST/GET da coleção, GET do ID,
POST/GET `/{id}/turns`, GET `/{id}/turns/{turn_id}` e POST/GET/DELETE `/{id}/consent`.
OpenAPI: `docs/openapi-backend.json`. Bearer permanece interno ao processo local.

Criar sem project_id faz o backend criar o vínculo interno, sem obrigar a pessoa
a configurar um projeto. Repetir conversation_id com o mesmo corpo devolve a mesma
conversa; corpo diferente dá conversation_id_conflict. Criar/listar não gera.

Exemplo de `turn` (envio com autorização individual):

```json
{
  "turn_id": "UUID-gerado-uma-vez-e-preservado",
  "instruction": "Explique melhor o segundo ponto",
  "kind": "general",
  "allowed_model_ids": ["claude-code:sonnet"],
  "preferred_model_id": "claude-code:sonnet",
  "mode": "single",
  "confirmed": true,
  "allow_unenforced_output_limit": true,
  "max_output_tokens": 2048,
  "source_ids": [],
  "snapshots": []
}
```

Só definir confirmed após ação da pessoa. Para aceite único por conversa, enviar
`consent: {policy_version:"1", confirmed:true, allowed_model_ids:[...],
allow_unenforced_output_limit:true, allow_visual_input:false, max_output_tokens:2048}`.
Explicar cota, teto indicativo e que revisão envolve duas chamadas se escolhida.
Nos próximos envios, usar consent_id devolvido; confirmed pode permanecer false.
O backend copia a autorização e o aceite para cada tarefa. Escopo é a conversa,
modelos, condições do catálogo e teto; não é autorização global de toda a conta.
Revogar bloqueia despachos futuros, inclusive revisão. Não cancela nem estorna
uma chamada que já foi despachada. Mudança de condições exige novo aceite.

Persistir o UUID e o **corpo inteiro do envio** antes de mandar. Em resposta de
transporte perdida, consultar turno ou reenviar o MESMO corpo com o MESMO turn_id.
Nunca gerar outro UUID automaticamente. Mesmo ID com corpo diferente dá conflito;
uma segunda tarefa enquanto a conversa está ocupada é recusada. Enviar cria
turno+tarefa+fila atomicamente; não combinar com tasks.plan/tasks.enqueue.

Histórico é montado pelo backend a partir dos turnos e fontes da mesma conversa,
com status/erros das respostas incompletas. Não usar sessões persistentes da CLI.
Limite atual: 80.000 caracteres e 20 itens de contexto, limitado também pelo perfil
do modelo e pela reserva de saída no gateway. Não há corte silencioso: excesso
pede nova conversa ou menos contexto. Não implementar resumo automático escondido.
Tarefas antigas não são convertidas em conversas automaticamente. Atividade
continua disponível; `tasks.list` sem summary inclui contexto completo.

## Contexto da página

`window.iaDesktop.runtime.sendMessage({type:"capture.page"})` captura texto visível
da aba inteira (até 38.000 caracteres; acima disso, erro pedindo seleção).
Não é print da página inteira nem leitura de PDFs/iframes/imagens. Exige ação
explícita, página HTTP(S), carregamento concluído e mesmo documento após leitura.
Retorna `{ok, capture}`; captura contém id, title, url, text, kind, document_id,
captured_at. Converter para snapshot: capture_id=id, content=text e demais campos.
Snapshots ficam no turno e não criam material na biblioteca.

`context.status` e o evento `activePage` devolvem document_id/url/title e
capture_is_current. Navegar/recarregar invalida a captura para a página atual;
o texto anexado continua sendo o snapshot antigo, identificado como tal. Deixar
remover ou recapturar, nunca trocar silenciosamente o conteúdo enviado.
`capture.clear` remove a captura pendente pelo id. Um novo capture exige salvar ou
descartar o anterior. Abrir painel não captura nem envia.

O shell foca a view e publica `focusComposer` ao abrir pelo botão/atalho. O frontend
ouve `storage.onChanged` e foca #instruction. Ctrl+Shift+L alterna painel; Ctrl+L
continua na barra de endereço. `navigatorApp.command("panel.resize", largura)`
aceita 320–800 px, persiste preferência e limita a largura disponível na janela.
O handle visual de redimensionamento pertence ao Claude de interface.

## Modelos, resultado e erros

Contrato gateway 1.2: `/v1.2/models`, `/v1.2/generate`. Inicializadores atualizados
juntos; 1 e 1.1 continuam disponíveis sem mudança de schema. Planos/aceites antigos
não são promovidos: em troca de protocolo, replanejar/renovar aceite.
`results[].served_model` é o modelo informado pela CLI. Não inferir a versão do
alias pelo catálogo. Login ativo não garante acesso a cada modelo.

`response_profile` opcional: quick prefere Haiku, normal Sonnet, deep Opus;
respeita modelos permitidos, contexto e capacidades. É regra de produto, não
avaliação de dificuldade/qualidade. Escolha explícita prevalece. Fable só entra
explicitamente. Revisor automático usa família de nível igual/superior
(Haiku < Sonnet < Opus < Fable); Fable não entra automaticamente como revisor.
Revisor inferior só por reviewer_model_id explícito. Sem candidato, recusar.

Novos chats e inicializador usam teto 2048 (1–4096); perfil configurado menor
continua prevalecendo. Teste real pequeno continua 128: o aumento de padrão não
é diagnóstico da falha antiga. Teto indicativo exige aceite e não é garantia.
`execution.steps[]` traz duration_ms acumulado das tentativas medidas e
request_fingerprint para cruzar logs. Após crash pode não haver duração; não
inventar zero nem tratar como tempo de raciocínio do modelo.

Erros distintos: provider_model_requires_credits, provider_model_unavailable,
provider_output_limit_reached, provider_rate_limited, provider_quota_exceeded.
Nenhum provoca repetição automática. Cota não inclui horário de renovação.
Quando a CLI transforma corte em erro, não há parcial para exibir. Quando entrega
parcial com length/unknown, preservá-lo e não iniciar revisão. provider_error
continua neutro: não presumir login/cota/teto.

## Visão 1.2

Implementada no backend/gateway, **experimental, validada somente com dublês**.
Habilitação explícita: IA_BBARU_CLAUDE_CODE_VISION_MODELS=sonnet (subconjunto dos
modelos configurados). Sem isso, input.image.supported=false. Não declarar
validação real de acesso/visão da conta. Não habilitar pelo frontend sozinho.

Primeira versão: uma imagem PNG/JPEG por contexto, até 480.000 bytes, 16 MP e
8.000 px por lado. Selecionar material do mesmo projeto em source_ids e enviar
allow_visual_input=true após prévia/aceite. Aceite de conversa deve incluir essa
permissão se usado; o turno ainda declara que está enviando imagem. Nos turnos
seguintes, a imagem histórica também exige aceite; outra imagem excede o limite
atual e pede nova conversa. Capturas visuais podem ser salvas como material pelo
fluxo existente. Snapshot visual direto no turno ainda não existe.

Pixels ficam em attachments tipado, nunca em ContextItem.content. Hash, MIME,
dimensões e bytes são conferidos nos dois lados. Plano/fila guardam referências;
bytes são relidos e conferidos antes do despacho, inclusive replay. Gateway
confere eco completo do bloco de imagem pela CLI, além de init.tools=[], modelo
e término. Sem eco exato: visual_input_unconfirmed; sem troca silenciosa para texto.
attachments_used confirma o transporte, não prova compreensão semântica da imagem.
Se a CLI real resumir o eco, o teste falhará de modo explícito e precisará revisão.

O uso interno de stream-json recompõe blocos de texto, mas HTTP streaming=false.
Não simular texto progressivo. Botão “Parar” e cancelamento de processo pela UI
não fazem parte deste contrato; revogação do aceite não deve ser rotulada “Parar”.

## Atualização da Frente 2 — 17/11/2026

As nove operações da tabela inicial mantêm nomes e envelopes. `tasks.execute`
continua proibido na ponte. Não criar aliases `consent.set` ou segunda fila.
O erro `source_snapshot_conflict` (HTTP 409) agora identifica reaproveitamento de
um ID de fonte/captura com título ou texto diferente: preservar o envio original,
criar nova captura quando o documento mudou ou começar uma conversa nova.
Não mudar o corpo de um `turn_id` enviado para contornar esse erro.

Histórico agora contém referências `{id,title}`; o conteúdo integral de cada
fonte fica uma única vez no pacote autorizado. Cada turno guarda suas próprias
fontes originais. Nem renderer nem CLI escolhem livremente histórico externo.
Backend e gateway usam a **mesma serialização e fórmula**: prompt de sistema +
argumento fixo + JSON serializado (incluindo escapes) + 4 caracteres por token
reservado para saída. A revisão é novamente verificada com a resposta efetiva;
se não couber, preserva a resposta principal e não despacha a revisão.

SQLite usa `conversations` e `conversation_turns`; bancos da versão anterior
com `chat_turns` são renomeados transacionalmente, preservando todas as linhas,
fontes, imagens, tarefas e aceites. Não é necessário apagar perfis/bancos.

Metadados aditivos de captura: `tab_id` (UUID) e `documentVersion` (inteiro >=0).
`TextSnapshot` aceita ambos opcionalmente; clientes anteriores com `document_id`
continuam válidos. Enviar somente os campos tipados, não o objeto `capture` inteiro:

```js
const snapshot = {
  capture_id: capture.id, kind: capture.kind, title: capture.title,
  content: capture.text, url: capture.url, document_id: capture.document_id,
  captured_at: capture.captured_at,
  tab_id: capture.tab_id, documentVersion: capture.documentVersion
}; // apenas page/selection/text; nunca media ou screenshot neste tipo
```

Resposta do envio pela ponte (campos constantes; valores ilustrativos):

```json
{
  "protocol_version": "0",
  "request_id": "uuid-do-envelope",
  "ok": true,
  "data": {
    "id": "uuid-do-turno",
    "conversation_id": "uuid-da-conversa",
    "sequence": 1,
    "task_id": "uuid-da-tarefa-duravel",
    "created_at": "2026-11-17T12:00:00+00:00",
    "task": {"status": "queued"},
    "snapshots": []
  }
}
```

`task` acima foi abreviado: mantém os campos da tarefa existente (`id`, `plan`,
`execution`, `output`, `results`, `error`, contexto resumido e autorização).
Consultar `conversations.turns.get` devolve a mesma estrutura, com o estado atual.
`conversations.turns.list` devolve `{items:[{id,conversation_id,sequence,task_id,
created_at,status,instruction,output_preview,error}],next_offset}`. `output_preview`
é apenas resumo de listagem; ler o turno para exibir a resposta completa.
Erros preservam `{protocol_version,request_id,ok:false,error:{code,message}}`.
Esquemas de entrada exatos, inclusive os metadados opcionais:
[openapi-backend.json](openapi-backend.json), `TurnInput`, `TextSnapshot`, `ConsentInput`.

Captura visual inteira e `maximize`, limites e pendências do navegador:
[RESPOSTA_VISAO_E_NAVEGADOR.md](RESPOSTA_VISAO_E_NAVEGADOR.md).
Este documento é a passagem para a Frente 3; não implica envio automático a outro chat.
