-- Romance stages and personas from economy.ts + romanceGen.ts.
local Economy
do
	local ok, loaded = pcall(function()
		return require(script.Parent.Economy)
	end)
	if ok then
		Economy = loaded
	else
		Economy = require("./Economy")
	end
end

local Romance = {}

Romance.STAGE_NAMES = { "stranger", "acquaintance", "friendly", "close", "sweetheart" }
Romance.GIFT_IDS = {
	"flower_gift",
	"brass_charm",
	"silk_scarf",
	"bloom_sky",
	"bloom_brass",
	"bloom_spore",
	"bloom_harbor",
	"bloom_aether",
	"polished_wire",
}
Romance.IDS = { "girl_lira", "girl_mira", "girl_nova", "girl_sage" }

Romance.ARCHETYPES = {
	girl_lira = {
		id = "girl_lira",
		baseName = "Lira",
		loves = { flower_gift = true, bloom_sky = true, bloom_brass = true, bloom_spore = true, bloom_harbor = true, bloom_aether = true },
		dislikes = { brass_charm = true, polished_wire = true },
		likesHint = "She loves flowers and bouquets — any plaza bloom or Cloud Blooms.",
		dislikesHint = "Brass charms and polished wire feel cold to her.",
	},
	girl_mira = {
		id = "girl_mira",
		baseName = "Mira",
		loves = { silk_scarf = true, bloom_spore = true },
		dislikes = { flower_gift = true, bloom_sky = true, bloom_brass = true },
		likesHint = "She wants a Spore-Silk Scarf (or rare Spore blooms).",
		dislikesHint = "She scoffs at common Cloud Blooms and basic bouquets.",
	},
	girl_nova = {
		id = "girl_nova",
		baseName = "Nova",
		loves = { brass_charm = true, polished_wire = true },
		dislikes = { silk_scarf = true, bloom_harbor = true, flower_gift = true },
		likesHint = "She loves Brass Charms and Polished Wire.",
		dislikesHint = "Silk scarves and soft flower gifts feel frivolous to her.",
	},
	girl_sage = {
		id = "girl_sage",
		baseName = "Sage",
		loves = { silk_scarf = true, bloom_aether = true, bloom_spore = true },
		dislikes = { brass_charm = true, polished_wire = true },
		likesHint = "She likes Spore-Silk Scarves, Aether blooms, and Spore blooms.",
		dislikesHint = "Brass charms and polished wire feel impatient to her.",
	},
}

