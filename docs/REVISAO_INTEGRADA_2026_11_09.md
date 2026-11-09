# Revisão das entregas antes dos testes práticos

Repositório: https://github.com/Bbarusu/Ia-bbaru. Revisão em 9/11/2026.

| Frente | Branch / commit revisado |
| --- | --- |
| Claude, PR #1 | `claude/vibrant-meitner-ksbzgf` / `452d2fd50437b382a3d7a91f01f0733a7dbe4ae5` |
| Gemini, PR #3 | `gemini/frontend-v2` / `9814424727d824fc77bc4ce57eef56aadd831047` |
| Backend consumidor | `codex/frontend-firefox` / `d593e76dee419b44c649bf3f1c1ab88b371ce506` |

**Parecer:** o gateway está compatível com o backend 1.1 nos testes executados.
O frontend corrigiu os dois achados originais, mas ainda precisa integrar o aceite
1.1 e tratar a preservação de edições e de capturas durante operações assíncronas.
O teste prático pela API pode avançar após a validação local no Windows; o painel
ainda não oferece um fluxo completo de planejamento com o Claude em 1.1.

As branches dos autores foram examinadas em worktrees separadas. Esta revisão
não as altera nem faz merge. Nenhuma conta real foi utilizada.

## Claude: correções confirmadas

- Deduplicação: falhas de autenticação/cota depois do início ficam armazenadas;
  repetir o pedido não chama novamente o provedor. Só `NotStarted` libera o ID.
- Término: ausência de `stop_reason` produz `unknown` em 1.1, com saída preservada.
  No legado, produz erro `completion_unconfirmed`, sem fabricar sucesso.
- Aceite: obrigatório antes de gerar em 1.1, independente da flag do legado.
- Catálogo: capacidades e motivo de indisponibilidade presentes no contrato 1.1.
- Schemas: `components` e `paths` do OpenAPI 1.1 do gateway são iguais aos do backend.
- Integração HTTP com CLI de teste: `unknown` resulta em
  `incomplete/completion_unconfirmed`, uma chamada e nenhuma revisão; término
  confirmado permite a revisão, com duas chamadas. Repetição não gera novamente.

Não identifiquei um novo bloqueio no gateway nos caminhos inspecionados. Ainda falta
executar o backend atual e o fluxo completo 1.1 no Windows do usuário. O registro
de geração real direta do gateway em `452d2fd` é evidência reportada pelo Claude;
não foi repetido nesta revisão nem substitui o teste com o novo backend.

Os schemas Python 1.1 continuam duplicados nas duas frentes, mas são equivalentes.
Consolidar os imports após combinar as branches é manutenção recomendável, não
condição para os testes práticos. Não alterar o contrato para contornar a UI.

## Gemini: correções anteriores confirmadas

- Segunda captura com modal aberto: agora título, texto e URL B são salvos juntos.
- Lista de projetos: usa `ul`/`li`, com `aria-current` no botão selecionado.
- Os novos testes de navegador exercitam captura dupla e edição manual.
- Build e testes passam; contraste, foco e layouts inspecionados continuam adequados.

O teste de edição manual, porém, considera correto apagar o rascunho. Ele comprova
coerência da nova captura, mas não protege o trabalho ainda não salvo.

### G1 — P1: planejamento 1.1 não envia o aceite

