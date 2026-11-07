export function sourceContent(title, url, text) {
  return url ? `${title}\nOrigem: ${url}\n\n${text}` : text;
}
export function taskState(status) {
  return (
    {
      planned: "Plano pronto",
      running: "Em execução",
      completed: "Concluída",
      failed: "Falhou",
      interrupted: "Interrompida",
      incomplete: "Resposta incompleta",
    }[status] || "Estado desconhecido"
  );
}
export function validateDraft({ projectId, text, selectedModels, review }) {
  if (!projectId) return "Escolha ou crie um projeto.";
  if (!text.trim()) return "Descreva o que você quer fazer.";
  if (text.length > 8000) return "O pedido pode ter até 8.000 caracteres.";
  if (!selectedModels.length) return "Selecione um agente disponível.";
  if (review && selectedModels.length < 2)
    return "A revisão precisa de dois agentes diferentes.";
  return null;
}
