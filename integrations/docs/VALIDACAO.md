# Registro de validação do gateway

Cada linha diz **o que** foi validado, **onde** e **com quê**. Testes com fixture
usam o dublê `tests/integrations/fixtures/fake_claude.py`, nunca uma conta.

## Rodada atual: fila durável integrada no `main` (10/11/2026)

Prompt: `docs/PROMPT_CLAUDE_EXECUCAO.md`. Base `main` `1c72ffa` (merges #4 → #5 → #1 e
#6 do Codex: C-1 códigos do gateway, C-2 fila/worker). Esta branch recomeçou do `main`.

### Linux (contêiner do Claude), dublê do CLI, sem conta real

| Comando | Resultado |
| --- | --- |
| `python -m unittest discover -s tests -v` | ✅ 60 OK; também com `-X dev -W error::ResourceWarning` (nenhuma conexão SQLite ou arquivo esquecido aberto) |
| `python -m unittest discover -s tests/integrations -v` | ✅ 56 executados: 55 OK + 1 pulado (o real) |
| `python scripts/verify_gateway_v11.py --gateway-checkout .` | ✅ `no_stop_reason` → incompleta; `success` → concluída com revisão (2 chamadas); `auth_error` → `provider_not_authenticated` final; `usage_limit` → `provider_quota_exceeded` final; `sleep` → `provider_timeout` incerta; sempre 1 chamada por etapa, sem repetição |
| `npm --prefix frontend test` / `npm --prefix desktop test` / build | ✅ 11 / 3 / ✅ |
| `npm --prefix desktop run test:ui` (Electron, Xvfb, sem sandbox do SO) | ✅ |
| `node tests/integrations/desktop_gateway_smoke.cjs` | ✅ |
| **Novo:** `tests/integrations/test_durable_gateway.py` (fila do backend + este gateway por HTTP real) | ✅ `gateway_busy` real → `waiting` → repetição com o **mesmo** `request_id` e o **mesmo corpo** (reenviar o corpo gravado devolve a resposta guardada sem nova geração); timeout → `uncertain`, `resume`/`enqueue` → 409, 1 chamada |

Mudança no gateway: uma falha inesperada depois de iniciar o CLI agora responde
409 `request_outcome_uncertain` já na primeira resposta (antes, 502
`gateway_internal_error`, que a fila tratava como erro final). O gateway já
gravava esse caso como incerto; agora a primeira resposta e as repetições dizem
o mesmo. Ambos os códigos estão na lista do backend; nenhum schema mudou.

Não coberto no Linux: a trava do worker no Windows (`msvcrt.locking`), que só
roda lá; `test_worker_lock_excludes_second_consumer` a exercita no Windows.

### No Windows do usuário

⏳ Pendente. Na pasta `W:\Projeto\Ia-bbaru-inicio`, com o app fechado:

```powershell
git status
git fetch origin
git merge --no-edit origin/main
git log --oneline -1
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
.\.venv\Scripts\python.exe -m unittest discover -s tests/integrations -v
.\.venv\Scripts\python.exe scripts/verify_gateway_v11.py --gateway-checkout .
$env:IA_BBARU_PYTHON = (Resolve-Path .venv\Scripts\python.exe).Path
npm.cmd --prefix frontend ci
npm.cmd --prefix desktop ci
npm.cmd --prefix desktop run build
npm.cmd --prefix desktop run test:ui
node tests/integrations/desktop_gateway_smoke.cjs
```

Esperado: 60 OK; 56 com 1 pulado; as 5 linhas do script; `Chromium UI passed`;
`Gateway + Chromium verificados`. Nenhum comando usa a conta.

## Rodada anterior: primeiro início com as três frentes (9/11/2026)

Codex `33fc1ea` + Gemini `00e2c8f` + este gateway, juntos numa worktree local.
Resultado completo e achados: [REVISAO_PRIMEIRO_INICIO.md](REVISAO_PRIMEIRO_INICIO.md).

| Verificação (Linux, sem conta real) | Resultado |
| --- | --- |
| Merges Gemini e gateway sobre o Codex | ✅ sem conflito |
| Python 48 / gateway 52 + 1 pulado / frontend 10 / desktop 3 / build | ✅ |
| `verify_gateway_v11.py`, `test:ui` e `desktop_gateway_smoke.cjs` | ✅ |
| 900×640 sem rolagem horizontal; painel sem violações do axe | ✅ |
| Barra do navegador no axe | ⚠️ 3 itens menores (ver revisão) |
| `integrations/scripts/iniciar-ia-bbaru.ps1` | ⚠️ **não executado** (sem PowerShell no contêiner) |

Reverificação com a correção do Gemini `ff5f7d7` (Linux, mesma combinação): Python 48,
gateway 52 + 1 pulado, frontend 11, desktop 3, build, `test:ui` e
`desktop_gateway_smoke.cjs` ✅. Motivo `not_logged_in` agora traduzido no painel.
axe em 900×640: painel sem violações; barra só com `#tabs` (pré-existente, C-4 em
[PASSAGEM_CODEX.md](PASSAGEM_CODEX.md)).

### Primeiro início no Windows do usuário (9/11/2026) ✅

Pasta `inicio/local` (Codex `33fc1ea` + Gemini `00e2c8f` + gateway), aberta com
`integrations/scripts/iniciar-ia-bbaru.ps1`. Conta real do usuário, **sem geração**.

| Etapa | Resultado |
| --- | --- |
| Primeira execução: `.venv`, `npm ci`, build e download do Electron | ✅ |
| Gateway em `127.0.0.1:8010` (`/health` 200) | ✅ |
| Navegador: abas, navegação real (site externo), captura com prévia | ✅ |
| Catálogo real: **Claude Code (sonnet) - assinatura** disponível no painel | ✅ |
| Plano criado pelo painel: contrato 1.1, "Limite indicativo aceito para esta tarefa", capacidades copiadas (assinatura, limite indicativo de 128 tokens, cancelamento apenas local) | ✅ |
| "Plano salvo. Esta versão ainda não inicia execuções pelo painel." | ✅ nenhuma geração pelo painel |

Achado no Windows, corrigido em `e6819d3`: a janela do gateway entrou no modo
"Selecionar" do console (que pausa o processo ao escrever no log) e mostrava
códigos de cor crus. O inicializador passou a rodar o gateway sem janela, com log
em arquivo. A captura de tela do plano não mostra se essa versão já estava em uso.


## Rodada: navegador Chromium (9/11/2026)

Prompt: `docs/PROMPT_CLAUDE_CHROMIUM.md` (branch `codex/chromium-browser`).

| Checkout | SHA |
| --- | --- |
| Navegador e backend (`codex/chromium-browser`) | `e1ff8b9` |
| Gateway antes desta rodada | `dfbc570` |
| Gateway desta rodada | commit que acrescenta esta seção |

### Linux (contêiner do Claude), sem conta real

| Verificação | Resultado |
| --- | --- |
| Backend `e1ff8b9`: `unittest discover -s tests` | ✅ 48 OK |
| `tests/integrations` com o backend `e1ff8b9` (worktree de integração) | ✅ 53 executados: 52 OK + 1 pulado (o real) |
| `scripts/verify_gateway_v11.py` (backend `e1ff8b9` → HTTP → gateway → dublê) | ✅ |
| Schemas 1.1: `docs/openapi-gateway-1.1.json` (backend) × `integrations/docs/openapi-gateway-1.1.json` | ✅ `components` e `paths` iguais |
| `npm --prefix frontend test` / `npm --prefix desktop test` | ✅ 6 OK / 3 OK |
| `npm --prefix desktop run test:ui` (Electron 45 real, **catálogo sintético** do Codex) | ✅ |
| `tests/integrations/desktop_gateway_smoke.cjs` (Electron real + **este gateway** por HTTP, dublê do CLI) | ✅ catálogo 1.1 no painel; aceite obrigatório; plano com aceite, capacidades e teto 128; `tasks.execute` recusado; zero gerações; sem login → indisponível com `not_logged_in` |

Os testes gráficos rodaram em Xvfb com `IA_BBARU_TEST_NO_SANDBOX=1` (o contêiner
não tem o helper da sandbox do Chromium). Não validam a sandbox do sistema
operacional nem o Windows.

Achado para o Gemini: sem login, o painel mostra "Indisponível" sem o motivo
(`unavailable_reason`), que chega no catálogo.

Ajuste no gateway: o estado do Claude Code é reavaliado a cada 5 s enquanto
indisponível (antes, 30 s), para um login feito no terminal aparecer logo.

### No Windows do usuário

⏳ Pendente; substituído pelo primeiro início (acima). Testes por partes continuam em [TESTE_PRATICO_1_1.md](TESTE_PRATICO_1_1.md).
A rodada anterior (base Firefox, abaixo) também não chegou a ser executada no
Windows; foi substituída por esta.

## Rodada mais antiga: revisão integrada do Codex (9/11/2026)

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

⏳ **Pendente.** Não executado; substituído pela rodada do navegador Chromium.

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
