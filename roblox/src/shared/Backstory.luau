-- Procedural starter story. Same seeds as src/forgeheart/backstory.ts.
local Data
do
	local ok, loaded = pcall(function()
		return require(script.Parent.BackstoryData)
	end)
	if ok then
		Data = loaded
	else
		Data = require("./BackstoryData")
	end
end

local Backstory = {}

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

local function pick(rng, arr)
	local n = #arr
	local index = math.floor(rng() * n) % n + 1
	return arr[index]
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

local function pronounsFor(gender: string)
	if gender == "m" then
		return {
			subject = "he",
			object = "him",
			possessive = "his",
			possessiveNoun = "his",
			reflexive = "himself",
			was = "was",
			is = "is",
			has = "has",
			s = "s",
		}
	end
	if gender == "f" then
		return {
			subject = "she",
			object = "her",
			possessive = "her",
			possessiveNoun = "hers",
			reflexive = "herself",
			was = "was",
			is = "is",
			has = "has",
			s = "s",
		}
	end
	return {
		subject = "they",
		object = "them",
		possessive = "their",
		possessiveNoun = "theirs",
		reflexive = "themselves",
		was = "were",
		is = "are",
		has = "have",
		s = "",
	}
end

local function namePool(gender: string)
	if gender == "m" then
		return Data.MALE_NAMES
	end
	if gender == "f" then
		return Data.FEMALE_NAMES
	end
	local pool = table.clone(Data.NEUTRAL_NAMES)
	for i = 1, 12 do
		table.insert(pool, Data.MALE_NAMES[i])
	end
	for i = 1, 12 do
		table.insert(pool, Data.FEMALE_NAMES[i])
	end
	return pool
end

local function resolveGender(who, rng)
	if who.genderBias == "m" or who.genderBias == "f" then
		return who.genderBias
	end
	local roll = rng()
	if roll < 0.42 then
		return "m"
	end
	if roll < 0.84 then
		return "f"
	end
	return "n"
end

local function capitalize(text: string): string
	if text == "" then
		return text
	end
	return string.upper(string.sub(text, 1, 1)) .. string.sub(text, 2)
end

