# Estado atual — Claude exclusivo

A direção vigente é [DIRECAO_CLAUDE_ONLY.md](DIRECAO_CLAUDE_ONLY.md).
Branch de integração: `codex/browser-capture-clis`, PR #7. Ainda fora da main.

- Único provedor: Claude Code oficial com a conta do usuário.
- Catálogo somente com os modelos Claude explicitamente configurados.
- Perfis editáveis por modelo: tipo de tarefa, contexto e preferência orientam
  a escolha. Não há classificação automática de qualidade/dificuldade.
- Resposta e revisão podem usar modelos Claude diferentes. Ferramentas seguem
  desativadas; resposta sem término confirmado não inicia revisão.
- Sonnet, Haiku, Opus e Fable são aliases documentados oficialmente. Acesso e
  cobrança dependem da conta; Fable não é habilitado por padrão e pode exigir
  créditos adicionais. Conferir `/model` antes de configurar.
- Captura de texto/print/imagem, armazenamento separado e fila durável preservados.
  Imagens continuam locais; visão no gateway ainda não está implementada.
- Linux e Windows: backend, gateway, build e teste gráfico aprovados para esta
  configuração. Login Claude confirmado no Windows. Nova captura de tarefa no
  painel mostra provider_error: geração real ainda não validada nesta configuração.
- Próxima experiência solicitada: chat lateral com contexto da página, resposta
  em destaque e envio direto. Especificação e divisão de responsabilidades em
  [AJUSTES_CHAT_LATERAL.md](AJUSTES_CHAT_LATERAL.md); ainda não implementadas.

Validação desta entrega: backend 67 aprovados; gateway 61 aprovados e 1 teste
de conta real ignorado; frontend 11 e políticas desktop 3 aprovados. Build,
teste gráfico Chromium, integração desktop/gateway e 5 cenários HTTP 1.1 aprovados.
Os testes gráficos Linux usaram Xvfb e sandbox do sistema desativada apenas no teste.

Prompts atuais: [Gemini/frontend](PROMPT_GEMINI_CLAUDE_ONLY.md) e
[Code/Claude Code](PROMPT_CODE_CLAUDE_ONLY.md).
As propostas e achados abaixo são histórico, não instruções para reativar provedores.

## Validação Windows recebida em 11/11/2026

Evidência: saída de terminal e captura do seletor de modelos fornecidas pelo usuário,
após incorporar a branch de integração (entrega fa24ef3; SHA do merge local não informado).

| Verificação | Resultado |
| --- | --- |
| Merge | Concluído pelo Git, sem conflitos reportados |
| Backend | 67 testes aprovados em 14,469 s |
| Gateway | 62 executados em 43,974 s: 61 aprovados e 1 teste real ignorado |
| Build frontend | TypeScript/Vite aprovado |
| Chromium test:ui | Aprovado: navegação, isolamento, backend real, captura, rascunhos e persistência |
| Claude Code | 2.1.307, instalado, sem flags faltantes |
| Login | logged_in=true, auth_method=claude.ai, uses_subscription=true, ready=true |
| Diagnóstico | 2,1 s; apenas claude_code; nenhuma variável de chave de API detectada |
| Contrato | 1.1 disponível; 1 indisponível por output_limit_not_enforced, esperado |
| Ferramentas | disabled |

O aviso de depreciação Starlette/httpx não impediu os testes. O teste real foi
ignorado de propósito; esses resultados não comprovam geração com a conta.

A captura da CLI mostra plano Claude Pro, Opus 5.5 selecionado e entradas
Sonnet 5.5, Fable 5.2, Haiku 5.5, Fable 5.1 e outros modelos. A entrada
Default (recommended) mostra Fable 5.2. Isso confirma a apresentação desses modelos
no seletor desta instalação, não que todos já tenham sido executados ou que
Fable esteja incluído sem créditos adicionais. A referência anterior à versão
mínima documentada de Fable não deve sobrepor esta observação: compatibilidade
de execução precisa de teste próprio, sem exigir atualização apenas pelo número.

Roteiro proposto antes da captura de falha abaixo: sair da CLI interativa e iniciar o navegador com -Models "sonnet".
Criar projeto/material sintético, planejar uma tarefa sem revisão e confirmar
uma única geração pelo painel. Observar saída, estado, modelo e persistência.
O pedido deve usar só a palavra "laranja" de uma fonte de teste.
Não repetir automaticamente se o resultado ficar incerto. Depois validar
outros modelos autorizados e revisão entre dois modelos Claude.

## Captura posterior e ajuste de experiência — 11/11/2026

