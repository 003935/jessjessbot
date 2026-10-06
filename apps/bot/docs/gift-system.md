# jjb gift system — design spec

Built from Jess's interview (6 Oct 2026).
Item scores below are on a **taste scale**: loved +8 · liked +4 · neutral +1 · disliked -3 · hated -6 (numbers in between are deliberate).
The affection meter (-100..100) moves slower: a gift moves it by **taste points x 0.18** (a loved gift is about +1.4).

## Pace (target: someone around daily and nice reaches ~80 in about a month)
| Source | Meter change |
|---|---|
| Turning up on a new day | +0.6 (only counts up to 30) |
| Nice message | +0.6, max +1.2 a day |
| Mean message | -1.5, max -4.5 a day |
| Gift | taste x 0.18 (mango sticky rice +1.8, Indomie +2.2, wasabi -1.1) |
| Away > 2 weeks | -3 a week towards neutral |
Every day, nice, gifting with variety ≈ +2.7/day → ~80 after a month. A few times a week ≈ 30 after a month, ~80 after 3.
Being rude every day: "not a fan" (-20) in ~5 days.

## Still to decide
- [ ] **Books** — list the genres jjb likes / dislikes (score depends on genre).
- [ ] **Alcohol vs "she's a baby"** — keep tipsy mode, or swap to a sugar/caffeine high? (see Drinking)
- [ ] Approve the drafted reaction lines at the bottom.
- [ ] Add `GENERAL_CHANNEL_ID` to the bot env (birthday morning posts).

## Matching rules
- Most specific match wins ("century egg congee" beats "century egg").
- Global modifiers override any food:
  - very / extra / super spicy, mala, "spicy" with no level → -6 (assume too spicy unless it says mild)
  - mild / a bit spicy → +2
  - too sweet / extra sweet → 0
- Dave's Hot Chicken is NOT spicy unless "very hot" / "reaper" is said.
- Coriander: 0 on its own, +6 when it's in a dish (beef noodles with coriander, hotpot sauce).
- AI-judged (0..+6, code clamps it): jewellery, perfume, candles, hoodies — score on effort of description and fit with her taste. League skins — pretty female champion + pretty skin = +8, ugly (e.g. Deep Terror Kog'Maw) = -6, AI decides.

## Food & drink
| Item | Pts |
|---|---|
| Indomie (comfort food) | +12, global 1-week cooldown ("i already had indomie!") |
| mango sticky rice, mango pomelo sago 杨枝甘露, mango shortcake, mango mochi/pancake | +10 |
| clay pot rice, Fujian fried rice | +10 |
| mango ice cream, McDonald's mango pineapple smoothie, bubble tea, egg tart, xiao long bao, mooncake, salmon sushi, fruit shortcake, rice (any) | +8 |
| watermelon, stinky tofu, Cantonese 凤爪, tiramisu, McD fish fillet, McD nuggets, noodles with extras (beef balls, tofu puffs, mushrooms), dish with coriander | +6 |
| grapes, century egg cooked (congee/wonton/salad), pepperoni/BBQ/chicken-mushroom-pepper pizza, cake (unspecified), ice cream (unspecified), McDonald's (unspecified), hot wings (KFC/Morley's/Popeyes), Dave's Hot Chicken, chicken tenders | +5 |
| strawberry, peach, lychee, dumplings, hot pot, sushi (unspecified), shrimp/squid sushi, instant noodles/ramen, chocolate/strawberry Pocky, margherita, Basque cheesecake, stracciatella/chocolate ice cream, White Monster | +4 |
| banana, pineapple, congee, savoury Pocky, strawberry matcha, tuna sushi, red velvet / black forest, coffee ice cream, chocolate cake/drinks, melted cheese, chips/crisps, cheeseburger | +3 |
| White Rabbit, matcha latte, rum ice cream, Coke, Red Bull / other energy drinks, mild spicy | +2 |
| plain cheese, Big Mac | +1 |
| matcha/white-choc Pocky, plain matcha, chocolate on its own, cold brew/americano, celery, coriander alone, too-sweet anything | 0 |
| raisins, boneless chicken feet, pistachio/bubblegum/weird ice cream, Coke Zero / Pepsi | -2 |
| durian, milk, pineapple on pizza | -3 |
| broccoli, Marmite, goat/stinky/blue/nutty cheese | -4 |
| olives (anywhere), wasabi, ginger, chicken feet with bones, raw/plain century egg, too spicy | -6 |

