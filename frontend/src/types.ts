export type Project = { id: string; title: string; created_at: string };
export type Source = {
  id: string;
  title: string;
  preview?: string;
  content?: string;
  char_count?: number;
};
export type Model = {
  id: string;
  provider: string;
  label: string;
  available: boolean;
  task_kinds: string[];
};
export type Task = {
  id: string;
  instruction: string;
  status: string;
  created_at: string;
  output?: string | null;
  error?: string | null;
  routing?: { reason: string };
  context?: { id: string; title: string; content: string }[];
  plan: { role: string; model_id: string }[];
  results?: { model_id: string; output: string; role: string }[];
};
export type Capture = { id: string; title: string; url: string; text: string };
export type Page<T> = { items: T[]; next_offset: number | null };
export type Tab = "workspace" | "library" | "history" | "connections";
declare global {
  interface Window {
    browser?: any;
  }
}
