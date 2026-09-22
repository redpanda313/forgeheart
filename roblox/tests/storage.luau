local CityRules = require("../src/shared/CityRules")
local Storage = require("../src/shared/Storage")

local function fail(message: string)
	error(message, 0)
end

if Storage.upgradeCost("inventions", 0) ~= 500 then
	fail("invent L0 " .. tostring(Storage.upgradeCost("inventions", 0)))
end
if Storage.upgradeCost("crafted", 0) ~= 850 or Storage.upgradeCost("resources", 0) ~= 1500 then
	fail("vault bases")
end
if Storage.upgradeCost("inventions", 1) ~= 20000 then
	fail("invent L1 " .. tostring(Storage.upgradeCost("inventions", 1)))
end
if Storage.officeDistrict("inventions") ~= "aether_spire" then
	fail("spire")
end
if Storage.officeDistrict("crafted") ~= "clocktower" or Storage.officeDistrict("resources") ~= "north_observatory" then
	fail("offices")
end

local inv = CityRules.ensure({ brass = 600, items = { bloom_aether = 3 } })
if Storage.inventionCap(inv) ~= 99 then
	fail("base invent cap")
end
local ok, msg = Storage.upgrade(inv, "inventions")
if not ok or inv.storageInventionsLevel ~= 1 or inv.brass ~= 100 then
	fail(msg .. " " .. tostring(inv.brass))
end
if Storage.inventionCap(inv) ~= 999 then
	fail("L1 cap " .. tostring(Storage.inventionCap(inv)))
end

local distilled, distMsg = Storage.distillAether(inv)
if not distilled or inv.aether ~= 3 or inv.items.bloom_aether ~= nil then
	fail(distMsg)
end

inv.playerBoard.owned = true
inv.brass = 200
inv.items.fuel_cell = 2
inv.items.polished_wire = 2
inv.items.cloud_iron = 6
local drive, driveMsg = Storage.craftAetherDrive(inv)
if not drive or inv.playerBoard.aetherDrive ~= true or inv.brass ~= 20 then
	fail(driveMsg .. " " .. tostring(inv.brass))
end

print("bonded storage and aether match")
