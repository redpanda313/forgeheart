-- Bonded storage + Aether from economy.ts.
local Economy
do
	local ok, loaded = pcall(function()
		return require(script.Parent.Economy)
	end)
	if ok then
		Economy = loaded
	else
		Economy = require("./Economy")
	end
end

local Storage = {}

Storage.MAX_LEVEL = 3
Storage.CAP_TIERS = { 0, 999, 999999, 999999999 }
Storage.INVENTION_BASE = 99
Storage.COST_BASE = {
	inventions = 500,
	crafted = 850,
	resources = 1500,
}
Storage.COST_SCALE = 40
Storage.RESOURCE_IDS = { "cloud_iron", "scrap_brass", "spore_silk", "sky_salt", "wire" }
Storage.CRAFTED_IDS = {
	"glass_pane",
	"fuel_cell",
	"gear_blank",
	"repair_kit",
	"speed_tool",
	"haul_pack",
	"polished_wire",
	"brass_charm",
	"silk_scarf",
	"bloom_brass",
	"bloom_sky",
	"bloom_spore",
	"bloom_harbor",
	"bloom_aether",
	"flower_gift",
}

function Storage.ensure(inv)
	if inv.aether == nil then
		inv.aether = 0
	end
	if inv.storageResourcesLevel == nil then
		inv.storageResourcesLevel = 0
	end
	if inv.storageCraftedLevel == nil then
		inv.storageCraftedLevel = 0
	end
	if inv.storageInventionsLevel == nil then
		inv.storageInventionsLevel = 0
	end
	if type(inv.playerBoard) ~= "table" then
		inv.playerBoard = { owned = false, thruster = false, rails = false, deck = false }
	end
	if inv.playerBoard.aetherDrive == nil then
		inv.playerBoard.aetherDrive = false
	end
	if inv.playerBoard.gyro == nil then
		inv.playerBoard.gyro = false
	end
	return inv
end

function Storage.trackLabel(track: string): string
	if track == "resources" then
		return "Resources"
	end
	if track == "crafted" then
		return "Crafted"
	end
	return "Inventions"
end

function Storage.officeDistrict(track: string): string
	if track == "resources" then
		return "north_observatory"
	end
	if track == "crafted" then
		return "clocktower"
	end
	return "aether_spire"
end

function Storage.trackFor(id: string): string
	for _, rid in Storage.RESOURCE_IDS do
		if rid == id then
			return "resources"
		end
	end
	return "crafted"
end

function Storage.getLevel(inv, track: string): number
	Storage.ensure(inv)
	local raw = if track == "resources"
		then inv.storageResourcesLevel
		elseif track == "crafted" then inv.storageCraftedLevel
		else inv.storageInventionsLevel
	return math.clamp(math.floor(raw or 0), 0, Storage.MAX_LEVEL)
end

function Storage.capAtLevel(track: string, level: number, baseStack: number): number
	local lv = math.clamp(level, 0, Storage.MAX_LEVEL)
	if lv <= 0 then
		return if track == "inventions" then Storage.INVENTION_BASE else baseStack
	end
	return Storage.CAP_TIERS[lv + 1] or Storage.CAP_TIERS[Storage.MAX_LEVEL + 1]
end

function Storage.inventionCap(inv): number
	return Storage.capAtLevel("inventions", Storage.getLevel(inv, "inventions"), Storage.INVENTION_BASE)
end

function Storage.upgradeCost(track: string, fromLevel: number): number
	if fromLevel < 0 or fromLevel >= Storage.MAX_LEVEL then
		return 0
	end
	local base = Storage.COST_BASE[track] or 500
	return math.round(base * (Storage.COST_SCALE ^ fromLevel))
end

function Storage.upgrade(inv, track: string): (boolean, string)
	Storage.ensure(inv)
	if track ~= "resources" and track ~= "crafted" and track ~= "inventions" then
		return false, "Unknown vault."
	end
	local from = Storage.getLevel(inv, track)
	if from >= Storage.MAX_LEVEL then
		return false, `{Storage.trackLabel(track)} storage is fully expanded.`
	end
	local cost = Storage.upgradeCost(track, from)
	if inv.brass < cost then
		return false, `Need {cost} brass (have {inv.brass}).`
	end
	inv.brass -= cost
	local nextLv = from + 1
	if track == "resources" then
		inv.storageResourcesLevel = nextLv
	elseif track == "crafted" then
		inv.storageCraftedLevel = nextLv
	else
		inv.storageInventionsLevel = nextLv
	end
	local base = if track == "inventions" then Storage.INVENTION_BASE else 99
	local cap = Storage.capAtLevel(track, nextLv, base)
	return true, `{Storage.trackLabel(track)} storage → L{nextLv} · hold up to {cap} each ({cost}b).`
