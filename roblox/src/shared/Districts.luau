-- Island table from economy.ts CITY_DISTRICTS, skyCity.ts skyway pairs,
-- and the residential anchors (apartment, neighbors, ferry).
-- Coordinates are browser units. The whole city is shifted on Z so it
-- does not sit on the workshop or the training market.
local Districts = {}

Districts.OFFSET_Z = 1600
Districts.DECK_Y = 0.2
Districts.FLOOR_THICK = 0.55

Districts.LIST = {
	{ id = "residential", name = "Residential Ring", x = 0, z = 0, size = 120, stallCost = 90, demandMul = 0.95, inventBonus = 0.9, color = 0x5A5348, role = "home" },
	{ id = "grand_market", name = "Grand Market", x = 400, z = -140, size = 152, stallCost = 280, demandMul = 1.4, inventBonus = 1.25, color = 0x6A5A48, role = "market", themePark = true },
	{ id = "industrial", name = "Industrial Slips", x = -350, z = -250, size = 135, stallCost = 160, demandMul = 0.85, inventBonus = 0.75, color = 0x4A4840, role = "industrial" },
	{ id = "harbor", name = "Cloud Harbor", x = 50, z = 480, size = 128, stallCost = 200, demandMul = 1.2, inventBonus = 1.0, color = 0x4A5560, role = "harbor" },
	{ id = "clocktower", name = "Clocktower Bazaar", x = 600, z = 250, size = 122, stallCost = 340, demandMul = 1.55, inventBonus = 1.45, color = 0x6A5848, role = "premium" },
	{ id = "gearworks", name = "Gearworks Ward", x = -520, z = 200, size = 120, stallCost = 220, demandMul = 1.1, inventBonus = 1.05, color = 0x555048, role = "industrial" },
	{ id = "spore_gardens", name = "Spore Gardens", x = 300, z = 530, size = 115, stallCost = 260, demandMul = 1.25, inventBonus = 1.7, color = 0x4A5A48, role = "premium" },
	{ id = "brass_arcade", name = "Brass Arcade", x = -280, z = 500, size = 122, stallCost = 300, demandMul = 1.35, inventBonus = 1.5, color = 0x6A5A40, role = "premium", themePark = true },
	{ id = "sky_foundry", name = "Sky Foundry", x = -600, z = -480, size = 132, stallCost = 240, demandMul = 1.05, inventBonus = 0.85, color = 0x4A4440, role = "industrial" },
	{ id = "aether_spire", name = "Aether Spire", x = 550, z = -480, size = 110, stallCost = 480, demandMul = 1.8, inventBonus = 2.0, color = 0x4A5068, role = "premium" },
	{ id = "mid_ring_east", name = "East Mid-Ring", x = 230, z = 100, size = 102, stallCost = 140, demandMul = 1.05, inventBonus = 1.0, color = 0x5A564C, role = "mixed" },
	{ id = "mid_ring_west", name = "West Mid-Ring", x = -200, z = 75, size = 102, stallCost = 140, demandMul = 1.0, inventBonus = 0.95, color = 0x5A564C, role = "mixed" },
	{ id = "south_docks", name = "South Docks", x = 100, z = -530, size = 105, stallCost = 180, demandMul = 1.15, inventBonus = 0.9, color = 0x4A5058, role = "harbor", themePark = true },
	{ id = "north_observatory", name = "North Observatory", x = -100, z = 650, size = 98, stallCost = 320, demandMul = 1.3, inventBonus = 1.6, color = 0x4A5568, role = "premium" },
}

Districts.SKYWAYS = {
	{ "residential", "mid_ring_east" },
	{ "residential", "mid_ring_west" },
	{ "residential", "harbor" },
	{ "mid_ring_east", "grand_market" },
	{ "mid_ring_west", "industrial" },
	{ "mid_ring_east", "clocktower" },
	{ "mid_ring_west", "gearworks" },
	{ "harbor", "spore_gardens" },
	{ "harbor", "brass_arcade" },
	{ "grand_market", "clocktower" },
	{ "grand_market", "aether_spire" },
	{ "grand_market", "south_docks" },
	{ "industrial", "sky_foundry" },
	{ "industrial", "gearworks" },
	{ "gearworks", "brass_arcade" },
	{ "spore_gardens", "north_observatory" },
	{ "brass_arcade", "north_observatory" },
	{ "spore_gardens", "clocktower" },
	{ "sky_foundry", "south_docks" },
	{ "aether_spire", "south_docks" },
}

Districts.NEIGHBORS = {
	{ id = "neighbor_pip", name = "Pip Harper", dx = 26, dz = 22 },
	{ id = "neighbor_sera", name = "Sera Quinn", dx = -24, dz = -24 },
	{ id = "neighbor_bolt", name = "Bolt Voss", dx = 28, dz = -18 },
}

function Districts.byId(id: string)
	for _, district in Districts.LIST do
		if district.id == id then
			return district
		end
	end
	return nil
end

function Districts.world(x: number, y: number, z: number): (number, number, number)
	return x, y, z + Districts.OFFSET_Z
end

-- Apartment underlay in skyCity.ts: residential + (-32, +20). Spawn is +4 on X.
function Districts.apartment(): (number, number)
	local home = Districts.byId("residential")
	return home.x - 32, home.z + 20
end

function Districts.apartmentSpawn(): (number, number, number)
	local x, z = Districts.apartment()
	return x + 4, 1.75, z
end

function Districts.plotCenter(district, cellX: number, cellY: number): (number, number, number)
	local cell = district.size * 0.26
	local originX = district.x - cell
	local originZ = district.z - cell
	return originX + cellX * cell, originZ + cellY * cell, cell
end

function Districts.centerSize(district): number
	return math.min(district.size * 0.3, 32)
end

function Districts.hasReef(district): boolean
	return district.role == "harbor"
		or district.role == "industrial"
		or district.role == "premium"
		or district.id == "spore_gardens"
		or district.id == "south_docks"
		or district.id == "mid_ring_east"
		or district.id == "mid_ring_west"
		or district.id == "grand_market"
end

return Districts
