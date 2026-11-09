# Estado do Ia-bbaru / Yuki

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