end

function Storage.distillAether(inv): (boolean, string)
	Storage.ensure(inv)
	local n = inv.items.bloom_aether or 0
	if n < 1 then
		return false, "Need Aether Orchids from premium reefs or plaza gardens."
	end
	inv.items.bloom_aether = nil
	inv.aether += n
	return true, `Distilled {n} Aether Orchid{if n == 1 then "" else "s"} · Æ {inv.aether}.`
end

function Storage.summary(inv, track: string): string
	Storage.ensure(inv)
	local level = Storage.getLevel(inv, track)
	local nextCost = Storage.upgradeCost(track, level)
	local base = if track == "inventions" then Storage.INVENTION_BASE else 99
	local cap = Storage.capAtLevel(track, level, base)
	local office = if track == "resources"
		then "North Observatory"
		elseif track == "crafted" then "Clocktower Bazaar"
		else "Aether Spire"
	local lines = {
		`{Storage.trackLabel(track)} vault · {office}`,
		`Bonded L{level}/{Storage.MAX_LEVEL} · cap {cap} each`,
		`Aether Æ {inv.aether}`,
	}
	if level >= Storage.MAX_LEVEL then
		table.insert(lines, "This vault is fully bonded.")
	else
		table.insert(lines, `Next expand {nextCost} brass.`)
	end
	if track == "inventions" then
		table.insert(lines, "Invention crafts stop when this vault is full.")
		table.insert(lines, "E Distill turns Aether Orchids into Æ.")
	end
	return table.concat(lines, "\n")
end

Storage.DRIVE_COST = 180
Storage.DRIVE_MATS = {
	{ id = "fuel_cell", n = 2 },
	{ id = "polished_wire", n = 2 },
	{ id = "cloud_iron", n = 6 },
}
Storage.GYRO_COST = 120
Storage.GYRO_MATS = {
	{ id = "gear_blank", n = 2 },
	{ id = "wire", n = 3 },
	{ id = "scrap_brass", n = 4 },
}

local function consumeMats(inv, mats): (boolean, string)
	for _, m in mats do
		if (inv.items[m.id] or 0) < m.n then
			local def = Economy.COMMODITIES[m.id]
			local name = if def then def.name else m.id
			return false, `Need {m.n}× {name} (have {inv.items[m.id] or 0}).`
		end
	end
	for _, m in mats do
		inv.items[m.id] -= m.n
		if inv.items[m.id] <= 0 then
			inv.items[m.id] = nil
		end
	end
	return true, ""
end

function Storage.craftAetherDrive(inv): (boolean, string)
	Storage.ensure(inv)
	if not inv.playerBoard.owned then
		return false, "Buy a board base first."
	end
	if inv.playerBoard.aetherDrive then
		return false, "Already installed."
	end
	if inv.brass < Storage.DRIVE_COST then
		return false, `Need {Storage.DRIVE_COST} brass (have {inv.brass}).`
	end
	local ok, msg = consumeMats(inv, Storage.DRIVE_MATS)
	if not ok then
		return false, msg
	end
	inv.brass -= Storage.DRIVE_COST
	inv.playerBoard.aetherDrive = true
	return true, `Aether drive coil fitted (−{Storage.DRIVE_COST}). Board top speed and walk pace rise.`
end

function Storage.craftGyro(inv): (boolean, string)
	Storage.ensure(inv)
	if not inv.playerBoard.owned then
		return false, "Buy a board base first."
	end
	if inv.playerBoard.gyro then
		return false, "Already installed."
	end
	if inv.brass < Storage.GYRO_COST then
		return false, `Need {Storage.GYRO_COST} brass (have {inv.brass}).`
	end
	local ok, msg = consumeMats(inv, Storage.GYRO_MATS)
	if not ok then
		return false, msg
	end
	inv.brass -= Storage.GYRO_COST
	inv.playerBoard.gyro = true
	return true, `Gyro gimbal fitted (−{Storage.GYRO_COST}). Powerslide and bank tighten.`
end

return Storage
