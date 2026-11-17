# Análise técnica da CLI oficial Claude Code

Autor: Claude Code (frente de compatibilidade da CLI). Data: 11/11/2026.
Escopo: `docs/PROMPT_CLAUDE_ESCOPO.md` e `docs/DIVISAO_RESPONSABILIDADES.md`.
Atualizado em 12/11/2026 com a base `4e6679e` (seção 6) e em 16/11/2026 com A1/A2
da passagem do frontend (seção 7), e em 17/11/2026 com o fechamento pré-teste contínuo,
base `31c3d43` (seção 8).
Base lida originalmente: `codex/browser-capture-clis` `36e5402`, que já contém meu trabalho até
`c22beb0` (merge `875d4b4`) e a correção do Codex `aa3933f`.

**Este documento é só análise.** Não alterei código, testes, fixtures,
configuração, contratos nem documentação comum. A correção de `provider_error`,
o parser, os diagnósticos e a integração de execução são do Codex. Quando este
texto diz "propor", é proposta para o responsável, não trabalho em andamento.

Este documento substitui, como orientação, as partes de
`integrations/docs/PASSAGEM_CLAUDE_ONLY.md` que davam roteiro de teste ao usuário
(seção P0 "Para confirmar" e item 7). A validação Windows é conduzida pelo Codex
(`docs/CORRECAO_PROVIDER_ERROR.md`). As pendências C-1 a C-10 daquela passagem
continuam como propostas e estão resumidas na seção 5.

## Níveis de evidência

| Marca | Origem |
| --- | --- |
| **[F]** | Dublês do repositório (`tests/integrations/fixtures/fake_claude.py`). Formatos escritos por nós, não capturados de uma execução do usuário |
| **[P]** | Pacote oficial `@anthropic-ai/claude-code` lido sem gerar (`--help`, textos do binário). 2.1.322: binário idêntico ao do npm. 2.1.307: só lido |
| **[N]** | 4 gerações **não intencionais** em 11/11, no contêiner de nuvem, com a conta do ambiente (não a do usuário), 2.1.322, entrada "diga oi". Já registradas em `PASSAGEM_CLAUDE_ONLY.md`. Não repetidas |
| **[R]** | Conta do usuário no Windows. Com geração: só as rodadas anteriores (2.1.307). Sem geração: `/model` e `diagnose` de 11/11 |

Verificação desta análise (sem conta real, `IA_BBARU_REAL_TEST` ausente), na
base `36e5402`: `tests/integrations` 89 OK + 1 ignorado; `tests` 67 OK;
`scripts/verify_gateway_v11.py` OK. Os achados da seção 3 foram reproduzidos
chamando funções existentes com a saída dos dublês existentes, num script fora do
repositório.

## 1. O que está comprovado

### 1.1 Saída `--output-format json`

| Fato | Versão | Nível |
| --- | --- | --- |
| Um único objeto `{"type":"result", ...}` com `subtype`, `is_error`, `result`, `stop_reason` (pode ser `null`), `usage`, `modelUsage`, `total_cost_usd`, `num_turns` | 2.1.322 | [P] schema; [N] observado |
| Subtipos de falha `error_during_execution`, `error_max_turns`, `error_max_budget_usd`, `error_max_structured_output_retries` **não têm `result`**: as mensagens ficam em `errors: string[]` | 2.1.322 | [P] schema. Nunca observado numa execução |
| Campos marcados internamente: `api_error` (tipo do erro da API que encerrou o turno) e `terminal_reason` | 2.1.322 | [P]. Valores possíveis não levantados |
| `modelUsage` vem indexado pelo ID do modelo servido (ex.: `claude-sonnet-5-5`), com `outputTokens`, `contextWindow`, `maxOutputTokens` | 2.1.322 | [N] |
| `stop_reason` vem no resultado e o real de 11/11 no Windows deu `stop` | 2.1.307 | [R] com geração (rodada anterior: "laranja", 913/5, teto 64) |
| Código de saída do processo em turno de erro de cota: **1**, com JSON objeto, `subtype: "success"` e `result` em texto | Windows, versão não registrada na captura | [R] com geração (seção 6). Outros tipos de erro não observados |

### 1.2 Erros e limites

| Fato | Versão | Nível |
| --- | --- | --- |
| Turno cortado por `max_tokens` vira **erro** "API Error: Claude's response exceeded the N output token maximum. To configure this behavior, set the CLAUDE_CODE_MAX_OUTPUT_TOKENS environment variable." (`apiError: "max_output_tokens"`). A resposta parcial não fica no `result` | 2.1.322 | [P] |
| Variante: "...for a request sent without streaming. The CLAUDE_CODE_MAX_OUTPUT_TOKENS environment variable cannot raise this limit." | 2.1.322 | [P]. Condição exata de uso não levantada |
| Janela de contexto: "API Error: The model has reached its context window limit." | 2.1.322 | [P] |
| Prefixo comum "API Error" nos turnos de erro da API | 2.1.322 | [P] |
| Recusas de modelo: "Your model policy only allows …, which requires usage credits", "CLAUDE_CODE_NO_MODEL_FALLBACK is set: model substitution is disabled", "There's an issue with the selected model (…). It may not have access…" | 2.1.322 | [P] |
| Consequência: na 2.1.322, `finish_reason: "length"` não deve aparecer pelo caminho normal. O corte vira erro e o texto parcial se perde na saída `json` | 2.1.322 | Dedução de [P] |

### 1.3 Modelos e troca automática

| Fato | Versão | Nível |
| --- | --- | --- |
| Aliases `sonnet`, `opus`, `haiku`, `fable`, `best`, `opusplan`, `sonnet[1m]`, `opus[1m]`, `fable[1m]` (sem `haiku[1m]`) | 2.1.307 e 2.1.322 | [P] |
| O alias é resolvido dentro da CLI por registro de modelos, conta/provedor e `ANTHROPIC_DEFAULT_<FAMÍLIA>_MODEL`. O padrão embutido para `fable` é 5.1 (2.1.307) e 5.2 (2.1.322). O registro pode trocar o padrão | ambas | [P] |
| Resolução observada: sonnet→`claude-sonnet-5-5`, haiku→`claude-haiku-5-5`, opus→`claude-opus-5-5`, fable→`claude-fable-5-2` | 2.1.322 | [N], só aquela conta |
| Não há comando que confirme acesso ou versão por modelo sem gerar. `claude auth status --json` só prova login global | 2.1.322 | [P] |
| Troca automática por sobrecarga, modelo inexistente, permissão, bloqueio, "último recurso", recusa e consentimento de créditos. Evento `system/model_fallback` no `stream-json` | 2.1.322 | [P] |
| `CLAUDE_CODE_NO_MODEL_FALLBACK` (booleana) desliga a substituição | 2.1.307 e 2.1.322 | [P]. Efeito em execução não observado |
| Conta do usuário: Claude Pro; seletor lista Opus 5.5, Sonnet 5.5, Fable 5.2 (incluído até 16/11, consome cota mais rápido) e Haiku 5.5; nenhum com "Requires usage credits" | 2.1.322 | [R] sem geração. **Listado ≠ executado** |
| A CLI se atualiza sozinha ("Updated to latest") | Windows, 11/11 | [R] sem geração |

