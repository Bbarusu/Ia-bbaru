# Registro de validação do gateway

Cada linha diz **o que** foi validado, **onde** e **com quê**. Testes com fixture
usam o dublê `tests/integrations/fixtures/fake_claude.py`, nunca uma conta.

## Rodada atual: revisão integrada do Codex (9/11/2026)

Prompt: `docs/PROMPT_CLAUDE_VALIDACAO.md` (branch `codex/frontend-firefox`).
Revisão do Codex: `docs/REVISAO_INTEGRADA_2026_11_09.md`, que não exige nova
correção no gateway.

| Checkout | SHA |
| --- | --- |
| Backend (`codex/frontend-firefox`) | `cbcf3d7126975bda6aa7eec9b41d14b83049563b` (backend igual ao `d593e76` revisado) |
| Gateway revisado pelo Codex (`claude/vibrant-meitner-ksbzgf`) | `452d2fd50437b382a3d7a91f01f0733a7dbe4ae5` |
| Gateway desta rodada | commit que acrescenta este arquivo (só diagnóstico, teste e documentação) |

### Pré-verificação no Linux (contêiner do Claude), sem conta real

| Passo do prompt | Resultado |
| --- | --- |
| 1. Backend `cbcf3d7`: `python -m unittest discover -s tests` | ✅ 48 testes OK |
| 2. `tests/integrations` numa worktree de integração (backend `cbcf3d7` + gateway `452d2fd`), `IA_BBARU_REAL_TEST` desligado | ✅ 51 executados, 50 OK + 1 pulado (o real). Com o diagnóstico desta rodada: 52, 51 OK + 1 pulado |
| 3. `scripts/verify_gateway_v11.py --gateway-checkout <gateway 452d2fd>` no checkout separado do backend | ✅ aceite exigido; `unknown` → `incomplete/completion_unconfirmed` com 1 chamada; término confirmado → revisão, 2 chamadas; sem repetição |
| 4. `python -m integrations diagnose` | ✅ sem geração. No contêiner: CLI 2.1.319, `oauth_token` (credencial da sessão de nuvem, não a conta do usuário) |

Ajuste feito nesta rodada (só `integrations/`): o diagnóstico passou a separar
`contract_1_1` (transporte pronto; a tarefa ainda precisa aceitar o limite
indicativo) de `contract_1` (bloqueado por padrão, `output_limit_not_enforced`).
Antes, `ready: true` sozinho podia ser lido como liberado no contrato 1.

### No Windows do usuário

⏳ **Pendente.** Comandos em [TESTE_PRATICO_1_1.md](TESTE_PRATICO_1_1.md), parte 1.
Registrar aqui os SHAs e as saídas quando o usuário executar.

## Resultados reais anteriores (contrato 1 e gateway direto)

Todos autorizados pelo usuário, no PC Windows dele, Claude Code 2.1.307, login
`claude.ai`. Não substituem o teste com o backend 1.1.

| Data | Versão do gateway | O quê | Resultado |
| --- | --- | --- | --- |
| 7/11 | antes da revisão | Gateway direto, contrato 1, teto 64 | `laranja`, `usage` 933/5, `stop` (podia ser inferido) |
| 7/11 | antes da revisão | Backend (contrato 1) → gateway → CLI, `single` | `completed`, `usage` 990/117, `stop` (podia ser inferido); 2º `execute` → 409 |
| 7/11 | `b4b2dcc` | Gateway direto, contrato 1.1, aceite por tarefa, teto 64 | `laranja`, `usage` 913/5, `stop` informado pelo CLI (`stop_reason`) |

Ainda sem conta real: backend 1.1 → gateway, modo `review`, erros reais de cota,
login expirado e timeout.
