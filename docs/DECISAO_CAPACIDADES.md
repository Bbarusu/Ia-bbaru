# Decisão técnica: contrato de capacidades do gateway

## Escopo e estado

Direção adotada para a próxima implementação do Ia-bbaru, a partir de
[`integrations/docs/PROPOSTA_CAPACIDADES.md`](https://github.com/Bbarusu/Ia-bbaru/blob/f134092/integrations/docs/PROPOSTA_CAPACIDADES.md).
A proposta foi conferida no commit `f134092` da branch do Claude e permanece igual
à versão anteriormente revisada. Os registros de teste com conta real não alteram
a semântica do contrato nem garantem o teto de saída em todas as chamadas.

**Implementado no backend da branch `codex/frontend-firefox`, com schemas 1.1
comparados ao gateway da PR #1 (`b4b2dcc`).** A versão 1 continua sendo o padrão
de configuração. Veja [configuração e testes](TESTAR_GATEWAY_1_1.md). O frontend
ainda precisa apresentar as capacidades e o aceite; a execução pela ponte segue
desativada.

## 1. Versões explícitas, sem quebrar o consumidor existente

Preservar os schemas e endpoints atuais `/v1/models` e `/v1/generate` com
`protocol_version: "1"`. Não inserir novos campos nesses objetos enquanto os
consumidores estritos atuais precisarem funcionar.

A próxima versão terá schemas próprios e endpoints `/v1.1/models` e
`/v1.1/generate`, com `protocol_version: "1.1"`. Separar as rotas torna a seleção
explícita inclusive no GET do catálogo. Não depender de campos opcionais que
clientes com `extra="forbid"` rejeitam.

O backend selecionará a versão por configuração local
`GATEWAY_PROTOCOL_VERSION=1|1.1`, mantendo `1` como padrão de compatibilidade.
Uma configuração 1.1 incompatível com o gateway deve produzir erro de integração;
não fazer fallback automático para outro transporte ou nova chamada de geração.
Resposta com versão diferente da solicitada deve ser rejeitada.

Os modelos legados continuam sob as garantias do contrato 1. Ausência de capacidades
em um objeto 1.1 será erro de validação, não evidência de limite garantido.

## 2. Capacidades explícitas no catálogo 1.1

Cada perfil 1.1 deve informar:

- `output_limit`: `enforced`, `best_effort` ou `none`.
- `cancellation`: `provider`, `local_process_only` ou `none`.
- `finish_reason`: `reported` ou `inferred`.
- `billing`: `api_key`, `subscription_quota` ou `unknown`.
- `streaming`: booleano.
- `tools`: `disabled` ou `restricted`.
- `unavailable_reason`: código estável ou null, fora do objeto `capabilities`,
  conforme a proposta original.

`available` representa disponibilidade do transporte/modelo, não consentimento
para uma tarefa. Um modelo com limite indicativo pode estar disponível e ainda
assim não ser elegível para um pedido sem aceite da limitação.

`max_output_tokens` será interpretado junto com `output_limit`: teto exigível quando
`enforced`, objetivo indicativo quando `best_effort`, sem controle correspondente
quando `none`. Nenhum deles deve ser apresentado como orçamento monetário.

Nesta etapa, o backend só seleciona perfis com `tools: disabled`: a execução atual
não possui política de autorização de ferramentas. Declarar uma capacidade não
significa que o consumidor implementa ou autoriza seu uso.

## 3. Aceite por tarefa e persistência

Adicionar à entrada de tarefa `allow_unenforced_output_limit`, padrão `false`.
Só selecionar um modelo `best_effort`/`none` se esse campo estiver explicitamente
ativado. Um modelo escolhido explicitamente, mas incompatível com a política da
tarefa, deve ser recusado com motivo claro, sem troca silenciosa de provedor.

Persistir o aceite e uma cópia das capacidades relevantes no plano de cada etapa.
A requisição 1.1 de geração também deve carregar esse aceite; o gateway precisa
validá-lo antes de iniciar o provedor. Tarefas antigas não herdam aceites novos:
na ausência do campo, considerar `false`.

Antes da execução, confirmar disponibilidade/capacidades do modelo. Se as garantias
piorarem em relação ao plano, interromper antes da geração e exigir novo planejamento,
sem alterar o plano ou substituir o agente silenciosamente.

A flag experimental `IA_BBARU_CLAUDE_CODE_ACCEPT_UNENFORCED_OUTPUT_LIMIT` não pode
servir como substituta do aceite da tarefa no fluxo 1.1. Seu tratamento no legado
deve ser documentado pelo gateway; ela não será ativada pela instalação do app.

## 4. Conclusão desconhecida não equivale a sucesso

A resposta 1.1 admite `finish_reason: stop|length|unknown`.

| Valor | Tratamento no backend |
| --- | --- |
| `stop` | Conclusão confirmada; pode avançar para a revisão planejada |
| `length` | Guardar resposta parcial, marcar tarefa `incomplete` e não iniciar a revisão |
| `unknown` | Guardar resposta, marcar tarefa `incomplete` com motivo `completion_unconfirmed` e não iniciar a revisão |

Não converter ausência de metadados em `stop`. Não declarar `length` sem evidência
correspondente. A saída desconhecida pode ser útil e deve continuar disponível
para leitura, identificada como conclusão não confirmada.

Não repetir automaticamente a tarefa. O estado final da geração é diferente da
certeza de consumo de cota: matar um processo local ou não receber resposta não
prova ausência de execução remota.

## 5. Diagnóstico e interface

`/v1/connections` permanece experimental até receber um schema estável e testes.
A primeira evolução não exige que todos os provedores implementem esse diagnóstico;
o catálogo 1.1 precisa fornecer as informações essenciais de disponibilidade.

Gemini deve exibir modalidade de uso, tipo de limite e motivo de indisponibilidade
quando os campos estiverem disponíveis no backend. Não confundir assinatura com
chave de API nem cancelamento local com interrupção garantida no provedor.
O aceite na interface não inicia uma geração.

O protocolo Native Messaging continua recusando `tasks.execute` até a execução
durável ser implementada. O suporte a capacidades não remove essa dependência.

## 6. Ordem de implementação e critérios de aceite

1. **Codex:** schemas separados, seleção explícita de versão no cliente de gateway,
   política de roteamento, persistência do aceite/capacidades, tratamento de
   `unknown`, OpenAPI e testes do backend. Documentar quando o contrato estiver
   implementado e disponível para integração.
2. **Claude:** endpoints/schemas 1.1, capacidades reais do adaptador, validação do
   aceite e término `unknown` quando não houver evidência. Preservar o legado e
   corrigir a deduplicação após o processo iniciar, conforme a revisão existente.
3. **Gemini:** consumir o contrato implementado, apresentar capacidades e aceite,
   e diferenciar resposta incompleta de conclusão confirmada.

Os testes devem cobrir: consumidor legado; versão incompatível; capacidades
obrigatórias no 1.1; modelo sem teto rejeitado por padrão e aceito por tarefa;
aceite persistido e encaminhado; mudanças de capacidade entre plano e execução;
`unknown` preservando a saída sem chamar o revisor; `length` sem revisão; ausência
de repetição automática após resultado incerto; ferramentas não autorizadas.

Usar fixtures explícitas para esses testes. Testes com conta real continuam
separados: não são necessários para validar os schemas e a política de roteamento.
