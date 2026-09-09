/**
 * IndicGraphemeCanvasWrapper.ts
 *
 * Rigorous grapheme-safe line wrapping and vertical metrics engine for HTML5 Canvas.
 * Supports: Devanagari, Bengali, Tamil, Telugu, Malayalam, Gurmukhi, Kannada, Odia.
 */

export interface IndicWrapOptions {
  maxWidth: number;
  maxLines?: number;
  fontSize: number;
  fontFamily?: string;
  fontWeight?: string | number;
  lineHeightMultiplier?: number;
  locale?: string;
}

export interface WrappedLine {
  text: string;
  width: number;
  ascent: number;
  descent: number;
}

export interface WrapResult {
  lines: WrappedLine[];
  totalHeight: number;
  isTruncated: boolean;
}

export class IndicCanvasRenderer {
  private static segmenterCache: Map<string, any> = new Map();

  private static getWordSegmenter(locale = "hi-IN"): any {
    const key = `word-${locale}`;
    if (!this.segmenterCache.has(key)) {
      if (typeof Intl !== "undefined" && (Intl as any).Segmenter) {
        this.segmenterCache.set(key, new (Intl as any).Segmenter(locale, { granularity: "word" }));
      } else {
        this.segmenterCache.set(key, null);
      }
    }
    return this.segmenterCache.get(key);
  }

  private static getGraphemeSegmenter(locale = "hi-IN"): any {
    const key = `grapheme-${locale}`;
    if (!this.segmenterCache.has(key)) {
      if (typeof Intl !== "undefined" && (Intl as any).Segmenter) {
        this.segmenterCache.set(key, new (Intl as any).Segmenter(locale, { granularity: "grapheme" }));
      } else {
        this.segmenterCache.set(key, null);
      }
    }
    return this.segmenterCache.get(key);
  }

  /**
   * Splits a string into atomic grapheme clusters so that combining characters (matras, viramas)
   * are never fractured across line breaks or string truncations.
   */
  public static splitIntoGraphemes(text: string, locale = "hi-IN"): string[] {
    if (!text) return [];
    const segmenter = this.getGraphemeSegmenter(locale);
    if (segmenter) {
      return Array.from(segmenter.segment(text)).map((s: any) => s.segment);
    }
    return Array.from(text);
  }

  /**
   * Safely truncates text to a maximum number of grapheme clusters with an ellipsis.
   */
  public static truncateGraphemes(text: string, maxGraphemes: number, ellipsis = "…", locale = "hi-IN"): string {
    if (!text) return "";
    const graphemes = this.splitIntoGraphemes(text, locale);
    if (graphemes.length <= maxGraphemes) return text;
    return graphemes.slice(0, maxGraphemes).join("") + ellipsis;
  }

  /**
   * Wraps multi-line text contextually measuring line width and protecting Indic conjuncts.
   * Can accept a real CanvasRenderingContext2D or a mock/fallback measure function.
   */
  public static wrapIndicText(
    ctx: { measureText: (text: string) => { width: number; actualBoundingBoxAscent?: number; actualBoundingBoxDescent?: number } } | null,
    text: string,
    options: IndicWrapOptions
  ): WrapResult {
    const {
      maxWidth,
      maxLines = 10,
      fontSize,
      lineHeightMultiplier = 1.5,
      locale = "hi-IN",
    } = options;

    const measureWidth = (str: string) => {
      if (ctx && typeof ctx.measureText === "function") {
        return ctx.measureText(str).width;
      }
      // Heuristic fallback for server-side testing: average ~0.6em per Latin char, ~0.8em per Indic cluster
      return str.length * fontSize * 0.65;
    };

    const wordSegmenter = this.getWordSegmenter(locale);
    let tokens: string[] = [];

    if (wordSegmenter) {
      const segments = Array.from(wordSegmenter.segment(text));
      tokens = segments.map((s: any) => s.segment);
    } else {
      tokens = text.match(/\S+|\s+/g) || [text];
    }

    const lines: WrappedLine[] = [];
    let currentLine = "";
    let isTruncated = false;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const candidateLine = currentLine + token;
      const candidateWidth = measureWidth(candidateLine);

      if (candidateWidth <= maxWidth) {
        currentLine = candidateLine;
      } else {
        // If currentLine is non-empty, flush it
        if (currentLine.trim().length > 0) {
          const w = measureWidth(currentLine);
          lines.push({
            text: currentLine.trimEnd(),
            width: w,
            ascent: fontSize * 0.9,
            descent: fontSize * 0.35,
          });

          if (lines.length >= maxLines) {
            isTruncated = true;
            break;
          }
          currentLine = "";
        }

        // Check if token alone exceeds maxWidth
        const tokenWidth = measureWidth(token);
        if (tokenWidth > maxWidth) {
          const graphemes = this.splitIntoGraphemes(token, locale);
          let subLine = "";

          for (const g of graphemes) {
            const candidateSub = subLine + g;
            if (measureWidth(candidateSub) <= maxWidth) {
              subLine = candidateSub;
            } else {
              if (subLine.length > 0) {
                lines.push({
                  text: subLine,
                  width: measureWidth(subLine),
                  ascent: fontSize * 0.9,
                  descent: fontSize * 0.35,
                });
                if (lines.length >= maxLines) {
                  isTruncated = true;
                  break;
                }
              }
              subLine = g;
            }
          }
          if (isTruncated) break;
          currentLine = subLine;
        } else {
          currentLine = token.replace(/^\s+/, "");
        }
      }
    }

    if (!isTruncated && currentLine.trim().length > 0) {
      lines.push({
        text: currentLine.trimEnd(),
        width: measureWidth(currentLine),
        ascent: fontSize * 0.9,
        descent: fontSize * 0.35,
      });
    }

    // Handle ellipsis if truncated
    if (isTruncated && lines.length > 0) {
      const lastIndex = lines.length - 1;
      let lastLine = lines[lastIndex].text;
      while (measureWidth(lastLine + "…") > maxWidth && lastLine.length > 0) {
        const graphemes = this.splitIntoGraphemes(lastLine, locale);
        graphemes.pop();
        lastLine = graphemes.join("");
      }
      lines[lastIndex].text = lastLine + "…";
      lines[lastIndex].width = measureWidth(lines[lastIndex].text);
    }

    const calculatedLineHeight = fontSize * lineHeightMultiplier;
    const totalHeight = lines.length * calculatedLineHeight;

    return { lines, totalHeight, isTruncated };
  }
}
