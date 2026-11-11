# Integração somente Claude: respostas ao prompt e passagem ao Codex

Pedido: `docs/PROMPT_CODE_CLAUDE_ONLY.md` (base `codex/browser-capture-clis`,
`fa24ef3`, PR #7). Direção: `docs/DIRECAO_CLAUDE_ONLY.md`. Data: 11/11/2026.
A branch `claude/vibrant-meitner-ksbzgf` foi avançada (fast-forward) até `fa24ef3`.
Não havia mudança local pendente. Só `integrations/` e `tests/integrations/` mudaram.
Nenhum adaptador antigo foi reintroduzido.

## Níveis de evidência usados aqui

| Marca | Significa |
| --- | --- |
| **[F]** | Dublê de teste (`fake_claude.py`), sem CLI real nem conta |
| **[P]** | Pacote oficial `@anthropic-ai/claude-code` lido **sem gerar**: `--help` e textos do binário (`strings`). Versões 2.1.322 (atual no npm, igual byte a byte ao binário instalado neste contêiner) e 2.1.307 (a do Windows do usuário, só lida, nunca executada) |
| **[N]** | Execução **não intencional** no contêiner de nuvem do Claude, com a conta **do ambiente** (ver abaixo) |
| **[R]** | Conta real do usuário. **Nenhuma nesta rodada** |

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
- Fable 5.2 exige CLI 2.1.321+ (doc oficial). Na 2.1.307 do usuário, `fable`
  resolveria para Fable 5.1 pelo padrão embutido [P]. Não atualizei nada nem
  habilitei modelo ou crédito.

**Condição para um teste real com Fable** (decisão do usuário, nesta ordem):
1. Decidir se atualiza o Claude Code para 2.1.321+ (`claude --version`).
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

Referência do próprio fornecedor (textos da CLI 2.1.322, **não medições**) [P]:
haiku "Fastest for quick answers"; sonnet "Most efficient for everyday tasks";
opus "Most capable for ambitious work"; fable "For your toughest challenges".

| Critério | Hoje | Sugestão (nada medido; preferências editáveis) |
| --- | --- | --- |
| Complexidade | Inferida só do tipo de tarefa | Escolha explícita do usuário no pedido: **rápido / normal / profundo** → haiku / sonnet / opus. O tipo sozinho não mede dificuldade |
| Contexto | Limite comum de 80.000 caracteres | Manter comum. [N] `modelUsage.contextWindow` foi 1.000.000 nos quatro na conta do ambiente; não vale como regra para a conta do usuário. Variantes `[1m]` só se o usuário configurar |
| Latência | Não considerada | Gravar o tempo de cada etapa no backend para ter medição real depois. Não ordenar por velocidade sem isso |
| Cota / preferência | Ordem autorizada + preferência explícita | `fable` **nunca** escolhido automaticamente: só por `preferred_model_id`, por causa de créditos. Mostrar no painel "pode exigir créditos" |
| Revisão | Modelo diferente do da resposta | Em análise, o plano de teste escolheu opus para responder e **haiku para revisar**. Sugestão: revisor de nível igual ou superior, ou o próprio usuário escolhe |
| Padrões | sonnet estudo/programação; haiku geral/escrita | Considerar sonnet também em geral/escrita (descrição "everyday") e haiku só em geral |

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
| G-1 | Frontend | Seletor explícito rápido / normal / profundo, se C-3/C-4 forem aceitos | Item 3 |

Prompt pronto para o Codex:

> Leia `integrations/docs/PASSAGEM_CLAUDE_ONLY.md` na branch
> `claude/vibrant-meitner-ksbzgf`. Avalie C-1 a C-6. Para C-1 e C-2, decida a versão
> do contrato e atualize schemas, OpenAPI e testes dos dois lados. O Claude adapta
> o gateway depois, sem emitir campo novo para consumidor do contrato 1. Não
> reintroduza outros provedores. Não use conta real nem gere conteúdo na revisão.
