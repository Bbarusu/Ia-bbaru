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
demais. O usuário autorizou a limpeza; falta obter o inventário do disco Windows,
que não é acessível pelo ambiente do Codex.

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
identificação de estado e preservação de alterações/commit local. O utilitário
ainda precisa ser executado no Windows do usuário; nenhuma das quatro pastas
foi removida pelo Codex.
