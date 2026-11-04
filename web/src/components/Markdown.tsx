import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownProps {
  text: string;
  className?: string;
}

/**
 * Renders message text strictly as GitHub-flavored Markdown.
 *
 * Raw HTML is not enabled (no rehype-raw), so agent-provided HTML stays inert
 * and is treated as text. Links are sanitized by react-markdown's default URL
 * transform, which rejects javascript: and other unsafe protocols.
 */
export function Markdown({ text, className }: MarkdownProps): React.JSX.Element {
  return (
    <div className={className ? `markdown-body ${className}` : "markdown-body"}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}