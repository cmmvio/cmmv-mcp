import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Logger, Application } from '@cmmv/core';
import { ModuleService } from '../src/module.service';

describe('ModuleService', () => {
    let moduleService: ModuleService;
    let mockApplication: Application;

    beforeEach(() => {
        moduleService = ModuleService.getInstance();
        mockApplication = {} as Application;
    });

    it('should be defined', () => {
        expect(moduleService).toBeDefined();
    });

    it('should be an instance of ModuleService', () => {
        expect(moduleService).toBeInstanceOf(ModuleService);
    });

    it('should have a logger with correct context', () => {
        expect(moduleService.logger).toBeInstanceOf(Logger);
    });

    it('should call loadConfig without throwing an error', async () => {
        await expect(ModuleService.loadConfig(mockApplication)).resolves.not.toThrow();
    });
});