### 1.4 `stream-json` e imagens

| Fato | Nível |
| --- | --- |
| `--input-format stream-json` exige `--print`; `--output-format stream-json` com `--print` exige `--verbose` | [P] |
| Entrada: `{"type":"user","message":<MessageParam>,"parent_tool_use_id":null}`. Imagem como bloco tipado `{"type":"image","source":{"type":"base64",...}}` | [P] |
| `--replay-user-messages` devolve as mensagens lidas; `--include-partial-messages` envia partes da resposta | [P] `--help` |
| Evento `system/init` com `model` resolvido e `tools: []` quando `--tools ""` | [N], entrada só texto |
| Envio real de imagem | **Não testado** |

## 2. O que falta para explicar a falha real

A falha “Revise” (sonnet, 1 material, limite 128, `provider_error`) **não tem
causa comprovada**. O limite de 128 tokens **não** é causa confirmada. Faltam:

1. **A linha estrutural daquela execução.** Ela rodou antes de `aa3933f` e
   `c22beb0`, então não deixou diagnóstico. Só uma nova execução, conduzida pelo
   Codex com o usuário, produz evidência.
2. **A versão da CLI no momento da falha.** O STATUS registra 2.1.307 no
   diagnóstico, e a captura posterior mostra 2.1.322 "Updated to latest". A
   atualização pode ter ocorrido antes ou depois da falha. O formato de erro do
   teto de saída foi confirmado só na 2.1.322.
3. **Se a geração usou raciocínio (effort/thinking)** e se o teto inclui esses
   tokens. A tela mostra "medium effort" para Opus 5.5. Para Sonnet 5.5 em `-p`
   não está levantado. A rodada real anterior (2.1.307, teto 64, uma palavra)
   passou, mas a versão e o modelo resolvido podiam ser outros.
4. **O código de saída e o subtipo** reais dos turnos de erro: observados só
   para cota (seção 6). Teto de saída, recusa de modelo e erros da API seguem
   sem observação.

Hipóteses compatíveis com o código anterior. Nenhuma está confirmada.

| Hipótese | Indício que a distinguiria |
| --- | --- |
| H1. Resposta de revisão passou de 128 tokens e a CLI converteu em erro | Categoria `output_limit_reached` (assinatura). **Hoje o log `claude_cli_failure` não mostra isso**, ver P-1 |
| H2. Teto menor que o orçamento de raciocínio, com recusa da API | Marcador `thinking_output_budget` (Codex), `api_status: 400` |
| H3. Login ou cota informados em `errors[]`, antes ignorados | `authentication` / `quota` (já classificados). Para cota, menos provável: ver seção 6 |
| H4. Problema de invocação no Windows depois da troca para o executável nativo (`bin/claude.exe` no pacote 2.1.322) | Marcador `argument_error`, `exit_code` sem JSON (`stdout_shape: invalid_json`) |

## 3. Problemas concretos encontrados (sem patch)

### P-1 (média, era alta) O diagnóstico pedido ao usuário não mostra a hipótese principal

Atualização de 12/11: na tentativa real, o Codex leu a categoria (`quota`) pela
assinatura ou pela linha `geração falhou`. A lacuna fica restrita ao roteiro de
extração do log do gateway e aos marcadores da linha `claude_cli_failure`.


- **Onde:** `integrations/failure_diagnostics.py` (`log_failure`, lista de
  marcadores) e `docs/CORRECAO_PROVIDER_ERROR.md` (pede só as linhas
  `"event": "claude_cli_failure"`).
- **Comportamento:** a mensagem de teto da 2.1.322 não contém `max_tokens`, só
  "output token maximum" e `CLAUDE_CODE_MAX_OUTPUT_TOKENS`. Por isso
  `markers: []`, indistinguível de uma falha desconhecida. A categoria correta
  (`output_limit_reached`) existe em outro registro: na assinatura do banco e na
  linha `geração falhou … categoria=…` do logger `integrations`. Essa linha não
  casa com o `Select-String` do roteiro.
- **Reprodução (feita, fora do repositório):** saída do dublê existente
  `FAKE_CLAUDE_MODE=output_limit_error` com teto 128 → `log_failure` gera
  `markers=[]`; `categorize(error_texts(...))` dá `output_limit_reached`.
  Resultado parecido para `api_400` e `overloaded` (marcadores vazios, categorias
  `api_invalid_request`/`overloaded`).
- **Esperado:** a evidência que o usuário envia distingue H1 de H2/H3/H4.
- **Proposta (Codex):** marcador `output_limit` para "output token maximum", ou
  incluir a categoria na linha `claude_cli_failure`, ou ampliar o filtro do
  roteiro para a linha `geração falhou`. Fixture: o modo `output_limit_error` já
  existe; o teste afirmaria o marcador ou a categoria na linha estrutural.

### P-2 (média) Duas listas de frases divergentes para a mesma classificação

- **Onde:** `integrations/failures.py` (`CATEGORIES`, usado na resposta e na
  assinatura) e `integrations/failure_diagnostics.py` (marcadores do log).
- **Comportamento:** cada lista reconhece casos que a outra não reconhece. Só os
  marcadores pegam `thinking.budget_tokens…max_tokens` (a categoria fica `none`) e
  sessão aninhada. Só as categorias pegam teto de saída, janela de contexto,
  sobrecarga e status HTTP. Reprodução feita com `errors_budget`:
  `markers=['thinking_output_budget']`, categoria `none`.
- **Impacto:** o código devolvido e a evidência podem contar histórias
  diferentes, e atualizações futuras da CLI exigem manter as duas listas.
- **Proposta (Codex):** uma única tabela de frases → categoria, usada pelos dois
  registros. Fixture: os modos `errors_*` e os de falha de API, com afirmação de
  categoria e marcador iguais.

### P-3 (baixa) JSON patológico vira resultado incerto em vez de saída inválida

- **Onde:** `ClaudeCodeAdapter.parse`, `except ValueError` em torno de `json.loads`.
- **Comportamento:** um JSON profundamente aninhado gera `RecursionError`, que não
  é `ValueError`. A exceção escapa do parser, o servidor a trata como inesperada
  e grava `request_outcome_uncertain` (409 para sempre), sem diagnóstico.
  Reprodução feita: `parse` com `"[" * 200000` no stdout → `RecursionError`.
- **Impacto:** improvável com a CLI oficial. É seguro (não repete), mas classifica
  como incerto algo conhecido como inválido.
- **Proposta (Codex):** tratar `RecursionError` como `provider_invalid_output`.
  Fixture: stdout aninhado.

### P-4 (média) Resposta truncada é perdida na 2.1.322

