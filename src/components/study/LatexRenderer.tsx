import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface LatexRendererProps {
  content: string;
  className?: string;
  displayMode?: boolean;
}

export function LatexRenderer({ content, className = '', displayMode = false }: LatexRendererProps) {
  // Fix 3: Handle partial markdown/math during streaming and style inline code
  const components = {
    // Custom renderer for inline code (backticks)
    code: ({ node, inline, className, children, ...props }: any) => {
      const isInline = inline || !className?.includes('language-');
      if (isInline) {
        return (
          <code
            className="bg-muted px-1.5 py-0.5 rounded-md text-xs font-mono font-medium border border-border/40"
            {...props}
          >
            {children}
          </code>
        );
      }
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
    // Fallback for math if not handled by a plugin, or we can use our existing logic
    // Actually, react-markdown doesn't natively split math without remark-math.
    // We'll pre-process the content to handle LaTeX specifically while using react-markdown for the rest.
  };

  const processedContent = useMemo(() => {
    // We'll wrap LaTeX in a way that doesn't break markdown but we can still identify it.
    // However, the simplest robust way is to just use react-markdown and handle math as text 
    // that we post-process, OR just use react-markdown for overall structure.

    // Let's try to render the math strings separately using our old logic but wrapped in a try-catch.
    try {
      // Improved regex to handle:
      // 1. $$...$$ (Display)
      // 2. $...$ (Inline)
      // 3. \[...\] (Display)
      // 4. \(...\) (Inline)
      const parts = content.split(/(\$\$[\s\S]*?\$\$|\$[^$]+\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g);
      
      return parts.map((part, index) => {
        if (!part) return null;

        // Check for display math ($$ ... $$ or \[ ... \])
        if ((part.startsWith('$$') && part.endsWith('$$')) || (part.startsWith('\\[') && part.endsWith('\\]'))) {
          const isSquare = part.startsWith('\\[');
          const latex = isSquare ? part.slice(2, -2) : part.slice(2, -2);
          try {
            const html = katex.renderToString(latex, {
              throwOnError: false,
              displayMode: true,
              output: 'html',
            });
            return (
              <div
                key={index}
                className="latex-content py-2 overflow-x-auto text-center"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          } catch (e) {
            return <div key={index} className="text-destructive font-mono text-center p-2 bg-muted/50 rounded">{part}</div>;
          }
        }

        // Check for inline math ($ ... $ or \( ... \))
        if ((part.startsWith('$') && part.endsWith('$')) || (part.startsWith('\\(') && part.endsWith('\\)'))) {
          const isRound = part.startsWith('\\(');
          const latex = isRound ? part.slice(2, -2) : part.slice(1, -1);
          try {
            // Auto-detect if inline math should be rendered in display mode based on common symbols
            const autoDisplay = latex.includes('\\frac') || latex.includes('\\sum') || latex.includes('\\int') || latex.includes('\\sqrt');
            const html = katex.renderToString(latex, {
              throwOnError: false,
              displayMode: displayMode || autoDisplay,
              output: 'html',
            });
            return (
              <span
                key={index}
                className={cn(
                  "latex-content inline-block align-middle",
                  autoDisplay && "py-1"
                )}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          } catch (e) {
            return <span key={index} className="text-destructive font-mono">{part}</span>;
          }
        }

        // For non-math parts, use ReactMarkdown
        return (
          <span key={index} className="inline-markdown">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={components}
            >
              {part}
            </ReactMarkdown>
          </span>
        );
      });
    } catch (error) {
      console.error('Markdown/LaTeX render error:', error);
      return <span>{content}</span>;
    }
  }, [content, displayMode]);

  return (
    <span className={`latex-wrapper break-words ${className}`}>
      {processedContent}
    </span>
  );
}

export function LatexBlock({ content, className = '' }: { content: string; className?: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(content, {
        throwOnError: false,
        displayMode: true,
        output: 'html',
      });
    } catch (error) {
      return content;
    }
  }, [content]);

  return (
    <div
      className={`latex-block overflow-x-auto py-2 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
