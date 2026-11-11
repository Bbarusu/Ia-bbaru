# Chat lateral com contexto — ajustes solicitados

Registro de 11/11/2026, baseado nas capturas enviadas pelo usuário.
Base: `codex/browser-capture-clis`, PR #7, repositório Bbarusu/Ia-bbaru.
**Estado: especificação para implementação.** Esta entrega documental não altera
o funcionamento do navegador. Complementa DIRECAO_CLAUDE_ONLY.md e passa a orientar
a próxima etapa dos prompts de frontend e integração.

## Problema observado

A interface atual exige entender projetos, materiais, planos e execução para
conversar. Na captura, o pedido “Revise” termina em “Falhou”, com `provider_error`.
Contrato, limites, cancelamento, tentativas e explicação do roteamento ocupam o
espaço principal; a pessoa não recebe uma resposta nem orientação suficiente.
O modal interrompe a navegação. Elementos decorativos sobre o conteúdo reduzem
a legibilidade. Isso também aparece na hierarquia de TaskViewModal.tsx.

Atlas e Edge são referências de interação: página e conversa lado a lado,
entrada evidente na barra do navegador, histórico e campo de mensagem sempre
acessível. Não são evidência de capacidades que nosso produto já tenha.
O shell já tem botão e painel lateral; devemos reaproveitá-los, substituindo
o fluxo central de planos por conversa, sem construir um segundo painel paralelo.

## Experiência desejada

1. **Abrir:** um botão permanente “Conversar com Claude” na barra principal abre
   o painel direito e foca o campo de mensagem. Painel redimensionável, fechamento
   claro e atalho documentado sem conflito. A página continua utilizável.
2. **Conversar:** histórico no corpo, resposta como conteúdo principal e compositor
   fixo no rodapé. Enter envia; Shift+Enter quebra linha. Novo chat, histórico,
   copiar resposta e anexar ficam acessíveis. Fechar e reabrir preserva a conversa
   e o rascunho. Não abrir modal para cada pedido ou resposta.
3. **Enviar:** uma ação “Enviar” conduz planejamento e execução internamente,
   depois da configuração/aceite inicial aplicável. Projetos e biblioteca são
   organização opcional: nenhum projeto/material manual é pré-requisito de chat.
   Criar vínculos internos sem duplicar os dados existentes.
4. **Entender o contexto:** mostrar “Usar página atual” e, quando incluída,
   um chip com título da página, prévia do texto e opção de remover. Ações
   “Resumir página” e “Explicar seleção” capturam o conteúdo correspondente e
   deixam visível o que será enviado. Abrir o painel não inicia uma geração.
5. **Continuar:** perguntas como “explique melhor o segundo ponto” recebem o
   histórico pertinente da conversa e suas fontes. Manter a conversa ao navegar;
   não substituir silenciosamente o contexto de mensagens anteriores.
6. **Escolher modelo:** seletor discreto, somente catálogo Claude configurado,
   escolha manual e opção automática com critérios explicáveis. Mostrar modelo
   utilizado junto da resposta. Revisão por outro modelo é opção avançada,
   desligada no chat simples. Não anunciar ranking universal ou habilitar Fable
   com possíveis créditos extras por conta própria.
7. **Ler com clareza:** estado vazio com sugestões pertinentes, resposta legível,
   fontes próximas da resposta e detalhes técnicos recolhidos. Remover partículas
   sobre textos/controles; preservar identidade Yuki/Kinfo, cores e edições do
   usuário que não prejudiquem leitura, foco e contraste. Sem novas sub-abas.

Fluxo de referência: abrir uma página → abrir Claude → escolher “Resumir página”
→ conferir o chip de contexto → enviar → ler a resposta no painel → perguntar
sobre um ponto da resposta. O chat também funciona sem anexar página alguma.

## Contexto real e continuidade

- Capturar texto da aba ativa por ação explícita. Seleção escolhida tem escopo
  próprio; não anexar a página inteira ou outras abas sem indicação do usuário.
  Não tratar somente URL/título como se fossem o conteúdo lido.
- Associar cada captura a identidade do documento, URL, título e instante.
  Detectar navegação durante a captura. Ao mudar de aba/página, indicar contexto
  anterior e oferecer atualização; não enviar material antigo como “página atual”.
- Quando a captura falhar ou a página não for legível, explicar a limitação e
  oferecer selecionar/colar texto. Nunca fabricar um resumo para preencher o chat.
- Respeitar limites incluindo histórico, instrução e fontes. Se não couber,
  informar e permitir reduzir o contexto; não cortar silenciosamente trechos.
  Referências devem apontar para fontes realmente usadas, não citações inventadas.
- Conteúdo da página é dado não confiável, nunca instrução que pode liberar
  ferramentas, mudar o modelo autorizado ou executar comandos.
- Prints e imagens continuam armazenados localmente. Mostrar que análise visual
  ainda não está disponível enquanto o contrato correspondente não for entregue.

## Estados, erros e aceite

- Mostrar atividade real: preparando pedido, aguardando Claude, resposta recebida.
  “Lendo página” somente durante captura; não simular progresso ou digitação.
  O contrato atual declara streaming=false; exibir resposta completa ao chegar.
