# Novo prompt para Claude Code — escopo delimitado

Repositório: https://github.com/Bbarusu/Ia-bbaru.
Sua branch: claude/vibrant-meitner-ksbzgf. Base de integração:
codex/browser-capture-clis (PR #7), que incorporou seu trabalho até c22beb0
pelo merge 875d4b4. Preserve mudanças locais antes de atualizar a base.
Leia docs/DIVISAO_RESPONSABILIDADES.md, docs/STATUS.md e
docs/CORRECAO_PROVIDER_ERROR.md. Não escreva na branch do Codex nem integre PRs/main.

**Este prompt substitui seu escopo anterior de implementação em integrations/.**
O usuário identificou trabalho duplicado entre você e Codex. A correção atual
de provider_error, o parser, os diagnósticos e a integração de execução pertencem
exclusivamente ao Codex. Não inicie outra correção em paralelo, mesmo encontrando
um problema. Registre a evidência e a proposta.

## Sua tarefa agora

Atue como especialista técnico da CLI oficial Claude. Consolide a análise em
**integrations/docs/ANALISE_CLI_CLAUDE.md**, único arquivo autorizado a editar.
Reaproveite evidências existentes; não repita pesquisas/testes concluídos sem
uma dúvida concreta. Inclua:

1. O que foi comprovado sobre formatos de saída, erros, limites e modelos,
   indicando versão, origem e nível de evidência.
2. O que falta para explicar a falha real. Até aqui não há diagnóstico suficiente;
   não apresente o limite de 128 tokens como causa confirmada.
3. Problemas concretos encontrados na integração: localização, comportamento
   esperado, impacto e reprodução por fixture proposta. Não aplicar patch nem
   criar teste nesta tarefa.
4. Recomendações de compatibilidade e, quando fundamentadas, propostas de visão
   ou streaming, explicitando dependências de contrato sob responsabilidade Codex.
5. Pendências para Codex e Gemini, sem assumir implementações ainda não transferidas.

Pode ler o repositório e rodar testes existentes com dublês, mantendo
IA_BBARU_REAL_TEST ausente. Não executar chamadas reais, nem para “testar sem
login”: o ambiente pode autenticar por proxy mesmo com variáveis removidas.
Não ler/copiar credenciais nem alterar instalação/conta do usuário.

## Fora do seu escopo atual

- Código de backend, gateway, adaptador, runner, modelos, diagnósticos, testes,
  fixtures, scripts, dependências, configuração, schemas ou OpenAPI.
- Interface, Electron/IPC, chat, contexto, fila e persistência.
- docs/STATUS.md, prompts de colaboradores e documentação comum de direção.
- Roteiros paralelos para o usuário fazer merges, aumentar limites ou gerar
  novamente. A validação Windows é conduzida pelo Codex neste chat.

Quando Codex ou o usuário transferir uma implementação, ela terá objetivo, base
e arquivos definidos. Durante a tarefa Codex não editará esses arquivos em paralelo.
Até essa transferência, sua entrega é análise documental.

Entregue commit/PR apenas com ANALISE_CLI_CLAUDE.md, resumo dos achados novos e
pendências. Se não houver achado novo, registre isso sem criar trabalho artificial.
Não envie mensagens a outros serviços/chats; o usuário repassa o link da entrega.
