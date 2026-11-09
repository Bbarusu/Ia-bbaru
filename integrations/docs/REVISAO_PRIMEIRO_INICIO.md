# Revisão para o primeiro início (Claude, 9/11/2026)

Pedido do usuário: com o Codex sem créditos, verificar a parte dele e a última
entrega do Gemini, e deixar o projeto pronto para o primeiro início. Revisão em
worktrees separadas; **nenhuma branch de outra frente foi alterada**. Sem conta real.

| Frente | Branch / PR | SHA revisado |
| --- | --- | --- |
| Codex | `codex/chromium-browser` / #4 | `33fc1ea` (código igual ao `e1ff8b9`; o commit novo só traz documentação) |
| Gemini | `gemini/chromium-ui` / #5 | `00e2c8f` (sobre `e1ff8b9`) |
| Claude | `claude/vibrant-meitner-ksbzgf` / #1 | `a58e66c` + esta entrega |

> **Atualização:** o Gemini corrigiu G-A, G-B e G-C em `ff5f7d7` (verificado no Linux).
> Resta só `#tabs`, que já existia antes. Passagem para o Codex:
> [PASSAGEM_CODEX.md](PASSAGEM_CODEX.md).

**Parecer:** pode fazer o primeiro início com as três frentes juntas
([PRIMEIRO_INICIO.md](PRIMEIRO_INICIO.md)). Não há bloqueio. Ficam correções
menores para o Gemini e uma observação para o Codex, abaixo.

## Testes executados (Linux, Xvfb, sem sandbox do SO)

| Verificação | Codex `33fc1ea` | Gemini `00e2c8f` | As três juntas |
| --- | --- | --- | --- |
| Python (`tests/`) | ✅ 48 | ✅ 48 | ✅ 48 |
| Gateway (`tests/integrations`) | — | — | ✅ 52 + 1 pulado |
| `npm --prefix frontend test` | ✅ 6 | ✅ 10 | ✅ 10 |
| `npm --prefix desktop test` | ✅ 3 | ✅ 3 | ✅ 3 |
| Build | ✅ | ✅ | ✅ |
| `desktop run test:ui` (Electron real, catálogo sintético) | ✅ | ✅ | ✅ |
| `scripts/verify_gateway_v11.py` | — | — | ✅ |
| `tests/integrations/desktop_gateway_smoke.cjs` (Electron + gateway real, dublê) | — | — | ✅ |
| Janela 900×640: rolagem horizontal (barra, painel estreito e ampliado) | ✅ nenhuma | — | ✅ nenhuma |
| axe WCAG A/AA, painel estreito / ampliado | ⚠️ contraste (5 / 7), região rolável sem foco | — | ✅ sem violações |
| axe WCAG A/AA, barra do navegador | ⚠️ `aria-required-children` em `#tabs` | — | ⚠️ `#tabs` + `aria-prohibited-attr` (`.brand`) + contraste (`#panel`) |

## Codex — sem bloqueio

Lido: `desktop/main.cjs`, `policy.cjs`, `local-service.cjs`, `backend/gateway.py`,
`backend/capabilities.py`.

- Abas web com `sandbox`, `contextIsolation`, sem Node e sem preload; navegação,
  redirecionamento e janelas novas limitados a HTTP/HTTPS; downloads e permissões
  negados; páginas internas protegidas contra navegação; IPC aceito só do frame
  principal com a URL exata do documento interno.
- Ponte com lista fixa de operações (sem `tasks.execute`), envelope validado,
  limite de tamanho e de pendências; backend com token interno aleatório em porta
  livre de loopback; logs do backend não vão para o renderer.
- Cliente do gateway sem redirecionamento nem nova tentativa; versão 1.1 conferida
  no catálogo e na resposta; política de aceite e revalidação de capacidades
  antes de executar.

Observações (não impedem o início):

- O1 — `scripts/start-browser.ps1` está salvo sem BOM. No PowerShell 5.1 a palavra
  "código" da mensagem de erro aparece com acento trocado. Salvar como UTF-8 com BOM.
- O2 — `#tabs` (`role="tablist"`) tem filhos `div` em vez de `tab` direto
  (axe `aria-required-children`). Já existia antes do Gemini.
- O3 — a ponte desiste em 20 s. A primeira consulta ao catálogo faz o gateway rodar
  três comandos do Claude Code (versão, ajuda e login); no Windows isso deve
  ficar bem abaixo do limite, mas não foi medido lá.

## Gemini — corrigir antes do merge (não bloqueia o primeiro início)

Conforme `docs/PROMPT_GEMINI_CHROMIUM.md`: transporte preservado (nenhum
`window.browser`/`window.iaDesktop` fora de `transport.ts`), aceite desmarcado e
enviado, capacidades e `completion_unconfirmed` explicados, captura em espera com
substituição explícita. Os testes do Codex foram ampliados, sem remover verificações.
O painel ficou sem violações do axe e sem rolagem em 900×640.

- G-A (P2) — `formatUnavailableReason` (`frontend/src/logic.mjs`) traduz códigos que
  o gateway **não envia** (`not_authenticated`, `subscription_required`,
  `api_key_missing`, `rate_limited`). Os códigos reais aparecem crus, por exemplo
  "Indisponível (not_logged_in)". Códigos enviados hoje: `cli_not_installed`,
  `cli_not_runnable`, `cli_version_unsupported`, `auth_status_unknown`,
  `not_logged_in`, `not_subscription_login` (lista em
  `integrations/docs/CONEXOES.md`, seção 4). Cota esgotada não aparece no catálogo,
  só ao gerar; não exibir "limite de uso" como motivo de indisponibilidade.
- G-B (P3) — barra do navegador: `aria-label` em `<span class="brand">` sem papel
  (axe `aria-prohibited-attr`) e contraste insuficiente no botão `#panel`.
  São novos em relação à base do Codex.

- G-C (P3, visto no primeiro início no Windows) — no plano, a capacidade
  `finish_reason: reported` aparece como "Término confirmado". Antes da execução
  nada foi confirmado; o valor só diz que o provedor **informa** o motivo de parada.
  Sugestão: "Término informado pelo provedor". Reservar "confirmado/não confirmado"
  para o resultado (`stop` × `unknown`/`completion_unconfirmed`).

Mensagem pronta para o Gemini:

> Revisão de `00e2c8f` (PR #5) junto com `codex/chromium-browser` e o gateway:
> build e todos os testes passam, e o painel ficou sem violações do axe em
> 900×640. Corrija: (1) `formatUnavailableReason` usa códigos que o gateway não
> envia. Traduza os reais: `cli_not_installed`, `cli_not_runnable`,
> `cli_version_unsupported`, `auth_status_unknown`, `not_logged_in`,
> `not_subscription_login`. Mantenha o texto genérico para códigos desconhecidos
> e não apresente cota como motivo do catálogo. (2) Na barra do navegador, remova
> o `aria-label` do `<span class="brand">` (ou dê um papel adequado) e ajuste o
> contraste do botão `#panel`. (3) No plano, troque "Término confirmado"
> (capacidade `finish_reason: reported`) por "Término informado pelo provedor";
> "confirmado" só vale para o resultado `stop`. Inclua testes de comportamento.