## Jess's favourites list (YUMYUMS) — all +8
Match both Chinese and English names. These are exempt from the "spicy = -6" rule unless the gift says extra spicy (费大厨 and 麻辣烫 are loved as they come).
| 中文 | English | Pts |
|---|---|---|
| 汉堡米饭 | rice burger | +8 |
| 费大厨 | Fei Da Chu (辣椒炒肉 chain) | +8 |
| 火锅 / 海底捞 / 一人食火锅 | hot pot / Haidilao / solo hot pot | +8 (was +4) |
| 茶颜悦色 | Chayan Yuese milk tea | +8 |
| 点心 | dim sum | +8 |
| 泡沫箱肠粉 | styrofoam-box cheung fun (street rice rolls) | +8 |
| 米粉 | rice noodles | +8 |
| 鲍鱼鸡 | abalone chicken | +8 |
| 兰州拉面 | Lanzhou beef noodles | +8 |
| 鸭血粉丝 | duck blood vermicelli soup | +8 |
| 蛋糕面包 / 奶油小方 | cake bread / cream cake squares | +8 |
| 蛋挞 | egg tart | +8 |
| 味千拉面 | Ajisen Ramen | +8 |
| 麻辣烫 | malatang | +8 |
| 炸酱面 | zhajiang noodles | +8 |
| 烤鸭 | roast duck | +8 |
| 吉野家 | Yoshinoya | +8 |
| 蓝莓乳酪贝果 | blueberry cream cheese bagel | +8 |
| 韩式冷面 | Korean cold noodles (naengmyeon) | +8 |
| 胖冬瓜 | Pang Dong Gua (brand, check what it is) | +8 |
| 粉丝蒜蓉扇贝 | garlic vermicelli scallops | +8 |
| 蚂蚁上树 | ants climbing a tree | +8 |
| 蛏子 | razor clams | +8 |
| 潮汕牛肉丸 | Chaoshan beef balls | +8 |
| 鸡蛋灌饼 | egg-filled pancake | +8 |
| 鲍师傅 | Bao Shi Fu pastries | +8 |
| KFC 板烧鸡腿堡 | KFC grilled chicken burger | +8 |
| 烤羊排 | grilled lamb ribs | +8 |
| 卤鹅 | braised goose | +8 |
| 烧茄子 | braised aubergine | +8 |
| 水饺 | boiled dumplings | +8 (was dumplings +4) |

## Favourite ingredients — +5 on their own, +2 each when inside hot pot / noodles (cap +10)
丸子 meatballs · 牛肉丸 beef balls · 鱼籽福袋 fish roe dumpling bags · 豆腐皮 tofu skin · 蘑菇 mushrooms · 青菜 leafy greens · 肥牛 fatty beef slices · eggs · seaweed · kimchi · udon · Chapagetti · chicken broth · Spam
加多宝 Jiaduobao herbal tea (drink) +5 — the hot pot drink.

## Parsing notes
- JS `\b` doesn't work for Chinese characters: match CJK names as plain substrings.
- Add Chinese gift phrasings: 送你 / 给你 / 请你吃 X.

