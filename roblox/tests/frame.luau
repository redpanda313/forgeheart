local Economy = require("../src/shared/Economy")
local Frame = require("../src/shared/Frame")
local CityRules = require("../src/shared/CityRules")

local function fail(message: string)
	error(message, 0)
end

local inv = Economy.empty(40)
CityRules.ensure(inv)
inv.cityWorkshopLeased = true
inv.parcelLeased = true
Economy.add(inv, "cloud_iron", 1)
Economy.add(inv, "gear_blank", 1)
Economy.add(inv, "fuel_cell", 1)
Economy.add(inv, "wire", 1)
Economy.add(inv, "flower_gift", 1)

local fill = Frame.autoFill(inv)
if fill.chassis ~= "cloud_iron" or fill.mechanisms ~= "gear_blank" or fill.power ~= "fuel_cell" then
	fail("auto fill")
end
if fill.wiring ~= "wire" or fill.personality ~= "flower_gift" then
	fail("auto fill slots")
end

local stats = Frame.evaluate(fill)
if stats.name ~= "Cloudbloom IronGear Cell-Wire Frame" then
	fail("name " .. tostring(stats.name))
end
-- qualities: iron 1, gear 1.05, cell 1.1, wire 1, bloom 1.15 → avg 1.06
if math.abs(stats.quality - 1.06) > 0.001 then
	fail("quality " .. tostring(stats.quality))
end
-- material 8+16+20+11+5=60 * 1.15 + 1.06*38 = 69 + 40.28 = 109.28 → 109
if stats.sellValue ~= 109 then
	fail("sell " .. tostring(stats.sellValue))
end

local ok, msg = Frame.assemble(inv, fill)
if not ok or #inv.assembledFrames ~= 1 then
	fail(msg)
end
if Economy.count(inv, "cloud_iron") ~= 0 then
	fail("consumed")
end

local giftOk, giftMsg = CityRules.giftBrass(inv, "neighbor_sera")
if not giftOk or inv.neighborAff.neighbor_sera ~= 3 or inv.brass ~= 30 then
	fail(giftMsg .. " brass " .. tostring(inv.brass))
end

print("frame and gifts match")
