# Revisão da entrega de integrações do Claude

**Atualização de 9/11/2026:** as correções e o gateway 1.1 foram confirmados em
`452d2fd`, combinado com o backend `d593e76`. Veja a
[revisão atual](REVISAO_INTEGRADA_2026_11_09.md) e o
[prompt de validação no Windows](PROMPT_CLAUDE_VALIDACAO.md).
Os achados abaixo são históricos e permanecem vinculados ao commit original.

Repositório: https://github.com/Bbarusu/Ia-bbaru — PR [#1](https://github.com/Bbarusu/Ia-bbaru/pull/1).
Revisão em 6 de novembro de 2026 (horário de Brasília) do commit
`16d094d0c1b84cc9a2a3216c62e4bf885c061861`.

**A estrutura segue a divisão de responsabilidades. Recomendo corrigir os três
pontos abaixo antes de integrar a execução ao aplicativo.** A branch do Claude
foi inspecionada separadamente; não foi alterada nem incorporada nesta entrega.

## 1. P1 — preservar a deduplicação após iniciar o provedor

[app.py, tratamento de falhas](https://github.com/Bbarusu/Ia-bbaru/blob/16d094d0c1b84cc9a2a3216c62e4bf885c061861/integrations/app.py#L103)
libera o `request_id` quando o erro é classificado como cota/autenticação, mesmo
após `adapter.generate` ter iniciado o processo. A classificação vem de texto de
erro; isso não prova que nenhuma geração ou consumo ocorreu. Um novo pedido com
esse ID pode invocar o provedor novamente, contrariando a proteção contra repetição.

Reprodução com o próprio `FakeRunner` da PR: duas chamadas com o mesmo corpo e
`FAKE_CLAUDE_MODE=usage_limit` retornam 429, mas `runner.generations` chega a **2**.
Não houve uso real de conta.

Correção sugerida: liberar a reserva apenas no caminho `NotStarted`, quando há
prova de que o processo não iniciou. Depois de iniciar, armazenar a falha ou um
resultado incerto e responder à repetição sem executar novamente. Cobrir cota e
falha de autenticação após início com testes de deduplicação.

## 2. P2 — motivo de término ausente não comprova conclusão

[_finish_reason](https://github.com/Bbarusu/Ia-bbaru/blob/16d094d0c1b84cc9a2a3216c62e4bf885c061861/integrations/adapters/claude_code.py#L267)
retorna `stop` quando não há metadado de parada e a contagem não prova truncamento.
A reprodução `_finish_reason({}, None, 1024)` retorna `stop`. O backend interpreta
isso como resposta concluída e pode enviá-la à revisão por outro agente. Contagem
abaixo de um teto configurado tampouco prova que o provedor terminou naturalmente.

Correção sugerida: validar uma indicação documentada de término ou evoluir o
contrato para término desconhecido/incompleto, propagando-o para backend e UI.
Não fabricar `length` como explicação quando o motivo é desconhecido. Testar ausência
de usage, ausência de stop_reason e truncamento reportado pelo provedor.

## 3. P2 — capacidade de limite deve chegar ao consumidor

O adaptador declara `output_limit: best_effort` no endpoint experimental
`/v1/connections`, mas o backend atual consome somente `/v1/models` pelo contrato v1.
`IA_BBARU_CLAUDE_CODE_ACCEPT_UNENFORCED_OUTPUT_LIMIT=1` torna modelos disponíveis
nesse contrato apesar de o CLI não garantir `max_output_tokens`.

O bloqueio por padrão e a documentação da limitação são adequados. Porém, o aceite
local da flag não comunica a diferença ao planejador nem ao usuário do painel.
A integração final não pode apresentar um teto garantido quando há apenas uma
instrução no prompt e uma verificação posterior.

Correção sugerida: PR de evolução por capacidades, coordenando schema, catálogo,
backend e frontend; manter bloqueado o fluxo incompatível até essa evolução.
A UI deve explicar limite indicativo, término e cancelamento local. Testar que um
cliente v1 não aceita inadvertidamente um modelo incompatível.

A PR já inclui `integrations/docs/PROPOSTA_CAPACIDADES.md`, que identifica a
incompatibilidade com consumidores estritos. A proposta é um bom ponto de partida;
o tratamento sugerido de `unknown` como `stop` precisa ser ajustado conforme o
item 2. A alteração ainda não foi aplicada aos contratos compartilhados.

## O que está adequado e o que os testes comprovam

- Serviço separado em `integrations/`, sem duplicar projetos, banco ou frontend.
- Adaptador do CLI oficial, sem extrair cookies nem arquivos privados de login.
- Ferramentas/MCP desativados, ambiente de execução restrito, timeout com término
  da árvore de processos e IDs de modelos configurados explicitamente.
- Armazenamento de deduplicação, erros normalizados e fixture de CLI separada.
- Documentação distingue o limite indicativo e o bloqueio padrão.

Comando executado na worktree da PR:

```sh
python -m unittest discover -s tests/integrations -v
```

**34 testes: 33 passaram e 1 foi ignorado** (teste opcional com conta real).
Foram feitas também as duas reproduções descritas acima. Esses resultados não
validam elegibilidade da assinatura, login, formato real de saída do CLI instalado
ou consumo real. O teste com a conta continua separado da instalação e depende do
fluxo oficial descrito no briefing.

## Próxima entrega esperada do Claude

Corrigir os itens 1–2, propor a evolução do contrato do item 3 e atualizar os testes
correspondentes na própria branch. Codex implementou a base de `frontend/` e
`extension/`; o usuário pediu nova tentativa com Gemini para evoluir a interface.
As alterações de contrato devem ser coordenadas com Codex e com essa implementação.

O usuário está executando testes com Claude. Esta revisão não afirma que versões
posteriores ao commit indicado ainda apresentem os mesmos problemas.
