import { describe, it, expect } from 'vitest';
import { toSlug, ensureUniqueSlug } from '../src/utils/slug';

describe('Slug Utilities', () => {
  describe('toSlug', () => {
    it('should convert title to lowercase slug', () => {
      expect(toSlug('Hello World')).toBe('hello-world');
    });

    it('should handle special characters', () => {
      expect(toSlug('Hello! World@2024')).toBe('hello-world-2024');
    });

    it('should trim whitespace', () => {
      expect(toSlug('  Hello World  ')).toBe('hello-world');
    });

    it('should handle multiple spaces', () => {
      expect(toSlug('Hello    World')).toBe('hello-world');
    });

    it('should handle unicode characters', () => {
      const result = toSlug('Café & Restaurant');
      expect(result).not.toContain('&');
      expect(result).toContain('caf');
    });
  });

  describe('ensureUniqueSlug', () => {
    it('should return original slug if unique', async () => {
      const checkExists = async () => false;
      const result = await ensureUniqueSlug('test-slug', checkExists);
      expect(result).toBe('test-slug');
    });

    it('should append number if slug exists', async () => {
      let callCount = 0;
      const checkExists = async () => {
        callCount++;
        return callCount === 1; // First call returns true (exists), second returns false
      };
      const result = await ensureUniqueSlug('test-slug', checkExists);
      expect(result).toBe('test-slug-1');
    });

    it('should keep incrementing until unique', async () => {
      let callCount = 0;
      const checkExists = async () => {
        callCount++;
        return callCount <= 3; // First 3 calls return true
      };
      const result = await ensureUniqueSlug('test-slug', checkExists);
      expect(result).toBe('test-slug-3');
    });
  });
});