- **Onde:** `finish_reason_from` (`max_tokens` → `length`) e o modo `max_tokens`
  do dublê, que imitam o comportamento anterior.
- **Comportamento:** pela seção 1.2, a CLI 2.1.322 não devolve o texto parcial
  com `stop_reason: max_tokens`. Ela devolve um erro. O caminho `length` do
  contrato 1.1 ("saída preservada") não é alcançado com `--output-format json`.
- **Impacto:** o usuário perde a resposta parcial, e o dublê `max_tokens` testa um
  formato que a versão atual não produz.
- **Proposta (Codex):** manter o dublê antigo como compatibilidade e acrescentar
  o formato 2.1.322 como caso principal. Preservar o parcial só é possível pela
  saída `stream-json` (seção 4), que depende de contrato.

### P-5 (baixa) A versão da CLI pode mudar entre o diagnóstico e a geração

- **Onde:** a assinatura usa a versão em cache do último status
  (`_status.version`); a linha `claude_cli_failure` não registra versão.
- **Comportamento:** a CLI se atualiza sozinha [R]. Com cache de 30 s a 5 min, a
  versão registrada pode não ser a que executou.
- **Proposta (Codex):** incluir a versão em cache na linha estrutural e anotar
  que é a última verificada. Desligar a atualização automática é decisão do
  usuário sobre a instalação dele, não do projeto.

Nenhum outro problema novo foi encontrado em formato, deduplicação ou
sanitização. Com os dublês, nenhum texto-canário aparece na resposta, no banco ou
nos logs (testes existentes `test_failures.py` e `test_claude_failures.py`).

## 4. Recomendações de compatibilidade e propostas

1. **Fonte única de frases da CLI** (P-2), com a versão em que cada frase foi
   vista, para rever a cada atualização da CLI.
2. **Formatos de 2.1.322 como referência dos dublês**: o turno de erro com
   "API Error", `errors[]` nos subtipos `error_*` e `modelUsage` em toda resposta.
   O código de saída real ainda precisa ser observado.
3. **Registrar por execução** a versão, o modelo pedido e o modelo servido
   (`ProviderResult.served_model` já existe; expor depende de C-1).
4. **Streaming (proposta, depende de contrato do Codex).** `--output-format
   stream-json --verbose` daria:
   - `init.model`: o modelo resolvido antes de gerar;
   - `system/model_fallback`: as trocas, que viram falha;
   - `--include-partial-messages`: a resposta em partes.
   Para o chat lateral, isso permitiria mostrar texto progressivo e talvez
   preservar o parcial antes de um corte (P-4). A preservação **não está
   verificada**. Depende de: contrato com `streaming: true` e formato de entrega
   (SSE ou consulta), política para parcial em erro, deduplicação de um fluxo
   interrompido e cancelamento local. Nada disso existe hoje. O contrato 1.1
   continua `streaming: false`.
5. **Visão (proposta existente).** `integrations/docs/PROPOSTA_ENTRADA_VISUAL.md`,
   seção 6: entrada `stream-json` com bloco `image` tipado, `--replay-user-messages`
   para confirmar o recebimento e `tools: []` conferido no `init`. Depende do
   contrato 1.2 (Codex). Nada implementado.
6. **Créditos e Fable.** Não escolher Fable automaticamente. "Incluído até 16/11"
   [R] implica que a condição muda com o tempo. Uma recusa por créditos precisa
   de código próprio para o usuário entender (C-2).

## 5. Pendências

Nenhuma destas pendências está transferida a mim. Ficam com o responsável indicado.

**Codex**

| Id | Pendência | Origem |
| --- | --- | --- |
| P-1 | Evidência do teto de saída na linha estrutural ou no roteiro | Seção 3 |
| P-2 | Tabela única de frases → categoria/marcador | Seção 3 |
| P-3 | `RecursionError` → `provider_invalid_output` | Seção 3 |
| P-4 | Dublê do formato 2.1.322 do teto; decisão sobre preservar parcial | Seção 3 |
| P-5 | Versão da CLI na linha estrutural | Seção 3 |
| C-1 | `served_model` na resposta (versão de contrato a decidir) | `PASSAGEM_CLAUDE_ONLY.md` |
| C-2, C-7 | Códigos próprios para créditos, modelo indisponível e teto de saída | idem |
| C-3, C-4 | Fable só por escolha explícita; revisor de nível igual ou superior | idem |
| C-5 | Duração por etapa | idem |
| C-6, C-10 | Login ≠ acesso por modelo; request ID ou impressão digital nos detalhes | idem |
| C-8 | Limite padrão para revisão/chat: decisão de produto. **Não** é correção da falha, que segue sem causa comprovada | idem |
| C-9 | Histórico do chat em `context[]`, dentro de `context_char_limit`, sem sessão paralela da CLI | idem |
| — | Observar na validação Windows: versão da CLI, código de saída e subtipo reais de um turno de erro | Seção 2 |

**Frontend/UI** (outro chat do Claude, no lugar do Gemini desde 11/11)

| Id | Pendência | Dependência |
| --- | --- | --- |
| F-2 | Manter a tradução neutra de `provider_error` já feita pelo Codex em `frontend/src/logic.mjs` ao construir o chat | Nenhuma |
| F-1 | Seletor rápido/normal/profundo | Decisão do Codex sobre C-3/C-4 |
| — | Mensagens específicas para teto de saída, créditos e modelo indisponível | Só depois que C-2/C-7 existirem no backend |
| F-3 | Para `provider_quota_exceeded`, não prometer horário de renovação: o gateway não o transmite (texto da CLI é descartado). Indicar conferir no Claude Code | Nenhuma; R-2 mudaria isso |

**Claude Code:** nenhuma implementação em aberto. Uma nova tarefa só começa por
transferência registrada em `docs/DIVISAO_RESPONSABILIDADES.md` ou por pedido
explícito do usuário.

## 6. Atualização de 12/11/2026 (base `4e6679e`)

Desde `36e5402`, a base mudou só em scripts de consolidação de cópias no Windows
e em documentos do Codex. **Nada em `integrations/`.** P-1 a P-5 continuam
abertos. Os prefixos G-* passaram a F-* (frontend, outro chat do Claude).

### Evidência nova [R, com geração, conduzida pelo Codex]

`docs/STATUS.md` e `docs/CORRECAO_PROVIDER_ERROR.md` registram que o teste opcional
`test_real_claude_code.py` (Sonnet, teto 128) terminou em **HTTP 429**:
`provider_quota_exceeded`, categoria `quota`, etapa `result_error`, em 2,885 s.
A CLI saiu com **código 1** e imprimiu **JSON objeto** com `subtype: "success"` e
`result` em texto.

O que isso comprova:
- O formato de erro de cota na conta do usuário: código 1 + `subtype: "success"`
  + texto em `result`. É o formato que os dublês `auth_error`/`usage_limit` já
  imitavam. Não é o envelope `errors[]` dos subtipos `error_*`.