local SURNAMES = {
	"Voss", "Quinn", "Hale", "Wren", "Thrush", "Ash", "Cole", "Reed", "Vale", "Keel",
	"Lantern", "Moss", "Pike", "Yarrow", "Underbay", "Coil", "Ember", "Forge", "Gilt", "Hearth",
	"Quill", "Riven", "Sable", "Tinker", "Umbra", "Vault", "Weld", "Yarn", "Bolt", "Cinder",
}
local ORIGINS = {
	"the hanging gardens of Residential Ring",
	"a silk loft above Brass Arcade",
	"dockside rooms that never stop humming",
	"Cloud Academy’s quiet east wing",
	"a foundry family that counted bolts for lullabies",
	"spore terraces where the air tastes sweet",
	"a ferry that never quite chose a home port",
	"North Observatory’s windy steps",
	"a rented skyflat with one good window",
	"Grand Market’s back alleys after closing",
	"an aunt’s workshop that smelled of oil and tea",
	"the soft side of Industrial, if such a thing exists",
	"a boarding house full of apprentices",
	"St. Brass parish and its stubborn hope",
}
local VOCATIONS = {
	"tend plaza gardens for hire",
	"keep ledgers for a silk trader",
	"test board thrusters on quiet lanes",
	"repair small automata nobody else has time for",
	"copy patent sketches for coin",
	"walk night deliveries between plazas",
	"teach children which blooms are safe to touch",
	"run a tiny stall two days a week",
	"sing at dock openings when the brass is good",
	"map wind paths for nervous first-time riders",
	"sort reef salvage into honest piles",
	"write letters for people who hate ink",
}
local TEMPERAMENTS = {
	"quick to laugh, slower to trust",
	"soft-spoken until a principle is crossed",
	"playful in public, serious in private",
	"blunt as a stamped gear",
	"curious to the point of trouble",
	"patient with machines, impatient with bragging",
	"warm, then suddenly distant if rushed",
	"dry-humored and hard to impress",
	"earnest in a way that startles busy people",
	"wary of empire boys with too-clean boots",
	"gentle, with a spine of drawn wire",
	"competitive about the small things that matter",
}
local SOFT_SPOTS = {
	"stray cats on the skyways",
	"honest apologies",
	"people who remember names",
	"hand-mended clothes",
	"late-night tea gone cold",
	"boards that still have scratches from learning",
	"kids who ask how gears work",
	"makers who admit when a design failed",
	"quiet plazas after rain-fog",
	"stories that don’t end in a sale",
}
local FEARS = {
	"being treated like scenery",
	"another winter alone in a loud city",
	"gifts that are really transactions",
	"rushing into the wrong forever",
	"losing the small freedoms I fought for",
	"pretty words with empty hands",
	"becoming someone’s soft escape from responsibility",
}
local DREAMS = {
	"a garden that doesn’t rent by the week",
	"a shop of my own with honest hours",
	"someone who stays after the patent season ends",
	"enough brass to choose slow days",
	"seeing the outer reefs once without working them",
	"a home loft with two chairs that get used",
	"being known for more than a pretty stall smile",
}
local SPEECH = { "half-joking", "careful", "direct", "lyrical", "teasing", "quiet", "bright", "measured" }
local STORY_REACTIONS = {
	"That… actually explains the way you look at machines.",
	"You’re building a life, not just a ledger. I like that.",
	"Keep talking. I want the honest version.",
	"Hmm. Ambition looks better when it has a pulse.",
	"So the empire isn’t just noise — you have a spine under it.",
	"That’s a builder’s story. I can work with that.",
	"Thank you for not rushing the truth.",
	"Your lost one… I won’t make you say more than you want.",
	"That invention of yours — I can hear how proud you are.",
	"You talk about your crew like family. That’s rare.",
	"I believe you. Don’t make me regret it.",
	"There’s grief in that, and grit. Both fit you.",
	"Say more when you’re ready. I’ll still be here.",
	"You’re not performing. Good.",
	"That was real. I felt it.",
	"I like the version of you that admits the hard numbers and the soft reasons.",
}

local function imul(a: number, b: number): number
	a = bit32.band(a, 0xffffffff)
	b = bit32.band(b, 0xffffffff)
	local aLo = bit32.band(a, 0xffff)
	local aHi = bit32.rshift(a, 16)
	local bLo = bit32.band(b, 0xffff)
	local bHi = bit32.rshift(b, 16)
	local low = aLo * bLo
	local mid = aHi * bLo + aLo * bHi
	return bit32.band(low + bit32.lshift(bit32.band(mid, 0xffff), 16), 0xffffffff)
end

local function mulberry32(seed: number)
	local a = bit32.bor(seed, 0)
	return function(): number
		a = bit32.band(a + 0x6d2b79f5, 0xffffffff)
		local t = imul(bit32.bxor(a, bit32.rshift(a, 15)), bit32.bor(1, a))
		local inner = imul(bit32.bxor(t, bit32.rshift(t, 7)), bit32.bor(61, t))
		t = bit32.bxor(bit32.band(t + inner, 0xffffffff), t)
		return bit32.bxor(t, bit32.rshift(t, 14)) / 4294967296
	end
end

local function hashStr(s: string): number
	local h = 2166136261
	for i = 1, #s do
		h = bit32.bxor(h, string.byte(s, i))
		h = imul(h, 16777619)
	end
	return h
end

local function pick(rng, arr)
	local n = #arr
	return arr[math.floor(rng() * n) % n + 1]
end

