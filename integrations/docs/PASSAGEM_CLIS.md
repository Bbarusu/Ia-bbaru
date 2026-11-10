# CLIs do ChatGPT e do Gemini no gateway — passagem para Codex e Gemini

Escrito pelo Claude em 10/11/2026, a pedido do usuário: "inserir as CLIs do ChatGPT
e do Gemini e deixar tudo registrado para orientar o Codex e o Gemini". Só
`integrations/` e `tests/integrations/` foram alterados. Base: `main` `1c72ffa`.

> Nome: a CLI oficial da OpenAI que usa o plano do ChatGPT se chama **Codex CLI**
> (`@openai/codex`, comando `codex`). Neste documento ela aparece como "ChatGPT
> (Codex CLI)" para não confundir com o Codex da equipe.

## 1. O que entrou

| | ChatGPT (Codex CLI) | Gemini CLI |
| --- | --- | --- |
| Pacote oficial conferido | `@openai/codex` 0.167.0 | `@google/gemini-cli` 0.67.0 |
| `provider` / `model_id` | `chatgpt-codex` / `chatgpt-codex:<modelo>` | `gemini-cli` / `gemini-cli:<modelo>` |
| Rótulo no catálogo | `ChatGPT (<modelo>, Codex CLI) - assinatura` | `Gemini (<modelo>) - conta Google` |
| Contrato | **Só 1.1** (`/v1.1/*`). Não aparece em `/v1/models`; `/v1/generate` responde `unknown_model` | igual |
| Login exigido | Sign in with ChatGPT (`codex login status` = "Logged in using ChatGPT") | Login with Google **forçado e verificado pela própria CLI** (correção de 10/11, seção 1.1); `IA_BBARU_GEMINI_CLI_LOGIN=google` só autoriza a verificação |
| `output_limit` | `none` | `none` |
| `cancellation` | `local_process_only` | `local_process_only` |
| `finish_reason` | `inferred` → todo resultado sai `unknown` | `inferred` → todo resultado sai `unknown` |
| `billing` | `subscription_quota` | `subscription_quota` |
| `streaming` | `false` | `false` |
| `tools` | **`restricted`** (ver K-1) | **`disabled`** |

Configuração por variáveis (mesmo padrão do Claude Code):
`IA_BBARU_CHATGPT_CODEX_{BIN,MODELS,TASK_KINDS,CONTEXT_CHARS,MAX_OUTPUT_TOKENS,TIMEOUT_S}`
e `IA_BBARU_GEMINI_CLI_{...}` + `IA_BBARU_GEMINI_CLI_LOGIN=google`. Sem `*_MODELS`, o
provedor não aparece e nada é executado. O inicializador ganhou
`-ChatGptModel <modelo>`, `-GeminiModel <modelo>` e `-GeminiLoginGoogle`.

### Como cada CLI é chamada (sem ferramentas, sem cobrança de API)

**ChatGPT (Codex CLI)** — `codex exec --json --ephemeral --ignore-user-config --ignore-rules
--skip-git-repo-check --sandbox read-only --color never --model <m> --output-last-message <arq>
--disable <23 recursos> -c web_search=disabled -c forced_login_method=chatgpt -`
- Pasta temporária vazia; documento JSON pela entrada padrão; nenhuma sessão gravada;
  `config.toml`, regras e servidores MCP do usuário ignorados.
- Desliga: `shell_tool`, `view_image`, `apps`, `plugins`, `browser_use*`, `computer_use`,
  `image_generation`, `multi_agent`, `hooks`, `unbounded_connection_retries` e outros.
  O diagnóstico confere isso com o próprio `codex features list` (sem chamar modelo).
- **`unified_exec` (executar comandos) continua ligado com qualquer opção** — testado
  no binário oficial. Por isso `tools: restricted`.
- Se aparecer qualquer ação de ferramenta no JSONL, a resposta é recusada (502).

