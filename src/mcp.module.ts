import { Module } from '@cmmv/core';

import { MCPConfig } from './mcp.config';
import { MCPService } from './mcp.service';

export const MCPModule = new Module('mcp', {
	configs: [MCPConfig],
	providers: [MCPService],
});
