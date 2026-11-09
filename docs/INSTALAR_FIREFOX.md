# Instalar e testar no Firefox

Esta é uma versão de desenvolvimento para uso pessoal. Usa o Firefox instalado
(Gecko), com painel lateral e uma página ampla da extensão. Não é um fork do navegador.
Projetos e materiais funcionam sem conectar uma IA. A extensão cria planos quando
há um gateway compatível; ainda não inicia gerações.

## Windows — PowerShell

Instale Python 3.12, Node.js 22.12+ e Firefox 142 ou mais recente. Faça o clone e
use a branch desta entrega enquanto o PR não estiver integrado:

```powershell
git clone https://github.com/Bbarusu/Ia-bbaru.git
cd Ia-bbaru
git switch codex/frontend-firefox
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
cd frontend
npm ci
npm run build
cd ..
.\.venv\Scripts\python.exe -m native_host.install --state-dir "$env:LOCALAPPDATA\Ia-bbaru" --register
.\.venv\Scripts\python.exe -m native_host.service --config "$env:LOCALAPPDATA\Ia-bbaru\config.json"
```

Deixe o último terminal aberto. O instalador cria um segredo aleatório, configuração,
launcher e manifesto local, e registra o host **somente para seu usuário** em
`HKCU\Software\Mozilla\NativeMessagingHosts\ia_bbaru.bridge`. Não exige acesso de
administrador. O segredo nunca é colocado na extensão. Uma reinstalação preserva
configuração e banco existentes; `--port` só altera a configuração na primeira instalação.

No Firefox:

1. Abra `about:debugging#/runtime/this-firefox`.
2. Escolha **Carregar extensão temporária** e selecione `extension/manifest.json`.
3. Clique no ícone Ia-bbaru da barra de extensões para abrir o painel.
4. Crie um projeto. Em uma página HTTP/HTTPS, selecione texto e use o menu de
   contexto **Adicionar ao Ia-bbaru**. Revise título, origem e texto antes de salvar.
5. Use **Expandir painel** para abrir a área de trabalho em uma aba ampla.

A extensão temporária precisa ser carregada novamente após reiniciar o Firefox.
Distribuição assinada e atualização automática ficam para uma etapa posterior.
Após editar a interface, rode `npm run build` em `frontend/` e recarregue a extensão
no `about:debugging`. Mantenha o clone e o ambiente Python no mesmo local; ao mover,
repita o instalador com o Python do novo ambiente.

## Linux e macOS

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
cd frontend
npm ci
npm run build
cd ..
.venv/bin/python -m native_host.install --state-dir "$PWD/.local-state" --register
.venv/bin/python -m native_host.service --config "$PWD/.local-state/config.json"
```

O diretório `.local-state/` é ignorado pelo Git. O registro fica em
`~/.mozilla/native-messaging-hosts/ia_bbaru.bridge.json` no Linux, ou
`~/Library/Application Support/Mozilla/NativeMessagingHosts/ia_bbaru.bridge.json`
no macOS. Instalações Firefox em Snap/Flatpak podem precisar de configuração
específica para acessar hosts fora do contêiner; não foram validadas nesta entrega.

## Estados e limites

- **Componente local:** processo Native Messaging encontrado pelo Firefox.
- **Backend local:** serviço Python acessível. A biblioteca já pode ser usada.
- **Serviço de IA:** catálogo de um gateway compatível. Login em um site de IA
  não conecta automaticamente uma assinatura a este backend.
- Sem gateway, o painel mostra nenhuma IA conectada e mantém os materiais acessíveis.
- A PR de integrações do Claude está em revisão. Não habilite o aceite experimental
  de limite de saída como forma de completar a instalação; veja `REVISAO_CLAUDE.md`.
- O NotebookLM é atendido nesta etapa por texto selecionado/colado e origem
  registrada. Não há importação automática de cadernos ou projetos de outros apps.
- O menu de contexto funciona após escolha explícita de texto. Páginas internas
  do Firefox e páginas protegidas podem impedir a captura. Colar texto é alternativa.
- Há até 20 materiais por pedido; o frontend não trunca conteúdo silenciosamente.
- Após timeout de uma criação, atualize a listagem antes de repetir a ação.
- Rascunhos e um trecho aguardando revisão ficam no armazenamento da extensão.
  Fontes salvas ficam no SQLite local. Nenhum desses dados é enviado ao GitHub.

## Prévia visual sem instalar

Em `frontend/`, execute `npm run dev` e abra `http://127.0.0.1:5173/?demo=1`.
O aviso de demonstração permanece visível; os dados são fictícios e nenhuma IA é
executada. Sem `?demo=1`, um navegador comum mostra o estado desconectado.

## Remover o registro local

Feche o backend e remova a extensão pelo Firefox. No Windows, execute:

```powershell
Remove-Item -LiteralPath 'HKCU:\Software\Mozilla\NativeMessagingHosts\ia_bbaru.bridge'
```

No Linux/macOS, remova apenas o manifesto `ia_bbaru.bridge.json` do diretório de
registro listado acima. A remoção do registro preserva seu banco; apague o diretório
de estado separadamente apenas se quiser excluir seus dados. O instalador não
altera perfis nem configurações de outros navegadores.

## O que foi validado

Build TypeScript/Vite, testes de protocolo e subprocesso Native Messaging, backend
real com banco temporário e fluxos de interface no Firefox/Gecko headless em Linux.
No teste de UI, as APIs WebExtensions são simuladas; o backend e a ponte Python são
reais. Instalação pelo registro Windows, captura por menu nativo e transporte
Firefox→host precisam de confirmação no computador de uso. Nenhuma conta de IA
real foi utilizada nesses testes.

Validação desta entrega: 23 testes Python, 6 testes JavaScript, build TypeScript/Vite
e fluxos de UI no Firefox 153. O `web-ext lint` terminou sem erros, com dois avisos
de `innerHTML` no runtime empacotado do React. O código do aplicativo não usa HTML
cru; conteúdo com `<script>` foi testado como texto, sem execução.