**Gemini CLI** — `gemini --skip-trust --prompt <pedido fixo> --output-format json --model <m>
--extensions none --allowed-mcp-server-names <nome inexistente> --admin-policy <pasta>
--policy <pasta> --approval-mode default`, com `GEMINI_SYSTEM_MD` (nosso prompt de
sistema), `GEMINI_CLI_AUTH_OVERRIDE=oauth-personal` e `GOOGLE_GENAI_USE_GCA=true`.
- Política com `toolName = "*"` e `decision = "deny"` bloqueia toda ferramenta, MCP
  incluído. Se mesmo assim uma ferramenta rodar (`stats.tools.totalSuccess > 0`), a
  resposta é recusada (502).
- `@caminho` na entrada viraria conteúdo de arquivo local: o documento vai com `@`
  escrito como `\u0040` (JSON válido, nenhum `@` literal). Vale também para o ChatGPT.
- Qualquer token de saída de outro modelo, mesmo misturado ao modelo pedido (fallback,
  modelos auxiliares), dá `provider_model_mismatch` (502, final, sem repetição). Sem
  estatísticas de modelo na saída, `provider_invalid_output`. Configure o nome exato do
  modelo (o de `gemini models list`), não apelidos.
- `--skip-trust` é obrigatório no modo não interativo (sem ele, código 55); confia só
  na pasta temporária vazia, nesta execução.

