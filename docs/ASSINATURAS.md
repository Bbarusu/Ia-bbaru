# Conta Claude no Ia-bbaru

O projeto usa somente Claude Code oficial, com o login feito pelo usuário.
Não lê arquivos de credenciais, cookies ou sessões do navegador e não faz
fallback para API paga quando a conta fica indisponível.

Login válido não confirma acesso a todos os modelos. Confira `/model` na CLI
antes de configurar aliases/IDs no aplicativo. Sonnet, Haiku, Opus e Fable
constam na [documentação oficial](https://code.claude.com/docs/en/model-config),
mas acesso, cotas e créditos dependem do plano. Fable pode exigir créditos
adicionais e não é habilitado automaticamente. Nenhum crédito é comprado pelo app.

O navegador guarda materiais e histórico localmente. Ao confirmar a execução,
o texto selecionado e o pedido são enviados à Anthropic pela CLI. Uma revisão
pode fazer uma segunda geração com outro modelo Claude. Cancelamento local não
garante cancelamento no provedor ou devolução de cota.

Configuração e limites: [DIRECAO_CLAUDE_ONLY.md](DIRECAO_CLAUDE_ONLY.md).
