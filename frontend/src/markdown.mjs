import { createElement } from "react";
import { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Markdown das respostas do Claude. Segurança:
 * - HTML bruto (da IA ou de páginas citadas) aparece como texto, nunca como
 *   elemento: não há rehype-raw nem dangerouslySetInnerHTML;
 * - links só http(s), mailto ou âncora; o resto vira link vazio;
 * - imagens não carregam (evita rastreio/requisição a terceiros): viram link.
 */
const SAFE_URL = /^(https?:|mailto:|#)/i;

export function safeUrl(url) {
  const value = defaultUrlTransform(String(url || ""));
  return SAFE_URL.test(value) ? value : "";
}

const strip = ({ node, ...props }) => props;

export const MARKDOWN_COMPONENTS = {
  a: (props) => {
    const { href, children, ...rest } = strip(props);
    if (!href) return createElement("span", rest, children);
    return createElement("a", { ...rest, href, target: "_blank", rel: "noopener noreferrer" }, children);
  },
  img: (props) => {
    const { src, alt } = strip(props);
    const label = `Imagem: ${alt || "sem descrição"}`;
    return src
      ? createElement("a", { href: src, target: "_blank", rel: "noopener noreferrer", className: "md-image-link" }, label)
      : createElement("span", null, label);
  },
  // Tabela larga rola dentro do próprio bloco, nunca a conversa.
  table: (props) =>
    createElement("div", { className: "md-table", role: "region", "aria-label": "Tabela", tabIndex: 0 },
      createElement("table", strip(props))),
};

export const MARKDOWN_OPTIONS = {
  remarkPlugins: [remarkGfm],
  urlTransform: safeUrl,
  components: MARKDOWN_COMPONENTS,
};
