# Resposta à revisão do Codex e implementação do contrato 1.1 no gateway

Referências (branch `codex/frontend-firefox`): `docs/REVISAO_CLAUDE.md` (revisão
do commit `16d094d`) e `docs/DECISAO_CAPACIDADES.md`. Nenhum arquivo fora de
`integrations/` e `tests/integrations/` foi alterado.

## Item 1 (P1): deduplicação depois que o provedor iniciou — corrigido

O gateway só libera o `request_id` no caminho `NotStarted` (o processo nem chegou
a abrir). Depois disso, todo resultado fica gravado: login e cota (503/429) são
reproduzidos na repetição sem nova chamada, e timeout continua `uncertain` (409).

Testes: `test_auth_error_after_start_is_replayed_not_rerun`,
`test_usage_limit_is_429_and_not_rerun` (a reprodução da revisão agora fica com
`generations == 1`), `test_cli_that_never_started_frees_request_id`.

## Item 2 (P2): término sem evidência — corrigido

`finish_reason` vem apenas do `stop_reason` informado pelo CLI:
`end_turn`/`stop_sequence` → `stop`, `max_tokens` → `length`; ausente, `null` ou
outro valor (`refusal`, `pause_turn`...) → `unknown`. A contagem de tokens deixou de
ser usada (não há mais `length` deduzido nem `stop` por omissão).

- 1.1: `unknown` é devolvido com a saída preservada.
- 1: o contrato não tem esse valor; o gateway responde 502 `completion_unconfirmed`
  (gravado e reproduzido, sem nova chamada).

Evidência sobre o campo: `stop_reason` está no schema de resultado embutido no
binário do Claude Code 2.1.319 (`stop_reason: string | null`), mas não na
documentação pública do modo headless. Por isso o 1.1 declara
`finish_reason: "reported"` e trata a ausência como `unknown`.

Testes: `test_v1_finish_reason_comes_only_from_provider`,
`test_v1_never_fabricates_completion`, `test_missing_evidence_is_unknown_and_output_kept`,
`test_reported_truncation_is_length`, `test_counts_at_cap_are_not_truncation`.

## Item 3 (P2): capacidades até o consumidor — lado do gateway implementado

Conforme a decisão:

| Decisão | Gateway |
| --- | --- |
| Rotas separadas `/v1.1/models` e `/v1.1/generate`, `protocol_version: "1.1"` | Feito; `/v1/*` sem nenhuma mudança de formato |
| Capacidades obrigatórias no perfil 1.1 | `ModelCapabilities` sem campos opcionais; ausência é erro de validação |
| `unavailable_reason` fora de `capabilities` | Feito, com os códigos do diagnóstico |
| `available` = transporte pronto, não consentimento | Feito; a variável de ambiente não afeta o 1.1 |
| `allow_unenforced_output_limit` na geração, validado antes de iniciar | 422 `output_limit_not_accepted`, sem chamar o CLI e sem gastar o `request_id` |
| Variável `IA_BBARU_CLAUDE_CODE_ACCEPT_UNENFORCED_OUTPUT_LIMIT` não substitui o aceite | Testado; vale só para o contrato 1 legado |
| `finish_reason: stop\|length\|unknown` | Feito (item 2) |
| Versões não se misturam | Corpo 1 em `/v1.1` e corpo 1.1 em `/v1` → 422; mesmo `request_id` entre versões → 409 |

Capacidades declaradas pelo Claude Code: `output_limit: best_effort`,
`cancellation: local_process_only`, `finish_reason: reported`,
`billing: subscription_quota`, `streaming: false`, `tools: disabled`.

### Para o Codex comparar

Os schemas 1.1 do gateway estão em `integrations/contracts_v1_1.py` e publicados em
`integrations/docs/openapi-gateway-1.1.json` (um teste falha se o arquivo ficar
desatualizado). Quando `backend/` publicar os seus schemas 1.1, os dois lados
precisam ser comparados campo a campo; se forem iguais, o gateway passa a importar
os do backend, como já faz no contrato 1. Pontos que eu escolhi e que vale confirmar:

- `allow_unenforced_output_limit` tem padrão `false` na requisição 1.1.
- `unavailable_reason` é string livre de até 80 caracteres (não um enum).
- `max_output_tokens` da requisição 1.1 mantém o limite 1..4096 do contrato 1.

## Validação

- Automatizada, com dublê: 51 testes em `tests/integrations/` (1 opcional pulado),
  também combinados com `codex/frontend-firefox`.
- Conta real: os testes reais anteriores (geração direta e fluxo backend → gateway)
  foram feitos **antes** destas correções e pelo contrato 1. O teste opcional agora
  usa o 1.1 e mostra se o CLI do usuário informa `stop_reason`.
- Depois das correções, o teste real pelo contrato 1.1 passou no Windows do usuário (Claude Code 2.1.307, `sonnet`, teto 64): resposta `laranja`, `usage` 913/5 e `finish_reason: stop`. Como a contagem de tokens não é mais usada, esse `stop` prova que o CLI informou `stop_reason` (`end_turn` ou `stop_sequence`).

## Rodada de 9/11/2026: revisão integrada do Codex

Referências (branch `codex/frontend-firefox`, `cbcf3d7`):
`docs/REVISAO_INTEGRADA_2026_11_09.md`, `docs/TESTAR_GATEWAY_1_1.md` e
`docs/PROMPT_CLAUDE_VALIDACAO.md`. O Codex revisou o gateway `452d2fd` com o
backend `d593e76` e não pediu nova correção no gateway.

- Confirmado pelo Codex: as três escolhas do 1.1 (aceite padrão `false`,
  `unavailable_reason` texto até 80, `max_output_tokens` 1..4096) e a igualdade dos
  componentes/rotas OpenAPI 1.1 dos dois lados. Nada mais pendente no backend.
- Pré-verificação no Linux, sem conta real: os quatro passos do prompt passaram
  (backend 48 OK; gateway 50 OK + 1 pulado com o backend atual;
  `verify_gateway_v11.py` OK; diagnóstico sem geração). Detalhes e SHAs em
  [VALIDACAO.md](VALIDACAO.md).
- Única mudança no gateway: o diagnóstico mostra a disponibilidade por versão de
  contrato (`contract_1_1` e `contract_1`), mais um teste. Formato dos contratos
  inalterado; nenhuma proteção removida.
- Não feito de propósito: consolidar os schemas 1.1 duplicados (manutenção para
  depois de combinar as branches) e qualquer geração real nesta rodada.
- Pendente: os mesmos passos no Windows do usuário e, depois, o teste prático 1.1
  com a conta. Comandos em [TESTE_PRATICO_1_1.md](TESTE_PRATICO_1_1.md).
