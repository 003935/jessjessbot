// jjb's food tastes now live in @repo/database/defaults (editable on the dashboard's voice page).
// Only added to the prompt when the conversation is about food, so she doesn't steer everything to snacks.

export { FOOD_TASTES_DEFAULT as FOOD_TASTES } from '@repo/database/defaults';

export function isFoodTalk(prompt: string): boolean {
	return (
		/\b(?:food|eat|eating|ate|hungry|starving|snack|snacks|meal|dinner|lunch|breakfast|brunch|supper|dessert|cook|cooking|recipe|order|takeaway|takeout|restaurant|menu|hot ?pot|noodles?|rice|ramen|sushi|dim sum|pizza|burger|mcdonalds?|kfc|boba|bubble tea|drink|fruit|mango|delivery|deliveroo|uber ?eats)\b/iu.test(prompt) ||
		/(?:吃|饭|面|火锅|点心|奶茶|饿|外卖|菜)/u.test(prompt)
	);
}
