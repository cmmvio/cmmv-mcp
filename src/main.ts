import { Module } from '@cmmv/core';

import { ModuleConfig } from './module.config';
import { ModuleService } from './module.service';

export const CmmvModule = new Module('module', {
    configs: [ModuleConfig],
    providers: [ModuleService],
});
