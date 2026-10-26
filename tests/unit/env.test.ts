import { describe, expect, it } from 'vitest';
import { loadEnv, parseEnvContent, readEnvFiles } from '../../src/server/env';

describe('Canonical Env Loader (src/server/env.ts)', () => {
  describe('parseEnvContent', () => {
    it('parses basic KEY=VALUE pairs', () => {
      const content = `
        FOO=bar
        PORT=3005
      `;
      expect(parseEnvContent(content)).toEqual({
        FOO: 'bar',
        PORT: '3005',
      });
    });

    it('ignores comments and empty lines', () => {
      const content = `
        # This is a comment
        FOO=bar

        # Another comment
        BAZ=qux
      `;
      expect(parseEnvContent(content)).toEqual({
        FOO: 'bar',
        BAZ: 'qux',
      });
    });

    it('strips surrounding single and double quotes', () => {
      const content = `
        DOUBLE="hello world"
        SINGLE='hello universe'
        UNQUOTED=no quotes here
      `;
      expect(parseEnvContent(content)).toEqual({
        DOUBLE: 'hello world',
        SINGLE: 'hello universe',
        UNQUOTED: 'no quotes here',
      });
    });

    it('handles values containing equal signs', () => {
      const content = `
        DATABASE_URL=postgres://user:pass@localhost:5432/db?sslmode=disable
        SECRET=abc=123==
      `;
      expect(parseEnvContent(content)).toEqual({
        DATABASE_URL: 'postgres://user:pass@localhost:5432/db?sslmode=disable',
        SECRET: 'abc=123==',
      });
    });
  });

  describe('readEnvFiles', () => {
    it('merges files with earlier files taking precedence', () => {
      const mockFiles: Record<string, string> = {
        '/test/.env': 'COMMON=from_env\nONLY_ENV=1',
        '/test/.dev.vars': 'COMMON=from_dev_vars\nONLY_DEV=2',
      };

      const result = readEnvFiles(
        ['/test/.env', '/test/.dev.vars'],
        (p) => mockFiles[p] || '',
        (p) => Boolean(mockFiles[p]),
      );

      expect(result).toEqual({
        COMMON: 'from_env',
        ONLY_ENV: '1',
        ONLY_DEV: '2',
      });
    });

    it('safely skips missing files', () => {
      const mockFiles: Record<string, string> = {
        '/test/.dev.vars': 'KEY=value',
      };

      const result = readEnvFiles(
        ['/test/.missing', '/test/.dev.vars'],
        (p) => mockFiles[p] || '',
        (p) => Boolean(mockFiles[p]),
      );

      expect(result).toEqual({
        KEY: 'value',
      });
    });
  });

  describe('loadEnv', () => {
    it('populates target env without overwriting existing vars by default', () => {
      const mockFiles: Record<string, string> = {
        '/app/.env': 'EXISTING=new-val\nNEW_KEY=hello',
      };

      const target: Record<string, string | undefined> = {
        EXISTING: 'original',
      };

      loadEnv({
        env: target,
        rootDir: '/app',
        readFile: (p) => mockFiles[p] || '',
        fileExists: (p) => Boolean(mockFiles[p]),
      });

      expect(target.EXISTING).toBe('original');
      expect(target.NEW_KEY).toBe('hello');
    });

    it('respects override: true flag', () => {
      const mockFiles: Record<string, string> = {
        '/app/.env': 'EXISTING=new-val',
      };

      const target: Record<string, string | undefined> = {
        EXISTING: 'original',
      };

      loadEnv({
        env: target,
        rootDir: '/app',
        override: true,
        readFile: (p) => mockFiles[p] || '',
        fileExists: (p) => Boolean(mockFiles[p]),
      });

      expect(target.EXISTING).toBe('new-val');
    });
  });
});

