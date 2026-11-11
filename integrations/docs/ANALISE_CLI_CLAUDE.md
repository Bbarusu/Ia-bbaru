# Análise técnica da CLI oficial Claude Code

Autor: Claude Code (frente de compatibilidade da CLI). Data: 11/11/2026.
Escopo: `docs/PROMPT_CLAUDE_ESCOPO.md` e `docs/DIVISAO_RESPONSABILIDADES.md`.
Base lida: `codex/browser-capture-clis` `36e5402`, que já contém meu trabalho até
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
| Código de saída do processo em turnos de erro | — | **Não comprovado.** Os dublês supõem 1 |

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
4. **O código de saída e o subtipo** reais dos turnos de erro (seção 1.1).

Hipóteses compatíveis com o código anterior. Nenhuma está confirmada.

| Hipótese | Indício que a distinguiria |
| --- | --- |
| H1. Resposta de revisão passou de 128 tokens e a CLI converteu em erro | Categoria `output_limit_reached` (assinatura). **Hoje o log `claude_cli_failure` não mostra isso**, ver P-1 |
| H2. Teto menor que o orçamento de raciocínio, com recusa da API | Marcador `thinking_output_budget` (Codex), `api_status: 400` |
| H3. Login ou cota informados em `errors[]`, antes ignorados | `authentication` / `quota` (já classificados) |
| H4. Problema de invocação no Windows depois da troca para o executável nativo (`bin/claude.exe` no pacote 2.1.322) | Marcador `argument_error`, `exit_code` sem JSON (`stdout_shape: invalid_json`) |

## 3. Problemas concretos encontrados (sem patch)

### P-1 (alta) O diagnóstico pedido ao usuário não mostra a hipótese principal

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

**Gemini**

| Id | Pendência | Dependência |
| --- | --- | --- |
| G-2 | Manter a tradução neutra de `provider_error` já feita pelo Codex em `frontend/src/logic.mjs` ao construir o chat | Nenhuma |
| G-1 | Seletor rápido/normal/profundo | Decisão do Codex sobre C-3/C-4 |
| — | Mensagens específicas para teto de saída, créditos e modelo indisponível | Só depois que C-2/C-7 existirem no backend |

**Claude Code:** nenhuma implementação em aberto. Uma nova tarefa só começa por
transferência registrada em `docs/DIVISAO_RESPONSABILIDADES.md` ou por pedido
explícito do usuário.
