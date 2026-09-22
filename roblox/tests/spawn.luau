local SpawnProgress = require("../src/shared/SpawnProgress")

local function fail(message: string)
	error(message, 0)
end

if SpawnProgress.resolve(nil, "explore", false) ~= "workshop" then
	fail("fresh explore stays in the workshop")
end
if SpawnProgress.resolve(nil, "siege", false) ~= "workshop" then
	fail("siege rejoin stays in the workshop")
end
if SpawnProgress.resolve(nil, "escape", false) ~= "workshop" then
	fail("dock rejoin stays in the workshop")
end
if SpawnProgress.resolve(nil, "market", false) ~= "market" then
	fail("skiff moves the checkpoint to the market")
end
if SpawnProgress.resolve(nil, "city", false) ~= "city" then
	fail("deed moves the checkpoint to the city")
end
if SpawnProgress.resolve(nil, "market", true) ~= "city" then
	fail("an owned apartment outranks a market visit")
end
if SpawnProgress.resolve("city", "market", false) ~= "city" then
	fail("a ferry visit must not walk the checkpoint backward")
end
if SpawnProgress.resolve("market", "siege", false) ~= "market" then
	fail("a workshop flag must not erase the market checkpoint")
end
if SpawnProgress.resolve("workshop", "market", false) ~= "market" then
	fail("phase still advances a workshop save")
end

if SpawnProgress.advance("workshop", "market") ~= "market" then
	fail("advance workshop to market")
end
if SpawnProgress.advance("market", "city") ~= "city" then
	fail("advance market to city")
end
if SpawnProgress.advance("city", "market") ~= "city" then
	fail("advance never retreats")
end
if SpawnProgress.advance(nil, "workshop") ~= "workshop" then
	fail("missing checkpoint stays workshop")
end

if SpawnProgress.locked("workshop") or not SpawnProgress.locked("market") or not SpawnProgress.locked("city") then
	fail("only players who left the workshop are locked")
end

print("spawn checkpoint matches")
