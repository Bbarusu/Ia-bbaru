# Integração somente Claude: respostas ao prompt e passagem ao Codex

Pedido: `docs/PROMPT_CODE_CLAUDE_ONLY.md` (base `codex/browser-capture-clis`,
`fa24ef3`, PR #7). Direção: `docs/DIRECAO_CLAUDE_ONLY.md`. Data: 11/11/2026.
A branch `claude/vibrant-meitner-ksbzgf` foi avançada (fast-forward) até `fa24ef3`
e depois recebeu `f7206ac` por merge (prompt atualizado e
`docs/AJUSTES_CHAT_LATERAL.md`). Não havia mudança local pendente. Só
`integrations/` e `tests/integrations/` mudaram. Nenhum adaptador antigo foi
reintroduzido.

## P0 — `provider_error` da captura “Revise” (sonnet, 1 material, limite 128)

**Causa da execução do usuário: ainda não comprovada.** Não há SHA, request ID nem
saída daquela execução. Ela rodou com o gateway de `fa24ef3`, anterior às mudanças
desta branch.

Onde o gateway produzia `provider_error` (código anterior): qualquer JSON válido
da CLI com `is_error`, código de saída ≠ 0 ou sem `result` em texto, quando o
texto não tinha palavras de login ou cota. Três lacunas, todas corrigidas [F]:

1. **Teto de saída atingido** [P]. Na 2.1.322, quando o modelo para por
   `max_tokens`, a CLI **troca o turno por um erro**: "API Error: Claude's response
   exceeded the N output token maximum. To configure this behavior, set the
   CLAUDE_CODE_MAX_OUTPUT_TOKENS environment variable." (`apiError:
   "max_output_tokens"`). A resposta parcial **não** vem no resultado. Com teto 128
   e um pedido “Revise”, essa é a **hipótese principal**, ainda não confirmada.
   Consequência: na 2.1.322, `finish_reason: "length"` não deve mais aparecer pela
   CLI. O caminho real é este erro.
2. **Subtipos `error_*`** (`error_during_execution`, `error_max_turns`, ...) não
   têm `result`; as mensagens ficam em `errors`. O gateway ignorava `errors`, então
   até um login expirado virava `provider_error`. Agora `result` e `errors` são lidos.
3. **Erros da API** ("API Error: 400/529 …"): sobrecarga agora é
   `provider_unavailable`. Pedido inválido continua `provider_error`, com a
   categoria guardada.

Nada é mascarado como sucesso: os códigos continuam os que o backend já aceita
(`backend/gateway_errors.py`). Um código desconhecido faria o backend registrar
`gateway_request_failed`, que é **incerto**, e isso seria pior. A categoria
específica fica numa **assinatura sanitizada**:

- gravada no banco local do gateway (`failure_signatures`, as últimas 200);
- uma linha no log: `request_id`, código, etapa, categoria.

Campos: etapa, modelo pedido, versão da CLI, código de saída, tamanhos de
stdout/stderr, subtipo, `is_error`, se havia texto, quantidade de `errors`,
`stop_reason`, `api_error`, `terminal_reason` (só identificadores conferidos),
número do status HTTP, modelos servidos e categoria. **Nunca** texto da CLI,
stderr, pedido, fontes ou credenciais. Os testes usam um texto-canário e provam
que ele não sai na resposta, no banco nem no log.

Consulta, somente leitura e segura com o gateway ligado:
```powershell
$env:IA_BBARU_GATEWAY_DB = "$env:LOCALAPPDATA\Ia-bbaru-gateway\gateway.sqlite3"
python -m integrations failures --limit 3
```

**Para confirmar (conduzido pelo usuário, uma geração por passo, sem repetir):**
1. Com esta branch, iniciar com `-Models "sonnet"` e criar uma tarefa sintética
   (fonte "A palavra é laranja.", pedido "Responda só com a palavra da fonte"),
   **limite 1024**. Esperado: sucesso, `served` sonnet.
2. Repetir o tipo de pedido da captura (“Revise”) com fonte sintética e **limite
   128**. Rodar `failures` e colar a saída. Se a categoria for
   `output_limit_reached`, a causa está confirmada. Se for outra, a assinatura
   mostra qual.

Recomendação para o Codex/Gemini (C-7, C-8): 128 é pouco para revisão ou chat. O
painel deve propor um limite padrão maior e, com C-7, explicar "a resposta passou
do limite de N tokens; aumente o limite", sem repetir sozinho.

## Chat lateral — o que o gateway oferece e o que depende do Codex

- O gateway **continua sem sessão própria**. Cada geração é um processo
  `claude -p` novo, com `--no-session-persistence`, em pasta temporária vazia. A
  continuidade vem só do que o backend envia. Não haverá `--resume`/`--continue`
  nem uma conversa paralela da CLI.
- Contrato 1.1 sem mudança: a requisição já tem `instruction`, `context[]`
  (id, título, conteúdo) e `previous_output`. O histórico do chat pode ir hoje como
  itens de `context` que o backend monta (por exemplo, título "Conversa — turno 3,
  usuário"). O prompt de sistema já trata fontes e resposta anterior como dados
  não confiáveis. Isso vale para texto de página e histórico.
- Limites: `context_char_limit` (padrão 80.000 caracteres) cobre instrução, fontes
  e histórico juntos. Acima disso o gateway responde `context_too_large` **antes**
  de iniciar a CLI, sem gastar o `request_id`. Cortar ou resumir histórico é
  decisão do backend, visível ao usuário. O gateway não corta em silêncio.
- `streaming: false` continua. Uma resposta parcial em tempo real exigiria
  `stream-json` e um contrato novo (proposta conjunta; ver a proposta visual).
- O `request_id` por turno já garante uma única geração: duplo clique ou perda de
  resposta HTTP repetem o resultado gravado, e timeout fica incerto para sempre.

## Níveis de evidência usados aqui

| Marca | Significa |
| --- | --- |
| **[F]** | Dublê de teste (`fake_claude.py`), sem CLI real nem conta |
| **[P]** | Pacote oficial `@anthropic-ai/claude-code` lido **sem gerar**: `--help` e textos do binário (`strings`). Versões 2.1.322 (atual no npm, igual byte a byte ao binário instalado neste contêiner) e 2.1.307 (a do Windows do usuário, só lida, nunca executada) |
| **[N]** | Execução **não intencional** no contêiner de nuvem do Claude, com a conta **do ambiente** (ver abaixo) |
| **[R]** | Conta real do usuário, **sem geração**: tela `/model` e `diagnose` no Windows (11/11/2026). Nenhuma geração real nesta rodada |

### Registro honesto: 4 gerações não intencionais [N]

Para ver como os aliases se resolvem, rodei a CLI 2.1.322 com `HOME` vazio e sem
variáveis de ambiente, esperando um erro de login. O ambiente de nuvem autentica
pelo proxy de rede e a CLI **gerou**: uma resposta curta ("diga oi") por alias,
4 no total, com custo informado pela CLI de cerca de US$ 0,06. Foi a conta do
ambiente de nuvem, não a assinatura do usuário. Não havia dado do usuário, imagem
ou ferramenta. Nada foi repetido depois disso. O que essas execuções mostraram vale
**só para aquela conta e versão** e aparece marcado com [N].

## 1. Aliases e verificação de acesso sem geração

- [P] 2.1.307 e 2.1.322 aceitam os aliases `sonnet`, `opus`, `haiku`, `fable`,
  `best`, `opusplan` e as variantes `sonnet[1m]`, `opus[1m]`, `fable[1m]`
  (não existe `haiku[1m]`).
- [P] O alias é resolvido **dentro da CLI**, a partir de um registro de modelos,
  do provedor/conta e de `ANTHROPIC_DEFAULT_<FAMÍLIA>_MODEL`. O padrão embutido para
  `fable` é **Fable 5.1 na 2.1.307** e **Fable 5.2 na 2.1.322**. A 2.1.307 nem
  contém o identificador `claude-fable-5-2`.
- [N] Na 2.1.322, com a conta do ambiente: `sonnet → claude-sonnet-5-5`,
  `haiku → claude-haiku-5-5`, `opus → claude-opus-5-5`, `fable → claude-fable-5-2`.
  Os padrões embutidos para sonnet e haiku seriam 4.6 e 4.5. O registro mudou isso,
  então a resolução depende de dados de fora do binário.
- [P] **Não existe comando que resolva um alias ou prove acesso a um modelo sem
  gerar.** `claude auth status --json` só prova o login global. A versão servida
  aparece depois de uma geração: `system/init.model` (saída `stream-json`) e as
  chaves de `result.modelUsage` (saída `json`, a que o gateway usa).

Implementado:

- `integrations/models.py`: só aceita nomes cujo modelo servido dá para conferir,
  ou seja, os 4 aliases (`[1m]` só em sonnet/opus/fable) ou um nome completo
  `claude-...`. `best`, `opusplan` (mistura opus e sonnet), `default` e
  `haiku[1m]` fazem a inicialização falhar com mensagem clara.
- Diagnóstico: cada modelo configurado aparece com `kind` (alias ou nome completo),
  `family`, `resolved_version: null` e `access: "not_verified_without_generation"`.
  Também há uma nota dizendo que o login não prova acesso por modelo. Nada é inventado.

## 2. Fable e créditos

- [P] A CLI marca modelos com "Requires usage credits" / "Draws from usage credits"
  conforme a conta: configuração por modelo, `overageConsentRequired` ou fim de
  limites do plano. Em modo interativo há um diálogo de consentimento. Sem diálogo
  (`-p`), a CLI tenta **trocar de modelo**. Com a troca proibida, ela termina com
  "Your model policy only allows Fable, which requires usage credits" ou
  "CLAUDE_CODE_NO_MODEL_FALLBACK is set: model substitution is disabled".
- O gateway agora classifica essas mensagens e "There's an issue with the selected
  model… may not have access" como `provider_unavailable` (503), com orientação para
  conferir `/model`. Não são tratadas como cota e não há nova tentativa. [F]
- A doc oficial cita 2.1.321+ para Fable 5.2, e o padrão **embutido** da 2.1.307
  para o alias `fable` é 5.1 [P]. Mas a resolução também usa um registro de
  modelos de fora do binário, e o seletor do Windows mostrou Fable 5.2 (e 5.1).
  Conclusão: **nem o número da versão nem o seletor confirmam a execução.** Só uma
  geração mostra o modelo servido (`modelUsage`, impresso pelo teste real).
  "Listado" ≠ "executado" ≠ "sem cobrança extra". Não exigir atualização só pelo
  número. Não atualizei nada nem habilitei modelo ou crédito.

### Windows do usuário, 11/11/2026 [R, sem geração]

O Claude Code do usuário se atualizou sozinho para **2.1.322** ("Updated to
latest"). Na tela inicial e em `/model`, com plano **Claude Pro**:

- Modelos listados: Default (recommended) = **Fable 5.2**, Opus 5.5 (o atual
  dele), Sonnet 5.5, Fable 5.2, Haiku 5.5 e "More models". Nenhum mostrou
  "Requires usage credits".
- Aviso da CLI: "Fable 5.2 … is included in your plan **until November 16**. It
  draws down usage faster than Opus 5.5."
- `diagnose`: `ready: true`, login `claude.ai`, assinatura, verificação em 0,4 s,
  1.1 disponível e contrato 1 bloqueado por `output_limit_not_enforced` (como
  esperado). Esse JSON **não** tem o campo `models`, então veio do código
  anterior a `eb94450`. É preciso repetir com esta branch.

Consequências:
- A tela é a lista **desta conta e desta versão**, não uma prova de acesso por
  geração. A versão que cada alias resolve só aparece no teste real (pedido/servido).
- Fable está incluído **só até 16/11/2026** e consome a cota mais rápido. Depois
  dessa data pode passar a exigir créditos. Reforça C-3: Fable nunca escolhido
  automaticamente, e o painel precisa avisar "consome cota mais rápido; incluído
  até 16/11".
- "Default (recommended)" = Fable não afeta o gateway: ele sempre passa
  `--model` com o modelo configurado. Rodar `claude` sem `--model` usaria Fable.
- O requisito de versão para Fable 5.2 (2.1.321+) agora está atendido no Windows.

**Condição para um teste real com Fable** (decisão do usuário, nesta ordem):
1. Anotar `claude --version`. Não é pré-requisito pelo número; na captura de 11/11
   a CLI já estava em 2.1.322, e o registro anterior do STATUS dizia 2.1.307.
2. Abrir `claude` → `/model` e ver se Fable aparece e se mostra "Requires usage
   credits". Se mostrar, **não** configurar `fable` sem aceitar conscientemente o
   gasto de créditos.
3. Só então incluir `fable` em `-Models` e rodar **uma** geração pelo teste real,
   que mostra o modelo pedido e o servido.

## 3. Perfis de tarefa: validação e sugestões

Validado [F]: catálogo só com modelos configurados; perfis padrão
(`sonnet` estudo/programação, `haiku` geral/escrita, `opus` e `fable` análise);
substituição por `IA_BBARU_CLAUDE_CODE_MODEL_TASK_KINDS` e validação de chaves
e categorias.
**Corrigido:** `opus[1m]` ou `claude-opus-5-5` caíam em "todas as categorias".
Agora herdam o perfil da família.

Referência do próprio fornecedor (textos, **não medições**). A tela `/model` da
conta do usuário [R] diz: Opus 5.5 "For complex work and everyday tasks"; Sonnet 5.5
"Most efficient for simpler tasks"; Fable 5.2 "For your toughest challenges";
Haiku 5.5 "Fastest for quick answers". Uma tabela interna do binário [P] traz textos
diferentes (por exemplo, sonnet "everyday tasks"). Vale a tela da conta.

| Critério | Hoje | Sugestão (nada medido; preferências editáveis) |
| --- | --- | --- |
| Complexidade | Inferida só do tipo de tarefa | Escolha explícita do usuário no pedido: **rápido / normal / profundo** → haiku / sonnet / opus. O tipo sozinho não mede dificuldade |
| Contexto | Limite comum de 80.000 caracteres | Manter comum. [N] `modelUsage.contextWindow` foi 1.000.000 nos quatro na conta do ambiente; não vale como regra para a conta do usuário. Variantes `[1m]` só se o usuário configurar |
| Latência | Não considerada | Gravar o tempo de cada etapa no backend para ter medição real depois. Não ordenar por velocidade sem isso |
| Cota / preferência | Ordem autorizada + preferência explícita | `fable` **nunca** escolhido automaticamente: só por `preferred_model_id`, por causa de créditos. Mostrar no painel "pode exigir créditos" |
| Revisão | Modelo diferente do da resposta | Em análise, o plano de teste escolheu opus para responder e **haiku para revisar**. Sugestão: revisor de nível igual ou superior, ou o próprio usuário escolhe |
| Padrões | sonnet estudo/programação; haiku geral/escrita | Pela tela da conta, Opus é o modelo "everyday" e Sonnet o de tarefas mais simples. Mas Opus gasta mais cota. Sugestão a decidir com o usuário: haiku geral; sonnet estudo/escrita; opus programação/análise; fable só explícito. Não aplicado |

Nenhuma dessas sugestões foi aplicada aos padrões: são decisões de produto
(usuário/Codex). Só a herança por família foi corrigida.

## 4. Troca automática de modelo

- [P] A 2.1.322 tem troca automática por sobrecarga/erro de servidor, modelo não
  encontrado, permissão negada, modelo bloqueado, "último recurso" e **recusa**
  (`model_refusal_fallback`). Também há troca por consentimento de créditos e um
  "modelo de reserva" informado pelo servidor. Cada troca gera um evento
  `system/model_fallback` (com `original_model`/`fallback_model`) na saída `stream-json`.
- [P] A variável oficial `CLAUDE_CODE_NO_MODEL_FALLBACK` (booleana; existe na
  2.1.307 e na 2.1.322) desliga a substituição. Com ela, a CLI falha em vez de trocar.

Implementado [F]:
- O processo do Claude Code recebe `CLAUDE_CODE_NO_MODEL_FALLBACK=1`. O gateway
  nunca passa `--fallback-model`, e as variáveis que redirecionam aliases ou o
  catálogo são removidas do ambiente.
- Conferência do `modelUsage` em toda execução, como segunda barreira (vale também
  para versões que ignorem a variável):
  - alias → o modelo servido precisa ser da mesma família (`fable` aceita
    `claude-fable-5-1` ou `-5-2`; nunca `claude-opus-…`);
  - nome completo → exatamente ele (sufixo de data ou `[1m]` aceitos;
    `claude-opus-5` **não** aceita `claude-opus-5-5`);
  - qualquer token de saída de outro modelo, mesmo junto do certo →
    `provider_model_mismatch` (502, final, gravado e reproduzido, sem nova geração);
  - entrada de outro modelo com zero tokens de saída é ignorada;
  - sem `modelUsage` → `provider_invalid_output`.
- **Alias pedido × versão resolvida:** o adaptador guarda o modelo servido
  (`ProviderResult.served_model`), mas os contratos 1 e 1.1 não têm campo para
  ele, então **não é exposto** (pendência C-1). O teste real opcional imprime
  "pedido" e "servido".

Limitação: a regra de família não distingue Fable 5.1 de 5.2 quando se pede o
alias `fable`. Para fixar a versão, configure o nome completo (`claude-fable-5-2`).

## 5. Proteções preservadas [F]

Login por assinatura (`claude.ai`/`oauth_token`), remoção de chaves de API e
nuvem, `--tools ""`/`--strict-mcp-config`/`--safe-mode`, erros sanitizados,
deduplicação com resultado gravado e reproduzido, `unknown` sem revisão e
`tools: disabled` no 1.1. Contratos 1 e 1.1 **inalterados** (OpenAPI conferido).

## 6. Entrada visual 1.2

[PROPOSTA_ENTRADA_VISUAL.md](PROPOSTA_ENTRADA_VISUAL.md), seção 6, reescrita para
somente Claude Code: `stream-json` na entrada e na saída, bloco `image` tipado da
API (base64 só em `source.data`, nunca no texto), `--replay-user-messages` para
confirmar o recebimento, `tools: []` conferido no `init` e as mesmas proteções
de modelo. Evidência: [P] para formatos e opções; [N] para `init.tools: []` e
`init.model`, com entrada só de texto. **Envio de imagem não testado.** Nada
implementado. Os contratos só mudam junto com o Codex.

## 7. Windows: o que o usuário roda

Sem conta real até o passo 5. Nenhuma repetição depois de timeout ou resultado incerto.

```powershell
git fetch origin
git checkout claude/vibrant-meitner-ksbzgf
git pull --ff-only origin claude/vibrant-meitner-ksbzgf
python -m pip install -r requirements.txt
python -m unittest discover -s tests -v
python -m unittest discover -s tests/integrations -v
python scripts/verify_gateway_v11.py --gateway-checkout .
claude --version
```

1. Suítes: esperado backend 67 OK; gateway 75 OK + 1 ignorado; script HTTP OK.
2. `claude` → `/model`: anotar quais modelos aparecem e quais mostram "Requires
   usage credits". Não aceitar créditos.
3. Inicializador só com os modelos sem créditos, por exemplo:
   `powershell -ExecutionPolicy Bypass -File .\integrations\scripts\iniciar-ia-bbaru.ps1 -Models "sonnet,haiku,opus"`.
   No navegador, conferir que as Conexões listam só esses modelos.
4. `python -m integrations diagnose | clip` e colar aqui: cada modelo deve
   aparecer com `access: not_verified_without_generation`.
5. Opcional, só com autorização explícita: uma geração por modelo, um de cada vez:
   ```powershell
   $env:IA_BBARU_REAL_TEST = "claude-code"
   $env:IA_BBARU_CLAUDE_CODE_MODELS = "haiku"
   python -m unittest discover -s tests/integrations -p "test_real_*.py" -v
   ```
   A linha "pedido: haiku | servido: claude-haiku-…" é a evidência de resolução
   **na conta do usuário**. Timeout ou erro: anotar e não repetir.

## Pendências para o Codex (backend/desktop) e para o frontend

| Id | Para | O quê | Por quê |
| --- | --- | --- | --- |
| C-1 | Codex | Campo `served_model` (texto ≤ 100 ou `null`) na resposta de geração, na versão de contrato que o Codex escolher (aditivo no 1.1 se os dois lados aceitarem; senão 1.2), guardado na etapa | O usuário ver "pedido: fable · servido: claude-fable-5-1". O gateway já tem o valor (`ProviderResult.served_model`) |
| C-2 | Codex | Códigos `provider_model_requires_credits` e `provider_model_unavailable` (503, pós-início, finais) na lista do consumidor, com mensagens próprias | Hoje caem em `provider_unavailable`, que o backend mostra como mensagem genérica |
| C-3 | Codex | `fable` nunca escolhido automaticamente; só por preferência explícita. Aviso "pode exigir créditos" no plano | Item 2 |
| C-4 | Codex | Revisor de nível igual ou superior ao da resposta (ou escolha do usuário) | Item 3: hoje opus responde e haiku revisa |
| C-5 | Codex | Gravar a duração de cada etapa | Ter medição de latência antes de usá-la como critério |
| C-6 | Codex | Explicar no painel/diagnóstico que login ≠ acesso por modelo, e mostrar o erro `provider_model_mismatch` como "a CLI tentou usar outro modelo; nada foi aceito" | Itens 1 e 4 |
| C-7 | Codex | Código `provider_output_limit_reached` (502, final) no consumidor, com mensagem "a resposta passou do limite de N tokens". O gateway passa a emiti-lo assim que o backend aceitar; hoje é `provider_error` + categoria | P0 |
| C-8 | Codex | Limite padrão maior que 128 para revisão/chat, e aceite do limite indicativo na configuração inicial, conforme AJUSTES_CHAT_LATERAL.md | P0 |
| C-9 | Codex | Montar o histórico do chat em `context[]` com ids estáveis por turno, respeitar `context_char_limit` e avisar quando cortar | Chat lateral |
| C-10 | Codex | Mostrar `request_id` do turno nos "Detalhes" do erro, para cruzar com `python -m integrations failures` | P0 |
| G-1 | Frontend | Seletor explícito rápido / normal / profundo, se C-3/C-4 forem aceitos | Item 3 |
| G-2 | Gemini | `provider_error`: "O Claude não conseguiu responder a este pedido." Com C-7, mostrar a ação "aumentar limite". Sem sugerir login ou cota sem código específico | P0 |

Prompt pronto para o Codex:

> Leia `integrations/docs/PASSAGEM_CLAUDE_ONLY.md` na branch
> `claude/vibrant-meitner-ksbzgf`. Comece pela seção P0 e por C-7, C-8 e C-10;
> depois C-9 (chat lateral) e C-1 a C-6. Para C-1, C-2 e C-7, decida a versão
> do contrato e atualize schemas, OpenAPI e testes dos dois lados. O Claude adapta
> o gateway depois, sem emitir campo novo para consumidor do contrato 1. Não
> reintroduza outros provedores. Não use conta real nem gere conteúdo na revisão.