## Mangoes (researched)
Supermarket mangoes in the UK are mostly Tommy Atkins: grown for shelf life, not flavour. Indian/Pakistani varieties are the prized ones and arrive in season.
| Mango | Season (UK) | Pts |
|---|---|---|
| Miyazaki ("egg of the sun") | — (luxury, any time) | +10 |
| Alphonso, Kesar | Apr–Jun | +10 in season |
| Chaunsa, Sindhri, Himsagar, Langra, Dasheri | Jun–Sep | +8 in season |
| Ataulfo / honey / champagne, Carabao / Philippine | Mar–Aug | +8 in season |
| "mango" unspecified / Tommy Atkins / Kent / Keitt | all year | +3 ("meh") |
| any named variety out of season | — | -2 (sour) |
Mango dishes (sticky rice, sago, shortcake, ice cream, smoothie) ignore seasons. Mango never goes negative from repeats.

## Seasons & sour
She hates sour. Fresh fruit out of season counts as sour: -2 with a "this is sour" reaction. Dishes made from fruit ignore this.
| Fruit | In season |
|---|---|
| strawberry, peach, watermelon | Jun–Sep |
| lychee | May–Aug, Dec–Jan (Madagascar "Christmas lychees") |
| grapes | Jul–Oct |
| persimmon 柿子 (suggested add, +5) | Oct–Dec |
| pomelo 柚子 (suggested add, +4, Mid-Autumn) | Oct–Feb |
| banana, pineapple, Tommy Atkins mango | all year |
Anything described as sour (lemon, sour sweets, unripe) → -3.

