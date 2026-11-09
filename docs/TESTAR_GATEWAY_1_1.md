# Backend e gateway 1.1: configuração e validação

O backend da branch `codex/frontend-firefox` implementa o contrato 1.1 do gateway
entregue pelo Claude na PR #1. Os schemas publicados em `docs/openapi-gateway-1.1.json`
foram comparados com `integrations/docs/openapi-gateway-1.1.json` do commit `b4b2dcc`:
**componentes e rotas são iguais**. O teste usa uma cópia desse schema em
`tests/fixtures/gateway-1.1-b4b2dcc.json` para detectar divergências sem rede.

Os schemas de geração/catálogo 1 continuam intactos. O backend pode usar uma versão
por instância; não faz fallback entre versões nem entre contas/provedores.

## Escolhas confirmadas

- `allow_unenforced_output_limit`: booleano, padrão `false` tanto na tarefa quanto
  na requisição 1.1. A entrada de tarefa exige um booleano JSON verdadeiro/falso;
  strings e números não substituem o aceite.
- `unavailable_reason`: texto livre de até 80 caracteres ou null.
- `max_output_tokens` na requisição 1.1: inteiro de 1 a 4096.
- Capacidades obrigatórias no perfil 1.1, inclusive indicação de ferramentas;
  esta versão do backend só seleciona modelos com `tools: disabled`.

Schemas Python do consumidor: `backend/contracts_v1_1.py`. Os nomes e campos são
iguais aos do gateway e podem passar a ser importados pelo gateway quando as
branches forem combinadas. Nenhum arquivo da branch do Claude foi alterado aqui.

## Configurar o backend no Windows

Use o backend desta branch e o gateway atualizado da PR #1, em checkouts separados
ou em uma branch local de integração. Não misture arquivos de credenciais no Git.
Mantenha os tokens de serviço que já configurou nos terminais correspondentes.
No terminal do **backend**, antes de iniciá-lo/reiniciá-lo:

```powershell
$env:GATEWAY_URL = 'http://127.0.0.1:8010'
$env:GATEWAY_PROTOCOL_VERSION = '1.1'
# GATEWAY_TOKEN deve continuar igual ao token do serviço de gateway.
# LAUNCHER_API_TOKEN é o token independente do backend.
.venv\Scripts\python.exe -m uvicorn backend.main:create_app --factory --host 127.0.0.1 --port 8000 --workers 1
```

Se estiver usando o instalador Native Messaging, mantenha a configuração acima
e inicie o backend com `python -m native_host.service --config <configuração-local>`
no lugar do comando uvicorn. Não execute duas instâncias sobre o mesmo banco.

No bash: `export GATEWAY_PROTOCOL_VERSION=1.1` e mantenha URL/token configurados.
A aplicação não carrega `.env` automaticamente. Valor diferente de `1`/`1.1`
interrompe a inicialização com erro de configuração; omitir a variável mantém `1`.

As rotas do **backend** continuam `/v1/*`. Seu `GET /v1/models` entrega o catálogo
com `protocol_version: "1.1"` e capacidades quando a integração 1.1 está selecionada.
O cliente HTTP chama `/v1.1/models` e `/v1.1/generate` no **gateway**.

## Planejar e executar pelo cliente HTTP de desenvolvimento

Crie um projeto e fontes pelos endpoints já existentes e use os IDs reais do
catálogo. Exemplo de corpo para `POST /v1/projects/{project_id}/tasks`:

```json
{
  "instruction": "Explique este material",
  "kind": "study",
  "source_ids": [],
  "allowed_model_ids": ["claude-code:sonnet"],
  "mode": "single",
  "allow_unenforced_output_limit": true
}
```

O ID acima só vale se estiver configurado e disponível no gateway. Criar o plano
consulta o catálogo, mas não gera uma resposta. O campo `true` aceita que o limite
seja apenas indicativo; não comprova que o provedor vá respeitar o teto solicitado.
Não existe fallback automático para uma API com cobrança.

A tarefa guarda `gateway_protocol_version`, `allow_unenforced_output_limit` e uma
cópia de `capabilities` em cada etapa de `plan`. O backend encaminha o aceite a
cada geração 1.1. O teto solicitado vem do perfil configurado no gateway, limitado
a 4096; `max_output_tokens` não é um novo campo da entrada de tarefa.

Quando desejar realizar a geração autorizada, use o endpoint já existente
`POST /v1/tasks/{task_id}/execute`. Ele pode consumir a cota da conta. Confira o
`status` no JSON, inclusive quando o HTTP retorna 200:

| Resultado | Estado e comportamento |
| --- | --- |
| `stop` | Pode seguir para o revisor planejado; ao terminar todas as etapas, `completed` |
| `length` | `incomplete` / `output_token_limit_reached`; saída preservada, sem revisão automática |
| `unknown` | `incomplete` / `completion_unconfirmed`; saída preservada, sem revisão automática |

Repetir `execute` retorna 409 e não refaz chamadas. Resultados parciais e metadados
ficam disponíveis em `GET /v1/tasks/{id}`. A execução pelo painel continua desativada
até existir coordenação durável; a ponte recebe o aceite ao planejar, mas recusa
`tasks.execute`. A exibição/controle das capacidades na UI é a próxima integração
com a frente do Gemini.

## Mudanças após o planejamento

Antes da primeira geração, todos os modelos restantes são revalidados. Antes da
revisão, o catálogo é atualizado novamente. Modelo removido, mudança de versão,
ferramentas habilitadas, troca de modalidade de cobrança ou perda das garantias
registradas interrompem o fluxo antes da etapa afetada. O backend não troca o
modelo nem relaxa o limite do plano silenciosamente.

A tarefa termina como `failed` com um motivo estável, por exemplo
`model_capabilities_changed_replan_required` ou `gateway_protocol_changed_replan_required`.
Uma tarefa antiga sem metadados é considerada versão 1 e sem aceite. Ela pode
continuar no modo 1; não é promovida automaticamente para o 1.1. Depois de alterar
a versão configurada, crie um novo plano compatível.

## Testes sem usar conta real

Na raiz do backend:

```powershell
.venv\Scripts\python.exe -m unittest discover -s tests -v
.venv\Scripts\python.exe scripts/verify_gateway_v11.py --gateway-checkout ..\claude-gateway
```

Troque `..\claude-gateway` pelo checkout que contém `integrations/` e a fixture
`tests/integrations/fixtures/fake_claude.py` da PR #1. O script fixa a execução
nessa fixture Python e não procura nem executa o CLI real. Inicia um gateway HTTP
em porta temporária, usa bancos temporários e verifica:

- rejeição por ausência de aceite antes da geração;
- `unknown` com saída persistida e apenas uma chamada;
- resposta confirmada seguida de revisão, em duas chamadas;
- preservação de texto com acentos e bloqueio de repetição da tarefa.

## Evidência desta entrega

- 48 testes do backend/ponte/store/contrato passaram no Linux.
- 51 testes da PR #1 combinados com este backend: 50 passaram e 1 foi ignorado
  (teste opcional com conta real desativado).
- Verificação backend → gateway por HTTP real → CLI de teste passou.
- O script não chama conta real. A nova versão do backend ainda precisa ser
  verificada no Windows; os resultados reais registrados por Claude no repositório
  referem-se às versões e condições descritas por ele.
