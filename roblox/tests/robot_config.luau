local fs = require("@lune/fs")
local serde = require("@lune/serde")

local Robot = require("../src/shared/RobotConfig")
local Scale = require("../src/shared/Scale")

local golden = serde.decode("json", fs.readFile("tests/golden/robot.json"))

local failures = {}

local function eq(got, expect, name: string)
	if type(expect) == "number" then
		if type(got) ~= "number" or math.abs(got - expect) > 1e-6 then
			table.insert(failures, string.format("%s: got %s expected %s", name, tostring(got), tostring(expect)))
		end
		return
	end
	if got ~= expect then
		table.insert(failures, string.format("%s: got %s expected %s", name, tostring(got), tostring(expect)))
	end
end

for key, value in golden do
	local got = Robot[key]
	if type(value) == "table" then
		for index, item in ipairs(value) do
			eq(got[index], item, key .. "[" .. tostring(index) .. "]")
		end
	else
		eq(got, value, key)
	end
end

eq(Scale.STUD_PER_UNIT, 4, "STUD_PER_UNIT")
eq(Scale.studs(1.6), 6.4, "player height in studs")
eq(Scale.studs(7), 28, "walk speed in studs")

if #failures > 0 then
	for _, line in ipairs(failures) do
		print(line)
	end
	error("robot config drifted from src/forgeheart/robot.ts")
end

print("robot config matches golden")