O usuário mostrou o pedido “Revise” em estado Falhou, Claude Code (sonnet),
um material, uma tentativa, limite indicativo de 128 e código provider_error.
Não foi informado o SHA dessa execução nem diagnóstico da CLI. Não sabemos se
é o teste sintético sugerido acima; não atribuir a falha ao limite ou à conta.
O reparo e uma geração real bem-sucedida continuam pendentes, apesar dos testes
automatizados aprovados. Não repetir automaticamente resultado incerto.

Também solicitou simplificar a interação conforme referências Atlas/Edge:
conversa persistente na lateral, contexto visível e respostas claras, retirando
planos e metadados técnicos do percurso principal. Os ajustes e critérios estão
em [AJUSTES_CHAT_LATERAL.md](AJUSTES_CHAT_LATERAL.md), com prompts atualizados
para Gemini (frontend) e Code (gateway). Esta rodada registra a especificação;
não implementa o novo chat nem corrige o provider_error observado.

## Tratamento de provider_error — correção e diagnóstico

Corrigida leitura de `errors[]` da CLI, antes ignorada quando a falha não vinha
em `result`. Autenticação/cota nesses envelopes agora conservam seus códigos.
Adicionado diagnóstico estrutural sanitizado `claude_cli_failure`, sem textos
do usuário/provedor, e mensagem compreensível para falha ainda desconhecida.
Nenhum retry automático novo; causa da captura e geração real ainda pendentes.

Roteiro de uma única geração sintética no Windows e coordenação com os outros
chats em [CORRECAO_PROVIDER_ERROR.md](CORRECAO_PROVIDER_ERROR.md).
Validação local: backend 67 OK; gateway 67 OK + 1 real ignorado; frontend 11 OK;
build e cinco cenários HTTP 1.1 aprovados. Windows ainda precisa validar esta correção.

## Histórico de decisões anteriores

# Estado do Ia-bbaru / Yuki

## Atualização: Gemini CLI indisponível para a conta do usuário

Revisão dos registros do Claude até `47bffd5` (10/11/2026), na branch
`claude/vibrant-meitner-ksbzgf`. Essas alterações ainda não foram incorporadas
à branch de integração por esta atualização documental.

- O Google recusou o login individual na Gemini CLI 0.67.0 e orientou migração
  para o Antigravity. Essa rota não é utilizável com a conta testada; não sugerir
  chave de API/Vertex nem tratar a recusa como simples configuração incorreta.
  Não há conclusão sobre todas as contas ou versões futuras.
- Claude corrigiu os dois achados anteriores em `64c6c36`: verificação do modo
  Google e recusa de saída mista de modelos, com regressões. O caminho de login
  válido ainda não foi observado com a conta real. A correção usa mecanismo
  interno da CLI, com limitações documentadas; não equivale a validar produção.
- Segundo `integrations/docs/VALIDACAO.md` dessa branch, o Windows passou com
  66 testes de backend, 80 de gateway + 1 ignorado e os 5 cenários HTTP 1.1.
  As duas falhas de acentuação foram resolvidas. O usuário também confirmou
  aprovação do teste gráfico da PR #7.
- Claude Code é o caminho funcional atual. Codex CLI tem login ChatGPT
  reconhecido, mas continua inelegível por `tools=restricted`; não foi liberado.
- Antigravity não é substituto implementado: faltam evidências de login por
  assinatura, execução não interativa, formato de saída e controle de ferramentas.

Direção recomendada: tirar a Gemini CLI do caminho dos testes práticos desta
conta e continuar com Claude Code e a avaliação do isolamento do Codex. Isso
não afeta o frontend produzido pelo Gemini nem o uso manual do site Gemini.
As capturas continuam locais e o contrato visual 1.2 é apenas uma proposta.

## Revisão de 10/11/2026 (ainda fora da main)

Estado da integração antes dos novos registros acima:

Branch `codex/browser-capture-clis`: combina Claude `db8cee4` (código `732b0ac`) e Gemini `fd2a574`,
com busca/zoom/minimizar/reabrir reais, captura nativa de tela/imagem, armazenamento
raster separado do texto e diagnóstico sanitizado das CLIs. Atualizar as dependências
Python com `python -m pip install -r requirements.txt` (Pillow foi acrescentado).

Claude Code permanece integrado. ChatGPT/Codex e Gemini entram somente no protocolo
1.1; Codex continua bloqueado por `tools=restricted`. Gemini funciona com dublê,
mas a revisão apontou duas pendências para uso real: garantir Login with Google e
rejeitar contribuição de modelo diferente. Ambas retornam `unknown`, sem revisão
automática. O código das integrações não foi alterado pelo Codex.

A captura guarda imagens localmente; o gateway 1.1 continua recebendo apenas texto.
Não há análise visual pronta. A integração permanece em revisão para o Claude
corrigir os pontos do gateway antes da incorporação na main.

