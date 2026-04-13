import { Tiers } from 'twisted/dist/constants';

declare global {
	namespace PrismaJson {
		type RankedData = {
			soloq?: {
				wins: number;
				rank: string;
				tier: Tiers;
				lp: number;
			};
		};
	}
}

// This file must be a module.
export {};
