# provider_error — correção de leitura e validação Windows

11/11/2026 · base `codex/browser-capture-clis` / PR #7.

## O que sabemos

O painel mostrou `provider_error` no pedido “Revise”; o usuário confirmou que
não havia informação adicional. A causa daquela execução não pode ser recuperada
do código genérico. Não está comprovado que o problema seja conta, modelo ou o
limite de 128 tokens. A geração real permanece pendente de validação.

Encontramos uma lacuna no adaptador: classificava somente o campo `result`,
ignorando mensagens em `errors[]`. Agora falhas estruturadas também usam essa
lista para reconhecer autenticação e cota. Subtipos conhecidos de falha não são
aceitos como sucesso; uma resposta de sucesso sem texto tem código de saída
inválida. Nenhum texto bruto é devolvido ao cliente.

Nas falhas de interpretação da resposta, o gateway registra o evento
`claude_cli_failure` com campos limitados: impressão digital do request ID,
código de saída do processo, formato do stdout, subtipo conhecido, presença de
texto/stderr, quantidade de erros e limite solicitado. `markers` contém somente
nomes fixos de indícios encontrados, nunca trechos da CLI. Um marcador é uma pista,
não diagnóstico confirmado. Não registramos pedido, fonte, resposta, ID bruto,
caminho, stderr bruto ou credencial. Sucesso não produz esse evento.

Falhas permanecem gravadas na deduplicação. Consultar/repetir o mesmo request ID
retorna o resultado salvo sem gerar novamente. Unknown/timeout continuam sem
repetição automática. Contratos 1/1.1 e aceite por tarefa não mudaram.

## Validar primeiro sem conta real

**Atualização da tentativa real Windows:** o teste opcional retornou HTTP 429,
provider_quota_exceeded/categoria quota, em 2,885 s, com limite solicitado de 128.
A classificação atual é limite de uso reportado pela CLI; a resposta bem-sucedida
continua pendente. Conferir a janela/cota no Claude Code e só retomar quando houver
disponibilidade. Esse resultado não prova a causa do provider_error original.

Validação local desta entrega: backend 67 aprovados; gateway 68 executados,
67 aprovados e 1 teste real ignorado; frontend 11 aprovados e build concluído.
Verificação HTTP 1.1 aprovada nos cinco cenários com dublês (sucesso/revisão,
término desconhecido, autenticação, cota e timeout). Nenhuma geração real feita.

Feche o navegador e o gateway antigo antes de usar a nova versão. Na cópia local:

```powershell
cd W:\Projeto\Ia-bbaru-validacao-pr7
git status --short
git fetch origin
git merge --no-edit origin/codex/browser-capture-clis
Remove-Item Env:IA_BBARU_REAL_TEST -ErrorAction SilentlyContinue
.\.venv\Scripts\python.exe -m unittest discover -s tests/integrations -p test_claude_failures.py -v
```

Esperado: seis testes aprovados. Usam apenas dublês. Cobrem lista de erros,
classificação, deduplicação nos dois contratos, resposta malformada e ausência
de conteúdo privado no diagnóstico. Em caso de conflito de Git, não sobrescrever
o trabalho local; resolver antes de testar.

## Uma geração sintética para identificar o comportamento real

Este passo é separado dos testes automáticos: faz **uma** geração e consome a
cota da assinatura. Não usa os materiais da captura e não reexecuta a tarefa
antiga. O pedido solicita a palavra “laranja” da fonte sintética. O limite de
128 corresponde ao exibido na captura; não foi aumentado para ocultar a falha.

```powershell
$env:IA_BBARU_CLAUDE_CODE_MODELS = "sonnet"
$env:IA_BBARU_REAL_TEST = "claude-code"
try {
    .\.venv\Scripts\python.exe -m unittest discover -s tests/integrations -p test_real_claude_code.py -v
} finally {
    Remove-Item Env:IA_BBARU_REAL_TEST -ErrorAction SilentlyContinue
}
```

Enviar o resultado desse comando, principalmente a linha JSON com
`"event": "claude_cli_failure"`, se aparecer. Se der erro, timeout ou término
incerto, parar e analisar; não repetir em loop ou aumentar limites por tentativa.
Se for ignorado por indisponibilidade da CLI/login, isso não valida geração.
Sucesso aqui valida o gateway com texto sintético; a validação posterior no
navegador ainda deve conferir captura, fonte usada e estado final da tarefa.

No gateway iniciado pelo script, a mesma linha fica em
`$env:LOCALAPPDATA\Ia-bbaru-gateway\gateway-erros.log`. Para extrair somente
os diagnósticos novos (sem compartilhar o log completo):

```powershell
Select-String -Path "$env:LOCALAPPDATA\Ia-bbaru-gateway\gateway-erros.log" -Pattern '"event": "claude_cli_failure"' | Select-Object -Last 3 -ExpandProperty Line
```

Logs anteriores à correção não contêm esse evento. Guardar o diagnóstico antes
de reiniciar pelo inicializador, que pode substituir o arquivo de log.

## Coordenação com os outros chats

Claude Code: a integração posterior incorporou sua branch até `c22beb0`, resolvendo
os conflitos do parser com aa3933f. Foram preservados o diagnóstico estrutural no
log, as assinaturas persistidas/consulta `python -m integrations failures`, a
classificação de errors[] e a conferência de modelo servido. Isso não comprova a
causa da falha real. Resultados malformados continuam recusados; tipos inesperados
no diagnóstico não podem transformar a falha original em uma exceção do parser.

Gemini: preservar a nova tradução de provider_error em frontend/src/logic.mjs
ao implementar o chat. Ela informa falha sem inventar causa. Não remove nem
substitui o diagnóstico técnico, e não anuncia geração corrigida antes do teste.

Backend: os códigos de autenticação/cota/erro já estão na allowlist do consumidor;
nenhuma nova política de retomada ou execução foi criada.

## Se o merge anterior ficou aberto no Windows

O `SyntaxError` apontando `<<<<<<< HEAD` em claude_code.py é um conflito de Git,
anterior a qualquer chamada de modelo. Não é o provider_error da geração. A branch
de integração contém agora ambos os históricos e o arquivo combinado/testado.

Para o estado informado pelo usuário (somente esse arquivo com UU), guardar uma
cópia do diff, cancelar o merge incompleto e incorporar a integração resolvida.
Executar uma linha por vez; se qualquer comando falhar, parar e verificar a saída:

```powershell
git diff HEAD --binary --output=../ia-bbaru-merge-backup.patch
git merge --abort
git fetch origin
git merge --no-edit origin/codex/browser-capture-clis
git status --short
```

O backup contém as diferenças locais e fica fora do repositório; não publicá-lo.
Não usar `git reset --hard`, `--ours` ou `--theirs` como resolução. Se o Git indicar
outros conflitos ou não conseguir cancelar, preservar os arquivos e informar o
estado antes de prosseguir. Depois do merge concluído, repetir os seis testes
test_claude_failures.py do roteiro acima, com o teste real desabilitado.