local function buildTutorial(args)
	local n = args.companionName
	local surname = args.surname
	local who = args.who
	local p = args.p
	local how = args.how
	local remains = args.remains
	local why = args.why
	local moral = args.moral
	local scar = args.scar
	local personality = args.personality
	local season = args.season
	local place = args.place
	local lastWords = args.lastWords
	local workshopTone = args.workshopTone
	local trays = args.trays
	local rng = args.rng
	local N = n
	local whoOf = who.of
	local tone = string.gsub(workshopTone, "{p}", p.possessive)

	local photoOpener = pick(rng, Data.PHOTO_OPENERS)
	local photoQuotes = {
		"Taken {season}. {Subject} {was} {personality}.",
		"{Season}. I still hear {object} humming at the bench.",
		"{Subject} {was} {personality}. I keep this where I can see {object}.",
	}
	-- Fill after pick so the RNG order matches the browser, which picks a template then interpolates.
	local function fillQuote(template: string): string
		return template
			:gsub("{season}", season)
			:gsub("{Season}", capitalize(season))
			:gsub("{Subject}", capitalize(p.subject))
			:gsub("{was}", p.was)
			:gsub("{personality}", personality)
			:gsub("{object}", p.object)
	end
	local quote = fillQuote(pick(rng, photoQuotes))

	local burialLines = {
		"You laid {object} to rest {place}. The lab {tone}.",
		"Afterward you came back here alone. The workshop {tone}.",
		"There is a place {place} with {possessive} name — and this room, which still expects {object}.",
	}
	local function fillBurial(template: string): string
		return template
			:gsub("{object}", p.object)
			:gsub("{place}", place)
			:gsub("{tone}", tone)
			:gsub("{possessive}", p.possessive)
	end
	local burial = fillBurial(pick(rng, burialLines))

	local journalBodies = {
		"I found the coil pattern in a sealed folio: plasma laced through brass can hold a pattern of mind. Not a program — a guest. When the frame is quiet and the remains are true, a soul may take seat. I write this for {whoOf}.",
		"Grandfather’s notes called it a “guest pattern.” Plasma sings; brass remembers. If any spark remains between stars and steam, the right seat will know {object}. I build because {why}.",
		"Tonight I stop calling automata empty. Something looks out when the plasma holds. I will seat {whoOf} if the city itself has to wait. The coil is ready. What remains is {remains}.",
	}
	local theoryBodies = {
		"I no longer believe the automata are empty. Something looks out of their eyes when the plasma sings. Demons wear scrap like coats. But love is a beacon too — if I can call {whoOf} home, {subject} will know my voice.",
		"They said personhood cannot cling to metal. I have seen the opposite: fear in red eyes, loyalty in green. {WhoOf} taught me that. {Subject} {was} {personality}. I will not scrap what still might listen.",
		"Rogue frames prove the worst can take a body. Then the best must be possible too. I am {moral} — and I carry {scar}. Still I reach for {whoOf} with the Hand, not the wrench.",
	}
	local talismanBodies = {
		"Wired {remains} into the chest plate. If any spark of {whoOf} remains, it will know this weight. Do not scrap the frame. Reprogram with the Hand. Speak {possessive} name.",
		"Last words I keep: {lastWords} I obeyed as far as craft allows. The frame on the bench is {possessive} only chance. Hand (1). Not E. Not yet.",
		"{Remains} sits over the heart gear. {WhoOf}, lost to {how}. I build {why}. Wake {object} gently.",
	}
	local function fillBody(template: string): string
		return template
			:gsub("{whoOf}", whoOf)
			:gsub("{WhoOf}", capitalize(whoOf))
			:gsub("{object}", p.object)
			:gsub("{subject}", p.subject)
			:gsub("{Subject}", capitalize(p.subject))
			:gsub("{was}", p.was)
			:gsub("{why}", why)
			:gsub("{remains}", remains)
			:gsub("{Remains}", capitalize(remains))
			:gsub("{personality}", personality)
			:gsub("{moral}", moral)
			:gsub("{scar}", scar)
			:gsub("{possessive}", p.possessive)
			:gsub("{lastWords}", lastWords)
			:gsub("{how}", how)
	end

	local wakeFlashes = {
		"{NUPPER} — the talisman finds {object}. Green eyes. {WhoOf}.",
		"{NUPPER} — plasma seats a guest. {Subject} knows you.",
		"GREEN EYES — {N} answers. {WhoOf} is home in brass.",
	}
	local wakeToasts = {
		"Plasma will settle near three-quarters with one ally. Stay close to {object}.",
		"{Subject} will fight beside you. Keep {object} in sight — the grid is fragile.",
		"Speak soft if you must. {Subject} is listening through iron. Guard the workshop together.",
	}
	local scrapToasts = {
		"No. The trays still hold {possessive} parts. Gather all three (E), then rebuild. You can still call {N} home.",
		"You dismantled the seat — not the soul. Three trays. Then the Hand. {N} is not finished.",
		"Grief made your hands cruel. Fix it: reclaim the trays, reseat {remains}, wake {N} properly.",
	}
	local siegeToasts = {
		"Demon-ridden frames. Hold the workshop for {N} — or take the Arc Wrench and force the door open early.",
		"Something outside wants empty hulls. Protect {N}. Grab the Arc Wrench (E) or wait out the bangs.",
		"The door shudders. {N} just woke into a siege. Arc Wrench on the rack — stand ready.",
	}
	local function fillBeat(template: string): string
		return fillBody(template)
			:gsub("{NUPPER}", string.upper(N))
			:gsub("{N}", N)
	end

	local marketLines = {
		"You lost {whoOf} to {how}.",
		"All that remains is {remains}.",
		"You build {why}.",
		"They call you {moral} — and you carry {scar}.",
		"{N} walks with you now in brass and green light.",
	}
	for i, line in marketLines do
		marketLines[i] = fillBeat(line)
	end

	return {
		workshopName = `{surname} Workshop`,
		flashTitle = `The Workshop — {N} waits on the bench`,
		openingToast = `{capitalize(whoOf)} is gone — lost to {how}. The frame holds {remains}. Walk the lab. Read. Then use the Hand (1) to wake {N} — not scrap (E).`,
		objectiveExplore = `Read the lab. Wake {N} with the Hand (1) — do not scrap {p.object}.`,
		photoTitle = `Photograph — {N} {surname}`,
		photoText = `{capitalize(whoOf)}. {photoOpener}: “{quote}” {burial}`,
		notes = {
			{ title = pick(rng, Data.JOURNAL_TITLES), text = fillBody(pick(rng, journalBodies)) },
			{ title = pick(rng, Data.THEORY_TITLES), text = fillBody(pick(rng, theoryBodies)) },
			{ title = pick(rng, Data.TALISMAN_TITLES), text = fillBody(pick(rng, talismanBodies)) },
		},
		trayLabels = trays,
		wrenchText = `An arc wrench from the family rack — plasma teeth for rogue frames. Press E to take it. Protect {N}.`,
		boatText = `Brass levers and a plasma throttle. Press E to cast off — escape with {N}.`,
		wakeFlash = fillBeat(pick(rng, wakeFlashes)),
		wakeToast = fillBeat(pick(rng, wakeToasts)),
		siegeToast = fillBeat(pick(rng, siegeToasts)),
		scrapFlash = "The talisman frame is scrap —",
		scrapToast = fillBeat(pick(rng, scrapToasts)),
		rebuildObjectiveBase = `Rebuild {N}`,
		rebuildFlash = `A new shell stands — {remains} reseated`,
		rebuildToast = `Stand close. Hand weapon. Click to reprogram. Speak the name {N} in the plasma.`,
		surviveObjective = `Survive — arc the demons, keep {N} close`,
		breachToastFight = `They wear scrap like coats. Arc wrench for combat. {N} will fight beside you.`,
		breachToastFlee = `They wear scrap like coats. Fight with {N} or run for the skiff.`,
		doorAlmostToast = `Almost through — stand ready with {N}.`,
		winFlash = `SKIFF AWAY — {N} is with you`,
		winToast = `Next: Sky City Market training — earn 1000 brass and buy a sky apartment. {N} rides the next chapter with you.`,
		marketLines = marketLines,
		trayPartFlash = function(title: string, count: number): string
			return `Part recovered — {title} ({count}/3)`
		end,
		trayObjective = function(count: number): string
			return `Rebuild {N} — trays {count}/3`
		end,
	}
