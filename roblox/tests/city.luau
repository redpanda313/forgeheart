local CityRules = require("../src/shared/CityRules")

local function fail(message: string)
	error(message, 0)
end

local function inv(brass: number)
	local state = {
		brass = brass,
		items = {},
		apartment = false,
	}
	return CityRules.ensure(state)
end

if CityRules.expandBayCost(1) ~= 50 or CityRules.expandBayCost(2) ~= 100 then
	fail("early expand costs")
end
if CityRules.expandBayCost(3) ~= 150 or CityRules.expandBayCost(4) ~= 207 or CityRules.expandBayCost(5) ~= 286 then
	fail("empire expand " .. tostring(CityRules.expandBayCost(4)) .. " " .. tostring(CityRules.expandBayCost(5)))
end
if CityRules.maxWorkersForBay(3) ~= 3 or CityRules.maxWorkersForBay(4) ~= 5 then
	fail("worker cap")
end

local fresh = inv(0)
if CityRules.objective(fresh) ~= "Deed a sky apartment · Training market · 1000 brass · Real Estate east" then
	fail(CityRules.objective(fresh))
end

local home = inv(40)
home.apartment = true
CityRules.onDeed(home, "Ada")
if home.empireStanding ~= 5 or home.districtStanding.residential ~= 5 then
	fail("deed standing")
end
if home.workers[1].id ~= "bot_elias" or home.workers[1].name ~= "Ada" then
	fail("elias crew")
end
if CityRules.workerWage(home, home.workers[1]) ~= 1 then
	fail("elias wage")
end
if CityRules.objective(home) ~= "Lease empire workshop · Industrial slips west · craft · hire · invent" then
	fail(CityRules.objective(home))
end

local denied = CityRules.leaseWorkshop(home)
if denied then
	fail("workshop should be too expensive")
end
home.brass = 500
local leased, leaseMsg = CityRules.leaseWorkshop(home)
if not leased or home.brass ~= 420 or home.bayLevel ~= 3 or home.cityWorkshopLeased ~= true then
	fail("lease " .. tostring(home.brass) .. " " .. tostring(home.bayLevel))
end
if not string.find(leaseMsg, "Invent unlocked", 1, true) then
	fail(leaseMsg)
end
if home.empireStanding ~= 9 or home.districtStanding.industrial ~= 6 then
	fail("workshop standing")
end
if CityRules.objective(home) ~= "Meet a neighbor · Residential ring · E talk · drama and hire come later" then
	fail(CityRules.objective(home))
end

local _, talk = CityRules.talk(home, "neighbor_pip")
if not string.find(talk, "Mira Coil", 1, true) or home.metNeighbor ~= true then
	fail(talk)
end
if home.empireStanding ~= 11 or home.districtStanding.residential ~= 9 then
	fail("neighbor standing")
end
if CityRules.objective(home) ~= "Open a plaza stall · Lease a district shop · stock shelf · stay open" then
	fail(CityRules.objective(home))
end

local _, stallMsg = CityRules.leaseStall(home, "residential")
if home.brass ~= 330 or not string.find(stallMsg, "Residential Ring", 1, true) then
	fail(stallMsg .. " brass " .. tostring(home.brass))
end
if CityRules.bayUpkeepDue(home) ~= 6 then
	fail("upkeep due " .. tostring(CityRules.bayUpkeepDue(home)))
end
if CityRules.objective(home) ~= "Invent a product · Bay L3 / workshop invent desk" then
	fail(CityRules.objective(home))
end

local paid, payMsg = CityRules.tickUpkeep(home)
if not paid or home.brass ~= 324 or not string.find(payMsg, "crew wages 1", 1, true) then
	fail(payMsg .. " " .. tostring(home.brass))
end

home.brass = 1
local broke, brokeMsg = CityRules.tickUpkeep(home)
if broke or home.workers[1].unpaid ~= true or home.empireStanding ~= 11 then
	fail("fail tick " .. brokeMsg .. " standing " .. tostring(home.empireStanding))
end
if home.stalls.residential.open ~= false then
	fail("stall should close")
end
local again = CityRules.tickUpkeep(home)
if again or home.empireStanding ~= 11 then
	fail("second fail should not restack standing")
end

home.brass = 400
home.workers[1].unpaid = false
local hired, hireMsg = CityRules.hireHuman(home)
if not hired or not string.find(hireMsg, "Hired Pip", 1, true) or home.brass ~= 347 then
	fail(hireMsg .. " brass " .. tostring(home.brass))
end
if CityRules.hireCost(inv(0)) ~= 35 then
	fail("empty hire cost")
end

local grew, growMsg = CityRules.expandBay(home)
if not grew or home.bayLevel ~= 4 or home.brass ~= 197 or not string.find(growMsg, "Empire Bay L4", 1, true) then
	fail(growMsg .. " L" .. tostring(home.bayLevel) .. " " .. tostring(home.brass))
end

home.brass = 500
local raised, raiseMsg = CityRules.improveHome(home)
if not raised or home.home.tier ~= "house" or home.brass ~= 50 then
	fail(raiseMsg .. " " .. tostring(home.brass))
end
home.brass = 200
local garden, gardenMsg = CityRules.improveHome(home)
if not garden or not CityRules.hasRoom(home, "garden") or home.brass ~= 20 then
	fail(gardenMsg .. " " .. tostring(home.brass))
end

print("city rules match")