- `subtype: "success"` não indica sucesso. O parser atual trata corretamente
  `is_error`/código ≠ 0 antes do subtipo.
- A classificação por frase funcionou para esta mensagem.

O que **não** comprova:
- Qual janela de uso foi atingida, nem o horário de renovação. O gateway descarta
  o texto e só guarda a categoria, de propósito.
- A versão da CLI nesta execução (a captura não mostra; P-5).
- Nada sobre o teto de 128: a falha veio antes de qualquer resposta.
- A causa do `provider_error` original.

### Dedução nova sobre a falha original (não é diagnóstico)

O código vigente na falha “Revise” (`fa24ef3`) já classificava como cota um
`result` com "usage limit", "limit reached", "rate limit", "quota" ou "resets".
Se aquela falha tivesse sido de cota **no mesmo formato** observado agora, o
painel teria mostrado `provider_quota_exceeded`, não `provider_error`. Logo, cota
nesse formato fica **menos provável** como causa original.

Ressalvas:
- A versão pode ter sido outra (2.1.307 × 2.1.322).
- Um texto de cota sem essas frases cairia em `provider_error`.
- Cota no envelope `errors[]` (H3) também seria `provider_error` no código antigo,
  mas esse envelope não foi observado para cota.

H1, H2 e H4 continuam em aberto.

### Leitura do próximo teste sintético (apoio à análise, não é pedido de teste)

O teste opcional pede uma resposta de **uma palavra** com teto 128. Portanto:
- **Sucesso** valida login, invocação, formato de sucesso e modelo servido (a
  linha imprime "pedido | servido"). **Não exclui H1**, porque a resposta não
  chega perto do teto. Só exclui H2 se o raciocínio contar no teto e ainda assim
  passar.
- **Erro com categoria `output_limit_reached`** ou marcador
  `thinking_output_budget` numa resposta de uma palavra indicaria H2 (raciocínio
  consumindo o teto), não H1.
- **Cota de novo** não diz nada sobre a falha original.
- O banco de deduplicação do teste é temporário. A assinatura persiste só nas
  linhas de log impressas no terminal (`claude_cli_failure` e `geração falhou`).
  Por isso P-1 importa nesse teste.

### Recomendações novas

- **R-1 (Codex):** documentar no dublê de cota que o formato foi **observado**
  (código 1, `subtype: "success"`, `result` em texto). Até agora era descrito como
  "visto na prática", sem data nem versão. Fixture: a existente `usage_limit`, com
  comentário de proveniência. Não precisa de código novo.
- **R-2 (Codex, depende de contrato):** a saída `stream-json` emite um evento
  `rate_limit_event`, visto em [N] só pelo tipo; campos **não levantados**. Se ele
  trouxer janela e renovação de forma estruturada, permitiria informar o usuário
  sem guardar texto da CLI. Hoje não há evidência suficiente para propor campos.
  Fica condicionado à proposta de streaming da seção 4.
- **R-3 (Codex):** a categoria `quota` junta "rate limit" (limite de taxa da
  API, possivelmente transitório) e "usage limit" (janela da assinatura). Se a
  interface for orientar "aguarde a renovação", convém separar as duas
  categorias na assinatura. A frase exata do limite de taxa na 2.1.322 não foi
  levantada, então não proponho a frase.

Sem outros achados novos nesta atualização.

## 7. Resposta cortada (A1) e sinalização do limite de uso (A2) — 16/11/2026

Pedidos A1 e A2 de `docs/PASSAGEM_CLAUDE_FRONTEND.md` (branch
`claude/friendly-curie-pxw81w`, `b2735ca`). Base inalterada desde `4e6679e`.
**Nenhuma geração.** Evidência [P]: binários oficiais lidos com `strings`:
- 2.1.325, a CLI instalada neste contêiner, que se atualizou sozinha;
- 2.1.322 e 2.1.307, os pacotes linux-x64 do npm, que são as versões do Windows.

Os trechos citados existem nas três versões, com nomes de variáveis diferentes.
Reprodução das classificações chamando as funções existentes do gateway, sem
alterar o repositório.

### 7.1 A1 — como a CLI monta `result`

O que o binário mostra, nas três versões:

1. **Cada bloco de conteúdo vira uma mensagem `assistant` separada.** No evento
   `content_block_stop` da API, a CLI emite uma mensagem com o mesmo `id` da
   resposta e `content` contendo **só aquele bloco**. Na saída `stream-json`, isso
   aparece como vários eventos `assistant` com o mesmo `message.id`.
2. **`result` guarda só o texto do último bloco.** O laço que monta o resultado
   final faz, para cada mensagem `assistant`:
   `texto = (último bloco é texto) ? bloco.text : ""`. O valor anterior é
   **substituído**, não concatenado. No fim, `result = erro ? texto_do_erro : texto`.
   2.1.325: `let Ts=H?se:yt`; 2.1.322: `let ws=Pe?fe:at`; 2.1.307: `let ks=pt?ts:Vt`.
3. **`stop_reason` não muda com isso.** Ele vem do `message_delta` final, então uma
   resposta assim termina com `end_turn` e o gateway devolve `finish_reason: stop`.
   É o que a captura mostrou ("término informado pelo provedor").

Consequência: se o modelo responder em **mais de um bloco de texto**, a saída
`--output-format json` (a usada pelo gateway) traz **só o último bloco**. Nada no
resultado indica a perda: `is_error: false`, `subtype: "success"`, `stop_reason`
normal.

Ligação com C2 (resposta "-48dc-b51a-4c4ebcb0da4e)."): o texto exibido é o **final**
de um UUID seguido de ")." e de fim de frase. É compatível com o último de vários
blocos de texto. **Não está comprovado** que foi isso:

| Hipótese | Situação | Como distinguir, sem gerar |
| --- | --- | --- |
| H-A. Resposta em vários blocos de texto; `result` só com o último | Mecanismo comprovado [P]. **Gatilho desconhecido**: não levantei quando a API divide o texto de uma resposta sem ferramentas em blocos (citações e ferramentas de servidor estão fora do uso do gateway) | Corpo gravado pelo gateway para aquele `request_id` (tabela de deduplicação): se `output` já é o trecho final e `usage.output_tokens` é muito maior que ~15 tokens, o corte veio da CLI. Ressalva: tokens de raciocínio também contam |
| H-B. Corte depois do gateway (backend, armazenamento ou exibição) | Não verificado. A interface diz mostrar `task.output` inteiro. `readableAnswer` só troca ids **completos** por títulos, então não produz o recorte | Mesmo corpo do gateway: se lá o texto estiver completo, o corte é depois dele |
| H-C. O modelo respondeu só isso | Improvável, sem evidência | `usage.output_tokens` da etapa |

O que falta é o texto completo da tarefa (U1) e, principalmente, o corpo gravado
pelo gateway e o `usage` daquela etapa. Os dois são leituras, sem geração, e
ficam com o Codex.

