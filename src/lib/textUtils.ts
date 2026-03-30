/**
 * Text utility functions for cleaning and formatting text content
 */

/**
 * Strips markdown formatting from text while preserving LaTeX
 * @param text - Text containing markdown formatting
 * @returns Clean text with markdown removed but LaTeX preserved
 */
export function stripMarkdown(text: string): string {
    if (!text) return '';

    return text
        // Preserve LaTeX (both inline $ and display $$)
        .replace(/(\$\$[\s\S]*?\$\$|\$[^$]+\$)/g, (match) => `__LATEX_${Buffer.from(match).toString('base64')}__`)

        // Remove markdown formatting
        .replace(/\*\*\*([^*]+)\*\*\*/g, '$1') // Bold + Italic
        .replace(/\*\*([^*]+)\*\*/g, '$1') // Bold
        .replace(/\*([^*]+)\*/g, '$1') // Italic
        .replace(/__([^_]+)__/g, '$1') // Bold (underscore)
        .replace(/_([^_]+)_/g, '$1') // Italic (underscore)
        .replace(/^#{1,6}\s+/gm, '') // Headers
        .replace(/`{3}[\s\S]*?`{3}/g, '') // Code blocks
        .replace(/`([^`]+)`/g, '$1') // Inline code
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links [text](url) -> text
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1') // Images ![alt](url) -> alt
        .replace(/^>\s+/gm, '') // Blockquotes
        .replace(/^[-*+]\s+/gm, '') // Unordered lists
        .replace(/^\d+\.\s+/gm, '') // Ordered lists
        .replace(/~~([^~]+)~~/g, '$1') // Strikethrough
        .replace(/\|/g, ' ') // Table separators
        .replace(/^[-:|\s]+$/gm, '') // Table alignment rows

        // Restore LaTeX
        .replace(/__LATEX_([A-Za-z0-9+/=]+)__/g, (_, base64) => {
            try {
                return Buffer.from(base64, 'base64').toString();
            } catch {
                return '';
            }
        })

        // Clean up extra whitespace
        .replace(/\n{3,}/g, '\n\n') // Max 2 newlines
        .replace(/\s{2,}/g, ' ') // Max 1 space
        .trim();
}

/**
 * Cleans text for display while preserving important formatting
 * @param text - Raw text
 * @returns Cleaned text suitable for display
 */
export function cleanTextForDisplay(text: string): string {
    if (!text) return '';

    return text
        .replace(/\r\n/g, '\n') // Normalize line endings
        .replace(/\t/g, '  ') // Convert tabs to spaces
        .trim();
}

/**
 * Truncates text to a maximum length with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
export function truncateText(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

/**
 * Removes grouped-question leading text and common ALOC artifacts.
 * E.g., removes "In each of the questions from 81-85..."
 * @param text - Raw question text from the database
 * @returns Cleaned question text
 */
export function cleanALOCArtifacts(text: string): string {
    if (!text) return '';

    return text
        // Remove "Questions 81-85" or "Questions 1 - 5."
        .replace(/Questions?\s+\d+\s*[-–]\s*\d+[^.]*\.?/gi, '')
        // Remove "In each of the following questions..." or "In each of the questions..."
        .replace(/In Each Of The (following )?Questions?[^,:]*[,:]/gi, '')
        // Remove specific JAMB/WAEC redundant headers
        .replace(/Choose the word that is opposite in meaning[^.]*\.?/gi, '')
        .replace(/Choose the word that has the same vowel sound[^.]*\.?/gi, '')
        // Remove HTML entities like &nbsp;
        .replace(/&nbsp;/g, ' ')
        // Remove multiple spaces and newlines
        .replace(/\n{3,}/g, '\n\n')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

/**
 * Strips HTML tags from a string while protecting LaTeX content
 * @param html - String containing HTML (and potentially LaTeX)
 * @returns Clean text without HTML tags, preserving LaTeX integrity
 */
export function stripHTML(html: string): string {
    if (!html) return '';

    // Step 1: Temporarily hide LaTeX content to prevent symbol corruption
    // Matches: $$...$$, $...$, \[...\], \(...\)
    const latexBlocks: string[] = [];
    const protectedText = html.replace(
        /(\$\$[\s\S]*?\$\$|\$[^$]+\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g, 
        (match) => {
            latexBlocks.push(match);
            return `__LATEX_PROTECT_${latexBlocks.length - 1}__`;
        }
    );

    // Step 2: Strip HTML tags from the remaining text
    const stripped = protectedText.replace(/<[^>]*>?/gm, '');

    // Step 3: Restore the protected LaTeX content
    return stripped.replace(/__LATEX_PROTECT_(\d+)__/g, (_, index) => {
        return latexBlocks[parseInt(index)] || '';
    });
}

/**
 * Sanitizes a question by cleaning artifacts and normalizing formatting.
 * Use this as the standard entry point for questions from the database.
 * @param text - Raw text
 * @returns Sanitized text
 */
export function sanitizeQuestion(text: string): string {
    if (!text) return '';
    return cleanALOCArtifacts(stripHTML(text));
}

/**
 * Legacy alias for sanitizeQuestion.
 */
export const cleanQuestionText = sanitizeQuestion;
