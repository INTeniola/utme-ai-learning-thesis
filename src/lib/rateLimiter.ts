/**
 * Client-side rate limiter for API calls
 * Prevents excessive requests to Gemini API
 */

interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
}

class RateLimiter {
    private requests: Map<string, number[]> = new Map();

    /**
     * Check if a request is allowed under the rate limit
     * @param key - Unique identifier for the rate limit (e.g., 'gemini-api', 'quiz-generation')
     * @param config - Rate limit configuration
     * @returns true if request is allowed, false if rate limited
     */
    public isAllowed(key: string, config: RateLimitConfig): boolean {
        const now = Date.now();
        const requests = this.requests.get(key) || [];

        // Remove requests outside the time window
        const validRequests = requests.filter(
            (timestamp) => now - timestamp < config.windowMs
        );

        // Check if we're under the limit
        if (validRequests.length >= config.maxRequests) {
            return false;
        }

        // Add current request
        validRequests.push(now);
        this.requests.set(key, validRequests);

        return true;
    }

    /**
     * Get time until next request is allowed (in milliseconds)
     */
    public getTimeUntilNextRequest(key: string, config: RateLimitConfig): number {
        const requests = this.requests.get(key) || [];
        if (requests.length < config.maxRequests) {
            return 0;
        }

        const oldestRequest = requests[0];
        const timeUntilExpiry = config.windowMs - (Date.now() - oldestRequest);

        return Math.max(0, timeUntilExpiry);
    }

    /**
     * Reset rate limit for a specific key
     */
    public reset(key: string): void {
        this.requests.delete(key);
    }

    /**
     * Clear all rate limits
     */
    public clearAll(): void {
        this.requests.clear();
    }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

// Predefined rate limit configurations
export const RATE_LIMITS = {
    // Gemini API: 10 requests per minute
    GEMINI_API: {
        maxRequests: 10,
        windowMs: 60 * 1000,
    },
    // Quiz Generation: 1 request per 5 seconds
    QUIZ_GENERATION: {
        maxRequests: 1,
        windowMs: 5 * 1000,
    },
    // AI Tutor: 5 requests per 10 seconds
    AI_TUTOR: {
        maxRequests: 5,
        windowMs: 10 * 1000,
    },
    // Concept Visualizer: 3 requests per minute
    CONCEPT_VISUALIZER: {
        maxRequests: 3,
        windowMs: 60 * 1000,
    },
} as const;
