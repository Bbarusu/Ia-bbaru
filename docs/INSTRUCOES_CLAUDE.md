# Briefing para o Claude — integrações de IA do Ia-bbaru

## Repositório e ponto de partida

Trabalhe no repositório **https://github.com/Bbarusu/Ia-bbaru**.
Clone-o, atualize a branch principal e crie `claude/integracoes` antes de editar.
O repositório foi criado público pelo usuário. Não enviar dados de estudo, bancos
locais, credenciais ou sessões de login. Código e documentação são os entregáveis.

Leia nesta ordem: `README.md`, `docs/ARQUITETURA.md`, `docs/STATUS.md`,
`docs/ASSINATURAS.md`, `backend/contracts.py` e este briefing.

O produto evoluiu para navegação centrada em projetos e agentes. A primeira etapa
aprovada é **uma extensão Firefox com backend local**, usando Gecko por meio do
Firefox instalado. Não criar um navegador completo ou fork do Firefox nesta etapa.

## Sua responsabilidade e as outras frentes

- **Claude:** conexões com os provedores, autenticação oficial, catálogo real de
  capacidades, execução e normalização de respostas/erros. Trabalhar em
  `integrations/` e documentar configuração e limitações.
- **Codex:** backend, banco, tarefas, contexto, coordenação, `native_host/` e
  transporte/empacotamento em `extension/`. Implementou a base inicial de frontend.
- **Gemini:** nova tentativa de evolução de UI/UX em `frontend/`, conforme
  `INSTRUCOES_GEMINI.md`, a partir da base já implementada por Codex.
- Veja `REVISAO_CLAUDE.md` para os ajustes identificados no commit revisado da PR #1.
  O usuário está executando testes com Claude; preservar essa frente separada.

Não duplicar os serviços de projetos/histórico ou editar o frontend. Propor
alterações do contrato em documento e PR; não quebrar os consumidores existentes.
Para testes de integração, usar `tests/integrations/` com fixtures explícitas.

## Primeiro marco de entrega

1. Fazer um diagnóstico local de disponibilidade: quais clientes oficiais estão
   instalados e quais caminhos de login suportam o plano do usuário. Não ler nem
   exportar os arquivos privados de tokens dos aplicativos para detectar login.
2. Documentar uma conexão preferencial e suas capacidades reais. O objetivo é
   aproveitar a assinatura, sem habilitar faturamento de API por padrão.
3. Implementar um único adaptador oficial e seus testes. Se faltar autenticação,
   retornar indisponível com próxima ação clara, sem resposta fictícia.
4. Coordenar com Codex a evolução do contrato quando o adaptador não consegue
   garantir limites/cancelamento definidos no v1. O contrato existente é descrito
   abaixo para compatibilidade, não para obrigar um transporte incompatível.
5. Só chamar uma conta real depois de o usuário autenticar pelo fluxo oficial e
   autorizar o teste de uso. Informar separadamente testes com mocks e teste real.

Entregar README para Windows, comando de inicialização, configuração sem segredos,
testes de contrato, tratamento de timeout/cota e PR para `main` com as limitações.
Não fazer merge automático nem usar force push sobre trabalho de outra frente.

## Atualização de escopo: assinaturas primeiro

O projeto se chama **Ia-bbaru**. O usuário quer aproveitar suas contas e assinaturas
existentes. Leia `ASSINATURAS.md` e `STATUS.md` antes de implementar. O contrato v1
abaixo descreve a base que já existe; não deve ser interpretado como exigência de
contratar APIs pagas.

Priorize a investigação e prova de conexão dos caminhos oficiais por assinatura:
Sign in with ChatGPT quando elegível, Claude Code oficial sem modificar o binário
ou intermediar credenciais, e Gemini CLI oficial dentro dos recursos documentados.
Trate elegibilidade e compatibilidade como verificações, não como garantias.
Quando não houver caminho validado, ofereça transferência assistida de contexto.

