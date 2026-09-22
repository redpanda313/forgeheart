local CityRules = require("../src/shared/CityRules")
local Market = require("../src/shared/Market")

local function fail(message: string)
	error(message, 0)
end

if Market.fairStallPrice("cloud_iron") ~= 4 or Market.fairStallPrice("spore_silk") ~= 7 then
	fail("fair stall")
end

local hot = Market.stallDemandInfo(3, 4, 0)
if hot.label ~= "Hot" or hot.factor ~= 1.5 then
	fail("hot " .. hot.label)
end
local steady = Market.stallDemandInfo(4, 4, 0)
if steady.label ~= "Steady" then
	fail("steady " .. steady.label)
end
local dead = Market.stallDemandInfo(8, 4, 0)
if dead.label ~= "Dead" or dead.factor ~= 0.09 then
	fail("dead " .. dead.label)
end

local serve = Market.categoryServeMul(1)
if serve.mul ~= 1.28 or serve.label ~= "Underserved niche" then
	fail("underserve")
end
if Market.categoryServeMul(2).mul ~= 1.0 or Market.categoryServeMul(3).mul ~= 0.88 or Market.categoryServeMul(4).mul ~= 0.72 then
	fail("serve ladder")
end

local bundle = Market.combineDemand({
	districtDemandMul = 1.8,
	openStallsStockingNeed = 1,
	empireStanding = 0,
	districtStanding = 0,
	avgKnownAffinity = 0,
	placementMul = 1,
	need = "mats",
})
if math.abs(bundle.demandMul - 1.8 * 1.28) > 0.001 then
	fail("aether plaza demand " .. tostring(bundle.demandMul))
end
if not string.find(table.concat(bundle.drivers, " · "), "Plaza ×1.80", 1, true) then
	fail("plaza driver")
end

local inv = CityRules.ensure({ brass = 200, items = { cloud_iron = 5 }, apartment = true })
local ok, msg = CityRules.leaseStall(inv, "residential")
if not ok then
	fail(msg)
end
local stocked, stockMsg = Market.stockGoods(inv, "residential", "cloud_iron", 2)
if not stocked then
	fail(stockMsg)
end
local stall = inv.stalls.residential
if stall.asks.cloud_iron ~= 4 then
	fail("ask default " .. tostring(stall.asks.cloud_iron))
end
local priced, priceMsg = Market.applyPolicy(inv, stall, "premium")
if not priced or stall.asks.cloud_iron ~= 5 then
	fail(priceMsg .. " ask " .. tostring(stall.asks.cloud_iron))
end
local d = Market.stallDemandInfo(5, 4, 0)
if d.label ~= "Cool" then
	fail("premium cool " .. d.label)
end

local rolls = { 0.01, 0.01, 0.05, 0.5 }
local i = 0
local function haggleRng()
	i += 1
	return rolls[i] or 0.5
end
local tick = Market.tickStallState(inv, stall, { demandMul = 1, inventBonus = 1, label = "Residential Ring" }, haggleRng)
if not tick.haggle or not stall.pendingHaggle then
	fail("expected haggle " .. tostring(tick.msg))
end
local refused, refuseMsg = Market.resolveHaggle(inv, stall, false)
if not refused or stall.pendingHaggle ~= nil then
	fail(refuseMsg)
end
if (stall.shelf.cloud_iron or 0) ~= 2 then
	fail("refuse should not take stock")
end

i = 0
rolls = { 0.01, 0.01, 0.99 }
local sold = Market.tickStallState(inv, stall, { demandMul = 1, inventBonus = 1, label = "Residential Ring" }, haggleRng)
if not sold.ok or not string.find(sold.msg or "", "5b", 1, true) or not string.find(sold.msg or "", "premium", 1, true) then
	fail(sold.msg or "no sale")
end
if (stall.shelf.cloud_iron or 0) ~= 1 then
	fail("sale consume")
end

print("market demand and haggle match")