- Contrato, limite numérico, roteamento e tentativas ficam em “Detalhes”. Avisos
  que afetam decisão (consumo de cota, limite indicativo, término não confirmado,
  eventual crédito extra) permanecem claros no momento pertinente.
- Proposta de simplificação do aceite: configuração inicial explícita e revogável,
  com escopo e versão registrados; cada envio registra a autorização e copia o
  aceite aplicável para a tarefa. Ausência de aceite continua false. Mudança de
  garantias/modelo que extrapole o escopo exige novo aceite. Coordenar contrato
  antes de implementar; não marcar confirmed=true indiscriminadamente no frontend.
- Erro aparece como mensagem na conversa, preservando rascunho, pedido e fontes.
  Para provider_error sem causa mais específica: “O Claude não conseguiu responder
  a este pedido.” Oferecer detalhes sanitizados para diagnóstico, sem sugerir
  login/cota/limite como causa não comprovada. Código técnico fica secundário.
- Se a causa for conhecida, mostrar ação correspondente: reconectar conta,
  selecionar modelo disponível ou reduzir contexto. Não oferecer repetição cega.
  Resultado incerto consulta o estado; unknown preserva saída como incompleta,
  sem revisão automática e sem repetir a geração.
- Interromper, quando suportado, precisa refletir cancelamento apenas local;
  não prometer interrupção remota ou restituição de cota.

## Falha real pendente — prioridade P0

A captura mostra “Revise”, Claude Code (sonnet), um material, uma tentativa,
limite indicativo de 128 tokens e provider_error. Esses dados **não identificam
a causa**. Não atribuir a falha ao limite, autenticação ou modelo sem evidência.
Os 67 testes backend, 61 gateway aprovados e teste gráfico Windows continuam
válidos, mas não comprovam essa geração real. Não há nesta evidência SHA local,
ID de requisição ou diagnóstico suficiente para reproduzir a falha.

Claude Code deve conferir a classificação do erro e o parser da resposta da CLI,
com fixtures que reproduzam o formato efetivamente observado. Registrar apenas
metadados sanitizados necessários: request/task ID correlacionável, modelo
solicitado, versão CLI, etapa da falha e código conhecido. Não expor stderr bruto,
credenciais ou materiais pessoais na interface/log de passagem. Codex acompanha
a preservação do código no backend e Gemini apresenta mensagem compreensível.
Uma geração curta com fonte sintética, conduzida pelo usuário, confirma o reparo;
não executar geração real automaticamente nem reenviar tarefa incerta.

## Divisão de implementação

| Responsável | Entrega |
| --- | --- |
| Gemini — frontend/ e desktop/ui/ | Painel de conversa, compositor, contexto visível, hierarquia, estados e erros; retirar modal do fluxo de chat e documentar contratos faltantes |
| Codex — backend/native_host/runtime | Conversas/turnos persistidos, histórico e fontes, captura vinculada à aba, envio idempotente, confirmação por tarefa e ponte segura para o painel |
| Code / Claude Code — integrations/ | Diagnóstico provider_error, resposta CLI/erros sanitizados, compatibilidade de modelos e proposta de evolução do gateway quando necessária |

Contrato de conversa ainda precisa ser definido conjuntamente. Descrever
conversation_id, turn_id, tarefa associada, texto, fontes/snapshots selecionados,
política de modelo e aceite, com resposta/erro correlacionados. Estes são requisitos,
**não endpoints já existentes**. Persistir antes de despachar; duplo clique, perda
da resposta HTTP ou reinício não podem gerar nova chamada para o mesmo envio.
O backend monta o contexto autorizado; não confiar em histórico/políticas
arbitrariamente reescritos pelo renderer. Preservar allowlist da ponte, validação
de origem e isolamento das páginas. Propor migração sem apagar projetos/tarefas.

## Ordem e critérios de aceite

**P0:** investigar a falha real e entregar o percurso mínimo de chat textual
lateral, envio e resposta claros. **P1:** contexto da página/seleção e continuidade
entre turnos com persistência. **P2:** refinamentos de modelos, organização e,
em entrega separada, visão/streaming com contratos e testes próprios.

- Com configuração concluída, abrir painel e enviar sem navegar por cadastro de
  projeto, material e plano; campo disponível em 900x640 e painel estreito.
- Resumir fonte sintética conhecida; resposta usa o texto capturado, não só URL.
  Explicar seleção não transmite texto das outras abas.
- Pergunta de continuação usa o turno anterior; nova conversa não recebe esse
  histórico. Navegação durante captura não mistura documentos.
- Fechar/reabrir painel e reiniciar preservam conversa, fontes e rascunho.
- Falha de extração, desconexão, provider_error e término incerto têm mensagens
  claras e preservam conteúdo; consulta/reabertura não repetem geração.
- Duplo envio/reconexão mantém uma execução por turno. Aceite ausente impede
  chamada; resposta incompleta não aciona revisão.
- Testar teclado, foco, contraste e rolagem com compositor acessível. Separar
  evidência de fixtures, teste gráfico integrado e geração real no Windows.

As referências mostram automação de sites, mas este escopo é conversa com contexto.
Ferramentas seguem desativadas. Não anunciar compras, cliques autônomos ou envio
de e-mail como disponíveis; qualquer futura automação exige projeto específico.
