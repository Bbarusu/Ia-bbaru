import { useState, type ReactNode } from "react";
import Markdown from "react-markdown";
import { Check, Copy } from "lucide-react";
import { MARKDOWN_COMPONENTS, MARKDOWN_OPTIONS } from "../markdown.mjs";

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object" && "props" in node)
    return textOf((node as { props: { children?: ReactNode } }).props.children);
  return "";
}

/** Bloco de código com linguagem e "Copiar código". */
function CodeBlock({ children }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const code = textOf(children).replace(/\n$/, "");
  const child = Array.isArray(children) ? children[0] : children;
  const className =
    child && typeof child === "object" && "props" in child
      ? String((child as { props: { className?: string } }).props.className || "")
      : "";
  const language = /language-([\w+-]+)/.exec(className)?.[1];
  return (
    <div className="md-code">
      <div className="md-code-bar">
        <span>{language || "código"}</span>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
          {copied ? "Copiado" : "Copiar código"}
        </button>
      </div>
      <pre>{children}</pre>
    </div>
  );
}

export function AnswerMarkdown({ text }: { text: string }) {
  return (
    <div className="turn-answer markdown">
      <Markdown
        {...MARKDOWN_OPTIONS}
        components={{ ...MARKDOWN_COMPONENTS, pre: ({ children }) => <CodeBlock>{children}</CodeBlock> }}
      >
        {text}
      </Markdown>
    </div>
  );
}
