# Direção atual: navegador integrado exclusivamente ao Claude

Decisão do usuário em 10/11/2026 (America/Sao_Paulo).
Repositório: https://github.com/Bbarusu/Ia-bbaru
Branch de integração: `codex/browser-capture-clis`, PR #7.
Este documento substitui as propostas de múltiplos provedores. Nomes de autores
nos documentos de colaboração não representam integrações disponíveis no produto.

## Implementado nesta rodada

- Um único adaptador, Claude Code oficial, com login da conta Claude.
- Removidos adaptadores, configuração, diagnóstico, inicializador e testes dos
  outros provedores. O consumidor do catálogo aceita somente `claude-code`.
- Removidos cartões, atalhos e referências visuais às outras IAs. O visual Yuki,
  as capturas e a fila durável continuam.
- A seleção passa a comparar **modelos Claude configurados**, não fornecedores.
  Sonnet, Haiku, Opus e Fable são modelos/aliases; os papéis da tarefa são resposta
  e revisão. Um agente especializado com instruções próprias é uma evolução separada.
- Nada da experiência de ferramentas restritas foi mantido: o contrato 1.1
  permanece inalterado e somente `tools=disabled` é elegível.
- Histórico já salvo não é apagado nem redirecionado para outro modelo. Planos de
  provedores removidos não têm modelo elegível no catálogo; precisam de novo plano.

## Seleção orientada por tarefa

O backend já usa categorias, limite de contexto, disponibilidade e ordem dos modelos
autorizados. Agora cada modelo Claude pode ter categorias distintas:

| Alias | Perfil inicial de produto |
| --- | --- |
| sonnet | Estudos e programação |
| haiku | Pedidos gerais e escrita |
| opus | Análise |
| fable | Análise, somente se configurado explicitamente |

Esses perfis são **preferências editáveis**, não benchmarks nem provas de qualidade.
Um pedido de escrita pode ser complexo; o tipo de tarefa sozinho não mede isso.
Não há ainda classificador semântico de dificuldade, estimativa de cota por modelo
ou medição de qualidade. Empates preservam a ordem autorizada; uma preferência
explícita prevalece. O plano mostra o motivo antes da execução.

Variável opcional, em PowerShell:
```powershell
$env:IA_BBARU_CLAUDE_CODE_MODEL_TASK_KINDS = '{"sonnet":["study","coding"],"haiku":["general","writing"],"opus":["analysis"]}'
```
As chaves devem ser modelos presentes em `IA_BBARU_CLAUDE_CODE_MODELS`.
Categorias válidas: general, study, writing, coding, analysis. A variável comum
`IA_BBARU_CLAUDE_CODE_TASK_KINDS` continua válida; perfis explícitos por modelo
têm prioridade. Para IDs completos de versões, configure o perfil pela chave exata.

## Modelos e assinatura: evidências e limites

Fonte oficial consultada nesta rodada:
https://code.claude.com/docs/en/model-config

A documentação lista os aliases sonnet, haiku, opus e fable. Aliases podem mudar
de versão; não atribuir uma versão fixa no painel sem evidência da CLI.
A disponibilidade depende do plano, da organização e da versão instalada.
O diagnóstico verifica login/CLI, **não o direito de uso de cada modelo**.
Só serão listados os nomes que o operador configurar, nunca quatro modelos
presumidos como disponíveis.

A documentação alerta que Fable pode exigir créditos adicionais dependendo
do plano/assento; a CLI pode mostrar “Requires usage credits”. Não habilitar Fable
por padrão nem tratá-lo como automaticamente incluído na assinatura. Conferir
`/model` na CLI e a condição de cobrança antes de configurá-lo.
A documentação consultada exige Claude Code 2.1.321+ para Fable 5.2; o diagnóstico
anterior do usuário era 2.1.307. Isso precisa ser revalidado, não atualizado
silenciosamente. Não comprar créditos nem executar geração real nesta rodada.

## Uso no Windows

Depois de incorporar esta branch e atualizar dependências, conferir os modelos
na CLI oficial (`claude`, depois `/model`). Iniciar somente com os autorizados:
```powershell
powershell -ExecutionPolicy Bypass -File .\integrations\scripts\iniciar-ia-bbaru.ps1 -Models "sonnet,haiku,opus"
```
`-Model` continua sendo alias de `-Models`. O padrão permanece apenas `sonnet`.
As opções dos outros provedores foram removidas; variáveis antigas deles não
configuram agentes. Não é preciso desinstalar aplicativos do computador.

## Contratos e execução preservados

- Aceite do limite indicativo por tarefa, confirmação antes de executar e fila durável.
- Término desconhecido → incomplete/completion_unconfirmed, preservando texto e
  parando a revisão. Não inferir stop pela contagem de tokens.
- Erros sanitizados, deduplicação, nenhuma repetição automática após resultado incerto.
- Texto/print/imagem continuam separados. O gateway 1.1 não recebe imagens.
- A proposta visual 1.2 ainda é proposta; deverá considerar somente Claude Code.

## Continuidade

Validação local: 67 testes backend; 61 gateway + 1 ignorado; 11 frontend e
3 políticas desktop. Build e ambos os testes gráficos passaram. Verificação
HTTP 1.1 cobriu sucesso/revisão, término desconhecido, login, cota e timeout.
Tudo com fixtures, sem conta real. O novo inicializador e a escolha entre modelos
precisam ser conferidos no Windows; Linux não comprova acesso na conta do usuário.

- [Frontend — Gemini](PROMPT_GEMINI_CLAUDE_ONLY.md)
- [Integração — Claude Code](PROMPT_CODE_CLAUDE_ONLY.md)

Documentos de passagens anteriores são histórico. Esta decisão prevalece quando
um texto antigo recomendar reativar outros provedores ou ferramentas restritas.
