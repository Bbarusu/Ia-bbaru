# Revisão do gateway para a primeira inicialização Chromium

Revisão em 9/11/2026 no repositório https://github.com/Bbarusu/Ia-bbaru.

- Gateway: `a58e66c049496a92bdffaf439f4d5aa5021bede6`, branch
  `claude/vibrant-meitner-ksbzgf` (PR #1).
- Navegador/backend: `e1ff8b94165888e9075443aad13f978a5b33577b`, branch
  `codex/chromium-browser` (PR #4).

**Parecer:** temos o necessário do gateway para abrir o navegador, consultar o
catálogo do Claude Code e criar planos pelo contrato 1.1. Não identifiquei bloqueio
novo no código do gateway nos caminhos verificados. Há uma correção no roteiro de
instalação limpa, descrita abaixo. Windows e login real nessa combinação continuam
pendentes de validação no computador do usuário.

## Compatibilidade confirmada

- O gateway permanece separado em loopback; o navegador inicia seu próprio backend
  em porta livre, com token interno. O guia do Claude respeita essa divisão.
- `GATEWAY_URL`, `GATEWAY_TOKEN` e `GATEWAY_PROTOCOL_VERSION=1.1` são herdados pelo
  backend iniciado pelo app. Não é preciso iniciar outro backend na porta 8000.
- O catálogo 1.1, aceite por tarefa e capacidades coincidem com o consumidor atual.
  `components` e `paths` dos OpenAPI das duas frentes são iguais.
- O diagnóstico distingue disponibilidade nos contratos 1 e 1.1. Disponibilidade
  no 1.1 não substitui aceite; a flag legada não foi promovida a consentimento.
- O cache de estado indisponível passou de 30 para 5 segundos. A reavaliação ocorre
  na próxima consulta após o TTL, não por atualização automática contínua do painel.
- Não há acoplamento a cookies/sessões web. Abrir uma aba Claude não conecta o CLI.
- Abrir o app, consultar modelos e salvar o plano não gera resposta nem consome
  cota de geração. A ponte continua recusando `tasks.execute`.

## C1 — P2: instalar dependências também na pasta do navegador

Arquivo do Claude:
[TESTE_PRATICO_1_1.md:49](https://github.com/Bbarusu/Ia-bbaru/blob/a58e66c049496a92bdffaf439f4d5aa5021bede6/integrations/docs/TESTE_PRATICO_1_1.md#L49).

Na parte 1, o roteiro cria apenas o ambiente Python em `Ia-bbaru-chromium`. Os
comandos `npm ci` são executados depois em **outra pasta**, `ia-integracao-chromium`.
Na parte 2, retorna a `Ia-bbaru-chromium` e chama `start-browser.ps1` sem `-Install`.
Em uma instalação limpa, essa pasta ainda não tem `desktop/node_modules`, e o
inicializador interrompe com a orientação para instalar. Este achado vem da
inspeção dos comandos e do guard do inicializador; não de execução no Windows.

Correção para o usuário: depois de configurar as três variáveis do gateway no
terminal 2, executar na primeira abertura:

```powershell
cd W:\Projeto\Ia-bbaru-chromium
.\scripts\start-browser.ps1 -Install
```

As variáveis configuradas no terminal são preservadas. Nas próximas aberturas,
usar `start-browser.ps1` sem o parâmetro. Alternativamente, executar os dois
`npm ci` também nessa pasta antes de iniciar. Se ela já tiver sido preparada pelo
guia do Codex, não há esse bloqueio.

Mensagem pronta para o Claude:

> A revisão de `a58e66c` com o Chromium `e1ff8b9` passou nos testes de gateway,
> schema, HTTP e interface. Ajuste apenas o roteiro de instalação limpa em
> `integrations/docs/TESTE_PRATICO_1_1.md`: a parte 1 instala dependências npm na
> pasta de integração, mas a parte 2 abre outra worktree. Use
> `scripts/start-browser.ps1 -Install` na primeira abertura de
> `Ia-bbaru-chromium`, após configurar as variáveis do gateway, ou instale ali
> `frontend/` e `desktop/`. Diferencie a primeira abertura das seguintes. Não é
> necessário mudar contratos nem liberar geração no painel.

## Verificação executada pelo Codex

| Verificação | Resultado |
| --- | --- |
| Suíte do gateway usando o backend Chromium | 53 testes: 52 passaram, 1 real ignorado |
| Comparação dos OpenAPI 1.1 | `components` e `paths` iguais |
| `scripts/verify_gateway_v11.py` | Passou: aceite, unknown sem revisão, revisão após stop e bloqueio de repetição |
| `tests/integrations/desktop_gateway_smoke.cjs` | Passou no Electron real com gateway HTTP real e CLI de teste |
| Catálogo disponível na interface | Claude Code selecionável, com capacidades 1.1 |
| Aceite e persistência | Ausência bloqueia; aceite true persiste com capacidades e teto solicitado 128 |
| Geração acidental | Zero gerações; `tasks.execute` recusado |
| Sem login no CLI de teste | Modelo indisponível; catálogo informa `not_logged_in` |

Para o teste gráfico, as duas versões foram combinadas em uma worktree descartável,
sem commit de merge nem alteração das branches dos autores. Dependências e build
do navegador `e1ff8b9` foram reutilizados. A revisão não incorporou o gateway à PR #4.

Ambiente Linux/Xvfb com `IA_BBARU_TEST_NO_SANDBOX=1`, perfil temporário e dublê do
CLI. A validação confirma o fluxo gráfico e a integração, mas não a sandbox do SO,
a instalação Windows ou o login real. Nenhuma conta real foi usada nesta revisão.

## Pendências que não impedem abrir o navegador

- O frontend mostra “Indisponível”, mas ainda não apresenta `unavailable_reason`.
  É um refinamento do Gemini já previsto no seu prompt; o diagnóstico do gateway
  permite identificar o motivo enquanto isso.
- A geração de IA pelo painel aguarda a execução durável do Codex. Não é uma falta
  do gateway para a primeira abertura.
- Para o Claude aparecer disponível no PC do usuário: CLI oficial instalado e
  autenticado por assinatura, modelo configurado, gateway iniciado e mesmo token
  de gateway nos dois terminais. O token interno do backend é gerado pelo app.

Roteiros: [navegador](TESTAR_NAVEGADOR_CHROMIUM.md) e
[gateway do Claude](https://github.com/Bbarusu/Ia-bbaru/blob/a58e66c049496a92bdffaf439f4d5aa5021bede6/integrations/docs/TESTE_PRATICO_1_1.md),
com a correção C1 na primeira abertura.
