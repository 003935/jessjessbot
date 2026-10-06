import { db } from '@/db';
import { ALREADY_GIFTED, giftMeterTenths, giftPoints, giftReaction, giftTaste, parseGift } from '@/modules/gift-table';

// One gift per person per day (UTC), like Stardew's gift limit. Stored in the
// member-preference table so it survives restarts.
export async function handleGift(
	guildId: string,
	userId: string,
	prompt: string,
	polite: boolean
): Promise<string | null> {
	const item = parseGift(prompt);
	if (!item) return null;
	const today = new Date().toISOString().slice(0, 10);
	if ((await db.botMemberPreference.getValue(guildId, userId, 'gift_day')) === today) return ALREADY_GIFTED;
	const taste = giftTaste(item);
	await db.botRelationship.adjust(guildId, userId, giftMeterTenths(giftPoints(item, taste)));
	await db.botMemberPreference.setValue(guildId, userId, 'gift_day', today);
	return giftReaction(item, taste, polite);
}
