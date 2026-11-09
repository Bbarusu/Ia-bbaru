# Execução durável — C-1 / C-2

O serviço local do navegador ativa um worker por banco SQLite. Para iniciar o
backend separadamente, definir `LAUNCHER_DURABLE_EXECUTION=1`.

Planejar não gera respostas. `POST /v1/tasks/{id}/enqueue`, autenticado, requer
`{"confirmed": true}` e retorna 202. `GET /v1/tasks/{id}` acompanha o resultado.
A ponte oferece `tasks.enqueue` e `tasks.resume`; `tasks.execute` continua proibido.
O renderer nunca chama o gateway diretamente. A rota HTTP síncrona antiga é
recusada quando o worker está ativo.

Cada etapa grava o corpo e `<task_id>:<índice>` antes da chamada. Resultado e avanço
de etapa são gravados juntos. Apenas `gateway_busy` e `request_in_progress` são
repetidos automaticamente, com espera crescente até 30 segundos, mesmo ID e corpo.
Timeout, resposta inválida, falha de transporte e interrupção durante uma chamada
produzem estado `uncertain`, sem retomada. Erros finais de cota/autenticação após
início, validação e 502 não são repetidos. `unknown` e `length` preservam a saída
como `incomplete` e impedem a revisão.

Falha no catálogo ou um código conhecido anterior à geração produz `blocked`.
Depois de corrigir a configuração/login, o usuário pode confirmar `resume`.
Capacidades alteradas ou modelo removido exigem novo planejamento. Motivos livres
do catálogo e mensagens livres do gateway não são propagados como códigos.

Fechar o painel não interrompe o worker. Fechar o aplicativo encerra seu serviço:
trabalho em fila permanece no SQLite; chamadas interrompidas ficam incertas na
próxima abertura. Não há execução garantida com o aplicativo fechado. Uma trava
do sistema operacional impede dois workers duráveis no mesmo banco. Não iniciar
um backend legado sobre o banco do navegador.

O cliente aceita somente pares código/status HTTP conhecidos do gateway. Nunca
repassa `message` ou `next_action`. Registra código e status na etapa. Os corpos
persistidos para repetição ficam fora das respostas públicas da API.

Validação automatizada usa fixtures, sem conta real. Executar:
`python -m unittest discover -s tests -v`.

Integração visual sobre a entrega Gemini: manter componentes, cores e layout;
acrescentar confirmação de consumo, acompanhamento e retomada apenas de `blocked`.
O ajuste ARIA de `#tabs` fica com o Codex na integração, preservando o visual.
`start-browser.ps1` mantém nome e parâmetros e passa a usar UTF-8 com BOM (C-3).
