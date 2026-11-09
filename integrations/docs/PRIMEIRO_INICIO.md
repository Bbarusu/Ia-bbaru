# Primeiro início do Ia-bbaru (Windows)

Navegador Chromium do Codex + interface do Gemini + gateway do Claude Code.
Nenhum passo deste guia gera resposta de IA nem consome cota de geração.

As três frentes ainda estão em PRs separadas (#4 Codex, #5 Gemini, #1 Claude).
Até o merge, o primeiro início usa uma **branch local** que junta as três, sem
alterar as branches dos autores. Combinação verificada (Linux, 9/11/2026):

| Frente | Branch | SHA |
| --- | --- | --- |
| Navegador, backend, ponte | `codex/chromium-browser` | `33fc1ea` |
| Interface | `gemini/chromium-ui` | `00e2c8f` |
| Gateway | `claude/vibrant-meitner-ksbzgf` | o desta entrega |

O merge entra sem conflito e passa em todas as suítes (ver [VALIDACAO.md](VALIDACAO.md)).

## Antes de começar

| Requisito | Conferir no PowerShell |
| --- | --- |
| Git | `git --version` |
| Python 3.12 | `py -3.12 --version` |
| Node.js 24 LTS | `node --version` (22.12 ou mais novo; recomendado 24) |
| Claude Code com login da assinatura | `claude auth status --text` |

## 1. Montar a pasta do primeiro início (uma vez)

```powershell
cd W:\Projeto\Ia-bbaru
git status                    # precisa estar limpo
git fetch origin
git worktree add -b inicio/local W:\Projeto\Ia-bbaru-inicio origin/codex/chromium-browser
cd W:\Projeto\Ia-bbaru-inicio
git merge --no-edit origin/gemini/chromium-ui
git merge --no-edit origin/claude/vibrant-meitner-ksbzgf
git log --oneline -3
```

Os dois merges devem terminar sem conflito. A branch `inicio/local` existe só no
seu PC: **não faça `git push`** dela.

## 2. Iniciar

```powershell
cd W:\Projeto\Ia-bbaru-inicio
powershell -ExecutionPolicy Bypass -File .\integrations\scripts\iniciar-ia-bbaru.ps1
```

`-ExecutionPolicy Bypass` vale só para essa execução; não muda a configuração do
Windows. O script:

1. na primeira vez, cria `.venv` e instala as dependências Python;
2. guarda o token do gateway em `%LOCALAPPDATA%\Ia-bbaru-gateway` (fora do Git);
3. mostra se o Claude Code está pronto (diagnóstico, sem gerar nada);
4. abre o gateway numa janela minimizada, na porta 8010;
5. abre o navegador com `GATEWAY_URL`, `GATEWAY_TOKEN` e `GATEWAY_PROTOCOL_VERSION=1.1`.
   Na primeira vez usa `start-browser.ps1 -Install` (instala a interface e baixa o
   Electron; pode levar alguns minutos);
6. quando você fecha o navegador, encerra o gateway.

O app cria o próprio backend e token interno: não suba backend na porta 8000 nem
defina `LAUNCHER_API_TOKEN`. Opções: `-Model opus`, `-MaxOutputTokens 256`, `-Port 8011`.

## 3. Roteiro do primeiro início (sem gastar cota)

1. A janela abre com a página inicial, abas e o painel de agentes à direita.
   O painel mostra "Backend local ativo".
2. Crie um projeto. Em **Adicionar texto**, salve uma anotação com acentos.
3. Abra um site pela barra de endereço. Teste nova aba, fechar, voltar, recarregar.
4. Selecione um trecho e clique em **Capturar**. Revise título, URL e texto e salve.
5. Em agentes, **Claude Code (sonnet) - assinatura** deve aparecer disponível, com
   as indicações de assinatura e limite indicativo.
6. Selecione o agente, escreva um pedido e clique em **Criar plano**: aparece o
   pedido de aceite. Marque **Aceito o limite indicativo para esta tarefa** e crie
   o plano. Ele é salvo; **nenhuma resposta é gerada**.
7. Na janela do gateway devem aparecer apenas `GET /v1.1/models`, nunca
   `POST /v1.1/generate`.
8. Feche e reabra pelo mesmo comando: projeto, materiais e rascunho continuam lá.

Se o agente aparecer indisponível, o motivo vem no cartão e no diagnóstico do
passo 3 do script. Os mais comuns: `not_logged_in` (rode `claude` e faça `/login`)
e `not_subscription_login` (o login ativo é por chave de API).

## O que ainda não funciona

- **Executar a tarefa pelo painel.** Depende da fila/worker durável do Codex; a
  ponte recusa `tasks.execute` de propósito. Geração real só pelo fluxo HTTP de
  desenvolvimento, em etapa separada e com sua autorização.
- Abas logadas no Claude, ChatGPT, Gemini ou NotebookLM não conectam agentes.
- Sem importação automática do NotebookLM, instalador ou atualização automática.

## Atualizar depois

```powershell
cd W:\Projeto\Ia-bbaru-inicio
git fetch origin
git merge --no-edit origin/codex/chromium-browser
git merge --no-edit origin/gemini/chromium-ui
git merge --no-edit origin/claude/vibrant-meitner-ksbzgf
```

Se alguma dependência mudar, rode uma vez `.\scripts\start-browser.ps1 -Install`
com as variáveis do gateway, ou apague `desktop\node_modules` antes de usar o
inicializador (ele refaz a instalação).

Limite desta entrega: o inicializador foi escrito para o PowerShell 5.1 do Windows,
mas **não foi executado** no ambiente do Claude (sem PowerShell). Se falhar, cole
a mensagem; o caminho manual está em [TESTE_PRATICO_1_1.md](TESTE_PRATICO_1_1.md).