local function pickN(rng, arr, n)
	local copy = table.clone(arr)
	local out = {}
	for _ = 1, n do
		if #copy == 0 then
			break
		end
		local index = math.floor(rng() * #copy) % #copy + 1
		table.insert(out, copy[index])
		table.remove(copy, index)
	end
	return out
end

function Romance.personaSeed(npcId: string, worldSeed: number): number
	return hashStr(`romance:{npcId}:{bit32.bor(worldSeed, 0)}`)
end

function Romance.generate(npcId: string, worldSeed: number)
	local arch = Romance.ARCHETYPES[npcId]
	if not arch then
		return nil
	end
	local seed = Romance.personaSeed(npcId, worldSeed or 1)
	local rng = mulberry32(seed)
	rng()
	rng()
	local surname = pick(rng, SURNAMES)
	local name = `{arch.baseName} {surname}`
	local origin = pick(rng, ORIGINS)
	local vocIdx = math.floor(rng() * #VOCATIONS) % #VOCATIONS + 1
	local vocation = VOCATIONS[vocIdx]
	local temperament = pick(rng, TEMPERAMENTS)
	local softSpot = pick(rng, SOFT_SPOTS)
	local fear = pick(rng, FEARS)
	local dream = pick(rng, DREAMS)
	local speech = pick(rng, SPEECH)
	local chat0 = pick(rng, {
		"Oh — a maker? You look like you work hard. Do you ever stop?",
		"Most people rush past. You paused. That’s already unusual.",
		"If you’re here to sell me something, leave. If you’re here to talk… maybe stay.",
		`I grew up around {origin}. This plaza is quieter. I like that.`,
		`Careful. I grew up around {origin}, and I can tell when someone’s performing.`,
	})
	local chat1 = pick(rng, {
		`You again. I’m {temperament} — don’t take the first silence personally.`,
		"Still showing up. That’s either stubborn or sweet.",
		`I {vocation}. When you visit, try not to treat me like a waypoint.`,
		"Tell me something true, not something impressive.",
		`I’m {speech} when I care. You’ll notice the difference.`,
	})
	local chat2 = pick(rng, {
		`I’ve decided you’re not pure noise. Soft spot confession: {softSpot}.`,
		"Friendly looks good on you. Don’t waste it on empty brass talk.",
		`I still {vocation}, but I save better hours for people who listen.`,
		"The city can wait. Sit. Tell me a story that isn’t about a ledger.",
		"You’re learning my pace. That’s rarer than a clean patent.",
	})
	local chat3 = pick(rng, {
		`Close enough that I might admit what I’m afraid of: {fear}.`,
		"I trust you with quieter rooms now.",
		"If you bring a gift, make it honest. I can smell a transaction.",
		"Walk with me after dusk. I want company that doesn’t rush.",
		"You’re in the circle of people I actually answer.",
	})
	local chat4 = pick(rng, {
		`Stay. My dream is simple — {dream} — and you keep not laughing at it.`,
		"“Sweetheart” is a heavy word. You’re carrying it well.",
		"I don’t need a speech. Just be here when the wind gets mean.",
		"You’ve seen the soft parts. Don’t put the armor back on now.",
		"The city can have your days. I’d like some of your evenings.",
	})
	local likesSelf = arch.likesHint:gsub("^She loves ", "I love "):gsub("^She wants ", "I want "):gsub("^She likes ", "I like ")
	local about = {
		`I come from {origin}. That never fully leaves a person.`,
		`By day I {vocation}. It pays enough to choose who I smile at.`,
		`I’m {temperament}. Gifts that ignore that bounce off.`,
		likesSelf,
	}
	return {
		id = npcId,
		name = name,
		loves = arch.loves,
		dislikes = arch.dislikes,
		likesHint = arch.likesHint,
		dislikesHint = arch.dislikesHint,
		origin = origin,
		vocation = vocation,
		temperament = temperament,
		softSpot = softSpot,
		fear = fear,
		dream = dream,
		speech = speech,
		chatByStage = { chat0, chat1, chat2, chat3, chat4 },
		aboutLines = about,
		storyReactions = pickN(rng, STORY_REACTIONS, 5),
		bioLine = `{string.upper(string.sub(temperament, 1, 1))}{string.sub(temperament, 2)}. From {origin}.`,
		seed = seed,
	}
end

function Romance.ensure(inv)
	if type(inv.relationships) ~= "table" then
		inv.relationships = {}
	end
	return inv
end

function Romance.state(inv, npcId: string)
	Romance.ensure(inv)
	for _, rel in inv.relationships do
		if rel.npcId == npcId then
			if type(rel.storiesShared) ~= "table" then
				rel.storiesShared = {}
			end
			if rel.knownLikes == nil then
				rel.knownLikes = false
			end
			return rel
		end
	end
	local rel = {
		npcId = npcId,
		stage = 0,
		affinity = 0,
		giftsGiven = 0,
		knownLikes = false,
		storiesShared = {},
	}
	table.insert(inv.relationships, rel)
	return rel
end

function Romance.recompute(rel)
	local a = rel.affinity
	if a >= 100 then
		rel.stage = 4
	elseif a >= 70 then
		rel.stage = 3
	elseif a >= 40 then
		rel.stage = 2
	elseif a >= 15 then
		rel.stage = 1
	else
		rel.stage = 0
	end
end

function Romance.stageName(stage: number): string
	return Romance.STAGE_NAMES[stage + 1] or "stranger"
end

local function loves(def, gift: string): boolean
	return def.loves[gift] == true
end

local function dislikes(def, gift: string): boolean
	return def.dislikes[gift] == true
end

local function isGift(id: string): boolean
	for _, g in Romance.GIFT_IDS do
		if g == id then
			return true
		end
	end
	return false
end

function Romance.heldGifts(inv)
	local out = {}
	for _, id in Romance.GIFT_IDS do
		if (inv.items[id] or 0) > 0 then
			table.insert(out, id)
		end
	end
	return out
end

function Romance.chat(inv, npcId: string, worldSeed: number): (boolean, string, number)
	local def = Romance.generate(npcId, worldSeed)
	if not def then
		return false, "She has already moved on.", 0
	end
	local rel = Romance.state(inv, npcId)
	local prev = rel.stage
	rel.affinity = math.min(120, rel.affinity + 3 + (if rel.stage >= 2 then 2 else 0))
	Romance.recompute(rel)
	local line = def.chatByStage[rel.stage + 1] or def.chatByStage[1]
	local stageNote = if rel.stage > prev
		then ` · Now {Romance.stageName(rel.stage)}.`
		else ` · {Romance.stageName(rel.stage)} ({rel.affinity}).`
	return true, `{def.name}: “{line}”{stageNote}`, rel.stage
end

function Romance.learn(inv, npcId: string, worldSeed: number): (boolean, string, number)
	local def = Romance.generate(npcId, worldSeed)
	if not def then
		return false, "She has already moved on.", 0
	end
	local rel = Romance.state(inv, npcId)
	local first = not rel.knownLikes
	rel.knownLikes = true
	if first then
		rel.affinity = math.min(120, rel.affinity + 6)
		Romance.recompute(rel)
	end
	local about = def.aboutLines[1]
	return true, `{def.name}: “{about}” · Likes: {def.likesHint} · Avoid: {def.dislikesHint}`, rel.stage
end

function Romance.gift(inv, npcId: string, gift: string, worldSeed: number, applyStanding): (boolean, string, number, number)
	local def = Romance.generate(npcId, worldSeed)
	if not def then
		return false, "She has already moved on.", 0, 0
	end
	if not isGift(gift) then
		local name = if Economy.COMMODITIES[gift] then Economy.COMMODITIES[gift].name else gift
		return false, `{name} isn’t something you’d offer as a gift.`, 0, 0
	end
	if (inv.items[gift] or 0) < 1 then
		return false, `No {Economy.COMMODITIES[gift].name} in pack.`, 0, 0
	end
	inv.items[gift] -= 1
	if inv.items[gift] <= 0 then
		inv.items[gift] = nil
	end
	local rel = Romance.state(inv, npcId)
	local prev = rel.stage
	local name = Economy.COMMODITIES[gift].name
	local delta = 8
	local reaction
	if loves(def, gift) then
		delta = if gift == "silk_scarf" or gift == "brass_charm" then 26 elseif gift == "flower_gift" then 18 else 16
		reaction = `Her eyes light up at the {name}.`
	elseif dislikes(def, gift) then
		delta = if gift == "silk_scarf" or gift == "brass_charm" then -18 else -12
		reaction = `She stiffens. The {name} was a misread.`
	else
		delta = 5
		reaction = `She accepts the {name} politely.`
	end
	rel.affinity = math.clamp(rel.affinity + delta, 0, 120)
	if delta > 0 then
		rel.giftsGiven += 1
	end
	Romance.recompute(rel)
	if applyStanding then
		if delta >= 16 then
			applyStanding(inv, 2)
		elseif delta > 0 then
			applyStanding(inv, 1)
		elseif delta < 0 then
			applyStanding(inv, -1)
		end
	end
	local stageBit = if rel.stage > prev
		then ` Now {Romance.stageName(rel.stage)}.`
		elseif rel.stage < prev then ` Now only {Romance.stageName(rel.stage)}.`
		else ` ({Romance.stageName(rel.stage)}, {rel.affinity})`
	local sign = if delta > 0 then `+{delta}` else `{delta}`
	return true, `{def.name}: {reaction} {sign} affinity.{stageBit}`, rel.stage, delta
end

function Romance.statusLine(inv, npcId: string, worldSeed: number): string
	local def = Romance.generate(npcId, worldSeed)
	local rel = Romance.state(inv, npcId)
	if not def then
		return "Gone."
	end
	local likes = if rel.knownLikes then ` · {def.likesHint}` else ""
	return `{Romance.stageName(rel.stage)} · affinity {rel.affinity}{likes}`
end

function Romance.listStories(inv, npcId: string, ctx)
	local rel = Romance.state(inv, npcId)
	local shared = {}
	for _, id in rel.storiesShared do
		shared[id] = true
	end
	local beats = {
		{ id = "origin", title = "Your origin", minStage = 2 },
		{ id = "companion", title = `{ctx.companionName} — the soul you woke`, minStage = 2 },
		{ id = "crew", title = "Your crew", minStage = 2 },
		{ id = "invention", title = "Proudest invention", minStage = 3, needInvent = true },
		{ id = "resources", title = "What the shelves taught you", minStage = 2 },
		{ id = "workshop", title = "Your workshop path", minStage = 3 },
	}
	local out = {}
	for _, b in beats do
		local locked = rel.stage < b.minStage or shared[b.id] == true
		local reason = nil
		if shared[b.id] then
			reason = "Already shared"
			locked = true
		elseif rel.stage < b.minStage then
			reason = `Need {Romance.stageName(b.minStage)}+ (now {Romance.stageName(rel.stage)})`
		elseif b.needInvent and #(inv.customRecipes or {}) < 1 then
			reason = "Invent something first (bay L3 / workshop lab)."
			locked = true
		end
		table.insert(out, {
			id = b.id,
			title = b.title,
			locked = locked,
			reason = reason,
		})
	end
	return out
end

function Romance.share(inv, npcId: string, storyId: string, ctx): (boolean, string, number)
	local def = Romance.generate(npcId, ctx.worldSeed or 1)
	if not def then
		return false, "She has already moved on.", 0
	end
	local rel = Romance.state(inv, npcId)
	local options = Romance.listStories(inv, npcId, ctx)
	local beat = nil
	for _, o in options do
		if o.id == storyId then
			beat = o
			break
		end
	end
	if not beat then
		return false, "Nothing to share.", rel.stage
	end
	if beat.locked then
		return false, beat.reason or "Not ready to share that yet.", rel.stage
	end
	table.insert(rel.storiesShared, storyId)
	local gain = if storyId == "origin" or storyId == "companion" then 14 elseif storyId == "invention" then 12 else 10
	local prev = rel.stage
	rel.affinity = math.min(120, rel.affinity + gain)
	Romance.recompute(rel)
	local reactIdx = (hashStr(`tell:{ctx.worldSeed or 1}:{npcId}:react:{storyId}:{rel.giftsGiven}`) % #def.storyReactions) + 1
	local reaction = def.storyReactions[reactIdx] or def.storyReactions[1]
	local stageBit = if rel.stage > prev
		then ` Now {Romance.stageName(rel.stage)}.`
		else ` (+{gain} affinity · {Romance.stageName(rel.stage)})`
	local preview = if storyId == "companion"
		then `I woke {ctx.companionName} in brass after the lab.`
		elseif storyId == "origin" then `I lost someone and kept building.`
		elseif storyId == "invention" then "I invented something I am still proud of."
		elseif storyId == "crew" then "My crew is not scenery."
		elseif storyId == "workshop" then "Leases and late nights paid for this bay."
		else "The shelves taught me what fear costs."
	return true, `You tell her: “{preview}” {def.name}: “{reaction}”{stageBit}`, rel.stage
end

function Romance.districtFor(npcId: string): string
	local index = 1
	for i, id in Romance.IDS do
		if id == npcId then
			index = i
			break
		end
	end
	local Districts
	local ok, loaded = pcall(function()
		return require(script.Parent.Districts)
	end)
	if ok then
		Districts = loaded
	else
		Districts = require("./Districts")
	end
	-- Browser: CITY_DISTRICTS[(i * 3 + 1) % length] with 0-based i
	local i = index - 1
	local slot = (i * 3 + 1) % #Districts.LIST
	return Districts.LIST[slot + 1].id
end

return Romance