Variáveis de chave de API (`OPENAI_API_KEY`, `CODEX_API_KEY`, `CODEX_ACCESS_TOKEN`,
`OPENAI_BASE_URL`, `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `GOOGLE_GENAI_USE_VERTEXAI`,
`GOOGLE_GEMINI_BASE_URL`, `GOOGLE_APPLICATION_CREDENTIALS`) são removidas do processo.

### 1.1 Correção de 10/11: login Google forçado e verificado (revisão do Codex, P1)

Antes, o catálogo anunciava o Gemini como pronto só pela declaração do usuário, e uma
chave de API salva na própria CLI poderia ser usada. Agora:

1. **Forçar:** toda chamada define `GEMINI_CLI_AUTH_OVERRIDE=oauth-personal`, a variável
   que a própria CLI usa ao se relançar e que substitui o tipo de login salvo.
   Conferido na CLI oficial 0.67.0, sem conta: com "gemini-api-key" salvo, a CLI segue
   o caminho do Google e para em "Manual authorization is required".
2. **Auto-teste do mecanismo** (a variável é interna): numa pasta de usuário isolada e
   vazia, com Vertex AI salvo e entrada vazia, só uma CLI que aplica a variável chega
   ao caminho do Google. Se não aplicar: `cli_version_unsupported`, indisponível.
3. **Verificar o login pela CLI**, sem ler credenciais: execução com a variável e
   **entrada vazia**. Login válido → a CLI autentica e para em "No input provided"
   (código 42). Sem login → código 41. Entrada vazia não gera resposta; a sonda ainda
   pede um modelo que não existe.
4. `IA_BBARU_GEMINI_CLI_LOGIN=google` (`-GeminiLoginGoogle`) apenas **autoriza** essa
   verificação, que faz a CLI falar com o Google usando o login do usuário. Sem ela,
   nada é consultado e o estado é `auth_status_unknown`.
5. Variáveis removidas do processo: chaves de API, `GEMINI_DEFAULT_AUTH_TYPE`,
   `GEMINI_CLI_USE_COMPUTE_ADC`, `GEMINI_CLI_SYSTEM_SETTINGS_PATH` e
   `GEMINI_CLI_SYSTEM_DEFAULTS_PATH`.

| Situação | Catálogo | Geração |
| --- | --- | --- |
| Login Google válido | disponível | usa o login Google |
| Chave de API salva na CLI | disponível só se o login Google também for válido | login Google; a chave não é usada |
| Chaves de API no ambiente | removidas | login Google |
| Sem login Google | `not_logged_in` | recusada antes de iniciar |
| CLI que não aplica a variável | `cli_version_unsupported` | recusada |
| Configuração de sistema presente / sonda inconclusiva / sem autorização | `auth_status_unknown` | recusada |
| Login perdido depois do catálogo | — | `provider_not_authenticated`, sem cair em chave de API |

### Limites honestos

- **Gemini — o que resta fora da garantia:** uma configuração de sistema da Gemini CLI
  (administrador) tem precedência sobre tudo; se o arquivo existir, o provedor fica
  indisponível (`auth_status_unknown`). O login pode usar uma conta Google ligada a um
  projeto ou licença da organização: continua sendo login, nunca chave de API. Ganchos
  (`hooks`) do próprio usuário na Gemini CLI não podem ser desligados de fora.
- **Ambas — término nunca informado:** nenhuma das duas informa se a resposta acabou ou
  foi cortada. O gateway responde `unknown` e o backend marca
  `incomplete/completion_unconfirmed`, sem revisão. É o comportamento correto pelo
  contrato; ver K-2.

## 2. Evidências

| O quê | Como | Resultado |
| --- | --- | --- |
| Opções e formatos das duas CLIs | Leitura dos pacotes oficiais (npm) e `--help` | ✅ registrados acima |
| ChatGPT: diagnóstico no binário oficial, sem login | adaptador real, pasta isolada | ✅ 0.167.0, flags presentes, recursos desligados exceto `unified_exec`, `not_logged_in` |
| ChatGPT: linha de comando completa, sem login | binário oficial | ✅ argumentos aceitos; falha de rede em ~40 s com tentativas limitadas |
| Gemini: diagnóstico e geração sem login | CLI oficial via Node, pasta isolada | ✅ flags presentes; `provider_not_authenticated` (código 41) em ~2 s, sem rede |
| Testes com dublês (`fake_codex.py`, `fake_gemini.py`) | `tests/integrations/test_cli_adapters.py`, 15 testes | ✅ catálogo, contrato 1 fechado, login, trava de recursos, linha de comando, `@` escapado, pasta vazia, chaves removidas, sucesso, reconexão, ferramenta, login, cota, saída inválida, timeout, fallback de modelo, repetição |
| Backend do Codex + fila + gateway por HTTP | mesmo arquivo | ✅ ChatGPT recusado no plano (`model_tools_not_supported`); Gemini executado → `incomplete/completion_unconfirmed`, resposta guardada, 1 chamada |
| Suítes completas | `tests` 60 OK; `tests/integrations` 70 OK + 1 pulado | ✅ Linux |
| **Conta real** (ChatGPT ou Google) | — | ❌ **não feito**; nenhuma geração real |
| Windows do usuário: `diagnose` | `732b0ac`, sem geração | ✅ Codex CLI 0.167.0 com login ChatGPT e trava confirmada; Gemini CLI 0.67.0 executável (login ainda não declarado) |

## 3. Para o Codex (backend, fila, ponte)

**K-1 — decidir sobre `tools: restricted` (ChatGPT).** Hoje o backend só planeja
`tools: disabled` e recusa o ChatGPT com `model_tools_not_supported` — o
comportamento certo enquanto não houver decisão. Na sandbox somente leitura, a Codex
CLI ainda pode **ler arquivos** do computador com comandos; o estado da sandbox no
Windows não foi verificado. Opções:
1. manter recusado (recomendado até validar no Windows);
2. criar aceite explícito por tarefa para ferramentas restritas
   (por exemplo `allow_restricted_tools`), com a mesma lógica do aceite de limite:
   contrato 1.1 nos dois lados, persistência, revalidação e UI. Nesse caso, o gateway
   precisa receber o aceite e deixar de recusar respostas com ação de ferramenta
   somente leitura — mudança coordenada, não feita aqui.

**K-2 — término sempre `unknown` para ChatGPT e Gemini.** Toda tarefa com esses
agentes termina `incomplete/completion_unconfirmed` e nunca segue para revisão.
Não fabricar `stop`. Se o produto precisar encadear revisão, a saída honesta é uma
**confirmação humana** ("li a resposta; pode revisar"), registrada na tarefa, e não
uma inferência automática.

**K-3 — motivos de indisponibilidade.** `auth_status_unknown` no Gemini significa "login
não declarado". O worker já trata `provider_auth_status_unknown` como bloqueio anterior
à geração (retomável). Nada a mudar; só documentar.

**K-4 — códigos de erro.** Nenhum código novo. "Ferramenta usada" e "saída inválida"
saem como `provider_error` / `provider_invalid_output` (502, finais). Se quiserem um
código específico (`provider_tool_use_detected`), é mudança dos dois lados.

**K-5 — tempo do catálogo.** Com as três CLIs, a primeira consulta roda ~9 comandos de
verificação. O gateway agora os executa em paralelo por provedor; ainda assim, medir no
Windows contra os 20 s da ponte (C-6).

**K-6 — documentação geral.** Atualizar `docs/STATUS.md`/`docs/ARQUITETURA.md` com os
dois provedores e o estado "só 1.1".

## 4. Para o Gemini (interface)

- **UI-1 — capacidades:** textos para `output_limit: none` ("sem limite de saída"),
  `finish_reason: inferred` ("o provedor não informa se terminou; o resultado fica como
  não confirmado") e `tools: restricted` ("pode executar comandos somente leitura;
  bloqueado nesta versão").
- **UI-2 — indisponibilidade do Gemini:** para `auth_status_unknown`, orientar:
  "Faça Login with Google na Gemini CLI e abra o Ia-bbaru com `-GeminiLoginGoogle`".
  Para o ChatGPT, `not_logged_in` → "rode `codex` e escolha Sign in with ChatGPT";
  `not_subscription_login` → "o login ativo não é o do ChatGPT".
- **UI-3 — plano recusado:** mostrar `model_tools_not_supported` ao escolher o ChatGPT,
  sem esconder o cartão do agente (ele está disponível, mas não elegível).
- **UI-4 — resultado não confirmado:** com ChatGPT/Gemini, `completion_unconfirmed` será
  o normal. Mostrar a resposta com o aviso, sem parecer erro.
- **UI-5 — conexões:** listar os três provedores com estado, versão e o que fazer.
  Login em abas web (chatgpt.com, gemini.google.com) **não** conecta agentes.

## 5. Para o usuário (Windows)

Instalação das CLIs oficiais (uma vez; confira nas páginas oficiais):
`npm install -g @openai/codex` e `npm install -g @google/gemini-cli`.
Login: `codex` → Sign in with ChatGPT; `gemini` → Login with Google.
Não configure chave de API em nenhuma delas.

```powershell
cd W:\Projeto\Ia-bbaru-inicio
git fetch origin
git merge --no-edit origin/claude/vibrant-meitner-ksbzgf
.\.venv\Scripts\python.exe -m unittest discover -s tests/integrations -v
.\.venv\Scripts\python.exe -m integrations diagnose
powershell -ExecutionPolicy Bypass -File .\integrations\scripts\iniciar-ia-bbaru.ps1 -ChatGptModel NOME -GeminiModel NOME -GeminiLoginGoogle
```

Troque `NOME` pelo nome real, **sem `< >`** (no PowerShell, `<` é redirecionamento):
- ChatGPT: abra `codex`, digite `/model` e use o nome mostrado para o seu plano;
- Gemini: `gemini models list` (lista local, não gera nada).

Se o diagnóstico disser `cli_not_runnable`, o campo `detail` explica o motivo.
Nada disso gera resposta. Uma geração real com essas contas é etapa separada, com
sua autorização.

## 6. Prompts prontos

**Codex:**
> Leia `integrations/docs/PASSAGEM_CLIS.md` na branch `claude/vibrant-meitner-ksbzgf`.
> O gateway agora oferece ChatGPT (Codex CLI) e Gemini CLI, só no contrato 1.1, sem
> mudança de schema. Decida K-1 (`tools: restricted` do ChatGPT; hoje recusado com
> `model_tools_not_supported`) e K-2 (término sempre `unknown` → tarefas incompletas;
> não fabricar `stop`). Atualize `docs/STATUS.md` (K-6) e meça o tempo do primeiro
> catálogo no Windows (K-5). Não altere `integrations/`.

**Gemini:**
> Leia `integrations/docs/PASSAGEM_CLIS.md`, seção 4, na branch
> `claude/vibrant-meitner-ksbzgf`. O catálogo agora pode trazer `chatgpt-codex:*` e
> `gemini-cli:*` com `output_limit: none`, `finish_reason: inferred` e, no ChatGPT,
> `tools: restricted`. Implemente UI-1 a UI-5 com testes de comportamento. Não
> esconda o motivo de indisponibilidade nem trate `completion_unconfirmed` como erro.
