local Economy = require("../src/shared/Economy")

local function fail(message: string)
	error(message, 0)
end

if Economy.APARTMENT_COST ~= 1000 then
	fail("apartment cost")
end
if Economy.COMMODITIES.scrap_brass.baseSell ~= 6 then
	fail("scrap sell")
end
if Economy.COMMODITIES.wire.baseSell ~= 11 then
	fail("wire sell")
end

local inv = Economy.empty(40)
local id, qty = Economy.harvest(inv, function()
	return 0
end)
if id ~= "cloud_iron" or qty ~= 1 then
	fail("harvest roll " .. tostring(id) .. " " .. tostring(qty))
end
local ok, message = Economy.craft(inv, "wire_from_scrap")
if ok then
	fail("craft should refuse without scrap")
end
if not string.find(message, "Draw Wire", 1, true) then
	fail(message)
end
Economy.add(inv, "scrap_brass", 2)
ok = Economy.craft(inv, "wire_from_scrap")
if not ok or Economy.count(inv, "wire") ~= 1 then
	fail("wire craft")
end
local gained = Economy.sellAll(inv)
-- cloud iron 8 + wire 11
if gained ~= 19 or inv.brass ~= 59 then
	fail("sell " .. tostring(gained) .. " brass " .. tostring(inv.brass))
end
local bought = Economy.buyApartment(inv)
if bought then
	fail("apartment should be too expensive")
end
inv.brass = 1000
bought = Economy.buyApartment(inv)
if not bought or inv.brass ~= 0 or inv.apartment ~= true then
	fail("apartment purchase")
end

print("economy starter rules match")
