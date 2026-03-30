/**
 * Input validation utilities
 */

/**
 * Validate email format using regex
 * More strict than HTML5 type="email"
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
    const trimmed = email.trim();

    if (!trimmed) {
        return { valid: false, error: 'Email is required' };
    }

    // RFC 5322 compliant email regex (simplified)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(trimmed)) {
        return { valid: false, error: 'Please enter a valid email address' };
    }

    // Check for common typos
    const commonTypos = [
        { wrong: '@gmail.con', correct: '@gmail.com' },
        { wrong: '@yahoo.con', correct: '@yahoo.com' },
        { wrong: '@hotmail.con', correct: '@hotmail.com' },
        { wrong: '@gmial.com', correct: '@gmail.com' },
        { wrong: '@gmai.com', correct: '@gmail.com' },
    ];

    for (const typo of commonTypos) {
        if (trimmed.toLowerCase().includes(typo.wrong)) {
            return {
                valid: false,
                error: `Did you mean ${trimmed.replace(typo.wrong, typo.correct)}?`
            };
        }
    }

    return { valid: true };
}

/**
 * Validate phone number format — specifically for Nigerian numbers.
 * Accepts: +234XXXXXXXXXX (13 chars) or 0XXXXXXXXXX (11 chars)
 */
export function validatePhoneNumber(phone: string): { valid: boolean; error?: string } {
    const trimmed = phone.trim();

    if (!trimmed) {
        return { valid: false, error: 'Phone number is required' };
    }

    // Strip spaces, dashes, and parentheses for validation
    const cleaned = trimmed.replace(/[\s\-()]/g, '');

    // Nigerian number: starts with +234 followed by 10 digits (total 13 chars)
    // OR starts with 0 followed by 10 digits (total 11 chars)
    const nigerianIntl = /^\+234[789][01]\d{8}$/;
    const nigerianLocal = /^0[789][01]\d{8}$/;

    if (!nigerianIntl.test(cleaned) && !nigerianLocal.test(cleaned)) {
        return {
            valid: false,
            error: 'Please enter a valid Nigerian number (e.g. +2348012345678 or 08012345678)'
        };
    }

    return { valid: true };
}

/**
 * Validate password strength
 * Returns strength level and suggestions
 */
export function validatePassword(password: string): {
    valid: boolean;
    strength: 'weak' | 'medium' | 'strong';
    error?: string;
    suggestions?: string[];
} {
    if (!password) {
        return {
            valid: false,
            strength: 'weak',
            error: 'Password is required'
        };
    }

    const suggestions: string[] = [];
    let score = 0;

    // Length check
    if (password.length < 8) {
        return {
            valid: false,
            strength: 'weak',
            error: 'Password must be at least 8 characters long'
        };
    }

    if (password.length >= 8) score++;
    if (password.length >= 12) score++;

    // Complexity checks
    if (/[a-z]/.test(password)) score++;
    else suggestions.push('Add lowercase letters');

    if (/[A-Z]/.test(password)) score++;
    else suggestions.push('Add uppercase letters');

    if (/\d/.test(password)) score++;
    else suggestions.push('Add numbers');

    if (/[^a-zA-Z0-9]/.test(password)) score++;
    else suggestions.push('Add special characters');

    // Determine strength
    let strength: 'weak' | 'medium' | 'strong';
    if (score <= 2) strength = 'weak';
    else if (score <= 4) strength = 'medium';
    else strength = 'strong';

    return {
        valid: true,
        strength,
        suggestions: suggestions.length > 0 ? suggestions : undefined
    };
}

/**
 * Sanitize text input
 * Trims whitespace and limits length
 */
export function sanitizeTextInput(
    text: string,
    maxLength: number = 1000
): string {
    return text.trim().slice(0, maxLength);
}

/**
 * Validate full name
 */
export function validateFullName(name: string): { valid: boolean; error?: string } {
    const trimmed = name.trim();

    if (!trimmed) {
        return { valid: false, error: 'Name is required' };
    }

    if (trimmed.length < 2) {
        return { valid: false, error: 'Name must be at least 2 characters' };
    }

    if (trimmed.length > 100) {
        return { valid: false, error: 'Name is too long' };
    }

    // Check for at least one space (first and last name)
    if (!trimmed.includes(' ')) {
        return { valid: false, error: 'Please enter your full name (first and last)' };
    }

    // Check for valid characters (letters, spaces, hyphens, apostrophes)
    const nameRegex = /^[a-zA-Z\s\-']+$/;
    if (!nameRegex.test(trimmed)) {
        return { valid: false, error: 'Name contains invalid characters' };
    }

    return { valid: true };
}

/**
 * Format phone number for display
 */
export function formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/[\s\-()]/g, '');

    // Format as +234 XXX XXX XXXX for Nigerian numbers
    if (cleaned.startsWith('+234')) {
        const digits = cleaned.slice(4);
        return `+234 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    }

    // Format as 0XXX XXX XXXX for local numbers
    if (cleaned.startsWith('0')) {
        return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
    }

    return phone;
}
