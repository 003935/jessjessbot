import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCustomSignupPreview } from '@repo/discord-api/utils';

test('excludes current and legacy customs signup previews, but not ordinary messages', () => {
	assert.equal(
		isCustomSignupPreview(
			'## League customs <@&123> · <t:123:F> **Joined (2)** Ada · Bob **Maybe (1)** Eve'
		),
		true
	);
	assert.equal(
		isCustomSignupPreview(
			'## League customs <@&123> · <t:123:F> React with 1️⃣ 2️⃣ to pick a team. Choose one!'
		),
		true
	);
	assert.equal(
		isCustomSignupPreview(
			'**League customs** <@&123> · <t:123:F> Join, leave, or mark maybe below.'
		),
		true
	);
	assert.equal(
		isCustomSignupPreview('## <@&123> League - <t:123:t> React with ✅ to sign up!'),
		true
	);
	assert.equal(isCustomSignupPreview('I joined customs tonight and maybe I can play'), false);
	assert.equal(isCustomSignupPreview('Join, leave, or mark maybe below.'), false);
});
