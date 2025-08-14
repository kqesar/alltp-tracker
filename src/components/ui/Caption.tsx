import type React from "react";

type CaptionProps = {
  text: string;
};

/**
 * Component to safely render caption text that may contain HTML image tags
 * Converts HTML img tags to React img elements to avoid dangerouslySetInnerHTML
 * @param text - The text content which may contain HTML img tags
 */
export const Caption = ({ text }: CaptionProps) => {
  // If text is empty or just whitespace, return empty span
  if (!text || text.trim() === "" || text === "") {
    return <span />;
  }

  /**
   * Parses HTML text and converts img tags to React elements
   * @param htmlText - Text containing HTML img tags
   * @returns Array of React elements (text and images)
   */
  const parseHtmlText = (htmlText: string): (string | React.ReactElement)[] => {
    const parts: (string | React.ReactElement)[] = [];
    let currentIndex = 0;
    let key = 0;

    // Regular expression to match img tags with src and class attributes
    const imgRegex =
      /<img\s+src=['"]([^'"]*?)['"](?:\s+class=['"]([^'"]*?)['"])?\s*\/?>/gi;
    let match: RegExpExecArray | null;

    // biome-ignore lint/suspicious/noAssignInExpressions: RegExp.exec pattern is standard
    while ((match = imgRegex.exec(htmlText)) !== null) {
      // Add text before the image
      if (match.index > currentIndex) {
        const textBefore = htmlText.slice(currentIndex, match.index);
        if (textBefore) {
          parts.push(textBefore);
        }
      }

      // Extract image information
      const fullMatch = match[0];
      const srcPath = match[1];
      const className = match[2] || "";

      // Create React img element with improved accessibility
      parts.push(
        <img
          alt={className === "mini" ? "Game item icon" : "Item icon"}
          aria-hidden="true"
          className={className}
          key={`img-${key++}`}
          src={srcPath}
        />,
      );

      currentIndex = match.index + fullMatch.length;
    }

    // Add remaining text after the last image
    if (currentIndex < htmlText.length) {
      const textAfter = htmlText.slice(currentIndex);
      if (textAfter) {
        parts.push(textAfter);
      }
    }

    return parts;
  };

  const renderedContent = parseHtmlText(text);

  return (
    <output
      aria-label="Item description"
      aria-live="polite"
      className="caption-output"
    >
      <span className="caption-content">
        {renderedContent.map((part, index) => {
          // Add subtle spacing between text and images
          if (typeof part === "string") {
            return (
              <span
                className="caption-text"
                key={`text-${part.slice(0, 20)}-${index}`}
              >
                {part}
              </span>
            );
          }
          return part;
        })}
      </span>
    </output>
  );
};
