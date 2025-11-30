/**
 * Generic validation utilities and common validation patterns
 *
 * Reusable validation functions for common data validation scenarios
 * that can be composed to create complex validation rules.
 *
 * @see {@link ../../../docs/api-design-patterns.md#validation-patterns} for validation strategies
 */

import { ValidationError, ErrorCodes, MediaType } from '@/types';

/**
 * Validation result interface for consistent validation responses
 */
export interface ValidationResult {
    /** Whether validation passed */
    isValid: boolean;
    /** Array of validation errors if validation failed */
    errors: ValidationError[];
}

/**
 * Email validation using regex pattern
 *
 * Validates email addresses using a comprehensive regex pattern
 * that covers most common email formats while avoiding overly
 * complex validation that might reject valid addresses.
 *
 * @param email Email address to validate
 * @returns True if email format is valid
 */
export const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * URL validation with protocol checking
 *
 * Validates URL format and ensures proper protocol specification.
 * Supports both HTTP and HTTPS protocols.
 *
 * @param url URL to validate
 * @returns True if URL format is valid
 */
export const isValidUrl = (url: string): boolean => {
    try {
        const urlObj = new URL(url);
        return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
        return false;
    }
};

/**
 * String length validation with customizable bounds
 *
 * Validates string length within specified minimum and maximum bounds.
 * Useful for form field validation and data integrity checks.
 *
 * @param value String to validate
 * @param min Minimum length (default: 1)
 * @param max Maximum length (default: 255)
 * @returns True if string length is within bounds
 */
export const isValidLength = (value: string, min: number = 1, max: number = 255): boolean => {
    const length = value.trim().length;
    return length >= min && length <= max;
};

/**
 * Numeric range validation
 *
 * Validates that a number falls within specified minimum and maximum bounds.
 * Supports both integer and floating-point validation.
 *
 * @param value Number to validate
 * @param min Minimum value (inclusive)
 * @param max Maximum value (inclusive)
 * @returns True if number is within range
 */
export const isInRange = (value: number, min: number, max: number): boolean => {
    return value >= min && value <= max;
};

/**
 * Required field validation
 *
 * Validates that a value is present and not empty. Handles various
 * data types including strings, arrays, and objects.
 *
 * @param value Value to validate
 * @returns True if value is present and not empty
 */
export const isRequired = (value: any): boolean => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
};

/**
 * Sanitize string input by removing potentially harmful characters
 *
 * Basic string sanitization to prevent common security issues.
 * Removes HTML tags and trims whitespace.
 *
 * @param input String to sanitize
 * @returns Sanitized string
 */
export const sanitizeString = (input: string): string => {
    if (!input || typeof input !== 'string') {
        return '';
    }
    return input
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .trim(); // Remove leading/trailing whitespace
};

/**
 * Validate multiple fields with comprehensive error reporting
 *
 * Higher-order validation function that applies multiple validation
 * rules to an object and collects all validation errors.
 *
 * @param data Object to validate
 * @param rules Validation rules object
 * @returns Comprehensive validation result
 */
export const validateFields = (
    data: Record<string, any>,
    rules: Record<string, ((value: any) => ValidationError | null)[]>
): ValidationResult => {
    const errors: ValidationError[] = [];

    Object.entries(rules).forEach(([field, validators]) => {
        const value = data[field];

        validators.forEach(validator => {
            const error = validator(value);
            if (error) {
                errors.push(error);
            }
        });
    });

    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Common validation rule builders
 *
 * Factory functions that create validation rules for common scenarios.
 * These can be composed with validateFields for comprehensive validation.
 */
export const ValidationRules = {
    /**
     * Create required field validator
     */
    required: (fieldName: string) => (value: any): ValidationError | null => {
        if (!isRequired(value)) {
            return {
                field: fieldName,
                message: `${fieldName} is required`,
                value
            };
        }
        return null;
    },

    /**
     * Create string length validator
     */
    length: (fieldName: string, min: number, max: number) => (value: any): ValidationError | null => {
        if (typeof value === 'string' && !isValidLength(value, min, max)) {
            return {
                field: fieldName,
                message: `${fieldName} must be between ${min} and ${max} characters`,
                value
            };
        }
        return null;
    },

    /**
     * Create email validator
     */
    email: (fieldName: string) => (value: any): ValidationError | null => {
        if (typeof value === 'string' && !isValidEmail(value)) {
            return {
                field: fieldName,
                message: `${fieldName} must be a valid email address`,
                value
            };
        }
        return null;
    },

    /**
     * Create numeric range validator
     */
    range: (fieldName: string, min: number, max: number) => (value: any): ValidationError | null => {
        if (typeof value === 'number' && !isInRange(value, min, max)) {
            return {
                field: fieldName,
                message: `${fieldName} must be between ${min} and ${max}`,
                value
            };
        }
        return null;
    }
};

/**
 * Validate media_type enum
 *
 * Ensures the media_type is either 'movie' or 'tvshow'.
 *
 * @param mediaType The value to validate
 * @returns The validated media type
 * @throws Error if invalid
 *
 * @example
 * ```typescript
 * const mediaType = validateMediaType(req.body.media_type);
 * // mediaType is now typed as 'movie' | 'tvshow'
 * ```
 */
export function validateMediaType(mediaType: unknown): MediaType {
    const validTypes: MediaType[] = ['movie', 'tvshow'];

    if (typeof mediaType !== 'string') {
        throw new Error(
            `media_type must be a string. Received: ${typeof mediaType}`
        );
    }

    if (!validTypes.includes(mediaType as MediaType)) {
        throw new Error(
            `Invalid media_type. Must be 'movie' or 'tvshow'. Received: '${mediaType}'`
        );
    }

    return mediaType as MediaType;
}

/**
 * Validate media_id format
 *
 * Ensures the media_id is a non-empty string.
 *
 * @param mediaId The value to validate
 * @returns The validated media ID
 * @throws Error if invalid
 */
export function validateMediaId(mediaId: unknown): string {
    if (typeof mediaId !== 'string') {
        throw new Error(
            `media_id must be a string. Received: ${typeof mediaId}`
        );
    }

    if (mediaId.trim().length === 0) {
        throw new Error('media_id cannot be empty');
    }

    return mediaId.trim();
}

/**
 * Validate avatar ID
 *
 * Ensures the avatar ID is a valid positive integer.
 *
 * @param avatarId The value to validate
 * @returns The validated avatar ID as a number
 * @throws Error if invalid
 */
export function validateAvatarId(avatarId: unknown): number {
    const parsed = typeof avatarId === 'string' ? parseInt(avatarId, 10) : avatarId;

    if (typeof parsed !== 'number' || isNaN(parsed)) {
        throw new Error(
            `avatar_id must be a valid number. Received: ${avatarId}`
        );
    }

    if (parsed <= 0 || !Number.isInteger(parsed)) {
        throw new Error(
            `avatar_id must be a positive integer. Received: ${parsed}`
        );
    }

    return parsed;
}