Referências atuais: [revisão](REVISAO_CLIS_2026_11_10.md),
[contrato de capturas](CONTRATO_CAPTURAS.md),
[prompt Claude](PROMPT_CLAUDE_CLIS.md), [prompt Gemini](PROMPT_GEMINI_CAPTURAS.md).

## Base já integrada

Atualizado em 9/11/2026. Base integrada: `main`.

As PRs #4 → #5 → #1 foram integradas nessa ordem, sem conflitos. O gateway vem de
`dad0696`; a interface do Gemini inclui `638e681` (tema claro Yuki). O primeiro
início com as três frentes já funcionou no Windows do usuário, sem geração.

## Entrega atual

- C-1: códigos sanitizados do gateway preservados e gravados por etapa. Somente
  pares código/status conhecidos; mensagens livres não são propagadas.
- C-2: fila SQLite, worker exclusivo, IDs estáveis, gravação antes da chamada,
  recuperação conservadora e acompanhamento pelo painel/histórico. Confirmação
  explícita para executar; `resume` apenas após falha anterior à geração.
- `gateway_busy` e `request_in_progress` aguardam com o mesmo corpo/ID. Timeout,
  transporte incerto e interrupção em voo nunca repetem. Cota/autenticação após
  início e validação são erros finais. `unknown` preserva saída incompleta sem revisão.
- C-3: `scripts/start-browser.ps1` em UTF-8 com BOM, sem alterar parâmetros.
- C-4: grupo de botões de seleção de abas, com `aria-pressed` e setas/Home/End;
  foco preservado durante atualização. As páginas são WebContents separados,
  portanto não se anuncia um tablist com tabpanels DOM inexistentes. O visual do
  Gemini e os botões de fechar permanecem. Verificação axe ARIA passou.
- C-5: merges concluídos; schemas 1.1 do gateway importam os do backend. O caminho
  antigo de importação permanece como compatibilidade, sem duplicar os modelos.
- C-6: sem mudança no timeout de 20 s da ponte; o primeiro catálogo funcionou.

A execução usa `tasks.enqueue`/`tasks.resume`, não `tasks.execute`. Páginas externas
continuam sem acesso à ponte. A extensão Firefox mantém planejamento. Fechar o
painel mantém o worker; fechar o aplicativo encerra seu serviço. Na reabertura,
trabalho em fila continua e chamadas interrompidas ficam incertas.

## Validação e limites

- Linux: testes de backend/fila/ponte, gateway, frontend e políticas Electron;
  build, teste gráfico Chromium e integração por HTTP com CLI simulado.
- Testes da fila cobrem IDs/corpos repetidos, reinício, exclusão de segundo worker,
  falha ao gravar resultado, bloqueio anterior à geração, timeout, cota e revisão.
- HTTP real: dublê nos modos `success`, `no_stop_reason`, `auth_error`, `usage_limit`
  e `sleep`; respectivamente concluída, incompleta, autenticação, cota e timeout.
- Electron: confirmação desmarcada, execução simulada, painel oculto, resultado
  acompanhado, teclado e ARIA, captura/rascunhos e persistência.
- Nenhuma conta real nem cota de IA usada nesta entrega. Testes gráficos Linux com
  Xvfb e `IA_BBARU_TEST_NO_SANDBOX=1`: não validam a sandbox do sistema operacional.
- A versão nova da fila/interface ainda precisa do teste Windows. A execução real
  pelo painel e revisão com dois modelos ainda não foram verificadas na conta do usuário.

## Próximo teste no Windows

Com o aplicativo fechado e o checkout limpo, na pasta `W:\Projeto\Ia-bbaru-inicio`:

```powershell
git fetch origin
git merge --no-edit origin/main
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Abra com `.\integrations\scripts\iniciar-ia-bbaru.ps1`. Planejar continua sem
geração; executar exige a confirmação separada no diálogo e pode consumir cota.

Guias: [execução durável](EXECUCAO_DURAVEL.md),
[Windows](TESTAR_NAVEGADOR_CHROMIUM.md),
[Claude](PROMPT_CLAUDE_EXECUCAO.md), [Gemini](PROMPT_GEMINI_EXECUCAO.md).

## Pendências de produto

- Importação automática NotebookLM e projetos dos outros aplicativos; hoje a
  captura e seleção de materiais são explícitas. Abas logadas não conectam agentes.
- Novos transportes oficiais, instalador assinado e atualização automática.
- As sub-abas visuais do Gemini reutilizam a mesma WebContents e não restauram
  histórico/estado de página independente. O botão “minimizar” apenas oculta o
  painel. Alinhar rótulos e comportamento com o runtime antes de anunciar essas
  funções como completas; detalhes no prompt do Gemini.
- Aplicação local, sem login multiusuário nem deployment público.

Revisões anteriores permanecem como histórico. Código no GitHub; bancos, sessões,
segredos e materiais pessoais fora do versionamento.
