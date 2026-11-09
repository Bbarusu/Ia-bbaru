# Prompt para o Gemini — concluir frontend e corrigir captura

Copie o texto abaixo para a sessão do Gemini.

---

Continue o frontend do Ia-bbaru no repositório https://github.com/Bbarusu/Ia-bbaru,
branch `gemini/frontend-v2`, PR #3. Sua entrega `9814424` foi revisada: a mistura
de capturas e a estrutura ARIA da lista foram corrigidas, e o build passou.
Preserve o estilo KInfo e as melhorias já entregues.

Primeiro leia, na branch `codex/frontend-firefox`, os arquivos:

- `docs/REVISAO_INTEGRADA_2026_11_09.md`;
- `docs/DECISAO_CAPACIDADES.md`;
- `docs/TESTAR_GATEWAY_1_1.md`;
- `docs/INSTRUCOES_GEMINI.md`.

Atualize sua branch com `origin/codex/frontend-firefox`, preservando alterações
locais e resolvendo conflitos na sua própria branch. O backend implementado em
`d593e76` é posterior à sua base `80d4e7e`. Não reinicie a interface nem use force
push. Trabalhe no frontend e nos testes de UI; backend, host e transporte da
extensão continuam sob responsabilidade do Codex.

Entregue três correções:

1. **Integrar capacidades e aceite 1.1.** Tipar e consumir `protocol_version`,
   `capabilities` e `unavailable_reason` do resultado de `models.list`. Mostrar
   assinatura/API, limite indicativo ou garantido e motivo de indisponibilidade
   conforme os dados reais. Explicar que encerrar o processo local não garante
   cancelamento no provedor. Aceite por tarefa, desmarcado inicialmente, enviado
   como booleano `task.allow_unenforced_output_limit` em `tasks.plan`. Não herdar
   automaticamente o aceite de outra tarefa ou ativá-lo ao selecionar um agente.
   Distinguir modelo disponível de elegível; bloquear/explicar antes do envio
   quando a seleção depende de aceite. Respeitar `tools: disabled`. Preservar o
   contrato legado 1, sem atribuir capacidades fictícias a um catálogo 1.1 inválido.
   Mostrar a cópia das capacidades/aceite gravada no plano e explicar
   `incomplete/completion_unconfirmed` mantendo a resposta visível. O backend
   continua com rotas `/v1/*`, e a ponte mantém protocolo `0`: não renomeie essas
   versões por causa do contrato do gateway. A execução pelo painel continua
   desativada; não chamar o gateway diretamente nem expor tokens no frontend.

2. **Preservar edições quando chega uma captura.** Hoje a chave de `SourceModal`
   reinicializa o formulário e perde rascunhos. Mantenha o trabalho alterado e a
   nova captura pendente, ou peça uma escolha explícita antes de substituir.
   Garanta coerência entre título, texto, URL, projeto e ID. Cubra formulário
   manual e edição de captura anterior. Corrija o teste atual que considera
   sucesso apagar o rascunho sem perguntar.

3. **Preservar capturas durante salvamento/descarte.** Ao salvar A, se B chegar
   antes da resposta, a conclusão de A não pode fechar/limpar o estado de B.
   Limpe apenas o ID efetivamente salvo/descartado. B deve continuar acessível
   sem recarregar o painel. Cubra também descarte de A e erro de salvamento.
   A simulação de `capture.clear` nos testes deve comparar IDs, como o background.

Critérios de aceite: testes de comportamento com componentes renderizados ou
Firefox real, incluindo catálogo 1 e 1.1, `best_effort` sem/com aceite, payload
e persistência do aceite pelo backend atual, modelo indisponível, saída incompleta,
edições preservadas e captura B durante salvamento/descarte de A. Não basta procurar
strings no código. Use fixtures; nenhuma conta real é necessária.

Execute `npm test`, `npm run build` em `frontend/` e os testes de navegador, mantendo
o script em `scripts/verify_ui.py` quando apropriado. Verifique teclado, foco e
larguras de 320/360 px. Registre comandos, resultados e limites dos testes.
Atualize a própria PR #3 e entregue o SHA para nova revisão, sem fazer merge.
