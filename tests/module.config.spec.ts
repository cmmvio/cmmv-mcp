import { describe, it, expect } from 'vitest';
import { ConfigSchema } from '@cmmv/core';
import { ModuleConfig } from '../src/module.config';

describe('ModuleConfig', () => {
    it('should be defined', () => {
        expect(ModuleConfig).toBeDefined();
    });

    it('should be an object', () => {
        expect(typeof ModuleConfig).toBe('object');
    });

    it('should be a valid ConfigSchema', () => {
        expect(ModuleConfig).toMatchObject<ConfigSchema>({});
    });
});
