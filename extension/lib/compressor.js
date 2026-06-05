/**
 * Compressor
 * Minifies JavaScript while preserving string literal contents.
 *
 * The naive approach of running regexes over the full source breaks when
 * cookie/localStorage values contain characters like:
 *   - "//" (treated as a comment start)
 *   - ";" (spacing stripped around it, corrupting cookie attribute strings)
 *   - whitespace sequences inside JSON values
 *
 * This implementation tokenises the source into string-literal segments and
 * code segments, only compresses code segments, then reassembles.
 */

class Compressor {
  /**
   * Compress JavaScript code, preserving string literal contents
   * @param {string} code - The uncompressed JS source
   * @returns {string} Minified JavaScript
   */
  compress(code) {
    // Split into alternating [code, string, code, string, ...] segments.
    // Handles both double-quoted and single-quoted strings with escape sequences.
    const segments = this._tokenise(code);

    // Compress only the code segments (even indices)
    const compressed = segments.map((seg, i) => {
      if (i % 2 === 0) {
        return this._compressCode(seg);
      }
      // Odd segments are string literals — return untouched
      return seg;
    }).join('');

    return compressed.trim();
  }

  /**
   * Split source into alternating code/string-literal segments.
   * Index 0, 2, 4 … are code; index 1, 3, 5 … are string literals
   * (including the surrounding quotes).
   * @param {string} source
   * @returns {string[]}
   */
  _tokenise(source) {
    const segments = [];
    let i = 0;
    let codeStart = 0;

    while (i < source.length) {
      const ch = source[i];

      // Start of a string literal
      if (ch === '"' || ch === "'") {
        // Flush accumulated code segment
        segments.push(source.slice(codeStart, i));

        const quote = ch;
        let j = i + 1;
        while (j < source.length) {
          if (source[j] === '\\') {
            j += 2; // skip escaped character
          } else if (source[j] === quote) {
            j++; // include closing quote
            break;
          } else {
            j++;
          }
        }

        // Push string literal segment (including quotes)
        segments.push(source.slice(i, j));
        i = j;
        codeStart = i;
      } else {
        i++;
      }
    }

    // Flush remaining code
    segments.push(source.slice(codeStart));
    return segments;
  }

  /**
   * Compress a code-only segment (no string literals inside)
   * @param {string} code
   * @returns {string}
   */
  _compressCode(code) {
    // Remove single-line comments (safe here — no strings in this segment)
    code = code.replace(/\/\/.*/g, '');
    // Remove multi-line comments
    code = code.replace(/\/\*[\s\S]*?\*\//g, '');
    // Collapse whitespace
    code = code.replace(/\s+/g, ' ');
    // Remove spaces around operators/punctuation that never appear inside strings
    code = code.replace(/ *([\{\}()=,]) */g, '$1');
    return code;
  }

  /**
   * Calculate size in bytes (UTF-8)
   * @param {string} code
   * @returns {number}
   */
  getSize(code) {
    return new Blob([code]).size;
  }
}

// Export for use in background service worker
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Compressor;
}
