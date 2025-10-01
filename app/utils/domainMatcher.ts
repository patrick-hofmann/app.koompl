/**
 * Domain pattern matching utility for email filtering
 * Supports wildcards and pattern matching for email addresses
 */

/**
 * Converts a domain pattern to a regex pattern
 * Supports:
 * - *@domain.com (any user at domain)
 * - user@domain.com (exact match)
 * - *user*@domain.com (user containing pattern)
 * - *@*.domain.com (any user at any subdomain)
 * - user@*.domain.com (specific user at any subdomain)
 */
export function domainPatternToRegex(pattern: string): RegExp {
  // Escape special regex characters except * and @
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special chars except * and @
    .replace(/\*/g, '.*') // Convert * to .* for regex
    .replace(/@/g, '@') // Keep @ as literal

  // Ensure the pattern matches the entire string
  return new RegExp(`^${regexPattern}$`, 'i')
}

/**
 * Checks if an email address matches any of the allowed domain patterns
 * @param email - The email address to check
 * @param allowedPatterns - Array of domain patterns (comma-separated string or array)
 * @returns true if email matches any pattern, false otherwise
 */
export function isEmailAllowed(email: string, allowedPatterns: string | string[]): boolean {
  if (!email || !allowedPatterns) return false

  // Convert to array if it's a string
  const patterns = Array.isArray(allowedPatterns)
    ? allowedPatterns
    : allowedPatterns.split(',').map(p => p.trim()).filter(p => p.length > 0)

  if (patterns.length === 0) return false

  const normalizedEmail = email.toLowerCase().trim()

  return patterns.some(pattern => {
    try {
      const regex = domainPatternToRegex(pattern.trim())
      return regex.test(normalizedEmail)
    } catch (error) {
      console.warn(`Invalid domain pattern: ${pattern}`, error)
      return false
    }
  })
}

/**
 * Validates domain patterns format
 * @param patterns - Comma-separated string of patterns
 * @returns validation result with isValid and errors
 */
export function validateDomainPatterns(patterns: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!patterns || patterns.trim().length === 0) {
    return { isValid: true, errors: [] }
  }

  const patternList = patterns.split(',').map(p => p.trim()).filter(p => p.length > 0)

  for (const pattern of patternList) {
    // Basic validation - should contain @ and not be empty
    if (!pattern.includes('@')) {
      errors.push(`Pattern "${pattern}" must contain @ symbol`)
      continue
    }

    // Check if it's a valid email-like pattern
    const parts = pattern.split('@')
    if (parts.length !== 2) {
      errors.push(`Pattern "${pattern}" must have exactly one @ symbol`)
      continue
    }

    const [local, domain] = parts

    // Local part validation (before @)
    if (local.length === 0) {
      errors.push(`Pattern "${pattern}" local part cannot be empty`)
      continue
    }

    // Domain part validation (after @)
    if (domain.length === 0) {
      errors.push(`Pattern "${pattern}" domain part cannot be empty`)
      continue
    }

    // Test if the pattern can be converted to a valid regex
    try {
      domainPatternToRegex(pattern)
    } catch (error) {
      errors.push(`Pattern "${pattern}" is invalid: ${error}`)
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}