**Problema P-7 (alta, se H-A se confirmar):** `ClaudeCodeAdapter.parse` usa só
`result` da saída `json`. Com mais de um bloco de texto, a resposta é aceita como
completa e com `finish_reason: stop`, mas faltando partes. Os dublês nunca
cobriram esse formato: o `fake_claude.py` emite um único `result` coerente.

Proposta (Codex; muda o parser, **não** o contrato):
- Ler `--output-format stream-json --verbose` **internamente** e montar a saída
  concatenando, em ordem, os blocos `text` das mensagens `assistant` da última
  resposta (mesmo `message.id`).
- Conferir com `result`: o último bloco precisa coincidir. Se não coincidir,
  `provider_invalid_output`, nunca sucesso.
- O backend continua recebendo uma resposta completa e não incremental.
  `streaming: false` não muda, porque `stream-json` aqui é só o formato da CLI.
- Ganhos extras da mesma leitura:
  - `init.model`: o modelo resolvido;
  - `system/model_fallback`: trocas de modelo, que viram falha;
  - `api_error_params` com o horário de renovação (seção 7.2);
  - `rate_limit_event`.
- Fixture proposta: o dublê no modo `stream-json` emitindo duas mensagens
  `assistant` com o mesmo `id` ("Primeira parte (fonte " / "abc-123).") e um
  `result` só com a segunda. Esperado: a saída concatenada. Outra variante:
  `result` diferente do último bloco → `provider_invalid_output`.

### 7.2 A2 — como a CLI sinaliza o limite de uso

**Na saída `json` (a do gateway hoje):** o turno de erro tem `is_error: true`,
`subtype: "success"` e código de saída 1, como observado no Windows [R]. Também traz:
- `result`: a frase para o usuário (abaixo);
- `api_error_status`: o status HTTP, por exemplo 429;
- `api_error_code` / `api_error_type`: códigos do servidor, quando existem;
- `api_error`: **tipo do erro, sem precisar ler texto**. Para limite da conta ou
  do plano, `"usage_limit_reached"`. Outros relacionados:
  `model_requires_usage_credits`, `long_context_credits_required`,
  `no_allowed_fallback`, `model_substitution_disabled`, `max_output_tokens`.

`api_error` é marcado como "@internal" e a própria CLI avisa que novos valores
aparecem com o tempo: "treat an unknown value as absent". A CLI só o preenche
quando a frase é reconhecida como limite (prefixos "You've hit your",
"You've reached your", "You're out of usage credits"...) ou com uso pausado. A
sobrecarga temporária do servidor também usa `rate_limit`, mas **sem** esse tipo.

**Horário de renovação e tipo de janela:** **não** vêm na saída `json`. O schema
de `result` não tem `api_error_params`. Eles aparecem só no `stream-json`:
- na mensagem `assistant` do erro, em `api_error_params.rate_limit_info`:
  - `status` (`allowed` / `allowed_warning` / `rejected`);
  - `resetsAt` (segundos Unix);
  - `rateLimitType` (`five_hour`, `seven_day`, `seven_day_opus`,
    `seven_day_sonnet`, `seven_day_overage_included`, `overage`);
  - `utilization` e, por janela, `unifiedWindows`;
- nos eventos `rate_limit_event`, emitidos "quando a informação de limite muda",
  inclusive **antes** de bater no limite (`allowed_warning`).

**Frase para o usuário** (montada pela CLI): `You've hit your <janela><sufixos>`.
- Janelas: "5-hour limit", "weekly limit", "Opus limit", "Sonnet limit",
  "Fable limit", "usage credit limit", "usage limit", "monthly spend limit".
- Sufixo " · resets <hora local>" **só quando a renovação é conhecida**, mais
  " · progress saved" em alguns casos.
- Variantes: "You're out of usage credits…", "Usage is paused for your
  organization…", "Your seat type doesn't include usage credits".

**Problema P-6 (alta): limite sem horário de renovação vira `provider_error`.**
- **Onde:** `integrations/failures.py`, categoria `quota`. Reconhece só "usage
  limit", "limit reached", "rate limit", "quota" e "resets". Os marcadores de
  `failure_diagnostics.py` também não pegam essas frases.
- **Reprodução feita** com `categorize` + `error_for`:

  | Frase | Resultado |
  | --- | --- |
  | "You've hit your 5-hour limit · resets 5pm …" | `provider_quota_exceeded` |
  | "You've hit your 5-hour limit · progress saved" | `provider_error` |
  | "You've hit your weekly limit" | `provider_error` |
  | "You've hit your Sonnet limit" | `provider_error` |
  | "Usage is paused for your organization…" | `provider_error` |

- **Impacto:** a interface mostra uma falha genérica para um limite de uso. A
  deduplicação continua correta (não repete).
- **Relação com a falha original "Revise":** o código de `fa24ef3` tinha as mesmas
  frases. Um limite sem horário de renovação teria virado `provider_error`, e no
  mesmo dia o teste seguinte bateu em cota (429). Isso vira a hipótese
  **H5, plausível e não comprovada**. Não substitui H1, H2 e H4.
- **Proposta (Codex):** classificar primeiro pelo campo tipado `api_error` do
  resultado:
  - `usage_limit_reached` → cota;
  - `model_requires_usage_credits` / `long_context_credits_required` → créditos;
  - `model_substitution_disabled` / `no_allowed_fallback` → modelo indisponível;
  - `max_output_tokens` → teto de saída (P-1, C-7).

  Usar o texto só quando o tipo estiver ausente ou desconhecido, e acrescentar
  "You've hit your" e "You've reached your" às frases. Usar `api_error_status` em
  vez de procurar "API Error: NNN" no texto. Fixture: o dublê `usage_limit` com
  `api_error: "usage_limit_reached"`, `api_error_status: 429` e a frase **sem**
  " · resets".

**Para a mensagem da interface (F-3 revisto):**
- Hoje o gateway não sabe quando o limite renova, então a interface não deve
  prometer horário. Pode dizer "limite de uso da conta atingido; confira no
  Claude Code".
- Com a leitura `stream-json` (P-7), o gateway passaria a ter `resetsAt` e
  `rateLimitType` **sem guardar texto da CLI**.
- Levar isso ao backend e à interface exige um campo de contrato, por exemplo
  `retry_after`/`limit_window` no erro 429. É decisão do Codex.
- O mesmo vale para avisar **antes** do limite (`allowed_warning`).

R-2 (seção 6) fica respondido: os campos de `rate_limit_event` agora estão levantados.

### 7.3 Pendências novas

