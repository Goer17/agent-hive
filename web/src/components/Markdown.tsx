import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkCjkFriendly from "remark-cjk-friendly";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import { ImageOff } from "lucide-react";
import { normalizeTables, remarkPromoteInlineFractions } from "../lib/markdown";

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
      <ReactMarkdown
        remarkPlugins={[[remarkGfm, { singleTilde: false }], remarkCjkFriendly, remarkMath, remarkPromoteInlineFractions]}
        rehypePlugins={[rehypeKatex]}
        components={{ img: MarkdownImage }}
      >
        {normalizeTables(text)}
      </ReactMarkdown>
    </div>
  );
}

function MarkdownImage({
  src,
  alt,
  title,
}: React.ComponentPropsWithoutRef<"img">): React.JSX.Element {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed || !src) {
    return (
      <span
        className="markdown-image-fallback"
        role="img"
        aria-label={alt ? `${alt}（图片无法加载）` : "图片无法加载"}
        title="图片无法加载"
      >
        <ImageOff size={14} aria-hidden="true" />
      </span>
    );
  }

  return (
    <img
      className="markdown-image"
      src={src}
      alt=""
      aria-label={alt || undefined}
      title={title}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}