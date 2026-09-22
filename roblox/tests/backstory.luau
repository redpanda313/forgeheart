local fs = require("@lune/fs")
local serde = require("@lune/serde")

local Backstory = require("../src/shared/Backstory")
local golden = serde.decode("json", fs.readFile("tests/golden/backstories.json"))

local failures = {}

local function fail(message: string)
	table.insert(failures, message)
end

local function same(got, expect, name: string)
	if type(expect) == "table" then
		if type(got) ~= "table" then
			fail(name .. " is not a table")
			return
		end
		if #expect > 0 then
			for index, item in ipairs(expect) do
				same(got[index], item, name .. "[" .. tostring(index) .. "]")
			end
			return
		end
		for key, item in expect do
			same(got[key], item, name .. "." .. tostring(key))
		end
		return
	end
	if got ~= expect then
		fail(string.format("%s\n  got: %s\n  expected: %s", name, tostring(got), tostring(expect)))
	end
end

if Backstory.estimateSpace() ~= golden.space then
	fail(string.format("space %s ~= %s", tostring(Backstory.estimateSpace()), tostring(golden.space)))
end

for _, expect in ipairs(golden.stories) do
	local story = Backstory.generate(expect.seed)
	local tutorial = story.tutorial
	local gotTutorial = {}
	for key, value in tutorial do
		if type(value) ~= "function" then
			gotTutorial[key] = value
		end
	end
	gotTutorial.trayPartFlashSample = tutorial.trayPartFlash(tutorial.trayLabels[1], 2)
	gotTutorial.trayObjectiveSample = tutorial.trayObjective(2)
	local got = {
		seed = story.seed,
		whoId = story.whoId,
		who = story.who,
		whoOf = story.whoOf,
		companionName = story.companionName,
		playerSurname = story.playerSurname,
		gender = story.gender,
		pronouns = story.pronouns,
		how = story.how,
		remains = story.remains,
		why = story.why,
		moral = story.moral,
		scar = story.scar,
		personality = story.personality,
		season = story.season,
		place = story.place,
		lastWords = story.lastWords,
		workshopTone = story.workshopTone,
		summary = story.summary,
		lines = story.lines,
		tutorial = gotTutorial,
	}
	same(got, expect, "seed " .. tostring(expect.seed))
end

if #failures > 0 then
	print(table.concat(failures, "\n\n"))
	error(#failures .. " backstory mismatches")
end

print("backstories match", #golden.stories, "seeds")
