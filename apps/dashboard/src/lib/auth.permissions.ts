import { createAccessControl } from 'better-auth/plugins/access';
import { defaultStatements, adminAc } from 'better-auth/plugins/admin/access';

export const statement = {
	...defaultStatements,
	game: ['manage', 'list'],
} as const;

export const ac = createAccessControl(statement);

export const user = ac.newRole({
	game: ['list'],
});

export const admin = ac.newRole({
	game: ['manage', 'list'],
	...adminAc.statements,
});
