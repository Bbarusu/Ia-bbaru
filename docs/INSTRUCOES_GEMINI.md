# Briefing para o Gemini — frontend e extensão Firefox do Ia-bbaru

## Repositório e objetivo

Repositório: **https://github.com/Bbarusu/Ia-bbaru**.
Clone-o, atualize `main` e crie a branch `gemini/frontend-firefox`.

Crie a primeira interface funcional do Ia-bbaru como **extensão Firefox com painel
lateral**, apoiada no backend local existente. O produto organiza tarefas por
projeto, permite selecionar contexto da navegação e encaminha pedidos aos agentes
disponíveis. O usuário quer aproveitar suas assinaturas de IA.

A primeira entrega não é um fork do Firefox nem um navegador construído do zero.
Gecko já será utilizado pelo Firefox. Não usar Electron para representar uma
implementação Gecko e não colocar os sites de IA em iframes para simular abas.

Leia: `README.md`, `docs/ARQUITETURA.md`, `docs/STATUS.md`, `docs/DESIGN.md`,
`docs/TRANSPORTE_EXTENSAO.md`, `docs/openapi-backend.json` e `backend/main.py`.

## Responsabilidade e organização

- Sua frente: `frontend/` para componentes, estilos e cliente de transporte;
  `extension/` para manifesto, background, captura e empacotamento Firefox.
- Stack proposta: React + TypeScript + Vite, com dependências e lockfile próprios
  em `frontend/`. Reaproveitar componentes no painel lateral e numa página ampla
  interna da extensão. Produzir assets locais compatíveis com a CSP da extensão.
- Codex mantém `backend/`, persistência, coordenação e ponte Native Messaging.
- Claude mantém integrações reais em `integrations/`.
- Não criar uma API ou um banco paralelo para substituir o backend. Rascunhos e
  preferências de apresentação podem ser locais à extensão.

## Design obrigatório: linguagem do KInfo

Fundo preto, cartões quase pretos, bordas suaves, cantos arredondados, tipografia
leve, ícones simples e azul nas ações/seleções. Espaçamento consistente, poucos
elementos simultâneos e estados claros. A página visitada continua sendo o foco.

Tokens iniciais propostos para o frontend, inspirados na referência e sujeitos a
ajuste visual; não são uma extração exata da captura:

```css
--background: #000000;
--surface: #0b0c0e;
--border: #202226;
--text: #e6e8ec;
--text-muted: #a3aab7;
--accent: #397ff2;
--radius-card: 12px;
--radius-panel: 16px;
```

Use uma pilha local como Inter, Segoe UI, system-ui, sans-serif; não depender de
fontes remotas. Contraste legível, foco visível, labels nos ícones e teclado em
todas as ações. Respeitar `prefers-reduced-motion`. Validar painel entre 320–480 px
e página ampla a partir de 768 px. Não depender de um tamanho fixo de monitor.

## Fluxo do primeiro marco

1. Abrir painel pela ação da extensão e listar/criar projetos.
2. Selecionar um trecho numa página e acionar “Adicionar ao Ia-bbaru”. Mostrar uma
   prévia com título, URL e texto; só persistir após a ação explícita do usuário.
3. Exibir as fontes do projeto, permitir escolher quais entram no próximo pedido
   e mostrar exatamente esse contexto no compositor.
4. Listar modelos retornados pelo backend. Se o gateway não estiver conectado,
   mostrar o motivo e manter biblioteca/compositor utilizáveis; não inventar modelos
   conectados nem apagar o texto digitado.
5. Com modelos disponíveis, escolher um ou dois, criar o plano e explicar a seleção.
   Execução pelo painel só deve ser habilitada quando a ponte declarar suporte;
   o transporte Native Messaging ainda é uma proposta, não um recurso existente.
6. Consultar tarefas e apresentar resposta, fontes usadas, agente de cada etapa e
   falhas parciais. Não converter `failed`, `interrupted` ou `incomplete` em sucesso.

Se o host local ainda não existir, entregar UI, transporte desacoplado e a mensagem
“Componente local não instalado”. Fixtures somente num modo de desenvolvimento
explicitamente identificado, nunca como fallback silencioso na versão normal.

