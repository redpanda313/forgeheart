-- Browser world units to Roblox studs. 1 unit = 4 studs, so a 1.6-unit
-- engineer is 6.4 studs, close to a Roblox avatar.
local Scale = {
	STUD_PER_UNIT = 4,
}

function Scale.studs(units: number): number
	return units * Scale.STUD_PER_UNIT
end

return Scale
