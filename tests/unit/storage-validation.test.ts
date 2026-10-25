import { describe, expect, it } from 'vitest';
import { validateStorageKey, validateStoragePrefix } from '../../src/core/adapters/storage/validation';

describe('Storage Key & Prefix Validation', () => {
  describe('validateStorageKey', () => {
    it('accepts valid nested keys', () => {
      expect(validateStorageKey('workspace-1/avatar.png')).toBe('workspace-1/avatar.png');
      expect(validateStorageKey('workspace-1\\avatar.png')).toBe('workspace-1/avatar.png');
      expect(validateStorageKey('folder/sub/file.txt')).toBe('folder/sub/file.txt');
    });

    it('rejects empty or non-string keys', () => {
      expect(() => validateStorageKey('')).toThrow('non-empty string');
      expect(() => validateStorageKey(null as any)).toThrow();
    });

    it('rejects leading slashes and drive letters', () => {
      expect(() => validateStorageKey('/root/file.png')).toThrow('leading slash');
      expect(() => validateStorageKey('\\root\\file.png')).toThrow('leading slash');
      expect(() => validateStorageKey('C:/evil.png')).toThrow('drive letter');
      expect(() => validateStorageKey('D:\\evil.png')).toThrow('drive letter');
    });

    it('rejects path traversal segments', () => {
      expect(() => validateStorageKey('../secret.env')).toThrow('traversal');
      expect(() => validateStorageKey('ws/../../secret.env')).toThrow('traversal');
      expect(() => validateStorageKey('ws/..')).toThrow('traversal');
    });

    it('rejects empty segments and null bytes', () => {
      expect(() => validateStorageKey('ws//file.png')).toThrow('empty segment');
      expect(() => validateStorageKey('ws/file.png/')).toThrow('empty segment');
      expect(() => validateStorageKey('ws/file\0.png')).toThrow('null byte');
    });
  });

  describe('validateStoragePrefix', () => {
    it('accepts valid directory or partial prefixes', () => {
      expect(validateStoragePrefix('workspace-1')).toBe('workspace-1');
      expect(validateStoragePrefix('workspace-1/')).toBe('workspace-1/');
      expect(validateStoragePrefix('workspace-1\\sub')).toBe('workspace-1/sub');
    });

    it('rejects empty, whitespace, or root prefixes', () => {
      expect(() => validateStoragePrefix('')).toThrow('Invalid storage prefix');
      expect(() => validateStoragePrefix('   ')).toThrow('Invalid storage prefix');
      expect(() => validateStoragePrefix('.')).toThrow('Invalid storage prefix');
      expect(() => validateStoragePrefix('./')).toThrow('Invalid storage prefix');
    });

    it('rejects leading slashes, drive letters, and traversal', () => {
      expect(() => validateStoragePrefix('/root')).toThrow('leading slash');
      expect(() => validateStoragePrefix('\\root')).toThrow('leading slash');
      expect(() => validateStoragePrefix('C:/root')).toThrow('drive letter');
      expect(() => validateStoragePrefix('ws/../evil')).toThrow('traversal');
      expect(() => validateStoragePrefix('ws\0')).toThrow('null byte');
    });
  });
});

