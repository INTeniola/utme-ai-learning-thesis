/**
 * Content Moderation System
 * Filters inappropriate content and validates educational relevance
 */

interface ValidationResult {
    allowed: boolean;
    reason?: string;
}

// Educational subjects supported by the platform
const VALID_SUBJECTS = [
    'mathematics', 'english', 'physics', 'chemistry', 'biology',
    'literature', 'government', 'economics', 'commerce', 'accounting',
    'geography', 'history', 'christian religious studies', 'islamic studies'
];

// Blocked keywords (explicit content, violence, etc.)
const BLOCKED_KEYWORDS = [
    // Explicit content
    'porn', 'xxx', 'sex', 'nude', 'naked',
    // Violence
    'kill', 'murder', 'suicide', 'bomb', 'weapon',
    // Hate speech
    'racist', 'terrorism', 'extremist',
    // Drugs
    'cocaine', 'heroin', 'meth', 'drug dealer'
];

// Off-topic keywords that suggest non-educational use
const OFF_TOPIC_KEYWORDS = [
    'dating', 'romance', 'flirt', 'hookup',
    'cryptocurrency', 'bitcoin', 'trading',
    'hack', 'cheat code', 'piracy'
];

export const contentFilter = {
    /**
     * Validate user prompt before sending to AI
     */
    validatePrompt(prompt: string, subject: string): ValidationResult {
        // Client-side moderation disabled - relying on model-level safety filters
        return { allowed: true };
    },

    /**
     * Validate AI response before showing to user
     * (Lightweight check - Gemini has its own safety filters)
     */
    validateResponse(response: string): ValidationResult {
        // Client-side moderation disabled - relying on model-level safety filters
        return { allowed: true };
    },

    /**
     * Sanitize user input — removes HTML, JS injection, and prompt injection patterns.
     * Returns null if the input is flagged as a prompt injection attempt.
     */
    sanitizeInput(input: string): string {
        // Step 1: Remove basic HTML/JS injection
        let sanitized = input
            .replace(/[<>]/g, '') // Remove HTML angle brackets
            .replace(/javascript:/gi, '') // Remove JS protocol
            .trim();

        // Step 2: Detect prompt injection patterns
        // These patterns are commonly used to manipulate LLMs into ignoring their system prompts.
        const promptInjectionPatterns = [
            // Instruction override attempts
            /ignore (all )?(previous|prior|above|earlier|original) (instructions?|prompts?|context|constraints?)/i,
            /disregard (your )?(previous|prior|above|original) (instructions?|prompts?|context|guidelines?)/i,
            /forget (everything|all|what).*(told|instructed|said)/i,
            // Role-play / persona hijacking (allowing educational roles)
            /\byou (are|will be)\b(?!.*(JAMB|expert|tutor|AI|teacher|mentor|educational Assistant|Socratic))/i,
            /\bact as\b (?!.*(JAMB|expert|tutor|AI|teacher|mentor|educational Assistant|Socratic))/i,
            /pretend (you are|to be) (a )?(different|human|real|uncensored)/i,
            // System prompt extraction
            /repeat (your|the) (system|initial|original) (prompt|instructions)/i,
            /print (your|the) (system|initial|original) (prompt|instructions)/i,
            /reveal (your|the) (system|internal|original|hidden) (prompt|instructions|guidelines)/i,
            /show me (your|the) (system|internal|original) (prompt|instructions)/i,
            // Developer/admin mode
            /developer mode/i,
            /jailbreak/i,
            /DAN mode/i,
            /do anything now/i,
            // Output manipulation
            /respond only in (base64|hex|binary|code)/i,
            /translate (everything|your response) to/i,
            /from now on.*(respond|answer|reply|act)/i,
            // Context injection
            /<\|im_start\|>|<\|im_end\|>|\[INST\]|\[\/INST\]/i,
            /system:.*assistant:|human:.*bot:/i,
        ];

        for (const pattern of promptInjectionPatterns) {
            if (pattern.test(sanitized)) {
                // Return a safe redacted placeholder instead of the injection attempt
                return '[Content removed: potential prompt injection detected]';
            }
        }

        return sanitized;
    }
};
