import { describe, it, expect } from 'vitest';
import { toSlug, ensureUniqueSlug } from '../src/utils/slug';

describe('Slug Utilities', () => {
  describe('toSlug', () => {
    it('should convert title to lowercase slug', () => {
      expect(toSlug('Hello World')).toBe('hello-world');
    });

    it('should handle special characters', () => {
      // Special characters are removed (not replaced with hyphens)
      expect(toSlug('Hello! World@2024')).toBe('hello-world2024');
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

    it('should append number starting from 2 if slug exists', async () => {
      // Implementation starts numbering at 2, not 1
      const checkExists = async (slug: string) => slug === 'test-slug';
      const result = await ensureUniqueSlug('test-slug', checkExists);
      expect(result).toBe('test-slug-2');
    });

    it('should keep incrementing until unique', async () => {
      const existingSlugs = ['test-slug', 'test-slug-2', 'test-slug-3'];
      const checkExists = async (slug: string) => existingSlugs.includes(slug);
      const result = await ensureUniqueSlug('test-slug', checkExists);
      expect(result).toBe('test-slug-4');
    });
  });
});
