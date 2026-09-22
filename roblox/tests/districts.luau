local Districts = require("../src/shared/Districts")

local function fail(message: string)
	error(message, 0)
end

if #Districts.LIST ~= 14 then
	fail("fourteen districts")
end
if #Districts.SKYWAYS ~= 20 then
	fail("twenty skyways")
end

local home = Districts.byId("residential")
if not home or home.x ~= 0 or home.z ~= 0 or home.size ~= 120 or home.stallCost ~= 90 then
	fail("residential ring")
end
local spire = Districts.byId("aether_spire")
if not spire or spire.x ~= 550 or spire.z ~= -480 or spire.stallCost ~= 480 or spire.size ~= 110 then
	fail("aether spire")
end
local foundry = Districts.byId("sky_foundry")
if not foundry or foundry.x ~= -600 or foundry.z ~= -480 then
	fail("sky foundry")
end

local ax, az = Districts.apartment()
if ax ~= -32 or az ~= 20 then
	fail("apartment anchor")
end
local sx, sy, sz = Districts.apartmentSpawn()
if sx ~= -28 or sy ~= 1.75 or sz ~= 20 then
	fail("apartment spawn")
end
local _, _, worldZ = Districts.world(sx, sy, sz)
if worldZ ~= 1620 then
	fail("city offset keeps the cottage off the workshop")
end

local px, pz, cell = Districts.plotCenter(home, 0, 0)
if math.abs(px - -31.2) > 0.001 or math.abs(pz - -31.2) > 0.001 or math.abs(cell - 31.2) > 0.001 then
	fail("residential plot 0,0 " .. tostring(px) .. " " .. tostring(pz))
end
if Districts.centerSize(home) ~= 32 then
	fail("civic pad caps at 32")
end
if not Districts.hasReef(Districts.byId("grand_market")) or Districts.hasReef(home) then
	fail("reef districts")
end
if Districts.NEIGHBORS[1].id ~= "neighbor_pip" or Districts.NEIGHBORS[1].dx ~= 26 or Districts.NEIGHBORS[1].dz ~= 22 then
	fail("pip harper spot")
end
if Districts.SKYWAYS[1][1] ~= "residential" or Districts.SKYWAYS[1][2] ~= "mid_ring_east" then
	fail("first skyway")
end

print("district layout matches")