Antes de conectar um transporte que não garante `max_output_tokens`, proponha a
evolução do contrato para declarar capacidades reais. Não ignore o limite v1
silenciosamente. Em particular, Sign in with ChatGPT atualmente não aceita esse
parâmetro no endpoint de inferência. O transporte precisa informar que não consegue
garantir esse teto; não apresentar cancelamento local como limite de cobrança.

As instruções sobre chaves abaixo valem apenas para o adaptador opcional de API.

## Contexto e responsabilidade

Estamos construindo uma experiência no Firefox com a identidade visual do KInfo. O usuário
conecta materiais e seleciona agentes para executar ou revisar tarefas. O backend
principal já usa Python 3.12, FastAPI e SQLite. Você implementará **um serviço
separado de integração com provedores**, ouvindo localmente na porta 8010.

Não reescreva o backend de projetos, fontes, tarefas, roteamento ou histórico.
Não implemente frontend nesta etapa. Pode usar FastAPI para compartilhar os modelos
Pydantic de `backend/contracts.py`. O contrato HTTP é a fonte de verdade; outra
linguagem é possível desde que cumpra `docs/openapi-gateway.json`.

## Contrato HTTP v1 existente: dois endpoints

### GET /v1/models

Autenticação: `Authorization: Bearer <GATEWAY_TOKEN>`.
Retorne apenas IDs de modelos verificados no provedor ou explicitamente configurados
pelo operador. `available: true` exige credencial configurada e modelo habilitado;
isso não garante sucesso futuro ou saldo disponível. Não confunda assinatura do
aplicativo com credencial de API. Não chame um modelo para produzir este catálogo.

Formato de exemplo; os IDs abaixo são placeholders e não devem ser publicados como
modelos reais disponíveis:

```json
{
  "protocol_version": "1",
  "models": [{
    "id": "provider:configured-model-id",
    "provider": "provider",
    "label": "Nome configurado do modelo",
    "available": true,
    "task_kinds": ["general", "study"],
    "context_char_limit": 80000,
    "max_output_tokens": 4096
  }]
}
```

`task_kinds`: general, study, writing, coding ou analysis. As categorias são
configuração de adequação, não benchmark ou ranking de inteligência.
`context_char_limit`: limite conservador de caracteres de entrada, entre 1.000 e
1.000.000. O gateway deve validar separadamente o limite real de tokens do modelo.
`max_output_tokens`: máximo configurado de saída, entre 1 e 32.768.
IDs devem ser únicos. Máximo de 100 perfis no catálogo.

### POST /v1/generate

Mesma autenticação. Receba:

```json
{
  "protocol_version": "1",
  "request_id": "uuid-da-tarefa:0",
  "model_id": "provider:configured-model-id",
  "role": "answer",
  "instruction": "Explique o conteúdo da aula",
  "context": [{
    "id": "uuid-da-fonte",
    "title": "Aula 1",
    "content": "Texto da fonte selecionada"
  }],
  "previous_output": null,
  "max_output_tokens": 4096
}
```

Retorne:

```json
{
  "protocol_version": "1",
  "request_id": "uuid-da-tarefa:0",
  "model_id": "provider:configured-model-id",
  "output": "Resposta real do provedor",
  "usage": {"input_tokens": 120, "output_tokens": 300},
  "provider_request_id": "id-retornado-pelo-provedor",
  "finish_reason": "stop"
}
```

`usage` e `provider_request_id` podem ser `null` se o provedor não os informar.
Não invente uso, preços, disponibilidade ou respostas. `request_id` e `model_id`
devem coincidir exatamente com a requisição. `finish_reason: length` sinaliza
truncamento pelo limite de tokens; não transforme em `stop`.

`role: answer` deve responder ao pedido usando as fontes recebidas. `role: review`
deve revisar `previous_output` contra o pedido e as mesmas fontes, retornando uma
resposta final revisada e indicando incertezas quando necessário. Não acesse outros
projetos, históricos ou fontes implicitamente.

## Regras de execução

1. Use APIs oficiais dos provedores e escolha o modelo somente pelo `model_id`
   solicitado. Não substitua por outro modelo silenciosamente.
