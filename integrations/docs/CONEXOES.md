# Conexões: diagnóstico, escolha e capacidades reais

Consultado em 7 de novembro de 2026. Revalidar antes de cada mudança: CLIs,
planos e termos mudam.

## 1. Diagnóstico local de disponibilidade

`python -m integrations diagnose` gera um relatório JSON. Ele:

- procura `claude`, `codex` e `gemini` no PATH e lê `--version`;
- para o Claude Code, lê `--help` (confere as opções que o adaptador usa) e
  `claude auth status --json`, comando oficial que informa `loggedIn` e
  `authMethod` (`claude.ai`, `oauth_token`, `api_key`, `api_key_helper`,
  `third_party` ou `none`);
- informa apenas **se** existem variáveis de chave de API, nunca seus valores;
- **não** abre arquivos de credencial ou token de nenhum aplicativo e **não**
  chama modelos.

Para Codex e Gemini CLI não há verificação de login: não encontrei comando de
status documentado que eu tenha conseguido conferir nesta sessão, e ler os arquivos
de credencial é proibido pelo briefing. Eles aparecem como `adapter_not_implemented`.

### O que foi executado nesta sessão

O diagnóstico rodou **no contêiner de nuvem da sessão do Claude**, não no computador
do usuário. Resultado: Claude Code 2.1.319 instalado, opções necessárias presentes,
`authMethod: oauth_token` (credencial da própria sessão de nuvem, **não** a conta do
usuário); Codex e Gemini CLI ausentes.

### No PC Windows do usuário (7/11/2026)

Executado pelo usuário com `python -m integrations diagnose`, sem chamada de modelo:
Claude Code **2.1.307** instalado, `missing_flags: []` (todas as opções usadas pelo
adaptador existem nessa versão), `loggedIn: true`, `authMethod: claude.ai`
(assinatura), nenhuma variável de chave de API presente; Codex e Gemini CLI
ausentes. Estado: `output_limit_not_enforced`, ou seja, pronto exceto pela decisão
consciente sobre o teto de saída. Isso valida no Windows a localização do CLI,
`--version`, `--help` e `auth status --json`. Depois, com autorização do usuário, uma geração real
pequena passou (ver tabela abaixo).

## 2. Conexão preferencial: Claude Code oficial

| Critério | Claude Code (escolhido) | Sign in with ChatGPT | Gemini CLI |
| --- | --- | --- | --- |
| Usa a assinatura | Sim, com `/login` do próprio usuário | Depende de elegibilidade da integração | Login Google pode reconhecer AI Pro/Ultra |
| Execução local sem intermediar credenciais | Sim, o binário oficial roda com o próprio login | Fluxo OAuth próprio do app integrador | Sim, CLI oficial |
| Saída estruturada documentada | `--output-format json` | Streaming | Modo headless (não reconferido) |
| Teto de saída | Variável "para a maioria das requisições" (best effort) | Não aceita `max_output_tokens` | Não verificado |
| Verificação de login sem ler tokens | `claude auth status --json` | — | Não encontrado |
| Documentação reconferida nesta sessão | Sim (headless, CLI, autenticação, legal, env vars) | **Não**: o host estava bloqueado pela rede | **Não**: o host estava bloqueado pela rede |

Escolhido por ser o único caminho que dava para conferir de ponta a ponta nesta
sessão (documentação oficial e opções da CLI instalada) e por ter um comando
oficial de status de login. ChatGPT e Gemini continuam como próximos adaptadores;
as afirmações sobre eles vêm de `docs/ASSINATURAS.md` e não foram revalidadas aqui.

### Capacidades reais da conexão Claude Code

| Capacidade | Valor | Observação |
| --- | --- | --- |
| Inferência (`answer`) | Sim | Uma execução `-p` por etapa. |
| Revisão (`review`) | Sim | Mesmo transporte, com `previous_output` como dado. |
| Teto de saída | **Best effort** | `CLAUDE_CODE_MAX_OUTPUT_TOKENS`; o gateway confere `usage` depois. |
| Cancelamento | **Somente local** | Matar o processo não devolve cota nem garante interrupção no servidor. |
| `finish_reason` | **Informado pelo CLI, quando existe** | `stop_reason` do resultado: `end_turn`/`stop_sequence` → `stop`, `max_tokens` → `length`, ausente/`null`/outro → `unknown` (1.1) ou erro 502 `completion_unconfirmed` (1). |
| Uso de tokens | Quando o CLI informa | Soma `input_tokens` com os tokens de cache. O custo em USD do CLI é descartado. |
| `provider_request_id` | `null` | O CLI devolve `session_id`, que não é id de requisição do provedor. |
| Streaming | Não usado | O contrato v1 é síncrono. |
| Ferramentas, MCP, web | Desativados | `--tools ""`, `--strict-mcp-config`, `--safe-mode`. |
| Importar projetos/conversas do Claude.ai | **Não** | O login de inferência não dá acesso ao histórico do app. |
| Cobrança | Cota do plano | Sem cair para a API: variáveis de chave são removidas do processo. |
| Concorrência | 1 geração por vez | Outra chamada simultânea recebe 429 `gateway_busy`. |

