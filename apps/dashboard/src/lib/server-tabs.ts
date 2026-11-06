// The server page's tabs. Settings and jjb are admin-only, so anyone else always lands on Overview.

export type ServerTab = 'overview' | 'settings' | 'jjb';

export function pickTab(param: string | null, isAdmin: boolean): ServerTab {
	if (isAdmin && (param === 'settings' || param === 'jjb')) return param;
	return 'overview';
}
