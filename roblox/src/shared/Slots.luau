-- Three save slots from src/forgeheart/save.ts.
local Slots = {}

Slots.COUNT = 3
Slots.VERSION = 6

Slots.LEVEL_NAMES = {
	workshop = "Voss Workshop",
	sky_city = "Sky City Market · Training",
	mega_city = "Sky City · Home District",
}

function Slots.levelId(payload): string
	if type(payload) ~= "table" then
		return "workshop"
	end
	if payload.apartment == true or payload.phase == "city" or payload.spawn == "city" then
		return "mega_city"
	end
	if
		payload.phase == "market"
		or payload.phase == "won"
		or payload.phase == "race"
		or payload.spawn == "market"
	then
		return "sky_city"
	end
	return "workshop"
end

function Slots.levelName(payload): string
	return Slots.LEVEL_NAMES[Slots.levelId(payload)] or "Voss Workshop"
end

function Slots.formatProgress(payload): string
	if type(payload) ~= "table" then
		return "Empty"
	end
	local brass = payload.brass or 40
	local bay = payload.bayLevel or 0
	local workers = if type(payload.workers) == "table" then #payload.workers else 0
	local bayBit = if bay > 0 then ` · Bay L{bay}` else ""
	local wBit = if workers > 0 then ` · {workers} workers` else ""
	local level = Slots.levelId(payload)
	if level == "mega_city" then
		local shop = if payload.cityWorkshopLeased then " · Workshop" else ""
		return `Sky City · {brass} brass{bayBit}{wBit}{shop}`
	end
	if level == "sky_city" then
		local apt = if payload.apartment then " · Apartment" else ` · Goal {brass}/1000`
		return `Market training · {brass} brass{bayBit}{wBit}{apt}`
	end
	local phase = payload.phase
	if phase == "escape" or phase == "breach" then
		return "Escape in progress"
	end
	if phase == "siege" then
		return "Under siege"
	end
	if phase == "rebuild" then
		return "Rebuilding companion"
	end
	if phase == "explore" then
		return "Workshop · wake companion"
	end
	return "In the workshop"
end

function Slots.emptyPayload(seed: number?)
	return {
		version = 5,
		backstorySeed = seed or 1,
		phase = "explore",
		spawn = "workshop",
		eliasAwake = false,
		brass = 40,
		aether = 0,
		items = {},
		apartment = false,
		harvestRuns = 0,
	}
end

function Slots.emptyEnvelope()
	return {
		version = Slots.VERSION,
		lastSlot = 0,
		slots = { false, false, false },
	}
end

function Slots.isFlatSave(data): boolean
	if type(data) ~= "table" then
		return false
	end
	if type(data.slots) == "table" and (data.version == Slots.VERSION or data.lastSlot ~= nil) then
		return false
	end
	return data.phase ~= nil or data.brass ~= nil or data.eliasAwake ~= nil or data.backstorySeed ~= nil
end

function Slots.migrate(data)
	if type(data) ~= "table" then
		return Slots.emptyEnvelope()
	end
	if type(data.slots) == "table" then
		local slots = {}
		for i = 1, Slots.COUNT do
			local slot = data.slots[i]
			slots[i] = if type(slot) == "table" then slot else false
		end
		local last = data.lastSlot
		if type(last) ~= "number" or last < 1 or last > Slots.COUNT then
			last = 1
			for i = 1, Slots.COUNT do
				if type(slots[i]) == "table" then
					last = i
					break
				end
			end
		end
		return { version = Slots.VERSION, lastSlot = last, slots = slots }
	end
	if Slots.isFlatSave(data) then
		return { version = Slots.VERSION, lastSlot = 1, slots = { data, false, false } }
	end
	return Slots.emptyEnvelope()
end

function Slots.list(envelope)
	local env = Slots.migrate(envelope)
	local out = {}
	for i = 1, Slots.COUNT do
		local data = env.slots[i]
		if type(data) ~= "table" then
			table.insert(out, {
				index = i,
				empty = true,
				label = `Slot {i} — Empty`,
				sublabel = "New game will use this slot",
				progress = "",
			})
		else
			table.insert(out, {
				index = i,
				empty = false,
				label = Slots.levelName(data),
				sublabel = `Slot {i}`,
				progress = Slots.formatProgress(data),
				phase = data.phase,
				brass = data.brass,
			})
		end
	end
	return out, env.lastSlot
end

return Slots
