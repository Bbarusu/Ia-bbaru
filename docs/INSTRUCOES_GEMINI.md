# Briefing para o Gemini — evolução do frontend do Ia-bbaru

> Atualização de 9/11/2026: a direção agora é Chromium/Electron. Use o
> [prompt atual](PROMPT_GEMINI_CHROMIUM.md) e a base `codex/chromium-browser`.
> O briefing abaixo registra a etapa anterior.

## Pedido e repositório

Você assumirá a evolução do **frontend existente** do Ia-bbaru. O usuário quer
uma nova tentativa de colaboração com Gemini enquanto testa as integrações com
Claude. Codex já implementou a primeira interface; continue essa base.

**Repositório:** https://github.com/Bbarusu/Ia-bbaru

**Base desta entrega:** `codex/frontend-firefox`.
**Sua nova branch:** `gemini/frontend-v2`.

A `main` pode ainda conter somente o backend e os briefings anteriores. Não parta
dela sem conferir se esta entrega foi integrada. Enquanto a PR estiver aberta,
prepare a branch assim:

```sh
git clone https://github.com/Bbarusu/Ia-bbaru.git
cd Ia-bbaru
git fetch origin
git switch -c gemini/frontend-v2 origin/codex/frontend-firefox
cd frontend
npm ci
npm run dev
```

Se já estiver em um clone com alterações locais, verifique `git status` e preserve
essas alterações antes de trocar de branch. Não use reset destrutivo ou force push.

Abra `http://127.0.0.1:5173/?demo=1` para a prévia visual identificada. Sem esse
parâmetro, um navegador comum mostra o estado desconectado. Para o fluxo real,
compile e carregue a extensão no Firefox conforme `docs/INSTALAR_FIREFOX.md`.

## O produto que estamos construindo

Ia-bbaru organiza projetos, materiais e tarefas com agentes de IA dentro do
Firefox. O primeiro produto é uma extensão com painel lateral e página ampla,
com backend local. Gecko é utilizado pelo Firefox instalado. Um navegador próprio
é uma possibilidade posterior; não é necessário construir ou alterar um motor.

O objetivo futuro é usar as contas/assinaturas do usuário para combinar agentes
compatíveis e transportar contexto entre trabalhos. Assinatura de um aplicativo
não equivale automaticamente a acesso à API. Conexões reais serão informadas pelo
backend; não simule login, saldo, disponibilidade ou execução bem-sucedida.

O caso de estudo principal é um **caderno do NotebookLM** da faculdade. Hoje o
usuário pode selecionar/colar texto e guardar a origem. Não há importação automática
de cadernos, conversas ou projetos do Claude/ChatGPT implementada nesta entrega.

## Responsabilidades e coordenação

| Responsável | Área |
| --- | --- |
| Gemini | UI/UX, componentes, estilos, acessibilidade e testes de frontend em `frontend/` |
| Codex | `backend/`, `native_host/`, contratos, persistência, coordenação e transporte/empacotamento Firefox em `extension/` |
| Claude | Integrações oficiais com provedores em `integrations/`, na própria branch/PR |

Você pode ajustar `frontend/src/transport.ts` se preservar o protocolo documentado.
Mudanças em `extension/manifest.json`, `extension/background.js`, contratos ou
backend devem ser propostas e coordenadas com Codex antes de serem incorporadas.
Não crie uma segunda API nem um banco paralelo. Rascunhos/preferências continuam
no armazenamento já existente da extensão.

O usuário está testando com Claude. Não altere, faça merge ou reescreva a branch
dele. `docs/REVISAO_CLAUDE.md` revisa um commit específico da PR #1; não presuma
que a revisão descreve versões posteriores ou o resultado dos testes em andamento.

## Leia antes de editar

1. `README.md`, `docs/STATUS.md` e `docs/DESIGN.md`.
2. `docs/INSTALAR_FIREFOX.md` e `docs/TRANSPORTE_EXTENSAO.md`.
3. `frontend/src/App.tsx`, `types.ts`, `transport.ts`, `logic.mjs` e `tokens.css`.
4. `frontend/tests/`, `scripts/verify_ui.py` e `docs/openapi-backend.json`.

A captura `docs/images/painel-demonstracao.png` mostra a implementação atual com
dados de demonstração. Ela não comprova conexão com contas reais.

## O que já funciona e deve ser preservado

- React + TypeScript + Vite, com `package-lock.json`.
- Área de trabalho, biblioteca, atividade e conexões.
- Projetos e fontes de texto no backend SQLite, por ponte Native Messaging.
- Captura explícita de seleção → revisão de título/URL/texto → salvar no projeto.
- Seleção de materiais para o pedido, visualização do conteúdo e listas paginadas.
- Rascunhos por projeto e estados separados de host, backend e serviço de IA.
- Catálogo real de modelos quando há gateway compatível; biblioteca utilizável
  quando nenhum serviço de IA está disponível.
- Criação de planos com modelo principal e revisão opcional por segundo modelo.
- Histórico com plano, contexto salvo, resultados e estados de falha/incompletude.
- Demo acessível somente por `?demo=1`, identificada e sem geração real.
- `npm run build` valida TypeScript e copia o bundle para `extension/app/`.

**Geração de IA pelo painel ainda não está habilitada.** O host informa
`task_execution: false` e não aceita `tasks.execute`. Codex cuidará da execução
durável antes de expor essa ação. Não adicione botão “Executar” que apenas finge
progresso, chama diretamente um provedor ou contorna essa limitação.

## Sua primeira entrega

Entregue um refinamento funcional do frontend existente, nesta ordem:

