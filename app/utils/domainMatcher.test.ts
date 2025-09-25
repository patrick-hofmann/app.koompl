/**
 * Test file for domain matching functionality
 * Run with: npx vitest run domainMatcher.test.ts
 */

import { describe, it, expect } from 'vitest'
import { isEmailAllowed, validateDomainPatterns } from './domainMatcher'

describe('Domain Matcher', () => {
  describe('isEmailAllowed', () => {
    it('should allow emails matching wildcard patterns', () => {
      const patterns = '*@delta-mind.at, patrick@delta-mind.at, *test-*@*.delta-mind.at'

      expect(isEmailAllowed('user@delta-mind.at', patterns)).toBe(true)
      expect(isEmailAllowed('patrick@delta-mind.at', patterns)).toBe(true)
      expect(isEmailAllowed('test-user@sub.delta-mind.at', patterns)).toBe(true)
      expect(isEmailAllowed('any@delta-mind.at', patterns)).toBe(true)
    })

    it('should reject emails not matching patterns', () => {
      const patterns = '*@delta-mind.at, patrick@delta-mind.at'

      expect(isEmailAllowed('user@other-domain.com', patterns)).toBe(false)
      expect(isEmailAllowed('other@delta-mind.at', patterns)).toBe(true) // *@delta-mind.at should match
      expect(isEmailAllowed('patrick@other-domain.com', patterns)).toBe(false)
    })

    it('should handle empty patterns', () => {
      expect(isEmailAllowed('user@delta-mind.at', '')).toBe(false)
      expect(isEmailAllowed('user@delta-mind.at', [])).toBe(false)
    })

    it('should handle complex wildcard patterns', () => {
      const patterns = '*test-*@*.delta-mind.at, admin@delta-mind.at'

      expect(isEmailAllowed('my-test-user@sub.delta-mind.at', patterns)).toBe(true)
      expect(isEmailAllowed('admin@delta-mind.at', patterns)).toBe(true)
      expect(isEmailAllowed('regular@delta-mind.at', patterns)).toBe(false)
      expect(isEmailAllowed('test@other-domain.com', patterns)).toBe(false)
    })
  })

  describe('validateDomainPatterns', () => {
    it('should validate correct patterns', () => {
      const result = validateDomainPatterns('*@delta-mind.at, patrick@delta-mind.at')
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject patterns without @ symbol', () => {
      const result = validateDomainPatterns('delta-mind.at, patrick@delta-mind.at')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Pattern "delta-mind.at" must contain @ symbol')
    })

    it('should reject patterns with multiple @ symbols', () => {
      const result = validateDomainPatterns('user@@delta-mind.at')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Pattern "user@@delta-mind.at" must have exactly one @ symbol')
    })

    it('should reject patterns with empty local part', () => {
      const result = validateDomainPatterns('@delta-mind.at')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Pattern "@delta-mind.at" local part cannot be empty')
    })

    it('should reject patterns with empty domain part', () => {
      const result = validateDomainPatterns('user@')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Pattern "user@" domain part cannot be empty')
    })

    it('should handle empty input', () => {
      const result = validateDomainPatterns('')
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })
})
