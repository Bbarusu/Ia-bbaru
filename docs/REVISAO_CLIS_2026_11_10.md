# Revisão das CLIs e da interface — 10/11/2026

Atualização posterior: os commits do Claude `64c6c36` a `47bffd5` corrigem os
dois achados abaixo e registram aprovação dos testes no Windows. A conta individual
do usuário, porém, recebeu recusa de login da Gemini CLI 0.67.0, com orientação
para migrar ao Antigravity. Ver [status atualizado](STATUS.md) e
[passagem do Claude, seção 1.2](https://github.com/Bbarusu/Ia-bbaru/blob/47bffd570d50b65e7f875a97272d4e628ca34263/integrations/docs/PASSAGEM_CLIS.md).
Esta atualização revisa código/documentos; não incorpora esses commits nem executa
novas gerações. Os achados e prompts originais permanecem como histórico da rodada.

Base: Claude `db8cee4` (código dos adaptadores em `732b0ac`), Gemini `fd2a574`,
main `1c72ffa`. Branch de integração: `codex/browser-capture-clis`.
Branches dos autores preservadas. O código de `integrations/` veio dos commits
do Claude, sem alterações próprias do Codex nessa pasta.

## Conclusão sobre o Claude

Contratos e fila funcionam com os adaptadores novos em testes simulados. Há duas
pendências antes de recomendar geração real com Gemini. ChatGPT/Codex fica visível
no catálogo, mas inelegível pelo backend. Não habilitamos ferramentas restritas
nem inventamos término confirmado.

### P1 — autenticação/cobrança do Gemini não é garantida

Em `integrations/adapters/gemini_cli.py`, `_probe()` declara `ready=True`,
`uses_subscription=True` e `auth_method=oauth-personal` a partir de uma variável
informada pelo operador. O próprio módulo registra que a configuração da CLI pode
selecionar API key, mesmo com variáveis de chave retiradas do processo. O catálogo
anuncia `billing=subscription_quota`.

Isso não confirma o requisito de usar somente contas/assinaturas. A configuração
declarada pode estar correta, mas o catálogo não a verifica. O frontend agora
diferencia login declarado de login verificado; isso informa a limitação, sem
resolver a garantia do transporte.

Correção para Claude: forçar e validar Login with Google, sem ler/expor conteúdo
de credenciais. Se a CLI não permitir, retornar indisponível com motivo existente
(`auth_status_unknown` ou `not_subscription_login`), em vez de declarar a garantia.
Testar API key configurada na própria CLI, ausência de configuração, Google login
e chaves no ambiente; nenhum cenário deve trocar silenciosamente para API paga.

### P1 — a verificação de modelo do Gemini aceita saída mista

`GeminiCliAdapter.parse()` rejeita fallback se nenhum token de saída for atribuído
ao modelo solicitado, mas aceita tokens do modelo solicitado **e** de outro modelo.
Reproduzido sem subprocesso, rede ou conta:

```python
import json
from integrations.adapters.gemini_cli import GeminiCliAdapter
from integrations.config import GeminiCliSettings
from integrations.runner import ProcessResult

response = {"response": "fixture", "stats": {
    "models": {
        "gemini-example": {"tokens": {"candidates": 1}},
        "another-model": {"tokens": {"candidates": 40}},
    }, "tools": {"totalSuccess": 0}}}
result = GeminiCliAdapter(GeminiCliSettings()).parse(
    "gemini-example", ProcessResult(0, json.dumps(response), ""))
print(result.finish_reason)  # unknown; foi aceita
```

Esperado: `provider_model_mismatch`. Qualquer modelo fora da identidade/alias
explicitamente permitido que contribua com saída deve impedir a aceitação.
Acrescentar teste de saída mista, além do fallback puro.

## Decisões K-1 a K-6

- **K-1:** manter `tools=restricted` bloqueado. Sandbox somente leitura não significa
  acesso somente aos materiais selecionados. Recusar uma resposta depois de uma
  ferramenta agir não desfaz a leitura/comando. Não criamos `allow_restricted_tools`.
- **K-2:** manter `unknown` → `incomplete/completion_unconfirmed`, preservar saída e
  não revisar automaticamente. O aviso visual agora é informativo, com título de
  término não confirmado. Confirmação humana para revisão requer fluxo próprio.
- **K-3:** `auth_status_unknown` ganhou instrução específica para Gemini; login nas
  abas web não fornece credencial à CLI.
- **K-4:** nenhum novo código exigido do gateway. `detail` e mensagens livres de
  diagnóstico não são encaminhados ao renderer.
- **K-5:** paralelização do catálogo preservada. O limite de 20 s da ponte não mudou.
  Medição do primeiro catálogo no Windows continua pendente.
- **K-6:** arquitetura/status atualizados; os dois novos adaptadores só usam 1.1.

A correção Windows `732b0ac` prioriza .exe/.cmd/.bat e acrescenta diagnóstico de
erro do sistema. Testes de resolução passaram no Linux com plataforma simulada. O Claude registrou
em `e6afc0c` diagnóstico no Windows: Codex 0.167.0 com login ChatGPT; Gemini
0.67.0 executável, login ainda não declarado. Não houve geração desses agentes.

## Interface Gemini e compatibilidade

- Sub-abas removidas; visual Yuki preservado. Conflitos em #tabs e CSS resolvidos
  mantendo acessibilidade e execução durável da main.
- Busca, zoom, minimizar janela e reabrir aba ligados ao runtime. Ctrl+F também
  funciona com foco na página. Histórico/favoritos visuais permanecem.
- Print captura somente a área visível da aba web após ação explícita. Menu de
  contexto captura recorte visível de imagem. Importação/colagem trabalham com
  imagens locais; outras janelas não são capturadas.
- O atalho de resumo captura texto da página para revisão; não dispara IA.
- Anexos separados do texto, sem truncar base64. PNG/JPEG validados, até 480.000
  bytes e 16 megapixels. Importações podem ser reduzidas, com prévia correspondente.
  O limite de 40.000 caracteres continua só para texto.
- O contrato 1.1 não tem entrada de imagem. A biblioteca guarda/mostra capturas,
  mas impede selecioná-las para geração visual. Planos antigos com AnexoVisual:
  também são recusados antes de gerar. Uma descrição textual não equivale aos pixels.
- Diagnóstico via connections.list → backend → gateway, com provedor, versão
  numérica, configuração, disponibilidade e motivo conhecido. Sem detail, mensagens
  livres, autenticação ou segredos no renderer.

## Validação

Fixtures, sem geração em conta real. Suítes de backend/fila/ponte/mídia, gateway
com os três adaptadores, frontend, políticas desktop e build. Electron real cobre
busca/zoom, print, recorte de imagem, importação de arquivo pequeno, fila, aceite,
proteção de rascunhos, ARIA e persistência. HTTP real com gateway + CLI simulado
cobre sucesso, término desconhecido, login, cota e timeout.

Resultados: 66 testes do backend/fila/ponte/mídia aprovados; gateway com 72
aprovados e 1 teste de conta real pulado; 11 testes do frontend e 3 de políticas
desktop aprovados. Build TypeScript/Vite, smoke gráfico e smoke desktop + gateway
também aprovados.

Linux/Xvfb com sandbox do sistema desativada apenas nos testes. Windows e a sandbox
do sistema não foram validados aqui. Downloads, permissões de câmera/microfone,
instalador e análise multimodal continuam fora desta implementação. Ainda não é
um substituto completo do Chrome.


A passagem mais recente do Claude, `PASSAGEM_GEMINI_NAVEGADOR.md` (`db8cee4`),
confirma os achados N-1/N-2/N-3. Os controles básicos/capturas acima já foram
implementados aqui; o Gemini deve incorporar esta base antes de ampliar o runtime.
As fases restantes (PDF, sessão completa, downloads etc.) continuam no roteiro dele.

## Retorno dos testes no Windows

O usuário executou a PR #7: relatou 66 testes no backend e 73 no gateway,
com 2 falhas e 1 ignorado no gateway. A captura do terminal confirma aprovação
do smoke gráfico: navegação, isolamento, backend real, captura, preservação de
rascunhos e persistência após reiniciar. A conferência manual da interface segue
pendente; esse resultado não valida geração em conta real.

Investigação local: executar os 17 testes de `test_cli_adapters.py` com
`PYTHONIOENCODING=cp1252` reproduziu duas falhas de comparação de texto nas
respostas Gemini (teste de geração e integração backend por HTTP). Os dublês
usavam a codificação padrão do Python para escrever JSON com acentos, enquanto
o gateway lê UTF-8, como fazem as CLIs reais. Os dublês Gemini/Codex agora
configuram stdout/stderr como UTF-8. Os 17 testes passaram sob CP1252 após a
correção. Falta comparar os tracebacks do usuário e repetir o gateway no Windows
para confirmar que as duas falhas relatadas têm essa mesma causa.
