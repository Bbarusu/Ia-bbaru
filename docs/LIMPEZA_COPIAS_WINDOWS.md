# Consolidar as cópias locais do projeto

11/11/2026. Pastas informadas pelo usuário:

| Pasta | Tratamento inicial |
| --- | --- |
| W:\Projeto\Ia-bbaru-validacao-pr7 | Candidata à cópia principal: é a usada nos testes atuais |
| W:\Projeto\Ia-bbaru | Auditar antes de remover |
| W:\Projeto\Ia-bbaru-chromium | Auditar antes de remover |
| W:\Projeto\Ia-bbaru-inicio | Auditar antes de remover |

O nome da pasta não comprova que ela seja descartável. Uma cópia antiga pode
conter arquivos locais, commits exclusivos ou a pasta .git compartilhada pelas
demais. O usuário autorizou a limpeza e enviou o inventário do disco Windows,
que não é acessível diretamente pelo ambiente do Codex. A aplicação da limpeza
será feita pelo usuário com o utilitário validado abaixo.

## Resultado recebido e consolidação disponível

O relatório Windows em aceb481 mostrou as quatro árvores limpas e compartilhando
`W:\Projeto\Ia-bbaru\.git`. Os 11 commits sem cobertura nas referências remotas
locais são a mesma contagem global, repetida em cada árvore. Não significam 44
commits diferentes. `data/` apareceu na cópia original. `frontend/src/tokens.css`
era um falso positivo do filtro de credenciais, corrigido no inventário.

**Não apagar a pasta Ia-bbaru diretamente:** ela guarda o Git usado pela cópia
principal. O utilitário scripts/consolidate_copies.py resolve esse vínculo antes
de remover as três árvores antigas. Caminhos são fechados para as quatro pastas
acima; divergências, worktrees extras, alterações locais ou Git em operação bloqueiam
o procedimento. Nenhuma chamada de IA ou instalação de dependências é feita.