1. Inspecione a UI ampla e o painel estreito e liste problemas concretos observados.
   Distingua problemas de interface de dependências do backend/integrações.
2. Refine a experiência inspirada no KInfo, principalmente a sidebar: acesso rápido
   a projeto, contexto, pedido e agentes, com menos rolagem e estados legíveis.
   A página ampla pode usar a composição de dashboard já existente.
3. Extraia componentes de `App.tsx` onde isso facilite manutenção: navegação,
   compositor, biblioteca, conexões e diálogos. Preserve o fluxo e o transporte.
4. Melhore feedback e acessibilidade: foco ao abrir/fechar diálogos, teclado,
   labels, contraste, estados de carregamento/erro, singular/plural e textos claros.
5. Confira o contexto selecionado antes de criar um plano, rascunhos ao trocar de
   projeto, recuperação de trechos pendentes e paginação sem itens duplicados.
6. Teste os fluxos afetados e entregue uma PR com capturas ampla/estreita e limitações.

Não substitua o trabalho por uma imagem, protótipo estático ou página desconectada.
Se não conseguir acessar GitHub ou executar comandos, diga exatamente qual acesso
está faltando e entregue um patch/arquivos com caminhos claros, sem afirmar que
houve commit, build ou teste que você não realizou.

## Direção visual: KInfo

A referência principal é o app KInfo do usuário: fundo preto/quase preto, cartões
escuros com bordas discretas, cantos arredondados, azul nas ações e seleções,
tipografia leve e ícones simples. Preserve a identidade já iniciada.

Tokens estão em `frontend/src/tokens.css`. Use fonte local (`Segoe UI`, system-ui
ou similar); mantenha assets empacotados e CSP compatível com extensão. Não dependa
de fontes remotas, scripts de CDN ou sites de IA dentro de iframes.

Priorize o pedido e seus materiais. Evite decorar a tela com indicadores fictícios,
rankings de inteligência, percentuais sem origem ou promessas de conexão automática.
A escolha atual do agente usa categorias configuradas e preferência do usuário;
não é um benchmark que identifica objetivamente a “melhor IA”.

Valide larguras de **320, 360 e 480 px** e página ampla a partir de 1024 px. Não
admita rolagem horizontal para ações essenciais. Respeite redução de movimento.

## Contrato que a interface deve consumir

Use `request(operation, params)` de `frontend/src/transport.ts`. Na extensão,
o caminho é UI → background → Native Messaging → backend local. Token, endereço
do serviço e credenciais de provedores não pertencem ao frontend.

Operações atuais:

| Operação | Parâmetros |
| --- | --- |
| `bridge.info`, `health.get`, `models.list` | `{}` |
| `projects.list` | `{offset?}` |
| `projects.create` | `{title}` |
| `sources.list`, `tasks.list` | `{project_id, offset?}` |
| `sources.create` | `{project_id, title, content}` |
| `sources.get` | `{project_id, source_id}` |
| `tasks.plan` | `{project_id, task}` |
| `tasks.get` | `{task_id}` |

Listagens retornam `{items, next_offset}`; `null` indica fim. Fontes resumidas têm
`preview` e `char_count`; use `sources.get` para detalhes. A tarefa aceita
`instruction`, `kind`, `source_ids`, `allowed_model_ids`, `mode` e preferências
opcionais de modelo conforme o schema. Não invente campos ou IDs de modelos.

Limites: 40.000 caracteres por fonte, 8.000 por instrução, até 20 fontes e 80.000
caracteres de entrada por tarefa. Origem/título/texto capturados são combinados
como conteúdo pelo helper existente; não truncar silenciosamente.

Após timeout de uma criação, atualizar a lista antes de repetir. O `request_id`
da ponte correlaciona mensagens e não garante idempotência dessas criações.
`failed`, `incomplete` e `interrupted` não são sucesso. Preserve os resultados
parciais, identificando-os como tais. Texto externo deve continuar escapado pelo
React; não usar `dangerouslySetInnerHTML` para materiais ou respostas de IA.

## Testar e entregar

```sh
# Dentro de frontend/
npm ci
npm test
npm run build

# Na raiz, com Python e requirements.txt instalados
python -m unittest discover -s tests -v
```

Opcional para os fluxos de UI automatizados:

```sh
python -m pip install playwright
python -m playwright install firefox
python scripts/verify_ui.py
```

O teste de UI renderiza em Firefox real, usa backend/ponte Python reais, mas simula
as APIs WebExtensions. Não descreva isso como teste completo de instalação nativa.
Registre separadamente testes manuais com extensão instalada e testes com conta real.
Não iniciar uso de assinatura/API só para validar uma alteração visual.

A base passou por 23 testes Python, 6 testes JavaScript e fluxos automatizados de
UI. `web-ext lint` não encontrou erros; há dois avisos no runtime do React sobre
`innerHTML`, sem uso de HTML cru pelo aplicativo. Firefox mínimo declarado: 142.

Entregue em `gemini/frontend-v2`, com commits pequenos e sem force push. Enquanto
a PR da base estiver aberta, aponte sua PR para **`codex/frontend-firefox`**, de modo
que o diff mostre apenas seu trabalho. Se a base já tiver sido integrada, atualize
a branch e direcione a PR para `main`. Não faça merge automático.

Na descrição: problema concreto, mudança, capturas, comandos executados, resultado
e pendências. Não versionar `node_modules/`, bundles, bancos, tokens, sessões ou
material pessoal. A pasta `docs/images/` pode receber capturas com dados de teste
claramente identificados.
