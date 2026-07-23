import { Constants } from 'twisted';

type Tier = (typeof Constants.Tiers)[keyof typeof Constants.Tiers];

declare global {
	namespace PrismaJson {
		type RankedData = {
			soloq?: {
				wins: number;
				rank: string;
				tier: Tier;
				lp: number;
			};
		};
	}
}

// This file must be a module.
export {};
