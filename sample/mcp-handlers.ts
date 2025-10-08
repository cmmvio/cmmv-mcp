import { MCPTool, z } from '../src/main';

export class MCPHandlers {
	@MCPTool('greet', {
		name: z.string(),
		age: z.number(),
	})
	public async greet({ name, age }: { name: string; age: number }) {
		return {
			content: [
				{
					type: 'text',
					text: `Hello ${name}, you are ${age} years old`,
				},
			],
		};
	}
}