## Componentes sugeridos

- Seletor de projeto e ação “Novo projeto”.
- Lista de contexto com seleção e prévia do trecho.
- Compositor persistente durante troca de abas/estados.
- Seleção de agentes com disponibilidade e motivo da recomendação.
- Plano da tarefa, progresso e histórico de resultados.
- Área de conexão mostrando host, backend e provedores como estados distintos.

O frontend recebe estados reais. Abrir uma aba do Claude/ChatGPT/Gemini é um atalho,
não comprovação de login e não execução de uma tarefa.

## Integração com backend existente

Usar `docs/openapi-backend.json`. O backend responde `{ "items": [...] }` nas
listagens. As rotas já existentes são:

| Ação | HTTP atual |
| --- | --- |
| Estado do backend | GET /health |
| Listar/criar projetos | GET/POST /v1/projects |
| Listar/adicionar fontes | GET/POST /v1/projects/{project_id}/sources |
| Consultar modelos | GET /v1/models |
| Listar/criar planos | GET/POST /v1/projects/{project_id}/tasks |
| Consultar tarefa | GET /v1/tasks/{task_id} |
| Executar tarefa | POST /v1/tasks/{task_id}/execute — síncrono no backend, ainda sem suporte na ponte proposta |

Uma fonte atual aceita apenas `title` e `content`. Enquanto não houver campos
estruturados de origem, incluir título/URL/texto no conteúdo após a prévia; não
enviar campos adicionais que o schema rejeita. Tratar o limite de 40.000 caracteres
por fonte e de 80.000 caracteres de entrada por tarefa sem truncamento silencioso.

Uma tarefa usa `instruction`, `kind`, `source_ids`, `allowed_model_ids`, `mode`,
`preferred_model_id` e `reviewer_model_id` opcionais. O frontend deve usar os IDs
retornados pelo backend; as regras exatas estão no schema.

Exibir erros úteis: 401 reconexão/autorização local; 404 item não encontrado;
422 validação; 409 tarefa já executada; 503 integração indisponível. O backend
também pode retornar HTTP 200 com tarefa `failed`; verificar o campo `status`.

## Extensão Firefox e transporte

Use WebExtensions e `sidebar_action`. Identidade de desenvolvimento proposta:
`ia-bbaru@bbarusu.local`. Declare `browser_specific_settings.gecko.id` no manifesto.
Use APIs compatíveis com Firefox, não `chrome.sidePanel` como se fosse equivalente.
Documente a versão mínima real escolhida e teste na versão correspondente.

Capture apenas após gesto do usuário, usando permissões mínimas. Prefira
`activeTab`, captura sob demanda e menu de contexto para seleção; não pedir acesso
a todos os sites, histórico e cookies para este fluxo. Páginas restritas do
navegador devem produzir mensagem explicativa.

Transporte de produção proposto: UI → background → Native Messaging → backend.
Mantenha todo o transporte num módulo substituível. Content scripts não recebem
tokens e não encaminham pedidos arbitrários de páginas para o host. Não usar uma
URL de API recebida da página nem desativar CORS/autenticação para integrar.

Não colocar chaves de IA, cookies de sessão ou o token de backend em bundles,
content scripts, fixtures ou commits. O host local será provisionado separadamente.

## Critérios de aceite e entrega

- Build reproduzível e instruções para carregar temporariamente a extensão pelo
  `about:debugging` do Firefox. Não publicar em loja nesta etapa.
- Navegação por teclado, foco e estados vazios/erro/indisponível/concluído.
- Nenhum pedido ou envio de contexto sem a ação correspondente do usuário.
- Captura e renderização seguras: texto da página e resposta de IA são conteúdo
  não confiável; não renderizar HTML cru nem executar scripts desses conteúdos.
- Testes de fluxo para seleção de contexto, indisponibilidade e falhas parciais;
  validar separadamente em Firefox real o que depender de APIs do navegador.
- Documentar o que está integrado, o que depende do host e o que usa fixtures.
- Entregar PR para `main`, com como executar, evidências e pendências. Não fazer
  merge automático ou sobrescrever o trabalho das outras frentes.

Fontes oficiais:
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/user_interface/Sidebars
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_messaging
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_manifests