| Id | Para | O quê |
| --- | --- | --- |
| P-6 | Codex | Classificar pelo `api_error` tipado; frases "You've hit/reached your"; `api_error_status` direto |
| P-7 | Codex | Ler `stream-json` internamente e concatenar os blocos de texto; conferir com `result` |
| E-1 | Codex | Ler, sem gerar, o corpo gravado pelo gateway e o `usage` da etapa da resposta cortada (C2), para distinguir H-A de H-B |
| C-11 | Codex | Se quiser mostrar renovação ou aviso prévio: campo de contrato para janela e renovação do limite |
| F-3 | Frontend | Mantido: não prometer horário de renovação enquanto C-11 não existir. Mensagem de limite também para `provider_error` só se o backend mandar código específico (P-6), nunca por adivinhação |

Nenhuma implementação comigo.

## 8. Fechamento antes do teste contínuo — 17/11/2026 (base `31c3d43`)

Base incorporada sem conflito: `31c3d43`. Desde a seção 7, o Codex implementou
P-1 a P-7 (`docs/RESPOSTA_ANALISE_CLI.md`):
- o adaptador passou a ler `--output-format stream-json --verbose` internamente
  (`integrations/stream_output.py`);
- o histórico do chat é montado pelo backend (`backend/conversations.py`);
- o contrato 1.2 foi acrescentado.

Esta seção confere esse estado contra a CLI do Windows. Não editei código e não
houve geração.

**Versão do Windows.** `docs/HISTORICO_STATUS.md` registra 2.1.307. A captura de
`/model` de 11/11 [R] já mostrava **2.1.322**, porque a CLI se atualizou sozinha.
Pode estar mais nova hoje. Por isso conferi **as duas**: pacotes linux-x64
oficiais do npm, mesma versão dos `win32-x64`. Nas duas, o pacote principal
instala `bin/claude.exe`, um executável nativo, não um script Node.

### 8.1 Flags passadas por `claude_code.py`

| Argumento (como enviado) | 2.1.307 | 2.1.322 | Observação |
| --- | --- | --- | --- |
| `--print <prompt fixo>` | ✅ | ✅ | Booleana; o texto é argumento posicional |
| `--output-format stream-json` | ✅ escolhas `text/json/stream-json` | ✅ | Com `--print` exige `--verbose`, senão: "Error: When using --print, --output-format=stream-json requires --verbose" e saída 1 |
| `--verbose` | ✅ | ✅ | Obrigatória pela linha acima |
| `--model <modelo>` | ✅ | ✅ | Alias ou nome completo |
| `--system-prompt <texto>` | ✅ | ✅ | Substitui o prompt de sistema |
| `--tools ""` | ✅ `<tools...>`, `""` = nenhuma | ✅ | Variádica: termina na próxima opção (`--strict-mcp-config`) |
| `--strict-mcp-config` | ✅ | ✅ | Sem `--mcp-config`, nenhum MCP |
| `--safe-mode` | ✅ | ✅ | Desliga CLAUDE.md, skills, plugins, hooks e MCP do usuário. Configurações administrativas (policy) continuam valendo |
| `--no-session-persistence` | ✅ | ✅ | "only works with --print" |
| `--disable-slash-commands` | ✅ | ✅ | |
| `--permission-prompts none` | ✅ escolhas `host/none` | ✅ | `none` nega automaticamente o que pediria permissão |
| `--input-format stream-json` (só visão) | ✅ | ✅ | Exige `--print` e saída `stream-json` |
| `--replay-user-messages` (só visão) | ✅ | ✅ | Só com entrada e saída `stream-json` |
| `CLAUDE_CODE_NO_MODEL_FALLBACK=1` (ambiente) | ✅ | ✅ | |

- Todas as flags de `REQUIRED_FLAGS` aparecem no `--help` das duas versões, nenhuma
  oculta. A verificação de flags do diagnóstico não deve recusar a CLI do Windows.
- O `--fallback-model` existe, mas o gateway não o passa.
- O prompt pede a saída `--output-format json`, mas desde `31c3d43` o adaptador usa
  `stream-json --verbose`. O resultado final continua o mesmo objeto `result`, agora
  na última linha.

### 8.2 Entrada no Windows: argumento × entrada padrão

- **Linha de comando:** 1.068 caracteres com caminho `claude.cmd` típico e
  `claude-sonnet-5-5[1m]`. O limite do `cmd.exe` (atalho `.cmd` do npm) é 8.191; o
  do `CreateProcess` (`claude.exe` direto) é 32.767. O `SYSTEM_PROMPT` tem 734
  caracteres, só ASCII e sem `% ^ & | < > " ! ( )`. Ele tem crescido a cada rodada.
  **Recomendação (Codex):** um teste que trave essas duas propriedades e um teto de
  ~4.000 caracteres.
- **Entrada padrão** [P, 2.1.307 e 2.1.322]:
  - a CLI lê a entrada padrão como UTF-8 e monta o prompt como
    `[argumento, entrada].join("\n")`: primeiro o pedido fixo, depois o documento JSON;
  - limite de **10 MiB** (10.485.760 caracteres), muito acima dos 80.000 do gateway;
  - se nada chegar em 3 s, segue sem a entrada e só avisa no stderr. O runner
    escreve logo após abrir o processo, então isso não deve ocorrer. Se ocorresse, a
    resposta seria sobre um pedido sem fontes, sem erro;
  - **fixture proposta:** o dublê imitar esse comportamento quando a entrada
    estiver vazia.
- **Visão:** com `--input-format stream-json`, a entrada é uma linha NDJSON de
  mensagem `user`. O argumento posicional fica sem uso.

### 8.3 Formatos de saída e erro (`stream-json`)

**Sequência típica de sucesso**, observada em [N] na 2.1.322:

1. `system/ui_invalidate`, às vezes;
2. `system/init`, com `model` já resolvido, `tools: []`, `claude_code_version` e
   `apiKeySource: "none"`;
3. uma mensagem `assistant` **por bloco** de conteúdo, com o mesmo `message.id`;
4. `rate_limit_event`;
5. `result`, por último.

**Na falha**, a mesma sequência termina em `result` com `is_error: true`. A mensagem
`assistant` que precede é o erro sintético da CLI.

Pontos principais:
- **`stdout` × `stderr`:** o que a CLI emite como evento vai para o `stdout`.
  O `stderr` só traz erros de opção (por exemplo, falta de `--verbose`) e avisos da
  entrada padrão. O gateway nunca interpreta o `stderr`; só registra o tamanho.
  **Nesses casos não há JSON** e o resultado é `provider_invalid_output` na etapa
  `parse_json`. Esse código também cobre a CLI recusar uma flag.
- **`errors[]`:** só nos subtipos `error_*`, sem `result` (seção 1.1).
- **`stop_reason`:** vem do último `message_delta`; não muda com a divisão em blocos.
- **`modelUsage`:** indexado pelo modelo servido.
- **Tipos `system` existentes nas duas versões:** mais de 60, entre eles `api_retry`,
  `model_fallback`, `model_refusal_fallback`, `model_consent_fallback`,
  `model_refusal_no_fallback`, `turn_duration`, `post_turn_summary`, `status` e
  `notification`. Também `rate_limit_event`, `keep_alive` e `prompt_suggestion` no
  nível de cima.