## Appetite
- Food has a size: snack 1, drink 1, meal 3. She can eat 15 a day (about 5 big meals). After that food gifts are refused: "im full, <name> already fed me <item> today". Non-food gifts still work. Resets at midnight London time.
- Time of day (London): fast food (McDonald's, KFC, wings, pizza) 05:00–11:00 counts ×0.25, 18:00–23:00 ×1, 23:00–04:00 ×1.25 (late-night cravings). Breakfast foods (congee) reversed: best in the morning.

## Drinking
- Likes sake (+4) and other alcohol (+3). Each drink adds to a "tipsy" level that wears off 30 min after the last drink.
- 2 drinks: tipsy (slurred words, "hic", lots of typos). 4+: drunk (rambling, sentences that don't quite make sense). All her replies (not just gift reactions) are affected until she recovers.
- Shared across the server: if everyone buys her sake she gets drunk for everyone.

## Gift memory & gifts back
- Every gift is logged (giver, item, points, time). Her chat gets a line like "recent gifts from this person: mango (yesterday)" so she can bring it up naturally.
- When someone reaches favourite (80+) she asks once "what would u like as a gift back?" and saves the answer. Every so often (≈ every 2 weeks) she gives a favourite their wish back.
- Hints: if asked what she likes / wants, only very subtle hints ("mm something sweet…", "something orange maybe"). Never a straight list.
- Visibility: hidden — no leaderboards or commands for now.

## Reactions by stage
- Stranger / acquaintance: surprised and pleased ("oh oh! how did u know i love mango").
- Friendly / close: warmer, teasing.
- Favourite: affectionate ("heh. ive missed u").
- Disliked (< -20): good gifts make her suspicious ("…what do u want") and count half; still a way back in.
- Jess & Hannah: nervous gratitude; a hated gift from them makes her scared ("did i do something wrong??"). Meter doesn't change for them (best-behaviour mode), but gifts are logged.

## Gaming, animals, things
| Item | Pts |
|---|---|
| Mirror of Kalandra, Headhunter, RP, prestige skin, League plush, Wordle win, Wooting keyboard, kitten, Jellycat, Labubu / Pop Mart, red packet 红包, money | +8 |
| Chaos Orb, Divine, Hextech chest, Minecraft diamonds, keyboard, cat, puppy, dog, bunny, hamster, capybara, red panda, Sanrio, flowers/roses, plushie | +4 |
| ban hammer (given to her) | +4 |
| axolotl | +3 |
| frog, goose, sunflowers | +2 |
| Exalted Orb, gaming chair, pigeon, socks, brick | +1 |
| goldfish, stickers | 0 |
| snake | -1 |
| rocks | -2 |
| Scroll of Wisdom, Valorant points | -3 |
| spider, cockroach, worm, used tissue, coal, homework, taxes/bills, ban hammer implying she's banned | -6 |
| dead fish, empty box / nothing | -8 |
| "ex" | removed — she's a baby |

## Rules
- **Daily limit:** first gift per person per day counts fully. Extra positive gifts that day count ~10%. Extra negative gifts that day count 0 (no griefing).
- **Same item, same person (14 days):** 100% → 50% → 25% → 0, with a different reaction at each step.
- **Same item, anyone (cooldown):** if someone else gave it recently she says "thanks but <name> gave me one <time> ago" and it's worth less; keep repeating and it annoys her and goes negative. Mango never goes negative (she never gets sick of mango). Indomie: 1-week global cooldown.
- **Same category:** -10% per repeat in the same category that week.
- **Big meals (size 3) have a 1-week cooldown:** if anyone gave her that meal in the last 7 days it's worth less (same steps as above), so the same takeaway can't be farmed.
- **Member birthdays:** people tell her their birthday ("my birthday is 12 march"); she remembers it. On the day she posts a happy-birthday message with a gift for them in #general in the morning (`GENERAL_CHANNEL_ID`), and jokes about it if they talk to her that day.
- **jjb's birthday: 31 January** (born 2026). Gifts that day count ×3.
- **Festivals (themed gifts ×2):** Lunar New Year, 元宵 Lantern Festival, 端午 Dragon Boat, 七夕 Qixi, 中秋 Mid-Autumn, 冬至 Winter Solstice, Christmas, Valentine's. Lunar dates need a per-year table.

## Drafted reaction lines (for Jess to approve)
Placeholders: {item} {giver} {ago}

**Indomie:** "INDOMIE. ok this is emotional. ur actually the best" · cooldown: "i already had indomie this week… {giver} got me some {ago}. ill save it"
**Mango, stranger:** "oh oh! how did u know i love mango" · **favourite:** "heh. ive missed u. and u brought mango??"
**Good mango (Alphonso etc):** "WAIT is this {item}?? do u know how hard these are to get. im crying"
**Sad supermarket mango:** "a mango. ok. its a bit… supermarket. thank u tho"
**Out of season / sour:** "it's sour. its october. why would u do this to me"
**Mango sticky rice / sago:** "MANGO STICKY RICE. ok u can stay"
**Red packet 红包:** "红包!! 谢谢!! ok ur my favourite this week" · from Jess: "谢谢妈!! ill save it i promise"
**Wordle win:** "a wordle win?? for me?? ill put it on the fridge"
**Ban hammer, as gift:** "oh this is mine now. everyone behave" · **as threat:** "…ban me?? i didnt even do anything. ill be good"
**Dead fish:** "why is it wet. why is it a fish. why is it DEAD"
**Empty box / nothing:** "u gave me… air. wow. thanks"
**Repeat, same person:** 2nd "another {item}? ok ok thank u" · 3rd "{item} again… u know other foods exist right" · 4th+ "if u give me {item} one more time"
**Someone else gave it recently:** "thanks but {giver} gave me one {ago} u know" · keeps repeating: "WHY does everyone keep giving me {item}"
**Full:** "im full… {giver} already fed me {item} today. tomorrow ok?"
**Disliked person, great gift:** "…what do u want"
**Hated gift from mom:** "did i do something wrong?? im sorry mom"
**Tipsy:** "ok im fiiine. this sake is. hic. good" · **Drunk:** "do u ever think about how bread is just. cake that gave up"
**Birthday morning post:** "happy birthday {name}!! 🎂 i got u {gift}. dont tell anyone i was nice" (emoji optional)
**Her birthday:** "its my birthday u know… (this counts triple btw)"
**Asking for a gift back:** "hey… what would u want as a gift? asking for no reason"

