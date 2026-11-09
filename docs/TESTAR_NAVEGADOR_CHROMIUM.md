# Testar o navegador Ia-bbaru (Chromium)

Base: branch `codex/chromium-browser` em https://github.com/Bbarusu/Ia-bbaru.
É uma aplicação desktop Electron com Chromium incorporado. O Firefox não é
necessário para este caminho. Esta é uma versão de desenvolvimento executada
a partir do código; instalador assinado e atualização automática ainda não existem.

## Windows: abrir a interface

Requisitos: **Node.js 24 LTS**, **Python 3.12** e Git. Use uma pasta própria para
esta branch, preservando as sessões do Claude e do Gemini. Na raiz de um clone:

```powershell
git fetch origin
git worktree add -b teste/chromium ..\Ia-bbaru-chromium origin/codex/chromium-browser
cd ..\Ia-bbaru-chromium
.\scripts\start-browser.ps1 -Install
```

Use o comando `worktree add` apenas na primeira criação dessa pasta/branch. Se ela
já existir, entre nela e atualize sem sobrescrever alterações locais. Nas próximas
aberturas, basta `.\scripts\start-browser.ps1`.

Se a configuração do PowerShell não permitir scripts locais, os comandos
equivalentes na raiz do checkout são:

```powershell
py -3.12 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
npm.cmd --prefix frontend ci
npm.cmd --prefix desktop ci
$env:IA_BBARU_PYTHON = (Resolve-Path .venv\Scripts\python.exe).Path
$env:GATEWAY_PROTOCOL_VERSION = '1.1'
npm.cmd --prefix desktop run build
npm.cmd --prefix desktop start
```

A primeira abertura baixa o binário do Electron se necessário. O app inicia seu
próprio backend em uma porta livre de loopback e provisiona um token interno.
Não exige iniciar uvicorn nem instalar o host no registro do Firefox. O gateway
de agentes continua sendo outro processo, opcional para navegar e guardar materiais.

O perfil fica na pasta de dados de usuário determinada pelo Electron, normalmente
`%APPDATA%\Ia-bbaru`. `local/launcher.sqlite3` guarda projetos/tarefas;
`workspace.json` guarda rascunhos e captura pendente; `Partitions/web` contém a
sessão das páginas. O perfil é separado dos dados da extensão Firefox existente.
`IA_BBARU_PROFILE_DIR` permite escolher uma pasta local alternativa. Não a coloque
no repositório e não copie cookies de outro navegador.

## Primeiro roteiro gráfico — sem usar cota de IA

1. Abra o navegador. Confira a página inicial, barra de endereço e painel de agentes.
2. Crie um projeto no painel. Digite uma anotação em Adicionar texto e salve.
3. Abra um site pela barra de endereço ou um atalho. Teste nova aba, fechar, voltar,
   avançar e recarregar. Use o botão Agentes para mostrar/ocultar o painel e ⤢ para
   ampliar o espaço de trabalho.
4. Selecione um trecho de texto e clique em Capturar, ou use o menu de contexto.
   Confira título, URL e texto na prévia antes de salvar no projeto.
5. Há apenas uma captura persistida pendente por vez. Salve/descarte antes de
   capturar outra. Se estiver escrevendo um material manual, ele é preservado e a
   captura aguarda uma revisão posterior.
6. Feche e abra o app. Confira o projeto, materiais e rascunho do pedido.

Os atalhos NotebookLM, Claude, ChatGPT e Gemini abrem sites reais, não contas
conectadas ao backend. O login depende do suporte de cada serviço a navegadores
incorporados. Não foi validado nesta entrega. O app não importa cadernos/projetos
automaticamente nem usa sessões web como credenciais do gateway.

## Catálogo e planejamento com o gateway 1.1

Inicie o gateway atualizado da PR #1 no checkout do Claude. No terminal de onde
iniciará o navegador, mantenha `GATEWAY_TOKEN` igual ao segredo configurado nesse
gateway e configure:

```powershell
$env:GATEWAY_URL = 'http://127.0.0.1:8010'
$env:GATEWAY_PROTOCOL_VERSION = '1.1'
.\scripts\start-browser.ps1
```

O token não deve ser escrito nos componentes React nem no código. As variáveis
são herdadas somente pelo processo local; o frontend recebe operações limitadas.
O app não lê `.env` automaticamente. Não é preciso definir `LAUNCHER_API_TOKEN`:
ele provisiona seu próprio segredo interno para o backend que iniciou.

No painel, verifique a conexão, selecione um agente do catálogo e descreva a
tarefa. Para limites indicativos, o aceite aparece desmarcado; sem ele o plano
não é enviado. Ao salvar, o backend persiste o aceite e as capacidades. O controle
volta a desmarcado após a criação do plano. Isso não dispara geração.

**A execução de IA pela interface ainda está bloqueada.** A ponte mantém apenas
operações curtas. O próximo passo do Codex é a execução durável com acompanhamento
de estado. A execução HTTP de desenvolvimento existente está documentada em
`TESTAR_GATEWAY_1_1.md`; não foi transformada em um botão síncrono no navegador.

## Verificações automatizadas

Depois de instalar e compilar:

```powershell
.venv\Scripts\python.exe -m unittest discover -s tests -v
npm.cmd --prefix frontend test
npm.cmd --prefix desktop test
$env:IA_BBARU_PYTHON = (Resolve-Path .venv\Scripts\python.exe).Path
npm.cmd --prefix desktop run test:ui
```

`test:ui` abre o Electron real, inicia o backend e a ponte Python reais, usa um
servidor de páginas/catálogo de teste e um perfil temporário. Verifica isolamento,
navegação, captura com acentos, planejamento 1.1, persistência e proteção de
rascunhos. Não chama provedores. Evidências locais: `artifacts/chromium/`.
Os resultados deste ambiente Linux são registrados em `STATUS.md`; execute esses
comandos no seu Windows para validar as particularidades do seu computador.

Linux: use uma sessão gráfica, `npm --prefix desktop ci`, compile a interface e
inicie com `IA_BBARU_PYTHON` apontando para o Python que tem `requirements.txt`.
O teste aceita `IA_BBARU_TEST_NO_SANDBOX=1` somente para ambientes de teste que
não suportem sandbox Chromium; não é a configuração do app nem do Windows.
Esse opt-in foi necessário no contêiner Linux desta entrega por falta do helper
SUID configurado. O teste não comprova a sandbox do sistema operacional; a aplicação
normal mantém a sandbox habilitada e o teste a solicita por padrão.

## Limites desta versão

- Downloads, permissões de câmera/microfone/localização e protocolos externos
  estão desativados até existirem fluxos próprios de autorização/gerenciamento.
- Sem restauração das abas ao reiniciar, favoritos, gerenciador de senhas, extensão
  Chrome, instalador, autoatualização ou garantia de compatibilidade com todos os sites.
- O runtime Chromium é mantido pelo Electron; não é um fork do código do Chrome.
- Backend e gateway precisam do Python local. Empacotá-los no instalador é uma
  entrega posterior. As versões das dependências estão fixadas no lockfile.