Local: [App.tsx:350](https://github.com/Bbarusu/Ia-bbaru/blob/9814424727d824fc77bc4ce57eef56aadd831047/frontend/src/App.tsx#L350),
`types.ts`, `AgentsSection.tsx` e `ConnectionsSection.tsx`.

O catálogo já pode retornar um modelo disponível com `output_limit: best_effort`,
mas a UI ignora versão/capacidades, não oferece aceite e omite
`allow_unenforced_output_limit` em `tasks.plan`. Com o backend atual, selecionar
esse modelo e clicar em Criar plano resulta em `http_422`, exibido pela ponte como
“Confira os campos e os limites de contexto.” O mesmo pedido pela API, com aceite
booleano `true`, retorna 201 e persiste o aceite.

Reprodução em Firefox com frontend `9814424`, backend/ponte `d593e76` reais e catálogo
1.1 de teste. Nenhuma geração ocorre. Esta é uma etapa de integração pendente:
a branch do Gemini inclui a base `80d4e7e`, anterior à implementação `d593e76`.

Correção: atualizar a base e consumir o contrato implementado. Apresentar capacidades
em linguagem simples e oferecer aceite por tarefa, inicialmente desmarcado.
Enviar o booleano em `task`; não usar a flag legada como substituto. Distinguir
disponibilidade de elegibilidade e explicar a limitação antes de submeter o plano.
Preservar compatibilidade com catálogos 1 e o bloqueio de execução na ponte.

### G2 — P2: nova captura descarta edições não salvas

Local: [App.tsx:197](https://github.com/Bbarusu/Ia-bbaru/blob/9814424727d824fc77bc4ce57eef56aadd831047/frontend/src/App.tsx#L197),
[chave do modal:673](https://github.com/Bbarusu/Ia-bbaru/blob/9814424727d824fc77bc4ce57eef56aadd831047/frontend/src/App.tsx#L673)
e `SourceModal.tsx:43–55`.

Reprodução: abrir Adicionar texto, digitar título/conteúdo e receber uma captura.
O formulário é remontado pela nova chave e o rascunho desaparece, sem confirmação,
opção de recuperá-lo ou salvamento. O mesmo mecanismo substitui edições numa captura
anterior. Reproduzido no navegador.

Correção: preservar o formulário alterado e manter a captura nova pendente, ou
oferecer uma escolha explícita antes de substituir. Título, conteúdo, origem,
projeto escolhido e identidade devem permanecer coerentes. O teste atual em
`scripts/verify_ui.py` precisa exigir preservação ou descarte explícito, em vez de
afirmar apenas que o rascunho sumiu.

### G3 — P2: término do salvamento A oculta uma captura B recebida depois

Local: [App.tsx:296–303](https://github.com/Bbarusu/Ia-bbaru/blob/9814424727d824fc77bc4ce57eef56aadd831047/frontend/src/App.tsx#L296).

Reprodução: atrasar a resposta de `sources.create` para A; enquanto aguarda, receber
B; completar A. O backend salva A corretamente, mas a conclusão executa
`setModal(null)` e `setCapture(null)` sem verificar se o formulário já representa B.
B desaparece do painel. O armazenamento da extensão ainda conserva B, porque
`capture.clear` compara IDs; portanto, não é exclusão da captura persistida.

Reproduzido com resposta da ponte adiada e simulação de `capture.clear` que respeita
IDs, como o background real. A simulação existente em `verify_ui.py` limpa a captura
indiscriminadamente e não testa esta concorrência.

Correção: encerrar/limpar apenas o formulário da operação concluída. Se houver uma
captura mais recente, mantê-la visível ou pendente com uma ação acessível no painel,
sem exigir recarregamento. Cobrir também a chegada de B durante o descarte de A.

## Verificações e limites

| Verificação nesta rodada | Resultado |
| --- | --- |
| Suíte do gateway com o backend atual | 50 passaram; 1 teste real ignorado |
| Componentes/rotas OpenAPI 1.1 das duas frentes | Iguais |
| `scripts/verify_gateway_v11.py` com gateway `452d2fd` | Passou, HTTP real e CLI de teste |
| `npm test` na branch do Gemini | 11 passaram |
| `npm run build` na branch do Gemini | Passou |
| `scripts/verify_ui.py` entregue pelo Gemini | Passou em Firefox |
| Reprodução independente da captura dupla | Salva B coerentemente |
| Foco após fechar modais de projeto/material | Retorna ao acionador, por Esc e botão |
| 4 telas × 6 larguras, 320 a 1440 px | 24 combinações sem rolagem horizontal |
| axe-core WCAG A/AA, área de trabalho ampla | Nenhuma violação nessa tela |
| Planejamento UI com catálogo 1.1 e backend atual | Falhou sem aceite; controle com aceite retorna 201 |
| Captura durante edição / salvamento | G2 e G3 reproduzidos |

Firefox/Gecko real em Linux; APIs WebExtensions simuladas e bancos temporários.
O teste cruzado do planejamento usa um catálogo explícito de teste. Não comprova
instalação nativa no Windows nem autenticação/consumo na conta real. O axe não é
uma auditoria de acessibilidade de todos os estados. Os 48 testes do backend
registrados na entrega `d593e76` não foram repetidos nesta rodada, pois o código
do backend não mudou.

Evidências: [JSON da revisão](reviews/integrated-2026-11-09.json).

Prompts preparados para o usuário encaminhar:
[Gemini](PROMPT_GEMINI_PENDENCIAS.md) e [Claude](PROMPT_CLAUDE_VALIDACAO.md).
