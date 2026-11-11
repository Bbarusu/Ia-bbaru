# Ia-bbaru / Yuki — navegador integrado ao Claude

Projeto independente, com referência visual KInfo e interface Yuki. Navegador
Chromium via Electron, painel React, backend FastAPI e SQLite locais.
**A única integração de IA é Claude Code**, usando o login da conta Claude.

Base desta entrega: `codex/browser-capture-clis`, PR #7, ainda fora da main.
[Direção vigente](docs/DIRECAO_CLAUDE_ONLY.md) · [Estado](docs/STATUS.md) ·
[Arquitetura](docs/ARQUITETURA.md) · [Capturas](docs/CONTRATO_CAPTURAS.md).

## Modelos e seleção

Sonnet, Haiku, Opus e Fable são aliases oficiais, sujeitos ao plano e à versão da
CLI. O aplicativo lista somente os modelos configurados pelo usuário. Categorias,
contexto e preferência orientam a escolha; não é um ranking universal. Revisão
pode usar outro modelo Claude. Fable não é habilitado por padrão e pode exigir
créditos adicionais: confira `/model` e a modalidade de uso na CLI.

Navegação, busca, zoom, reabertura de abas e captura de texto/print/imagem já estão
ligados ao runtime. Imagens ficam na biblioteca local; o gateway textual 1.1 não
faz análise visual. A fila durável exige confirmação para iniciar geração.

## Iniciar no Windows

Requer Python 3.12 e Node.js 24 recomendado. Na pasta do projeto:

```powershell
# Em ambientes existentes, atualizar também a dependência Pillow:
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
powershell -ExecutionPolicy Bypass -File .\integrations\scripts\iniciar-ia-bbaru.ps1
```

O inicializador prepara dependências no primeiro uso e usa somente `sonnet` por
padrão. Depois de conferir os modelos autorizados em `claude` → `/model`:

```powershell
powershell -ExecutionPolicy Bypass -File .\integrations\scripts\iniciar-ia-bbaru.ps1 -Models "sonnet,haiku,opus"
```

`-Model` permanece como alias. Veja [configuração por modelo](docs/DIRECAO_CLAUDE_ONLY.md).
Abrir o navegador não gera respostas automaticamente; executar uma tarefa usa
cota da conta e depende das condições do plano.

## Desenvolvimento coordenado

- [Prompt para Gemini — frontend](docs/PROMPT_GEMINI_CLAUDE_ONLY.md).
- [Prompt para Code / Claude Code — integração](docs/PROMPT_CODE_CLAUDE_ONLY.md).
- Runtime, backend e ponte: desenvolvimento nesta sessão.

Os nomes dos colaboradores não representam provedores do aplicativo. Passagens
anteriores são histórico; a direção Claude exclusivo prevalece sobre elas.

## Executar somente o backend para desenvolvimento

Para testar o navegador, siga [Abrir o Chromium](docs/TESTAR_NAVEGADOR_CHROMIUM.md):
ele inicia o backend automaticamente. Os comandos abaixo servem para desenvolver
o backend separadamente. O caminho anterior de [extensão Firefox](docs/INSTALAR_FIREFOX.md)
também continua disponível.

Requer Python 3.12. Os comandos abaixo são para bash:

```sh
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
export LAUNCHER_API_TOKEN="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
python -m uvicorn backend.main:create_app --factory --host 127.0.0.1 --port 8000 --workers 1
```

No PowerShell, ative `.venv\Scripts\Activate.ps1`, configure o token usando
`$env:LAUNCHER_API_TOKEN = python -c "import secrets; print(secrets.token_urlsafe(32))"`
e use o mesmo comando uvicorn.

A documentação local estará em `http://127.0.0.1:8000/docs`.
As rotas `/v1/*` exigem `Authorization: Bearer <LAUNCHER_API_TOKEN>`.
`/health`, `/docs` e `/openapi.json` não expõem registros privados.
O arquivo `.env.example` é referência: não é carregado automaticamente.

Para usar o gateway Claude desta branch, configure no backend:

```sh
export GATEWAY_URL=http://127.0.0.1:8010
export GATEWAY_PROTOCOL_VERSION=1.1
# Configure GATEWAY_TOKEN com o mesmo segredo de serviço usado no gateway.
```

Não use o token do launcher como token do gateway. O login fica a cargo da CLI Claude Code; o navegador não precisa conhecer suas credenciais.

Veja [configuração e validação do 1.1](docs/TESTAR_GATEWAY_1_1.md), incluindo o
aceite `allow_unenforced_output_limit` e os comandos para Windows.

## Fluxo disponível

