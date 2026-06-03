import React, { useState } from "react";
import { Copy, Check, Lightbulb } from "lucide-react";

export default function SuggestionBox({ suggestions = "" }) {
  const [copiedIndex, setCopiedIndex] = useState(null);

  const handleCopy = (code, index) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => {
      setCopiedIndex(null);
    }, 2000);
  };

  // Custom parser to split markdown text into chunks (ordinary text vs code blocks)
  const parseMarkdown = (text) => {
    if (!text) return [];
    
    const parts = [];
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    
    let lastIndex = 0;
    let match;
    let blockIndex = 0;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      // Push text block before the code block
      if (match.index > lastIndex) {
        parts.push({
          type: "text",
          content: text.substring(lastIndex, match.index)
        });
      }

      // Push code block details
      parts.push({
        type: "code",
        language: match[1] || "plaintext",
        content: match[2].trim(),
        index: blockIndex++
      });

      lastIndex = codeBlockRegex.lastIndex;
    }

    // Push trailing text block
    if (lastIndex < text.length) {
      parts.push({
        type: "text",
        content: text.substring(lastIndex)
      });
    }

    return parts;
  };

  const renderTextChunk = (content) => {
    // Basic parser for inline headers, bold tags, and list bullets
    return content.split("\n").map((line, idx) => {
      const trimmed = line.trim();
      
      // Headers
      if (trimmed.startsWith("### ")) {
        return (
          <h4 key={idx} className="text-md font-bold text-slate-800 dark:text-slate-100 mt-4 mb-2">
            {trimmed.replace("### ", "")}
          </h4>
        );
      }
      if (trimmed.startsWith("## ")) {
        return (
          <h3 key={idx} className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-6 mb-3 border-b border-slate-200 dark:border-slate-800 pb-2">
            {trimmed.replace("## ", "")}
          </h3>
        );
      }
      if (trimmed.startsWith("# ")) {
        return (
          <h2 key={idx} className="text-xl font-bold text-slate-900 dark:text-slate-50 mt-8 mb-4">
            {trimmed.replace("# ", "")}
          </h2>
        );
      }

      // Lists
      if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
        const text = trimmed.substring(2);
        return (
          <li key={idx} className="ml-4 list-disc text-slate-600 dark:text-slate-300 mb-1 leading-relaxed">
            {renderBoldText(text)}
          </li>
        );
      }

      // Normal paragraph
      if (trimmed === "") return <div key={idx} className="h-2" />;
      return (
        <p key={idx} className="text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
          {renderBoldText(line)}
        </p>
      );
    });
  };

  const renderBoldText = (text) => {
    // Basic parser for **bold** text
    const parts = text.split(/\*\*([\s\S]*?)\*\*/g);
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return <strong key={index} className="font-semibold text-slate-900 dark:text-white">{part}</strong>;
      }
      // Parse inline code tags `code`
      return renderInlineCode(part);
    });
  };

  const renderInlineCode = (text) => {
    const parts = text.split(/`([\s\S]*?)`/g);
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return (
          <code key={index} className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded text-xs text-rose-500 font-mono">
            {part}
          </code>
        );
      }
      return part;
    });
  };

  const parsedChunks = parseMarkdown(suggestions);

  return (
    <div className="glass-card rounded-2xl p-6 h-full flex flex-col border border-slate-200 dark:border-slate-800">
      <div className="flex items-center gap-2 mb-4 text-amber-500">
        <Lightbulb size={20} className="shrink-0" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
          Remediation & Suggestions
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-sm">
        {suggestions ? (
          parsedChunks.map((chunk, index) => {
            if (chunk.type === "text") {
              return <div key={index}>{renderTextChunk(chunk.content)}</div>;
            } else {
              return (
                <div key={index} className="relative group my-4 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 font-mono text-xs">
                  {/* Code Block Header */}
                  <div className="flex justify-between items-center px-4 py-2 bg-slate-900 text-slate-400 text-[10px] select-none uppercase">
                    <span>{chunk.language}</span>
                    <button
                      onClick={() => handleCopy(chunk.content, chunk.index)}
                      className="flex items-center gap-1 hover:text-white transition-colors duration-200"
                    >
                      {copiedIndex === chunk.index ? (
                        <>
                          <Check size={12} className="text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  {/* Code Content */}
                  <pre className="p-4 overflow-x-auto text-slate-300 select-all leading-relaxed whitespace-pre">
                    <code>{chunk.content}</code>
                  </pre>
                </div>
              );
            }
          })
        ) : (
          <div className="text-slate-500 text-center py-10 font-medium">
            No compliance suggestions available. Scan a repository to generate AI recommendations.
          </div>
        )}
      </div>
    </div>
  );
}
