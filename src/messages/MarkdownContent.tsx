/**
 * 安全的 Markdown 渲染组件
 *
 * 用纯 React 元素渲染，天然防 XSS (React 自动转义文本)
 * 支持：代码块、行内代码、加粗、无序列表、有序列表、引用、标题、链接
 *
 * 链接安全：isSafeUrl() 只允许 http/https/mailto/相对路径 协议
 */
import React, { useMemo } from "react";
import styles from "./messages.module.css";

const isSafeUrl = (url: string): boolean => {
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("/")
  );
};

/** 判断是否为普通文本行（不是任何块级语法的起始行） */
const isPlainTextLine = (line: string): boolean => {
  const t = line.trimStart();
  return (
    t.trim() !== "" &&
    t !== "-" &&
    t !== "*" &&
    !t.startsWith("- ") &&
    !t.startsWith("* ") &&
    !t.startsWith("> ") &&
    !t.startsWith("```") &&
    !/^(#{1,6})\s/.test(t) &&
    !/^(\d+)[.、]\s*/.test(t)
  );
};

/** 匹配无序列表标记，返回标记长度；非标记行返回 0 */
const matchUlMarker = (line: string): number => {
  const t = line.trimStart();
  if (t.startsWith("- ") || t.startsWith("* ")) return 2;
  if (t === "-" || t === "*") return 1;
  return 0;
};

/**
 * 读取列表项内容。LLM 常把标记单独放在行尾/独占一行、内容换到下一行，
 * 此时把下一行普通文本并回本项，避免序号与内容错位。
 */
const readListItem = (
  lines: string[],
  startIdx: number,
  markerLen: number,
): { item: string; nextIdx: number } => {
  let item = lines[startIdx]!.trimStart().slice(markerLen);
  let nextIdx = startIdx + 1;
  if (item === "") {
    const next = lines[nextIdx];
    if (next !== undefined && isPlainTextLine(next)) {
      item = next.trim();
      nextIdx++;
    }
  }
  return { item, nextIdx };
};

const parseMarkdown = (text: string): React.ReactNode[] => {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let lineIdx = 0;
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];

  while (lineIdx < lines.length) {
    const line = lines[lineIdx];
    if (line === undefined) break;

    // --- 围栏代码块 ---
    if (line.trimStart().startsWith("```")) {
      if (inCodeBlock) {
        nodes.push(
          <pre key={`code_${lineIdx}`} className={styles.mdPre}>
            <code>{codeBlockLines.join("\n")}</code>
          </pre>,
        );
        inCodeBlock = false;
        codeBlockLines = [];
        lineIdx++;
        continue;
      } else {
        inCodeBlock = true;
        codeBlockLines = [];
        lineIdx++;
        continue;
      }
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      lineIdx++;
      continue;
    }

    // --- 引用块 ---
    if (line.trimStart().startsWith("> ")) {
      const quoteLines: string[] = [];
      while (
        lineIdx < lines.length &&
        lines[lineIdx]?.trimStart().startsWith("> ")
      ) {
        quoteLines.push(lines[lineIdx]!.trimStart().slice(2));
        lineIdx++;
      }
      nodes.push(
        <blockquote key={`quote_${lineIdx}`} className={styles.mdBlockquote}>
          {renderInlineContent(quoteLines.join("\n"))}
        </blockquote>,
      );
      continue;
    }

    // --- 无序列表 ---
    if (matchUlMarker(line) > 0) {
      const items: string[] = [];
      while (lineIdx < lines.length) {
        const current = lines[lineIdx];
        if (current === undefined) break;
        const markerLen = matchUlMarker(current);
        if (markerLen === 0) break;
        const { item, nextIdx } = readListItem(lines, lineIdx, markerLen);
        lineIdx = nextIdx;
        if (item !== "") items.push(item);
      }
      nodes.push(
        <ul key={`ul_${lineIdx}`} className={styles.mdUl}>
          {items.map((item, idx) => (
            <li key={idx}>{renderInlineContent(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // --- 有序列表 ---
    const olMatch = line.trimStart().match(/^(\d+)[.、]\s*/);
    if (olMatch) {
      const items: string[] = [];
      const startNum = Number.parseInt(olMatch[1]!, 10);
      while (lineIdx < lines.length) {
        const current = lines[lineIdx];
        if (current === undefined) break;
        const itemMatch = current.trimStart().match(/^(\d+)[.、]\s*/);
        if (!itemMatch) break;
        const { item, nextIdx } = readListItem(
          lines,
          lineIdx,
          itemMatch[0].length,
        );
        lineIdx = nextIdx;
        if (item !== "") items.push(item);
      }
      nodes.push(
        <ol key={`ol_${lineIdx}`} className={styles.mdOl} start={startNum}>
          {items.map((item, idx) => (
            <li key={idx}>{renderInlineContent(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // --- 标题 ---
    const headingMatch = line.match(/^(#{1,6})\s/);
    if (headingMatch) {
      const level = headingMatch[1]!.length;
      const content = line.slice(headingMatch[0]!.length);
      const headingNodes: Record<number, React.ReactNode> = {
        1: (
          <h1 key={`h_${lineIdx}`} className={styles.mdH1}>
            {renderInlineContent(content)}
          </h1>
        ),
        2: (
          <h2 key={`h_${lineIdx}`} className={styles.mdH2}>
            {renderInlineContent(content)}
          </h2>
        ),
        3: (
          <h3 key={`h_${lineIdx}`} className={styles.mdH3}>
            {renderInlineContent(content)}
          </h3>
        ),
        4: (
          <h4 key={`h_${lineIdx}`} className={styles.mdH4}>
            {renderInlineContent(content)}
          </h4>
        ),
        5: (
          <h5 key={`h_${lineIdx}`} className={styles.mdH5}>
            {renderInlineContent(content)}
          </h5>
        ),
        6: (
          <h6 key={`h_${lineIdx}`} className={styles.mdH6}>
            {renderInlineContent(content)}
          </h6>
        ),
      };
      nodes.push(headingNodes[level]!);
      lineIdx++;
      continue;
    }

    // --- 空行 ---
    if (line.trim() === "") {
      lineIdx++;
      continue;
    }

    // --- 普通段落 ---
    nodes.push(
      <p key={`p_${lineIdx}`} className={styles.mdParagraph}>
        {renderInlineContent(line)}
      </p>,
    );
    lineIdx++;
  }

  if (inCodeBlock && codeBlockLines.length > 0) {
    nodes.push(
      <pre key="code_unclosed" className={styles.mdPre}>
        <code>{codeBlockLines.join("\n")}</code>
      </pre>,
    );
  }

  return nodes;
};

const renderInlineContent = (text: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  const regex = /(`([^`]+)`)|(\*\*(.+?)\*\*)|(\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      parts.push(
        <code key={`ic_${keyIdx++}`} className={styles.mdInlineCode}>
          {match[2]!}
        </code>,
      );
    } else if (match[3]) {
      parts.push(
        <strong key={`ib_${keyIdx++}`} className={styles.mdBold}>
          {match[4]!}
        </strong>,
      );
    } else if (match[5]) {
      const url = match[7]!;
      const linkText = match[6]!;
      if (isSafeUrl(url)) {
        parts.push(
          <a
            key={`ia_${keyIdx++}`}
            href="_blank"
            rel="noopener noreferrer"
            className={styles.mdLink}
          >
            {linkText}
          </a>,
        );
      } else {
        parts.push(`[${linkText}](${url})`);
      }
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
};

const MarkdownContent: React.FC<{ text: string }> = ({ text }) => {
  const nodes = useMemo(() => parseMarkdown(text), [text]);
  return <div className={styles.mdContainer}>{nodes}</div>;
};

export default MarkdownContent;