### Campos do JSON do CLI usados

Documentados: `result`, `session_id`, `usage`, `total_cost_usd` (descartado).
Usados se existirem, mas **não documentados** publicamente: `is_error`, `modelUsage` e
`stop_reason`. Os três aparecem no schema de resultado embutido no binário 2.1.319
(`stop_reason` anulável). Se faltarem, o gateway responde erro ou `unknown` em vez de
inventar resultado.

## 3. Mocks e conta real

| O quê | Como foi validado |
| --- | --- |
| Contrato v1 (schemas iguais ao `docs/openapi-gateway.json`) | Teste automatizado |
| Cliente `HttpGateway` do backend contra este serviço via HTTP real | Teste automatizado com dublê |
| Montagem da linha de comando, ambiente do processo, entrada JSON | Teste automatizado com dublê (`fake_claude.py`) |
| Deduplicação, 409, timeout, reinício, concorrência | Teste automatizado com dublê |
| Derrubar processo no timeout | Teste com processo real (o dublê), só em Linux |
| `claude --version`, `--help`, `auth status --json` | Executados na CLI real 2.1.319, **no contêiner de nuvem** |
| Geração real com a conta do usuário | **Feita uma vez** (7/11/2026), autorizada pelo usuário, no Windows dele: Claude Code 2.1.307, login `claude.ai`, modelo `sonnet`, `max_output_tokens` 64. Resposta correta (`laranja`, lida de uma fonte com acento), `usage` 933 tokens de entrada (incluindo cache) e 5 de saída, `finish_reason: stop`, cerca de 6 s. Uma chamada não prova que o teto de saída é respeitado. **Atenção:** nessa versão o `stop` podia ser inferido pela contagem de tokens; não prova que o CLI informou `stop_reason`. |
| Fluxo completo backend → gateway → Claude Code, conta real | **Feito uma vez** (7/11/2026), autorizado pelo usuário, no Windows dele (branch local com `codex/frontend-firefox` + esta): projeto e fonte criados, plano com `claude-code:sonnet` e teto 1024, `execute` → `completed`, resposta em 3 frases citando a fonte pelo id, `usage` 990/117, `finish_reason: stop`, acentos preservados de ponta a ponta. Segundo `execute` → 409 `task_already_executed_or_running`, sem nova chamada. Modo `review` (dois modelos) ainda não testado com conta real. Mesma ressalva sobre `stop`: feito antes da correção do item 2 da revisão. |
| Geração real pelo contrato 1.1, depois da revisão | **Feita uma vez** (7/11/2026), autorizada pelo usuário, no Windows dele: Claude Code 2.1.307, `sonnet`, teto 64, aceite por tarefa. `laranja`, `usage` 913/5, `finish_reason: stop`, ~5 s. Sem inferência por tokens: o CLI informou `stop_reason` de término normal. |
| Windows (`claude.exe`, `taskkill`) | No PC do usuário (Python 3.12): diagnóstico validado e os 34 testes de integração passando (timeout com `taskkill`, deduplicação, ponta a ponta com o backend), também combinados com `codex/frontend-firefox` (25 testes OK). A primeira rodada revelou que o dublê lia a entrada em cp1252; corrigido. |

## Fontes oficiais consultadas

- https://code.claude.com/docs/en/headless
- https://code.claude.com/docs/en/cli-reference
- https://code.claude.com/docs/en/authentication
- https://code.claude.com/docs/en/env-vars
- https://code.claude.com/docs/en/legal-and-compliance
- Ajuda local `claude --help` e `claude auth status --help` (versão 2.1.319)

Bloqueadas pela rede da sessão (não lidas): geminicli.com e developers.openai.com.
