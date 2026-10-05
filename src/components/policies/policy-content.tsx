import type { ReactNode } from "react";

import type { BlockNode, InlineNode } from "@/lib/policies/markdown";

/**
 * Renders parsed policy blocks. Shared by the public policy pages and the admin
 * preview, so what an administrator previews is exactly what gets published.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function renderInline(nodes: InlineNode[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (node.type) {
      case "text":
        return node.value;
      case "bold":
        return (
          <strong key={key} className="font-semibold text-ink">
            {renderInline(node.children, key)}
          </strong>
        );
      case "link": {
        const external = node.href.startsWith("https://");
        return (
          <a
            key={key}
            href={node.href}
            className="font-medium text-brand-700 underline underline-offset-4 hover:text-brand-900"
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {renderInline(node.children, key)}
          </a>
        );
      }
      case "value":
        return EMAIL_PATTERN.test(node.value) ? (
          <a
            key={key}
            href={`mailto:${node.value}`}
            className="font-medium text-brand-700 underline underline-offset-4"
          >
            {node.value}
          </a>
        ) : (
          <span key={key}>{node.value}</span>
        );
      case "placeholder":
        return (
          <mark
            key={key}
            className="policy-placeholder rounded bg-warning-100 px-1 py-0.5 text-[0.92em] font-medium text-warning-700"
          >
            [PLACEHOLDER: {node.label}]
          </mark>
        );
    }
  });
}

export function PolicyBlocks({ blocks, idPrefix }: { blocks: BlockNode[]; idPrefix: string }) {
  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        const key = `${idPrefix}-${index}`;
        switch (block.type) {
          case "paragraph":
            return (
              <p key={key} className="text-[15.5px] leading-[1.75] text-pretty text-ink-soft">
                {renderInline(block.children, key)}
              </p>
            );
          case "note":
            return (
              <p
                key={key}
                className="rounded-xl border border-line bg-paper-deep px-4 py-3.5 text-[14px] leading-relaxed text-ink-soft"
              >
                {renderInline(block.children, key)}
              </p>
            );
          case "subheading":
            return (
              <h3
                key={key}
                className="font-display pt-3 text-[17px] leading-snug font-semibold text-ink"
              >
                {block.text}
              </h3>
            );
          case "list": {
            const ListTag = block.ordered ? "ol" : "ul";
            return (
              <ListTag
                key={key}
                className={
                  block.ordered
                    ? "list-decimal space-y-2 pl-6 text-[15.5px] leading-[1.7] text-ink-soft marker:font-semibold marker:text-ink"
                    : "list-disc space-y-2 pl-6 text-[15.5px] leading-[1.7] text-ink-soft marker:text-brand-500"
                }
              >
                {block.items.map((item, itemIndex) => (
                  <li key={`${key}-${itemIndex}`} className="pl-1">
                    {renderInline(item, `${key}-${itemIndex}`)}
                  </li>
                ))}
              </ListTag>
            );
          }
        }
      })}
    </div>
  );
}
