# Prompt para o Gemini — frontend do navegador Chromium

Copie o texto abaixo para o Gemini.

---

Mudamos a direção do Ia-bbaru por decisão do usuário: agora construiremos um
navegador desktop com Chromium, usando Electron. Repositório:
https://github.com/Bbarusu/Ia-bbaru. A nova base obrigatória é
`origin/codex/chromium-browser`, que já contém uma versão executável. Leia
`docs/ARQUITETURA.md`, `docs/STATUS.md` e `docs/TESTAR_NAVEGADOR_CHROMIUM.md` nessa
branch. O briefing Firefox anterior é histórico para esta frente.

Crie `gemini/chromium-ui` a partir dessa base, preservando alterações locais.
Não aplique a branch antiga inteira por cima: as mudanças de transporte, aceite e
preservação de captura desta nova base precisam continuar funcionando. Reaproveite
as melhorias visuais/componentes da PR #3 seletivamente, com testes.

Sua responsabilidade é UI/UX e componentes em `frontend/`, mais o visual da
barra de abas/endereço e nova aba em `desktop/ui/`. Codex mantém `desktop/main.cjs`,
preloads, política de navegação/IPC, ciclo do backend, `backend/` e `native_host/`.
Claude mantém `integrations/`. Não altere essas fronteiras para contornar limitações.

Objetivo: refinar a experiência de navegador + espaço de agentes seguindo KInfo
(preto, superfícies discretas, azul, cantos arredondados, tipografia legível).
A nova aba deve parecer parte do mesmo produto, e o painel deve funcionar tanto
estreito quanto ampliado. Preserve abas reais, URL real, estados de carregamento/
erro, atalhos, controles por teclado e indicação de painel aberto. Não simule
conexões de IA. Abra sites pelos comandos permitidos, nunca por webview/iframe
privilegiado ou acesso direto a Node/IPC.

O painel usa `window.iaDesktop` pelo adaptador `frontend/src/transport.ts`; Firefox
continua como compatibilidade. Não volte a fazer chamadas diretas a `window.browser`
nos componentes. A shell usa `window.navigatorApp`. Veja as interfaces nos preloads;
não exponha novas operações genéricas. Tokens permanecem no processo local.

Integre/refine capacidades 1.1: assinatura versus API, limite indicativo, motivo
de indisponibilidade, cancelamento apenas local, aceite por tarefa desmarcado e
cópia das capacidades no plano. A base já envia/persiste o aceite e exige a opção
quando necessária. Preserve isso, mantenha compatibilidade com v1 e traduza
`completion_unconfirmed` para uma explicação compreensível com a saída disponível.
O checkbox não inicia geração. Não habilite execução: a ponte ainda recusa
`tasks.execute` até o Codex entregar execução durável.

Captura: a base desktop mantém uma captura pendente e impede substituí-la antes
de salvar/descartar. Se chegar enquanto há edição manual, o formulário é preservado
e a captura fica aguardando. Preserve esse comportamento e cubra concorrência,
foco e revisão da origem. Não faça extração automática de cadernos, cookies ou
conteúdo de outras abas. Login em um site não significa agente conectado.

Execute os testes do frontend e desktop, build e `desktop` → `npm run test:ui`.
Acrescente testes de comportamento para suas mudanças, com o Electron real quando
afetarem navegação/painel. Teste janela 900×640, painel estreito e espaço ampliado;
verifique contraste, foco, nomes acessíveis e rolagem. Não basta testar strings CSS.
Entregue capturas reais, comandos, limites da validação e o SHA. Abra PR com base
`codex/chromium-browser`, sem merge nem force push.
