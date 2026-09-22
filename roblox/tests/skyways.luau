local Districts = require("../src/shared/Districts")
local Skyways = require("../src/shared/Skyways")

local function fail(message: string)
	error(message, 0)
end

local links = Skyways.links()
if #links < 20 + 1 + 3 + 1 then
	fail("static skyway count " .. tostring(#links))
end

local pair = links[1]
if pair.ax ~= 0 or pair.az ~= 0 or pair.bx ~= 230 or pair.bz ~= 100 or pair.width ~= 8 then
	fail("first pair residential → east mid-ring")
end

local foundApartment = false
local foundFerry = false
local foundPip = false
local foundReef = false
local ax, az = Districts.apartment()
for _, link in links do
	if link.ax == ax and link.az == az and link.bx == 0 and link.bz == 0 then
		foundApartment = true
	end
	if link.ax == 0 and link.az == 0 and link.bx == 0 and link.bz == 36 then
		foundFerry = true
	end
	if link.ax == 26 and link.az == 22 then
		foundPip = true
	end
	local rx, rz = Skyways.reefOffset(Districts.byId("spore_gardens"))
	if math.abs(link.bx - rx) < 0.05 and math.abs(link.bz - rz) < 0.05 then
		foundReef = true
	end
end
if not foundApartment or not foundFerry or not foundPip then
	fail("home hops")
end
if not foundReef then
	fail("spore gardens reef hop")
end

local curve = Skyways.curve(0, 0, 230, 100, { arch = math.min(22, 6 + math.sqrt(230 * 230 + 100 * 100) * 0.035), width = 8 })
if not curve or #curve.points < 13 then
	fail("bezier samples")
end
local mid = curve.points[math.floor(#curve.points / 2) + 1]
if mid.y <= Districts.DECK_Y + 2 then
	fail("arch height " .. tostring(mid.y))
end

local routes = Skyways.routes()
if #routes ~= #links then
	fail("world routes " .. tostring(#routes) .. " vs " .. tostring(#links))
end
local _, _, worldZ = Districts.world(0, 0, 0)
local onLane = Skyways.sampleFloor(0, worldZ + 8, routes)
if onLane == nil then
	fail("sample on residential-harbor / ferry hop")
end
local offLane = Skyways.sampleFloor(9000, 9000, routes)
if offLane ~= nil then
	fail("sample far from any lane")
end

local pads = Skyways.extraPads()
if #pads ~= 40 or math.abs(pads[1].x - 180) > 0.01 then
	fail("extra pads " .. tostring(pads[1].x))
end

print("skyways match")
