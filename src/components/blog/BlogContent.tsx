import type { Block } from '@/data/blog';

/** 본문 인라인 마크업 — **굵게**, `코드` 를 안전하게 JSX로 변환. */
function renderInline(text: string, keyBase: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((part, i) => {
    const key = `${keyBase}-${i}`;
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={key} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={key} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={key}>{part}</span>;
  });
}

export function BlogContent({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-5">
      {blocks.map((b, i) => {
        const key = `b-${i}`;
        switch (b.t) {
          case 'h2':
            return (
              <h2 key={key} className="mt-10 text-2xl font-bold tracking-tight text-foreground">
                {b.text}
              </h2>
            );
          case 'p':
            return (
              <p key={key} className="leading-relaxed text-muted-foreground">
                {renderInline(b.text, key)}
              </p>
            );
          case 'ul':
            return (
              <ul key={key} className="list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">
                {b.items.map((it, j) => (
                  <li key={`${key}-${j}`}>{renderInline(it, `${key}-${j}`)}</li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={key} className="list-decimal space-y-2 pl-5 leading-relaxed text-muted-foreground">
                {b.items.map((it, j) => (
                  <li key={`${key}-${j}`}>{renderInline(it, `${key}-${j}`)}</li>
                ))}
              </ol>
            );
          case 'note':
            return (
              <div
                key={key}
                className="rounded-2xl border border-accent/30 bg-accent/8 p-5 leading-relaxed text-foreground"
              >
                💡 {renderInline(b.text, key)}
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