**Parser atual × formatos que os dublês ainda não cobrem.** Reproduzido chamando
`ClaudeCodeAdapter.parse(..., stream=True)` com saídas sintéticas, fora do
repositório:

| Id | Formato | Resultado hoje | Leitura |
| --- | --- | --- | --- |
| F1 | `ui_invalidate` antes do `init` + `rate_limit_event` antes do `result` (observado [N]) | ✅ sucesso | Coberto pelo código, não pelos dublês |
| F2 | Dois blocos de texto, mesmo `id` (A1) | ✅ concatena | Coberto (`multi_block`) |
| F3 | Bloco de pensamento + texto | ✅ | |
| F4 | **Evento depois do `result`** (ex.: `system/turn_duration`) | ❌ `provider_invalid_output` | P-8 |
| F5 | `system/api_retry`, resposta abortada (`id` m1) + nova (`id` m2) | ✅ usa só m2 | |
| F6 | **Mensagem `assistant` sintética** (`model: "<synthetic>"`) num turno de sucesso | ❌ `provider_model_mismatch` | P-9 |
| F7 | `system/model_refusal_fallback` com assistente no mesmo modelo | ✅ aceito | P-10 |
| F8 | `init.tools` não vazio | ❌ `provider_invalid_output` | Correto |
| F9 | Texto final com marcação que a CLI remove de `result` (`<cc-memory …>`) | ❌ `provider_invalid_output` | Caso raro, correto não aceitar |
| F10 | Só bloco de pensamento | ❌ `provider_empty_output` | Correto |
| F11 | Linhas com `\r\n` (Windows) | ✅ | |

**P-8 (média): evento depois do `result` invalida uma geração já feita.**
- **Onde:** `decode_output` exige que o `result` seja a última linha.
- **Evidência:** em [N], 2.1.322, o `result` foi o último nas 4 execuções. Nas duas
  versões existem eventos de fim de turno (`turn_duration`, `post_turn_summary`,
  `prompt_suggestion`) cuja ordem com `--print` não foi levantada.
- **Impacto:** se aparecerem depois do `result`, toda geração vira
  `provider_invalid_output`, final, já cobrada.
- **Proposta:** aceitar depois do `result` apenas eventos sem conteúdo (`system/*`
  exceto os de troca de modelo, `rate_limit_event`, `keep_alive`) e recusar
  `assistant`/`user` ali.
- **Fixtures:** `stream_events` + `{"type":"system","subtype":"turn_duration"}` no fim
  → sucesso; + uma `assistant` no fim → `provider_invalid_output`.

**P-9 (baixa-média): mensagem sintética derruba a conferência de modelo.**
- **Onde:** `assemble` exige que **toda** mensagem `assistant` tenha o modelo
  autorizado.
- **Evidência:** a CLI cria mensagens com `model: "<synthetic>"` (avisos e erros,
  por exemplo "No response requested."). Num turno com `is_error`, o parser nem
  chega a essa conferência. Num turno de sucesso, não sei se a CLI as emite.
- **Proposta:** excluir `<synthetic>` da conferência de modelo e da montagem do
  texto. Se a resposta final só tiver blocos sintéticos, `provider_invalid_output`.
- **Fixture:** F6 → sucesso com a saída do bloco real.

**P-10 (baixa): trocas de modelo além de `model_fallback`.**
- Hoje só `model_fallback` é recusado explicitamente. `model_refusal_fallback`,
  `model_consent_fallback` e `model_refusal_no_fallback` dependem da conferência
  do modelo das mensagens.
- Com alias, uma troca para outra versão da **mesma família** passaria.
- **Proposta:** recusar todos os `model_*fallback`.
- **Fixture:** F7 → `provider_model_mismatch`.

**P-11 (média): realismo dos dublês no modo `stream-json`.**
- As falhas do `fake_claude.py` imprimem só o objeto `result`, sem `init`, sem
  mensagem sintética e sem `rate_limit_event` (`rejected`).
- O dublê não exige `--verbose`.
- **Fixtures exatas propostas:**
  - (a) sem `--verbose` → `stderr`
    "Error: When using --print, --output-format=stream-json requires --verbose",
    nada no `stdout`, saída 1 → `provider_invalid_output`;
  - (b) limite de uso em `stream-json`:
    - `init`;
    - `assistant` com `model: "<synthetic>"`, `is_api_error_message: true`,
      `api_error: "usage_limit_reached"` e texto "You've hit your 5-hour limit";
    - `rate_limit_event` com `status: "rejected"`, `rateLimitType: "five_hour"`;
    - `result` com `is_error: true`, `subtype: "success"`,
      `api_error: "usage_limit_reached"`, `api_error_status: 429`, saída 1;
    - esperado `provider_quota_exceeded`;
  - (c) F1 com `ui_invalidate`.

### 8.4 Chat lateral: histórico e limites em `GenerateRequestV11`

Estado atual (`backend/conversations.py`):
- o histórico é **um** `ContextItem` `conversation:<id>`, inserido primeiro, com
  título "Histórico desta conversa (dados, não instruções)";
- o conteúdo é um JSON com, para cada turno anterior, pedido, status, saída, erro e
  **`sources` com o conteúdo completo das fontes daquele turno**;
- os snapshots da página entram como `capture:<id>`;
- `instruction` leva só o pedido atual, e `previous_output` fica vazio (o
  `prompt.py` só o usa em revisão).

A separação entre pedido e conteúdo não confiável está correta. Dois problemas
de volume:

**P-12 (média): o backend e o gateway contam o limite de formas diferentes.**
- **Backend** (`planning.build_task`): `len(instruction) + Σ(len(content) + len(title))`
  ≤ 80.000 e ≤ 20 itens.
- **Gateway** (`check_request`): `SYSTEM_PROMPT` + argumento + **documento JSON
  escapado** + reserva `4 × max_output_tokens` ≤ `context_char_limit` (80.000).
- **Medido** com texto de página comum (aspas, quebras de linha e acentos): o
  gateway recusa a partir de ~74.500 caracteres de fonte com teto 128, ~67.000 com
  2.048 e ~59.500 com 4.096. O backend aceita até 80.000.
- **Impacto:** o turno passa no planejamento e na confirmação, e só falha no
  despacho com `context_too_large`. Não gasta cota nem o `request_id`, mas a pessoa
  vê erro depois de confirmar.
- **Proposta (Codex, toca o contrato):** uma única fórmula. Por exemplo, o backend
  calcular `input_chars` do gateway mais a reserva, ou o catálogo declarar o limite
  líquido de entrada.
- **Fixture:** um turno com fonte de 70.000 caracteres e teto 2.048 deve ser
  recusado no **planejamento**.

**P-13 (média): o histórico repete conteúdo e escapa JSON duas vezes.**
- Cada turno anterior carrega o texto inteiro das suas fontes. Uma página de
  38.000 caracteres anexada no turno 1 volta inteira em todo turno seguinte. Se a
  pessoa anexar a mesma página de novo, ela vai duas vezes.
