# Responsabilidades dos colaboradores

Decisão solicitada pelo usuário em 11/11/2026, após conflito no adaptador Claude.
Esta divisão substitui os escopos amplos anteriores dos prompts e passagens.
O produto continua integrado exclusivamente com Claude Code; os nomes dos
colaboradores não são provedores disponíveis no aplicativo.

## Responsáveis

| Frente | Responsável | Limite |
| --- | --- | --- |
| Backend, conversas, contexto, fila, persistência e políticas | Codex | backend/, native_host/ e testes correspondentes |
| Contratos e integração do gateway | Codex | Schemas dos dois lados, OpenAPI, servidor, configuração, deduplicação, códigos de erro, diagnósticos e comandos |
| Electron, IPC, capturas, inicialização e validação integrada | Codex | Runtime desktop, scripts e testes de integração/UI |
| Experiência visual, chat lateral e mensagens da interface | Gemini | frontend/ e desktop/ui/; dependências de IPC/backend são documentadas |
| Compatibilidade e comportamento da CLI oficial Claude | Claude Code | Análise técnica e relatório próprio; código somente em tarefa transferida explicitamente |
| Integração final, merges e estado geral | Codex | codex/browser-capture-clis, PR #7, docs/STATUS.md e documentação comum |

Codex não implementará o novo frontend em paralelo ao Gemini. Ajustes pequenos de
interface indispensáveis a um contrato serão registrados para Gemini incorporá-los.
Gemini não substituirá backend/runtime por mocks em produção. Cada frente mantém
seus testes coerentes com o escopo atribuído.

## Reserva atual: provider_error

Responsável único: **Codex**. Inclui adaptador Claude, runner, parser, modelos,
classificação de erros, diagnóstico, fixtures e testes envolvidos. Claude não
abre uma segunda correção desses arquivos enquanto esta reserva existir.
Seu trabalho até c22beb0 já foi integrado em 875d4b4; não reaplicar patches antigos.
A geração real ainda depende do teste Windows.

Tarefa atual de Claude: consolidar evidências existentes e pendências em
**integrations/docs/ANALISE_CLI_CLAUDE.md**, único arquivo autorizado a editar.
Pode ler o repositório e executar testes existentes com dublês e geração real
desabilitada. Não alterar código, testes, configuração ou documentação comum.

## Transferência de implementação

A mudança de responsável exige pedido explícito do usuário ou registro de tarefa
neste documento pelo Codex: objetivo, responsável, commit base, lista fechada de
arquivos e critério de conclusão. Um achado ou sugestão não transfere o escopo.

Uma futura tarefa do Claude poderá incluir adaptador/runner/modelos e testes
específicos. Durante essa tarefa Codex deixa de editar esses arquivos e recebe a
entrega para revisão/integração. Contratos, servidor, fila e persistência continuam
com Codex, salvo transferência explícita. Ao concluir, registrar commit, evidências
e dependências antes de liberar outra tarefa nos mesmos arquivos. A regra não
exige nova autorização do usuário para cada edição dentro de uma tarefa atribuída.

## Fluxo de entrega

- Cada colaborador usa sua branch. Só Codex atualiza a branch de integração ou
  integra PRs. Sem force push ou descarte de alterações locais.
- Antes de começar, verificar estado local e base. Em conflito, interromper a
  edição nos arquivos afetados e informar os caminhos; não escolher um lado
  inteiro nem commitar marcadores de merge.
- Dependências fora do escopo vão para documento com problema, evidência,
  arquivos envolvidos, proposta e responsável. Não criar contrato alternativo,
  segunda fila ou estrutura de chat para contornar a dependência.
- Claude e Gemini não enviam roteiros concorrentes de instalação, merges ou
  geração real ao usuário. Codex consolida a validação Windows. Distinguir
  dublês, inspeção de pacote e execução real nas evidências.
- Não iniciar geração real, comprar créditos ou alterar a conta como parte de
  teste automático. Não registrar credenciais ou conteúdo pessoal.

Prompt vigente: [PROMPT_CLAUDE_ESCOPO.md](PROMPT_CLAUDE_ESCOPO.md).
