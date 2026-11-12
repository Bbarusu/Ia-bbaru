# Capturas do navegador e backend

Branch de revisão: codex/browser-capture-clis. Gateway 1 e 1.1 não mudam.
As imagens são materiais locais; envio multimodal ainda requer contrato próprio.

## Runtime (somente páginas internas autorizadas)

Shell navigatorApp.command:
- capture: seleção de texto, até 38.000 caracteres.
- capture.page: texto da página (ação explícita de contexto/resumo). Se exceder
  38.000 caracteres, solicita seleção menor, sem truncar silenciosamente.
- capture.screenshot: área visível da aba web; recusa página interna, mudança de
  documento durante a captura e captura pendente.
- capture.image: seletor nativo de arquivo local, sem carregar URL arbitrária.
- find: {text,forward}, até 500 caracteres, findInPage/stopFindInPage do Chromium.
- zoom: número de 50 a 200, aplicado à página.
- minimize e reopen: janela real e última aba fechada; Ctrl+Shift+T também funciona.

Contexto da página: “Capturar área visível da imagem” rasteriza apenas o recorte
visível de IMG. Em frames inacessíveis, use o print da aba. Não extrai imagem
oculta/não renderizada e não faz requisições HTTP extras para contornar CORS.
Campos de formulário, cookies e sessões não são importados como credenciais.

Painel: capture.screenshot e capture.image via iaDesktop.runtime.sendMessage.
A captura é publicada em workspace:changed/pendingCapture e exige revisão. Há uma
captura pendente por vez. Uma nova captura não substitui material em edição.
Fechar o diálogo não descarta a captura persistida; salvar/descartar faz isso.

## Materiais

sources.create conserva project_id, title e content e aceita media opcional:
```json
{"kind":"screenshot","data_url":"data:image/jpeg;base64,..."}
```
kind é image ou screenshot. O backend aceita somente PNG/JPEG válidos, até
480.000 bytes, 16 megapixels e 8.000 pixels por dimensão. A entrada/saída fica
dentro do limite da ponte. Importação WebP é convertida no frontend/runtime.
Arquivos locais de entrada têm limite de 10 MB e podem ser reduzidos para caber;
o usuário vê a imagem que será salva. Nunca cortar uma string base64.

SQLite: source_media (source_id com chave estrangeira; body). Sem alterar as
colunas existentes de sources. A transação salva texto e imagem juntos.
sources.get devolve media com data_url, kind, MIME, dimensões e byte_count.
sources.list devolve apenas metadados, sem data_url, inclusive para paginação.
A busca por detalhe exige que o material pertença ao projeto informado.

A criação de tarefa rejeita imagens com visual_context_not_supported. A execução
também revalida planos antigos contendo AnexoVisual:. Nenhuma imagem/base64 é
transformada em evidência textual ou enviada ao gateway como se fosse visão.
Pode-se criar um material textual separado com uma descrição/transcrição manual.

## Diagnósticos

connections.list → GET /v1/connections do backend → endpoint experimental do
gateway. Retorna somente provider, version numérica, installed, ready, configured
e reason conhecido. Não transfere detail, next_action, segredos ou texto livre.
A UI consulta quando o usuário abre Conexões, sem bloquear o catálogo inicial.

## Verificar

Instalar requirements.txt (agora inclui Pillow). Rodar suíte Python, frontend e
desktop; build seguido de desktop test:ui. O teste gráfico usa fixtures, verifica
captura real, recorte de imagem, importação pequena, busca/zoom e preservação de
rascunhos. Captura não executa IA. Não testar com conta real automaticamente.

