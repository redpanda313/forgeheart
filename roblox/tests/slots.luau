local Slots = require("../src/shared/Slots")

local function fail(message: string)
	error(message, 0)
end

if Slots.COUNT ~= 3 then
	fail("slot count")
end

local empty = Slots.emptyEnvelope()
local list, last = Slots.list(empty)
if last ~= 1 and last ~= 0 then
	-- migrate with no occupied slots still reports a last index
end
if #list ~= 3 or list[1].empty ~= true or list[1].label ~= "Slot 1 — Empty" then
	fail(list[1] and list[1].label or "no list")
end

local workshop = Slots.emptyPayload(7)
if Slots.levelId(workshop) ~= "workshop" or Slots.formatProgress(workshop) ~= "Workshop · wake companion" then
	fail(Slots.formatProgress(workshop))
end

local market = { phase = "market", brass = 120, bayLevel = 1, workers = {} }
if Slots.levelId(market) ~= "sky_city" then
	fail("market level")
end
if not string.find(Slots.formatProgress(market), "Goal 120/1000", 1, true) then
	fail(Slots.formatProgress(market))
end

local city = { apartment = true, brass = 400, bayLevel = 3, cityWorkshopLeased = true, workers = { {}, {} } }
if Slots.levelId(city) ~= "mega_city" then
	fail("city level")
end
if Slots.formatProgress(city) ~= "Sky City · 400 brass · Bay L3 · 2 workers · Workshop" then
	fail(Slots.formatProgress(city))
end

local migrated = Slots.migrate({ version = 5, phase = "city", brass = 80, apartment = true })
if migrated.version ~= 6 or migrated.lastSlot ~= 1 or type(migrated.slots[1]) ~= "table" then
	fail("migrate flat")
end
if migrated.slots[2] ~= false or migrated.slots[3] ~= false then
	fail("other slots empty")
end

local siege = { phase = "siege", brass = 40 }
if Slots.formatProgress(siege) ~= "Under siege" then
	fail(Slots.formatProgress(siege))
end

print("save slots match")