Fechar o navegador, o gateway e editores/terminais usando as três pastas antigas.
Manter o PowerShell na pasta Ia-bbaru-validacao-pr7. Após atualizar essa cópia:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*copies.py" -v
.\.venv\Scripts\python.exe scripts\consolidate_copies.py --parent W:\Projeto
```

Os testes usam repositórios temporários, nunca as quatro pastas reais. Esperado:
oito testes aprovados. O segundo comando apenas mostra o plano. Se os testes
passarem e o plano mantiver a cópia de validação/remover apenas as três antigas:

```powershell
.\.venv\Scripts\python.exe scripts\consolidate_copies.py --parent W:\Projeto --apply
git status --short --branch
git worktree list
```

O modo --apply, já dentro do escopo de limpeza solicitado pelo usuário:

1. Cria backups ZIP locais das quatro árvores, sem .venv, node_modules, builds,
   caches Python e relatórios reconstruíveis. Arquivos versionados dentro dessas
   exclusões impedem o procedimento. Arquivos ignorados como data/ e .env são
   preservados; dados antigos ficam no backup, sem substituir o banco ativo.
2. Arquiva também todo o Git compartilhado (incluindo refs, reflogs e configurações).
   Verifica listagem, CRC dos arquivos e registra SHA-256 dos ZIPs no manifest.json.
3. Cria Git independente por clone local sem hardlinks, preserva referências e
   os quatro commits de checkout, troca somente o vínculo .git da cópia principal
   e verifica commit/status. Mantém o caminho, .venv, node_modules e dados ativos.
4. Passa a usar branch local/windows (ou nome com sufixo se já existir). Quando
   disponível, acompanha origin/codex/browser-capture-clis. Não publica commits.
5. Só depois da verificação remove Ia-bbaru-chromium, Ia-bbaru-inicio e Ia-bbaru.
   Reconfere os arquivos antes de excluir; AppData nunca é alterado.

Resultado esperado: uma pasta de trabalho ativa, mais os backups compactados em
`W:\Projeto\Backups-Ia-bbaru\<data-hora>`. Não remover esses backups durante a
validação; podem conter dados pessoais e configuração Git, portanto não publicá-los.
Isso reduz duplicação de dependências sem prometer um número de bytes liberados.

Se houver falha antes de ativar o novo Git, as cópias antigas permanecem. Se a
verificação da ativação falhar, o vínculo anterior é restaurado. Se um arquivo
bloqueado impedir a exclusão posterior, a principal permanece independente e o
manifest.json registra limpeza incompleta. Nesse caso, parar e enviar somente a
mensagem/manifesto, sem repetir exclusões manualmente. O arquivo de vínculo
original também é guardado como primary-original.git-link no backup.

Testado em repositórios temporários no Linux: prévia sem escrita, preservação de
commits/dados/dependências, bloqueio de mudanças/worktrees extras, restauração do
vínculo e falha de exclusão sem perda da principal. A execução no Windows real
ainda precisa ser confirmada pelo usuário.

## Inventário sem alterações

Após atualizar a cópia principal, executar:

```powershell
.\.venv\Scripts\python.exe scripts\audit_copies.py --parent W:\Projeto
```

O script usa somente Python padrão e comandos Git locais de leitura. Não faz
fetch, não chama modelos, não lê conteúdo de arquivos pessoais e não apaga nada.
Exibe nome da branch, commit, quantidade de alterações, conflitos, diretório Git
compartilhado, diretórios gerados e nomes de possíveis arquivos/pastas de estado.
Não segue links/junctions nem percorre dependências ou diretórios de estado.

`commits_not_in_local_remote_refs` compara apenas as referências locais existentes.
Zero não é prova suficiente para apagar: as referências podem estar desatualizadas
e podem existir dados ignorados pelo Git. Erro de leitura, scan incompleto ou
vínculo entre pastas exige conferência. O script nunca autoriza exclusão sozinho.

## Consolidação após análise do resultado

1. Confirmar a cópia principal e salvar trabalho exclusivo encontrado nas outras,
   incluindo arquivos ignorados. Atualizar/verificar referências Git antes de
   concluir que todos os commits estão preservados remotamente.
2. Preservar dados locais e conferir dependências entre worktrees. Se a cópia
   principal depender de .git dentro de outra pasta, resolver esse vínculo antes
   de remover qualquer diretório. Usar operações Git adequadas para worktrees.
3. Remover somente cópias verificadas ou arquivadas com conteúdo conferido. O
   comando será definido para os caminhos efetivamente aprovados pela auditoria,
   sem wildcard de exclusão em W:\Projeto.
4. Manter uma instalação de dependências na cópia principal. .venv e node_modules
   dessa cópia são necessários para os testes e a inicialização; apagá-los agora
   apenas exigiria instalação novamente. Nas cópias descartadas, são reconstruíveis.
5. Revalidar a inicialização e o teste sintético com a cópia consolidada.

## Dados e componentes que permanecem

- `%LOCALAPPDATA%\Ia-bbaru-gateway`: token, banco e diagnóstico do gateway.
- Perfil Electron em AppData ou no caminho definido por IA_BBARU_PROFILE_DIR:
  sessões, workspace e banco local do navegador. Não limpar caches do perfil
  sem distinguir dados pessoais dos arquivos gerados.
- data/, .local-state/, arquivos .env, bancos SQLite e configurações locais que
  existam em qualquer cópia. Git limpo não significa ausência desses dados.
- extension/ e native_host/ continuam usados pela execução atual. extension/app
  é gerado pelo build e o painel depende dele. Não remover esses componentes
  apenas porque o projeto passou de Firefox para Chromium.

A organização de pastas reduz duplicação de instalações e confusão de versões;
não é uma alegação de ganho de desempenho do navegador. Alterações de performance
precisam de medição separada e respeitar a divisão dos colaboradores.

Validação do inventário: três testes locais aprovados, cobrindo pasta aninhada,
identificação de estado e preservação de alterações/commit local, além do relatório
Windows fornecido pelo usuário. A consolidação é a etapa pendente; nenhuma das
quatro pastas Windows foi removida pelo Codex.