end

function Backstory.generate(seed: number)
	local stored = bit32.bor(seed or 0, 0)
	local rng = mulberry32(if stored == 0 then 1 else stored)
	rng()
	rng()

	local who = pick(rng, Data.WHO)
	local gender = resolveGender(who, rng)
	local pronouns = pronounsFor(gender)
	local companionName = pick(rng, namePool(gender))
	local playerSurname = pick(rng, Data.SURNAMES)
	local how = pick(rng, Data.HOW)
	local remains = pick(rng, Data.REMAINS)
	local why = pick(rng, Data.WHY)
	local moral = pick(rng, Data.MORAL)
	local scar = pick(rng, Data.SCAR)
	local personality = pick(rng, Data.PERSONALITY)
	local season = pick(rng, Data.SEASONS)
	local place = pick(rng, Data.PLACES)
	local lastWords = pick(rng, Data.LAST_WORDS)
	local workshopToneRaw = pick(rng, Data.WORKSHOP_TONES)
	local workshopTone = string.gsub(workshopToneRaw, "{p}", pronouns.possessive)
	local trays = pick(rng, Data.TRAY_SETS)

	pickN(rng, Data.PERSONALITY, 2)
	pick(rng, Data.HOW)

	local tutorial = buildTutorial({
		companionName = companionName,
		surname = playerSurname,
		who = who,
		p = pronouns,
		how = how,
		remains = remains,
		why = why,
		moral = moral,
		scar = scar,
		personality = personality,
		season = season,
		place = place,
		lastWords = lastWords,
		workshopTone = workshopToneRaw,
		trays = trays,
		rng = rng,
	})

	local lines = { tutorial.marketLines[1], tutorial.marketLines[2], tutorial.marketLines[3], tutorial.marketLines[4] }
	return {
		seed = stored,
		whoId = who.id,
		who = who.label,
		whoOf = who.of,
		companionName = companionName,
		playerSurname = playerSurname,
		gender = gender,
		pronouns = pronouns,
		how = how,
		remains = remains,
		why = why,
		moral = moral,
		scar = scar,
		personality = personality,
		season = season,
		place = place,
		lastWords = lastWords,
		workshopTone = workshopTone,
		summary = table.concat(lines, " "),
		lines = lines,
		tutorial = tutorial,
	}
end

function Backstory.estimateSpace(): number
	return #Data.WHO
		* (#Data.MALE_NAMES + #Data.FEMALE_NAMES + #Data.NEUTRAL_NAMES)
		* #Data.SURNAMES
		* #Data.HOW
		* #Data.REMAINS
		* #Data.WHY
		* #Data.MORAL
		* #Data.SCAR
		* #Data.PERSONALITY
		* #Data.SEASONS
		* #Data.PLACES
		* #Data.LAST_WORDS
		* #Data.WORKSHOP_TONES
		* #Data.TRAY_SETS
end

return Backstory
