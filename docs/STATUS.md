# Estado do Ia-bbaru

Atualizado em 6 de novembro de 2026.

## Implementado

- Backend local Python/FastAPI com SQLite.
- Autenticação por token único para uso pessoal local.
- Projetos, fontes de texto, tarefas e histórico.
- Plano com modelo principal e revisão opcional por segundo modelo.
- Seleção por categorias configuradas e preferência, com explicação.
- Cópia do contexto selecionado por tarefa e validação de vínculo com o projeto.
- Proteção contra execução concorrente/repetida da mesma tarefa.
- Registro de respostas parciais, truncamentos e interrupção após reinício.
- Contrato HTTP de gateway para API e schemas OpenAPI exportados.
- 14 testes automatizados locais; sem inferência real ou credenciais de provedores.
- Briefings separados de integração (Claude) e frontend/extensão (Gemini), com
  repositório e responsabilidades definidos.

## Não implementado

Frontend, extensão Firefox, host Native Messaging, autenticação das contas de IA,
adaptadores reais, OAuth, importação de notebooks/projetos, execução por CLI,
fila durável, multiusuário e deploy público do aplicativo.
Não há conta conectada nem uso de assinatura validado.

## Decisão atual

Primeiro validar a experiência numa extensão Firefox com backend local, usando
Gecko pelo Firefox instalado. Avaliar navegador próprio posteriormente.
Ver docs/ARQUITETURA.md e docs/TRANSPORTE_EXTENSAO.md; a ponte local é proposta,
ainda não implementação.

Priorizar contas e assinaturas existentes. Ver docs/ASSINATURAS.md. O gateway v1
é base para APIs com chave; precisa evoluir por capacidades antes de conectar
transportes com outras garantias, especialmente de limite de saída.

## Colaboração

- Codex: backend principal e coordenação das tarefas.
- Claude: investigar e implementar integrações dos agentes, seguindo o contrato
  acordado e comunicando mudanças de capacidades.
- Gemini: frontend e extensão Firefox, com cliente de transporte desacoplado.
- Design: seguir docs/DESIGN.md, com o KInfo como referência.
- Repositório criado pelo usuário e acessível: https://github.com/Bbarusu/Ia-bbaru.
  Visibilidade encontrada: pública. Preservar a configuração do usuário.

## Próximo marco

Gemini: painel e captura explícita de contexto. Claude: validar uma integração
oficial compatível com a conta. Codex: implementar a ponte local e evoluir o backend
para execução durável antes de habilitar execução pelo painel. Cada frente usa sua
branch; os briefings indicam nomes e critérios de aceite.

Não incluir no GitHub bancos locais, segredos, sessões de contas ou documentos
pessoais. Guardar código, contratos, testes e decisões de projeto.