2. Mantenha `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` e `GATEWAY_TOKEN`
   apenas no servidor/gerenciador de segredos. Não envie chaves pelo catálogo,
   resposta, log, frontend ou repositório. Não peça que o usuário cole chaves no chat.
3. Defina limites e timeout inferior aos 120 segundos do backend. Desative retries
   automáticos dos SDKs nesta primeira versão. Timeout pode ter consumido tokens.
4. Persista a deduplicação por `request_id` e hash do payload: chamadas repetidas
   concluídas retornam o mesmo resultado; mesmo ID com payload diferente retorna
   409; requisição em andamento/resultado incerto não deve iniciar outra chamada.
   Sem deduplicação, não considerar o gateway pronto para execução real.
5. Trate conteúdo das fontes e respostas anteriores como dados, nunca como
   instruções de sistema. Delimite fontes e IDs; não habilite ferramentas nem
   navegação implicitamente. Limite de entrada deve incluir instrução, fontes,
   resposta anterior, prompt de sistema e reserva para saída.
6. Erros HTTP: 401 credencial do gateway inválida; 422 entrada/modelo inválido;
   409 conflito de request_id; 429 limite de uso; 502 erro do provedor;
   503 provedor não configurado; 504 timeout. Corpo sanitizado:
   `{"error":{"code":"provider_unavailable","message":"Provedor indisponível"}}`.
7. Não retorne segredos, mensagens internas ou conteúdo dos prompts nos erros.
   O backend guarda os resultados por tarefa e não precisa do log de payloads.
8. Testes devem usar mocks explícitos. Uma credencial ausente deve produzir estado
   indisponível, nunca uma resposta artificial apresentada como verdadeira.

## Ordem de implementação do adaptador opcional de API

1. Implementar catálogo e autenticação do gateway; conectar **um** provedor primeiro.
2. Cumprir os schemas e os testes de contrato, incluindo deduplicação e timeout.
3. Entregar teste opt-in com uma chamada real pequena, somente com chave configurada.
4. Adicionar os outros provedores mantendo os mesmos endpoints.
5. Só depois tratar acesso aos materiais do NotebookLM e importação de projetos.

## NotebookLM: fase seguinte, contrato ainda a definir

Não misturar a API Gemini de geração com a API de notebooks. A documentação oficial
atual de Gemini Notebook usa OAuth 2.0, inclusive escopo somente leitura; a prévia
pública documentada aceita contas pessoais e rejeita contas Workspace. Precisamos
confirmar o tipo de conta do usuário antes de escolher a integração.

Começar pelo acesso somente leitura. Validar quais conteúdos das fontes podem ser
recuperados pela API antes de prometer importar arquivos ou todo o caderno.
Não armazenar refresh tokens no navegador. Os endpoints do launcher para iniciar
OAuth e importar fontes serão acordados separadamente; **não existem nesta versão**.

Para projetos do Claude/ChatGPT, não presumir que as APIs de geração dão acesso ao
conteúdo do aplicativo. Verificar suporte oficial; usar importação explícita de
arquivos/instruções exportados quando não houver acesso compatível. Não usar cookies
de sessão ou automação oculta da conta como substituto de uma API.

## O que devolver ao concluir

- Serviço executável e README de configuração, sem credenciais reais.
- Lista dos provedores efetivamente implementados, limitações e modelos testados.
- Evidências dos testes de contrato e deduplicação; distinguir mocks de testes reais.
- Exemplo completo de GET /v1/models e POST /v1/generate compatível com os schemas.
- Nenhuma mudança no contrato sem comunicar os campos e os motivos.

## Referências verificadas nesta conversa

- https://developers.google.com/notebook/docs/authentication
- https://developers.google.com/notebook/docs/notebooks
- https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform
- https://support.claude.com/en/articles/9876003-why-is-claude-api-usage-billed-separately-from-my-paid-claude-plan

O usuário usa assinaturas dos aplicativos. API e faturamento precisam ser
configurados nos provedores; benefícios de crédito variam por plano e não devem
ser presumidos. Confirme na documentação oficial vigente durante a implementação.