1. `POST /v1/projects`: criar projeto com `title`.
2. `POST /v1/projects/{id}/sources`: adicionar `title` e `content` em texto.
3. `GET /v1/models`: consultar o catálogo real do gateway.
4. `POST /v1/projects/{id}/tasks`: criar plano, sem gerar resposta ou consumir tokens
   de geração. O gateway deve consultar o catálogo sem chamadas de geração.
5. `POST /v1/tasks/{id}/enqueue` com `{"confirmed": true}`: colocar na fila durável.
   Pode consumir cota/cobrança. Requer worker ativo (automático no navegador;
   `LAUNCHER_DURABLE_EXECUTION=1` no backend separado). `resume` retoma apenas bloqueios
   anteriores à geração, após correção e nova confirmação. `/execute` é legado,
   somente com o worker desativado, e continua fora da ponte.
6. `GET /v1/tasks/{id}`: consultar status e resultados intermediários.

Corpo de criação de tarefa (troque IDs pelos retornados pelas APIs):

```json
{
  "instruction": "Explique o conteúdo e crie cinco exercícios com gabarito",
  "kind": "study",
  "source_ids": ["ID_DA_FONTE"],
  "allowed_model_ids": ["ID_REAL_MODELO_1", "ID_REAL_MODELO_2"],
  "mode": "review"
}
```

`mode: single` usa um modelo. `review` exige dois modelos diferentes: o segundo
recebe a resposta anterior e as fontes selecionadas, e entrega a versão revisada.
`preferred_model_id` e `reviewer_model_id` permitem escolha explícita dentro dos
modelos autorizados. O plano guarda uma cópia das fontes no momento de sua criação.

O roteamento atual é uma regra transparente por categoria configurada, capacidade
de contexto e ordem de preferência do usuário. **Não mede qual modelo é melhor** e não
faz uma chamada de IA para decidir o roteamento.

## Limites desta primeira entrega

- Uso pessoal local: um token corresponde a um único espaço de trabalho.
  Não há login multiusuário, isolamento por conta, OAuth nem aplicação pública.
- SQLite e **um único processo/worker**. Não executar múltiplas instâncias sobre
  o mesmo banco; a recuperação de tarefas pressupõe uma instância.
- Fila SQLite e worker local, até 120 segundos por chamada ao gateway. Fechar o
  painel mantém a execução; fechar o aplicativo encerra seu serviço. Na reabertura,
  tarefas em fila continuam e chamadas interrompidas ficam `uncertain`, sem repetição.
- Apenas `gateway_busy` e `request_in_progress` são repetidos automaticamente,
  com o mesmo ID e corpo. Falha de transporte/timeout fica incerta. Cota esgotada,
  autenticação recusada após início e validação são erros finais para aquela tarefa.
- Respostas cortadas ou de conclusão desconhecida ficam `incomplete`; não são
  apresentadas como concluídas nem enviadas automaticamente à revisão.
- Até 20 fontes por tarefa e 80.000 caracteres de entrada. A contagem em caracteres
  é uma pré-validação; o gateway ainda precisa validar tokens no provedor.
- Texto e imagens locais na biblioteca; somente texto é encaminhado ao Claude.
  Sem extração de PDF, sincronização de projetos da conta, busca vetorial ou ferramentas externas.
- Sem orçamento monetário ou estimativa de preço. Solicitação por etapa: até 4.096
  tokens de saída. No contrato 1.1 o teto só é garantido para `output_limit: enforced`;
  outros transportes exigem aceite da limitação. Usage é registrado quando retornado.
- Sem streaming, cancelamento remoto ou reexecução de etapas.
- Sem credenciais configuradas, `/v1/models` e a criação de planos retornam 503.
  Não existem respostas fictícias no fluxo normal. A prévia visual `?demo=1` é
  explicitamente identificada e não faz inferência.

Antes de publicar: substituir o token único por autenticação e autorização por
usuário, definir retenção/exclusão dos dados e implantar coordenação distribuída e limites de
custo. Esta base não deve ser exposta publicamente como está.

## Validação

```sh
python -m unittest discover -s tests -v
cd frontend
npm ci
npm test
npm run build
```

Os testes verificam autenticação, isolamento das fontes entre projetos, roteamento,
passagem de contexto à revisão, limites de entrada, execução única concorrente,
falhas parciais, respostas truncadas, recuperação após reinício e validação do gateway.
Não realizam chamadas pagas a provedores.

A validação opcional de UI usa `python scripts/verify_ui.py` após instalar
`playwright` e executar `python -m playwright install firefox`. Renderiza em Gecko
com backend real e APIs WebExtensions simuladas; não substitui testar o carregamento
nativo da extensão. Nenhuma validação automática exige login de IA.
