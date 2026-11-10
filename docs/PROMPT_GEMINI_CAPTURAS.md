# Gemini — continuar sobre o runtime integrado

Repositório https://github.com/Bbarusu/Ia-bbaru. Sua entrega fd2a574 foi combinada
na branch codex/browser-capture-clis, preservando o visual e removendo sub-abas.
Leia docs/REVISAO_CLIS_2026_11_10.md e docs/CONTRATO_CAPTURAS.md. Não volte à base
antiga: preserve seu trabalho local e integre essa branch antes de continuar.

O Codex ligou busca, zoom, minimizar, reabrir aba, captura de tela, imagem visível
(menu de contexto) e importação local ao processo principal. Os atalhos de contexto
só capturam para revisão. Não iniciam geração automaticamente.

Use Source.media para imagens; não escreva AnexoVisual/base64 dentro de content e
não trunque arquivos. O backend valida PNG/JPEG e impede mídia no gateway textual.
A biblioteca guarda imagens, mas não oferece análise visual como se já existisse.
Descrição textual manual é um material diferente. A URL externa não é prévia de
imagem confiável; não abra o CSP nem busque imagens arbitrárias pelo backend.

Na UI, preserve:
- fila e confirmação de execução; resultados unknown informativos, sem revisão;
- cartão Codex visível e marcado como não elegível por ferramentas;
- Gemini com login declarado, nunca apresentado como autenticação verificada;
- connections.list para versão/status sanitizados; sem fetch direto ao gateway;
- captura pendente, rascunhos e consentimentos quando chegar uma nova captura;
- #tabs como grupo de botões com aria-pressed e foco/teclado preservados.

A própria página inicial ainda contém textos de apresentação ambiciosos. Evite
anunciar navegador completo, IA 100% local ou visão pronta: os modelos rodam nos
provedores e ainda faltam downloads/permissões/instalador. Preserve a direção
visual escolhida pelo usuário, alterando apenas textos que descrevam capacidade
inexistente.

Rode frontend test, desktop test, build e desktop test:ui. Verifique 900x640,
painel estreito, imagem pequena/inválida/grande e retomada do trabalho ao reabrir.
Registre dependências de runtime em documento e não simule sucesso de controles.


Leia também integrations/docs/PASSAGEM_GEMINI_NAVEGADOR.md (Claude db8cee4).
A passagem amplia sua atuação no runtime. Integre nossa base antes: busca, zoom,
minimizar, reabrir e capturas já estão ligados e testados. Continue a partir deles
as funções restantes do roteiro, sem substituir main.cjs pela versão antiga.