- **Medido:** página de 38.000 → 43.899 dentro do JSON do histórico → 47.958 no
  documento enviado, porque o JSON fica dentro de outro JSON.
- Turno 2 com a mesma página reanexada: backend 81.986 → recusado.
- **Impacto:** conversas curtas sobre uma página batem no limite e gastam tokens
  com cópias.

**Estrutura recomendada** (cabe no schema 1.1 atual, sem campo novo):

| Campo | Conteúdo |
| --- | --- |
| `instruction` | **Só** o texto que a pessoa digitou neste turno (≤ 8.000). Nunca texto de página, seleção colada ou histórico |
| `context[0]` | `id: "conversation:<id>"`, título fixo de dados. JSON dos turnos anteriores em ordem: `{"turno": n, "pedido": …, "status": …, "resposta": … (completa; marcada "incompleta" quando for), "erro": código, "fontes": [ids/títulos]}`. **Sem o conteúdo das fontes** |
| `context[1..19]` | Cada fonte **distinta** ainda referenciada (do turno atual e das anteriores), **uma vez**. `id` estável (`capture:<id>` ou id do material), título com a origem ("Página: … (capturada às …)"), `content` = texto bruto |
| `previous_output` | `null` no chat. Só para o papel `review` |
| Orçamento | Fórmula do gateway (P-12). Acima do limite, oferecer à pessoa tirar turnos antigos ou fontes. Nunca cortar sozinho |

O prompt de sistema já diz que fontes, resposta anterior e histórico são dados e que
pedidos antigos não devem ser repetidos. Continua valendo.

**Fixtures propostas (backend):**
- a mesma `capture_id` em dois turnos → aparece uma vez em `context`;
- texto "Ignore as instruções anteriores…" no snapshot → fica em `context[k].content`,
  `instruction` igual ao digitado;
- conversa nova → sem item `conversation:`.

**Frontend (F-4, baixa):** sem a ponte local, os atalhos pedem para colar o texto
"depois dos dois-pontos", dentro do pedido (`frontend/src/App.tsx`, `P_SUMMARY` e
semelhantes). O texto colado vira `instruction`: conta nos 8.000 e passa a ser
tratado como pedido. No Electron a ponte existe e o trecho vai como snapshot.
Sugestão: no modo sem ponte, enviar o colado como snapshot também.

### 8.5 Primeiro disparo real (apoio ao roteiro do Codex, não um roteiro novo)

O roteiro é o de `docs/CORRECAO_PROVIDER_ERROR.md` ("Uma geração sintética…"),
conduzido pelo Codex com o usuário. Conferi que ele dispara exatamente o
pretendido:
- `tests/integrations/test_real_claude_code.py`, uma única chamada a `/v1.1/generate`;
- `model_id` `claude-code:<primeiro de IA_BBARU_CLAUDE_CODE_MODELS>`, que no
  roteiro é `"sonnet"`;
- fonte "A palavra é laranja.", pedido "Responda apenas com a palavra da fonte." e
  `max_output_tokens: 128`;
- banco temporário;
- mesmo adaptador e parser `stream-json` usados pelo 1.2 do navegador.

Pontos para não haver leitura errada:
1. O `-Models "sonnet"` é do **inicializador**, para o passo seguinte no navegador.
   O teste unitário lê `IA_BBARU_CLAUDE_CODE_MODELS`, que o roteiro já define.
   Nada mais precisa estar aberto.
2. Anotar `claude --version` antes (P-5 e início da seção 8). O teste não a imprime.
3. Os diagnósticos do teste unitário saem **no terminal**, no `stderr`: as linhas
   `{"event": "claude_cli_failure", …}` e "geração falhou … categoria=…". Não saem
   em `gateway-erros.log`, que é só do gateway iniciado pelo script.
4. Leituras possíveis, sem repetir em nenhum caso de erro ou timeout:

   | Resultado | Leitura |
   | --- | --- |
   | `OK` + "pedido: sonnet \| servido: claude-sonnet-…" | Login, flags, `stream-json` e modelo validados na conta. **Não** exclui H1 (resposta de uma palavra) |
   | `provider_output_limit_reached` | Com resposta de uma palavra, aponta **H2** (raciocínio consumindo o teto 128). Achado importante |
   | `provider_quota_exceeded` / `provider_rate_limited` | Limite da conta; nada sobre a falha antiga |
   | `provider_invalid_output`, etapa `parse_json` | Ver `stderr_present`: flag recusada ou P-8 |
   | `provider_invalid_output`, etapa `stream_shape` | Formato fora do esperado: P-8, P-11 ou F9 |
   | `provider_model_mismatch` | P-9 ou P-10 |
   | Teste **ignorado** | CLI ou login indisponível. Não valida geração |

5. Só depois de um `OK` faz sentido abrir o teste contínuo no navegador.

### 8.6 Critério de pronto da Frente 1

| Critério | Resultado (Linux, dublês, `IA_BBARU_REAL_TEST` ausente) |
| --- | --- |
| `python -m unittest discover -s tests/integrations -v` | ✅ 103 executados: 102 OK + 1 ignorado (o teste real) |
| `python -m unittest discover -s tests` | ✅ 92 OK |
| `scripts/verify_gateway_v11.py --gateway-checkout .` | ✅ 5 cenários |
| OpenAPI 1.1 do gateway | ✅ `export_openapi --check` sem diferença |
| Propostas sem divergência de schema 1.1 | ✅ P-8 a P-13 e as fixtures usam só campos existentes. Só a variante "limite líquido no catálogo" de P-12 tocaria contrato e fica como decisão do Codex |
| Windows e conta real | ⏳ Suítes no Windows e o disparo da seção 8.5, com o Codex |

**Riscos que ainda podem aparecer só com a conta real:**
- ordem dos eventos de fim de turno (P-8);
- mensagens sintéticas em sucesso (P-9);
- raciocínio contando no teto 128 (H2);
- versão real da CLI no Windows.

Nenhum deles impede o disparo único da seção 8.5. Todos são classificados sem
repetição.

### 8.7 Pendências novas

| Id | Para | O quê |
| --- | --- | --- |
| P-8 | Codex | Tolerar eventos sem conteúdo depois do `result` |
| P-9 | Codex | Excluir `model: "<synthetic>"` da conferência e da montagem |
| P-10 | Codex | Recusar todos os `model_*fallback` |
| P-11 | Codex | Dublês `stream-json` realistas: (a) a (c) da seção 8.3 |
| P-12 | Codex | Mesma fórmula de orçamento no backend e no gateway |
| P-13 | Codex | Histórico sem conteúdo de fonte; fontes únicas por id |
| — | Codex | Teste que trave tamanho e caracteres do `SYSTEM_PROMPT` (seção 8.2) |
| F-4 | Frontend | Texto colado sem ponte como snapshot, não no pedido |

Nenhuma implementação comigo.
