> Direção vigente: [Claude exclusivo](https://github.com/Bbarusu/Ia-bbaru/blob/codex/browser-capture-clis/docs/DIRECAO_CLAUDE_ONLY.md). As referências abaixo a outros provedores são histórico; não reinstalar suas integrações.

# Claude — correções da revisão dos adaptadores

Repositório https://github.com/Bbarusu/Ia-bbaru. Leia docs/REVISAO_CLIS_2026_11_10.md
na branch codex/browser-capture-clis. Ela reúne sua entrega 732b0ac, Gemini fd2a574
e a compatibilidade do Codex. Preserve alterações locais ao atualizar sua branch.

Corrija em integrations/ e tests/integrations/:
1. Gemini: não anunciar subscription_quota/Google login verificado apenas por
   IA_BBARU_GEMINI_CLI_LOGIN. Force/verifique o modo Google sem ler/expor segredos;
   se não for possível, mantenha indisponível com motivo existente. Cubra API key
   salva na própria CLI e variáveis de ambiente. Sem fallback para cobrança API.
2. Gemini: rejeitar saída de modelo diferente mesmo quando stats.models também
   contém tokens do solicitado. Há uma reprodução mínima no documento. Esperado:
   provider_model_mismatch, erro final e sem repetição.
3. Codex: preservar tools=restricted. O backend continuará recusando planejamento.
   Não alterar para disabled nem habilitar ferramentas por simples aceite.
4. Preservar unknown, saída parcial e ausência de revisão automática. Não fabricar stop.
5. Verificar no Windows a resolução .exe/.cmd, timeout do catálogo e fechamento
   de processos/SQLite. Registre SHA, plataforma e comandos; testes com fixtures.

O Codex acrescentou connections.list com diagnóstico sanitizado, captura real e
armazenamento raster separado do texto. O contrato 1.1 continua textual e não envia
pixels. Para suporte visual, proponha contrato versionado com tipos MIME/tamanho,
capacidades de entrada por modelo, vínculo por projeto, aceite e tratamento de
cada CLI. Não habilite visão usando base64 dentro de ContextItem.content.

Não use conta real nem faça geração como parte desta revisão automática. Entregue
PR com regressões e evidência; o Codex revalida a integração.

