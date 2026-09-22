-- Sky-city rules copied from economy.ts and laborMarket.ts.
-- Housing is empty in this slice, so wages stay at the open-market multiplier.
local Districts
local Market
local Storage
do
	local ok, loaded = pcall(function()
		return require(script.Parent.Districts)
	end)
	if ok then
		Districts = loaded
	else
		Districts = require("./Districts")
	end
	ok, loaded = pcall(function()
		return require(script.Parent.Market)
	end)
	if ok then
		Market = loaded
	else
		Market = require("./Market")
	end
	ok, loaded = pcall(function()
		return require(script.Parent.Storage)
	end)
	if ok then
		Storage = loaded
	else
		Storage = require("./Storage")
	end
end

local CityRules = {}

CityRules.CITY_WORKSHOP_COST = 80
CityRules.UPKEEP_INTERVAL = 28
CityRules.BAY_UPKEEP_PER_LEVEL = 1
CityRules.LABORER_HIRE_COST = 35
CityRules.LABORER_WAGE_PER_TICK = 1
CityRules.ROBOT_WAGE_MUL = 0.35
CityRules.SHOP_TAX = 2
CityRules.LABOR_BASELINE_POOL = 30
CityRules.LABOR_HOUSING_SOFT_START = 25
CityRules.TRAINING_MAX_BAY_LEVEL = 3
CityRules.BAY_EXPAND_L2 = 50
CityRules.BAY_EXPAND_L3 = 100
CityRules.ABSOLUTE_MAX_WORKERS = 48

CityRules.WORKER_NAMES = {
	"Rook",
	"Pip",
	"Nessa",
	"Bolt",
	"Midge",
	"Kade",
	"Sera",
	"Juno",
	"Vex",
	"Quinn",
	"Ivy",
	"Tarn",
	"Wren",
	"Osha",
	"Reed",
	"Lark",
	"Moss",
	"Cinder",
	"Pax",
	"Glyph",
	"Hex",
	"Rune",
	"Ash",
	"Nyx",
}

CityRules.STALLS = {}
for _, district in Districts.LIST do
	CityRules.STALLS[district.id] = { name = district.name, cost = district.stallCost }
end

CityRules.HOME_TIERS = {
	{ id = "cottage", name = "Cottage", extraCost = 0, roomCap = 1 },
	{ id = "house", name = "House", extraCost = 450, roomCap = 2 },
	{ id = "manor", name = "Manor", extraCost = 1400, roomCap = 3 },
	{ id = "estate", name = "Estate", extraCost = 3800, roomCap = 4 },
	{ id = "island", name = "Private Island", extraCost = 9000, roomCap = 5 },
}

CityRules.ROOMS = {
	living = { name = "Living room", cost = 0 },
	workshop = { name = "Workshop", cost = 380 },
	invent_lab = { name = "Invention lab", cost = 520 },
	gallery = { name = "Gallery", cost = 220 },
	garden = { name = "Garden court", cost = 180 },
}

CityRules.ROBOT_BUY_COST = 120
CityRules.ROGUE_REPAIR_PAY = 22
CityRules.ROGUE_CHANCE_PER_SEC = 0.00012
CityRules.STALL_PRICE_MUL = 1.12
CityRules.INVENTION_CAP = 99
CityRules.PLOT_PRICE = 16560
CityRules.INVENT_MATS = { "cloud_iron", "scrap_brass", "spore_silk", "sky_salt", "wire", "gear_blank" }

CityRules.PLOT_BUILDS = {
	decor = { name = "Plaza décor", cost = 1800, zones = { residential = true, retail = true, mixed = true, garden = true } },
	garden = { name = "Flower garden", cost = 5500, zones = { residential = true, garden = true, mixed = true }, primary = true },
	apartment = { name = "Apartment row", cost = 8500, zones = { residential = true, mixed = true }, primary = true },
	factory = { name = "Factory pad", cost = 18000, zones = { industrial = true, mixed = true }, primary = true },
	retail = { name = "Retail front", cost = 14000, zones = { retail = true, mixed = true }, primary = true },
}

CityRules.NEIGHBORS = {
	{
		id = "neighbor_pip",
		name = "Pip Harper",
		drama = "Mira Coil wants twelve hundred brass by week’s end or I’m out on the ring walk.",
		later = "Empire city! Lease stalls on many plazas — Spore Gardens & Aether Spire pay invent premiums.",
	},
	{
		id = "neighbor_sera",
		name = "Sera Quinn",
		drama = "The ring gets quiet after dark. I used to fly with a crew.",
		later = "One board purchase forever. Q anywhere. Islands only connect by wind skyways.",
	},
	{
		id = "neighbor_bolt",
		name = "Bolt Voss",
		drama = "Had words with the slip foreman. Pay’s late and my hands are idle.",
		later = "Industrial slips west. Hire a crew, raise pay grades, run harvest→craft→stock programs.",
	},
}

local function clamp(n: number, lo: number, hi: number): number
	return math.clamp(n, lo, hi)
end

function CityRules.ensure(inv)
	if inv.bayLevel == nil then
		inv.bayLevel = 0
	end
	if inv.cityWorkshopLeased == nil then
		inv.cityWorkshopLeased = false
	end
	if inv.parcelLeased == nil then
		inv.parcelLeased = false
	end
	if inv.empireStanding == nil then
		inv.empireStanding = 0
	end
	if type(inv.districtStanding) ~= "table" then
		inv.districtStanding = {}
	end
	if type(inv.workers) ~= "table" then
		inv.workers = {}
	end
	if inv.metNeighbor == nil then
		inv.metNeighbor = false
	end
	if type(inv.home) ~= "table" then
		inv.home = { tier = "cottage", rooms = { "living" }, props = {} }
	end
	if type(inv.home.rooms) ~= "table" then
		inv.home.rooms = { "living" }
	end
	if type(inv.stalls) ~= "table" then
		inv.stalls = {}
	end
	if type(inv.knownNeighbors) ~= "table" then
		inv.knownNeighbors = {}
	end
	if inv.upkeepIn == nil then
		inv.upkeepIn = CityRules.UPKEEP_INTERVAL
	end
	if type(inv.customRecipes) ~= "table" then
		inv.customRecipes = {}
	end
	if type(inv.customStock) ~= "table" then
		inv.customStock = {}
	end
	if inv.inventionsMade == nil then
		inv.inventionsMade = 0
	end
	if inv.repairsDone == nil then
		inv.repairsDone = 0
	end
	if inv.clearedDebt == nil then
		inv.clearedDebt = false
	end
	if inv.hiredNeighbor == nil then
		inv.hiredNeighbor = false
	end
	if inv.plantedGarden == nil then
		inv.plantedGarden = false
	end
	if type(inv.debts) ~= "table" then
		inv.debts = { neighbor_pip = 1200, neighbor_bolt = 6500 }
	end
	if type(inv.plot) ~= "table" then
		inv.plot = { owned = false, buildings = {} }
	end
	if inv.rogueId == nil then
		inv.rogueId = false
	end
	if type(inv.playerBoard) ~= "table" then
		inv.playerBoard = { owned = false, thruster = false, rails = false, deck = false }
	end
	if type(inv.neighborAff) ~= "table" then
		inv.neighborAff = {}
	end
	if type(inv.assembledFrames) ~= "table" then
		inv.assembledFrames = {}
	end
	if inv.aether == nil then
		inv.aether = 0
	end
	if type(inv.relationships) ~= "table" then
		inv.relationships = {}
	end
	if type(inv.marketPressure) ~= "table" then
		inv.marketPressure = {}
	end
	if inv.brokerFrameStock == nil then
		inv.brokerFrameStock = 0
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
	if type(inv.frameFill) ~= "table" then
		inv.frameFill = {}
	end
	Storage.ensure(inv)
	return inv
end

function CityRules.applyStanding(inv, empireDelta: number, districtId: string?, districtDelta: number?)
	CityRules.ensure(inv)
	if empireDelta ~= 0 then
		inv.empireStanding = clamp(inv.empireStanding + empireDelta, 0, 100)
	end
	if districtId then
		local delta = districtDelta or empireDelta
		if delta ~= 0 then
			local cur = inv.districtStanding[districtId] or 0
			inv.districtStanding[districtId] = clamp(cur + delta, -20, 100)
		end
	end
end

function CityRules.tierIndex(tierId: string): number
	for index, tier in CityRules.HOME_TIERS do
		if tier.id == tierId then
			return index
		end
	end
	return 1
end

function CityRules.tierDef(tierId: string)
	return CityRules.HOME_TIERS[CityRules.tierIndex(tierId)]
end

function CityRules.bayLevelName(level: number): string
	if level <= 0 then
		return "No bay"
	end
	if level == 1 then
		return "Starter Bay"
	end
	if level == 2 then
		return "Expanded Pad"
	end
	if level == 3 then
		return "Workshop Wing"
	end
	return `Empire Bay L{level}`
end

function CityRules.maxWorkersForBay(bayLevel: number): number
	if bayLevel <= 0 then
		return 0
	end
	if bayLevel <= 3 then
		return bayLevel
	end
	return math.min(CityRules.ABSOLUTE_MAX_WORKERS, 3 + (bayLevel - 3) * 2)
end

function CityRules.expandBayCost(fromLevel: number): number
	if fromLevel == 1 then
		return CityRules.BAY_EXPAND_L2
	end
	if fromLevel == 2 then
		return CityRules.BAY_EXPAND_L3
	end
	return math.round(150 * (1.38 ^ (fromLevel - 3)))
end

function CityRules.humanCount(inv): number
	local n = 0
	for _, worker in inv.workers do
		if worker.kind ~= "robot" then
			n += 1
		end
	end
	return n
end

function CityRules.laborSupply(_inv): number
	return CityRules.LABOR_BASELINE_POOL
end

function CityRules.wageMul(inv): number
	local humans = CityRules.humanCount(inv)
	local supply = CityRules.laborSupply(inv)
	local tightness = if supply <= 0 then 1 else math.clamp(humans / supply, 0, 1)
	local pressure = math.max(0, (tightness - 0.55) / 0.45)
	return 1 + pressure * (2.4 - 1)
end

function CityRules.hireCost(inv): number
	CityRules.ensure(inv)
	local base = CityRules.LABORER_HIRE_COST + #inv.workers * 18
	return math.max(1, math.round(base * CityRules.wageMul(inv)))
end

function CityRules.workerWage(inv, worker): number
	local wage = CityRules.LABORER_WAGE_PER_TICK + (worker.payGrade or 0)
	if worker.kind == "robot" then
		return math.max(1, math.round(wage * CityRules.ROBOT_WAGE_MUL))
	end
	return math.max(1, math.round(wage * CityRules.wageMul(inv)))
end

function CityRules.totalWages(inv): number
	local total = 0
	for _, worker in inv.workers do
		total += CityRules.workerWage(inv, worker)
	end
	return total
end

function CityRules.ownedStallCount(inv): number
	local n = 0
	for _, stall in inv.stalls do
		if stall.owned then
			n += 1
		end
	end
	return n
end

function CityRules.bayUpkeepDue(inv): number
	CityRules.ensure(inv)
	if inv.bayLevel < 1 then
		return 0
	end
	return inv.bayLevel * CityRules.BAY_UPKEEP_PER_LEVEL
		+ CityRules.totalWages(inv)
		+ CityRules.ownedStallCount(inv) * CityRules.SHOP_TAX
end

function CityRules.ensureElias(inv, companionName: string)
	CityRules.ensure(inv)
	for _, worker in inv.workers do
		if worker.id == "bot_elias" then
			worker.name = companionName
			worker.kind = "robot"
			return worker
		end
	end
	local elias = {
		id = "bot_elias",
		name = companionName,
		kind = "robot",
		payGrade = 1,
		job = "idle",
		unpaid = false,
	}
	table.insert(inv.workers, 1, elias)
	return elias
end

function CityRules.onDeed(inv, companionName: string)
	CityRules.ensure(inv)
	if not inv.deedStandingGranted then
		CityRules.applyStanding(inv, 5, "residential", 5)
		inv.deedStandingGranted = true
	end
	CityRules.ensureElias(inv, companionName)
end

function CityRules.leaseWorkshop(inv): (boolean, string)
	CityRules.ensure(inv)
	if inv.cityWorkshopLeased then
		return false, "You already lease a city workshop slip."
	end
	if inv.brass < CityRules.CITY_WORKSHOP_COST then
		return false, `Need {CityRules.CITY_WORKSHOP_COST} brass for a city workshop.`
	end
	inv.brass -= CityRules.CITY_WORKSHOP_COST
	inv.cityWorkshopLeased = true
	if not inv.parcelLeased then
		inv.parcelLeased = true
		inv.bayLevel = math.max(inv.bayLevel, 1)
	end
	if inv.bayLevel < 3 then
		inv.bayLevel = math.max(inv.bayLevel, 3)
	end
	CityRules.applyStanding(inv, 4, "industrial", 6)
	return true,
		`City workshop leased (−{CityRules.CITY_WORKSHOP_COST}). Invent unlocked · expand bay forever · lease stalls across plazas.`
end

function CityRules.canEmpireExpand(inv): boolean
	return inv.apartment == true or inv.cityWorkshopLeased == true
end

function CityRules.expandBay(inv): (boolean, string)
	CityRules.ensure(inv)
	if not inv.parcelLeased or inv.bayLevel < 1 then
		return false, "Lease a starter bay first."
	end
	local from = inv.bayLevel
	if not CityRules.canEmpireExpand(inv) and from >= CityRules.TRAINING_MAX_BAY_LEVEL then
		return false,
			"Workshop Wing is max in market training. Earn 1000 brass → buy your apartment (east) for the full city and unlimited expands."
	end
	local cost = CityRules.expandBayCost(from)
	if inv.brass < cost then
		local nextName = CityRules.bayLevelName(from + 1)
		if CityRules.canEmpireExpand(inv) then
			return false, `Need {cost} brass to expand to {nextName} (empire scale gets expensive).`
		end
		return false, `Need {cost} brass to expand to {nextName}.`
	end
	inv.brass -= cost
	inv.bayLevel = from + 1
	local slots = CityRules.maxWorkersForBay(inv.bayLevel)
	if inv.bayLevel == 2 then
		return true, `Expanded Pad · −{cost} brass. {slots} worker slots. More floor to the west.`
	end
	if inv.bayLevel == 3 then
		if CityRules.canEmpireExpand(inv) then
			return true, `Workshop Wing · −{cost} brass. {slots} workers · invent unlocked. Expand again anytime.`
		end
		return true,
			`Workshop Wing · −{cost} brass. {slots} workers · invent unlocked. Buy your apartment for unlimited empire expands.`
	end
	local name = CityRules.bayLevelName(inv.bayLevel)
	return true, `{name} · −{cost} brass. Worker slots: {slots}. Expand again at Sky Foundry yards — no hard cap.`
end

function CityRules.laborLine(inv): string
	local humans = CityRules.humanCount(inv)
	local supply = CityRules.laborSupply(inv)
	if humans < CityRules.LABOR_HOUSING_SOFT_START then
		return `Labor open · humans {humans}/{supply} (housing optional until ~{CityRules.LABOR_HOUSING_SOFT_START})`
	end
	local mul = CityRules.wageMul(inv)
	return `Labor {humans}/{supply} humans · housing 0/0 beds · wage ×{string.format("%.2f", mul)}`
end

function CityRules.hireHuman(inv): (boolean, string)
	CityRules.ensure(inv)
	if not inv.parcelLeased or inv.bayLevel < 1 then
		return false, "Lease a bay first — workers need a place to report."
	end
	local cap = CityRules.maxWorkersForBay(inv.bayLevel)
	if #inv.workers >= cap then
		return false, `Bay full ({#inv.workers}/{cap}). Expand bay (unlimited) for more worker slots.`
	end
	local humans = CityRules.humanCount(inv)
	local supply = CityRules.laborSupply(inv)
	if humans >= supply then
		return false,
			`Labor market empty ({humans}/{supply} humans). Build apartments/homes (0 beds now) so migrants move in, then hire. Robots still hire if bay slots allow.`
	end
	local cost = CityRules.hireCost(inv)
	if inv.brass < cost then
		return false, `Need {cost} brass to hire (crew + labor market ×{string.format("%.2f", CityRules.wageMul(inv))}).`
	end
	local line = CityRules.laborLine(inv)
	inv.brass -= cost
	local name = CityRules.WORKER_NAMES[(#inv.workers % #CityRules.WORKER_NAMES) + 1]
	table.insert(inv.workers, {
		id = `w_{#inv.workers}`,
		name = name,
		kind = "human",
		payGrade = 0,
		job = "harvest",
		unpaid = false,
	})
	CityRules.applyStanding(inv, 2)
	return true, `Hired {name} (−{cost} brass). {line}`
end

function CityRules.neighborDef(id: string)
	for _, neighbor in CityRules.NEIGHBORS do
		if neighbor.id == id then
			return neighbor
		end
	end
	return nil
end

function CityRules.talk(inv, neighborId: string): (boolean, string)
	CityRules.ensure(inv)
	local def = CityRules.neighborDef(neighborId)
	if not def then
		return false, "Nobody home."
	end
	local first = inv.knownNeighbors[neighborId] ~= true
	inv.knownNeighbors[neighborId] = true
	if not inv.metNeighbor then
		inv.metNeighbor = true
		CityRules.applyStanding(inv, 2, "residential", 4)
	end
	local line = if first then def.drama else def.later
	return true, `{def.name}: {line}`
end

function CityRules.leaseStall(inv, districtId: string): (boolean, string)
	CityRules.ensure(inv)
	local dist = CityRules.STALLS[districtId]
	if not dist then
		return false, "Unknown district."
	end
	local stall = inv.stalls[districtId]
	if stall and stall.owned then
		return false, `You already lease a stall in {dist.name}.`
	end
	if inv.brass < dist.cost then
		return false,
			`Need {dist.cost} brass for a stall in {dist.name} (you have {inv.brass}). Multi-plaza retail is expensive — invent & sell.`
	end
	inv.brass -= dist.cost
	local stall = Market.ensureStall(inv, districtId)
	stall.owned = true
	stall.open = true
	stall.forcedClosed = false
	CityRules.applyStanding(inv, 3, districtId, 5)
	local n = CityRules.ownedStallCount(inv)
	return true, `Leased stall · {dist.name} (−{dist.cost}). Empire shops: {n}. Stock inventions at premium plazas for max profit.`
end

function CityRules.tickUpkeep(inv): (boolean, string, number)
	CityRules.ensure(inv)
	if inv.bayLevel < 1 then
		return true, "", 0
	end
	local wages = CityRules.totalWages(inv)
	local total = CityRules.bayUpkeepDue(inv)
	if total <= 0 then
		return true, "", 0
	end
	if inv.brass < total then
		local newly = 0
		for _, worker in inv.workers do
			if not worker.unpaid then
				newly += 1
			end
			worker.unpaid = true
		end
		for _, stall in inv.stalls do
			if stall.owned then
				stall.open = false
				stall.forcedClosed = true
			end
		end
		if newly > 0 then
			CityRules.applyStanding(inv, -3)
		end
		local crewBit = if #inv.workers > 0
			then `Crew unpaid ({CityRules.crewNames(inv)}).`
			else "No crew left to idle."
		return false, `Can't cover upkeep ({total}b) — {crewBit}`, total
	end
	for _, worker in inv.workers do
		worker.unpaid = false
	end
	inv.brass -= total
	if #inv.workers > 0 then
		local shops = CityRules.ownedStallCount(inv)
		return true,
			`Upkeep −{total}b (crew wages {wages} · bay L{inv.bayLevel} · {shops} shops)`,
			total
	end
	return true, `Bay upkeep −{total} brass`, total
end

function CityRules.crewNames(inv): string
	local names = {}
	for _, worker in inv.workers do
		table.insert(names, worker.name)
	end
	return table.concat(names, ", ")
end

function CityRules.hasRoom(inv, kind: string): boolean
	for _, room in inv.home.rooms do
		if room == kind then
			return true
		end
	end
	return false
end

function CityRules.upgradeHome(inv): (boolean, string)
	CityRules.ensure(inv)
	local index = CityRules.tierIndex(inv.home.tier)
	local nxt = CityRules.HOME_TIERS[index + 1]
	if not nxt then
		return false, "The home island is as large as it gets."
	end
	if inv.brass < nxt.extraCost then
		return false, `Need {nxt.extraCost} brass to raise a {nxt.name} (you have {inv.brass}).`
	end
	inv.brass -= nxt.extraCost
	inv.home.tier = nxt.id
	return true, `{nxt.name} raised · −{nxt.extraCost} brass. Room cap {nxt.roomCap}.`
end

function CityRules.addRoom(inv, kind: string): (boolean, string)
	CityRules.ensure(inv)
	local spec = CityRules.ROOMS[kind]
	if not spec then
		return false, "Unknown room."
	end
	if CityRules.hasRoom(inv, kind) then
		return false, `{spec.name} is already in the house.`
	end
	local tier = CityRules.tierDef(inv.home.tier)
	if #inv.home.rooms >= tier.roomCap then
		return false, `The {tier.name} is full. Raise the next tier before adding a {spec.name}.`
	end
	if inv.brass < spec.cost then
		return false, `Need {spec.cost} brass for a {spec.name} (you have {inv.brass}).`
	end
	inv.brass -= spec.cost
	table.insert(inv.home.rooms, kind)
	return true, `{spec.name} placed · −{spec.cost} brass.`
end

function CityRules.nextHomeAction(inv): string
	CityRules.ensure(inv)
	local tier = CityRules.tierDef(inv.home.tier)
	if #inv.home.rooms >= tier.roomCap and CityRules.HOME_TIERS[CityRules.tierIndex(inv.home.tier) + 1] then
		return "upgrade"
	end
	if not CityRules.hasRoom(inv, "garden") then
		return "garden"
	end
	if not CityRules.hasRoom(inv, "gallery") then
		return "gallery"
	end
	if not CityRules.hasRoom(inv, "workshop") then
		return "workshop"
	end
	if CityRules.HOME_TIERS[CityRules.tierIndex(inv.home.tier) + 1] then
		return "upgrade"
	end
	return "done"
end

function CityRules.improveHome(inv): (boolean, string)
	local action = CityRules.nextHomeAction(inv)
	if action == "upgrade" then
		return CityRules.upgradeHome(inv)
	end
	if action == "done" then
		return false, "The cottage holds all it can for now."
	end
	return CityRules.addRoom(inv, action)
end

local INVENT_PREFIX = {
	gear_blank = "Gear",
	wire = "Wire",
	cloud_iron = "Iron",
	scrap_brass = "Brass",
	spore_silk = "Silk",
	sky_salt = "Salt",
}

local INVENT_SUFFIX = {
	gear_blank = "works",
	wire = "filament",
	cloud_iron = "plate",
	scrap_brass = "coil",
	spore_silk = "weave",
	sky_salt = "crystal",
}

local SLOT_ORDER = { "chassis", "mechanisms", "power", "wiring", "personality" }
local SLOT_LABEL = {
	chassis = "Chassis",
	mechanisms = "Mechanisms",
	power = "Power",
	wiring = "Wiring",
	personality = "Personality",
}

function CityRules.fairPrice(id: string, inv: any?): number
	return Market.fairStallPrice(id, inv)
end

function EconomyCommodity(id: string)
	local commodities = {
		cloud_iron = { name = "Cloud Iron", baseBuy = 4 },
		scrap_brass = { name = "Scrap Brass", baseBuy = 3 },
		spore_silk = { name = "Spore Silk", baseBuy = 6 },
		sky_salt = { name = "Sky Salt", baseBuy = 2 },
		wire = { name = "Copper Wire", baseBuy = 5 },
		gear_blank = { name = "Gear Blank", baseBuy = 8 },
		repair_kit = { name = "Repair Kit", baseBuy = 6 },
		haul_pack = { name = "Haul Pack", baseBuy = 10 },
		fuel_cell = { name = "Fuel Cell", baseBuy = 10 },
		glass_pane = { name = "Glass Pane", baseBuy = 7 },
		flower_gift = { name = "Cloud Blooms", baseBuy = 2 },
		brass_charm = { name = "Brass Charm", baseBuy = 35 },
		silk_scarf = { name = "Spore-Silk Scarf", baseBuy = 55 },
		polished_wire = { name = "Polished Wire", baseBuy = 11 },
		bloom_brass = { name = "Brass Petals", baseBuy = 2 },
		bloom_sky = { name = "Skyblooms", baseBuy = 2 },
		bloom_spore = { name = "Spore Lilies", baseBuy = 2 },
		bloom_harbor = { name = "Harbor Roses", baseBuy = 2 },
		bloom_aether = { name = "Aether Orchids", baseBuy = 2 },
	}
	return commodities[id]
end

function CityRules.itemName(id: string): string
	local def = EconomyCommodity(id)
	return if def then def.name else id
end

function CityRules.inventPairKey(a: string, b: string): string
	return if a < b then `{a}|{b}` else `{b}|{a}`
end

function CityRules.hasInventPair(inv, a: string, b: string): boolean
	local key = CityRules.inventPairKey(a, b)
	for _, recipe in inv.customRecipes do
		local inputs = recipe.inputs
		if inputs and inputs[1] and inputs[2] and CityRules.inventPairKey(inputs[1].id, inputs[2].id) == key then
			return true
		end
	end
	return false
end

function CityRules.inventName(a: string, b: string, index: number): string
	local left = INVENT_PREFIX[a] or a
	local right = INVENT_SUFFIX[b] or b
	local base = left .. string.upper(string.sub(right, 1, 1)) .. string.sub(right, 2)
	if index > 0 then
		return `{base} {index + 1}`
	end
	return base
end

function CityRules.slotBlurb(a: string, b: string): string
	local has = {}
	local function mark(id: string)
		if id == "gear_blank" then
			has.mechanisms = true
		end
		if id == "wire" then
			has.wiring = true
		end
		if id == "cloud_iron" or id == "scrap_brass" or id == "spore_silk" or id == "sky_salt" then
			has.chassis = true
		end
	end
	mark(a)
	mark(b)
	local parts = {}
	for _, slot in SLOT_ORDER do
		if has[slot] then
			table.insert(parts, SLOT_LABEL[slot])
		end
	end
	if #parts == 0 then
		return "Chassis · Power"
	end
	return table.concat(parts, " · ")
end

function CityRules.findInventPair(inv): (string?, string?)
	local mats = CityRules.INVENT_MATS
	for i = 1, #mats do
		for j = i + 1, #mats do
			local a = mats[i]
			local b = mats[j]
			if (inv.items[a] or 0) >= 2 and (inv.items[b] or 0) >= 2 and not CityRules.hasInventPair(inv, a, b) then
				return a, b
			end
		end
	end
	return nil, nil
end

function CityRules.canInvent(inv): boolean
	return (inv.bayLevel or 0) >= 3 or inv.cityWorkshopLeased == true
end

function CityRules.invent(inv): (boolean, string)
	CityRules.ensure(inv)
	if not CityRules.canInvent(inv) then
		return false, "Invention needs Workshop Wing (bay L3+) or a leased city workshop."
	end
	local a, b = CityRules.findInventPair(inv)
	if not a or not b then
		local held = 0
		for _, id in CityRules.INVENT_MATS do
			if (inv.items[id] or 0) >= 2 then
				held += 1
			end
		end
		if held < 2 then
			return false, "Need 2× of two different invent mats (set pair in program or stock pack)."
		end
		return false, "No new invention pairs left — that material combo is already in the book (or try other mats)."
	end
	local labFee = 15 + #inv.customRecipes * 12
	if inv.brass < labFee then
		return false, `Lab fee {labFee} brass for next prototype (you have {inv.brass}).`
	end
	inv.items[a] -= 2
	if inv.items[a] <= 0 then
		inv.items[a] = nil
	end
	inv.items[b] -= 2
	if inv.items[b] <= 0 then
		inv.items[b] = nil
	end
	inv.brass -= labFee
	local index = #inv.customRecipes
	local name = CityRules.inventName(a, b, index)
	local quality = math.min(3, 1 + math.floor(inv.bayLevel / 4) + (if index >= 4 then 1 else 0))
	local sellValue = math.round(
		(EconomyCommodity(a).baseBuy + EconomyCommodity(b).baseBuy) * (2.8 + quality * 0.35) + 12 + inv.bayLevel * 2
	)
	local recipe = {
		id = `inv_{index}`,
		name = name,
		inputs = { { id = a, n = 1 }, { id = b, n = 1 } },
		sellValue = sellValue,
		quality = quality,
	}
	table.insert(inv.customRecipes, recipe)
	inv.inventionsMade += 1
	CityRules.applyStanding(inv, 2)
	local tip = if index == 0
		then " Tip: craft a Rivet Spanner or Haul Pack, then Temper / Reinforce it (Tools) with this invention for stronger crew harvests."
		else ""
	local blurb = CityRules.slotBlurb(a, b)
	return true, `Invented {name} (Q{quality}, ~{sellValue}b). Fits frame slots: {blurb}. Craft → assemble or stock stalls.{tip}`
end

function CityRules.craftInvention(inv): (boolean, string)
	CityRules.ensure(inv)
	local recipe = inv.customRecipes[#inv.customRecipes]
	if not recipe then
		return false, "Unknown invention."
	end
	if not (inv.cityWorkshopLeased or inv.parcelLeased) then
		return false, "Need a bay or home workshop."
	end
	for _, input in recipe.inputs do
		if (inv.items[input.id] or 0) < input.n then
			return false, `Missing {CityRules.itemName(input.id)} for {recipe.name}.`
		end
	end
	local have = inv.customStock[recipe.id] or 0
	local cap = Storage.inventionCap(inv)
	if have >= cap then
		return false, `Invention storage full ({cap}). Expand at Aether Spire.`
	end
	for _, input in recipe.inputs do
		inv.items[input.id] -= input.n
		if inv.items[input.id] <= 0 then
			inv.items[input.id] = nil
		end
	end
	inv.customStock[recipe.id] = have + 1
	return true, `Crafted 1× {recipe.name}`
end

function CityRules.sellInventions(inv): (boolean, string, number)
	CityRules.ensure(inv)
	local gained = 0
	local parts = {}
	for _, recipe in inv.customRecipes do
		local n = inv.customStock[recipe.id] or 0
		if n > 0 then
			gained += recipe.sellValue * n
			table.insert(parts, `{n}× {recipe.name}`)
			inv.customStock[recipe.id] = nil
		end
	end
	if gained == 0 then
		return false, "No inventions in stock.", 0
	end
	inv.brass += gained
	return true, `Sold {table.concat(parts, ", ")} for {gained} brass.`, gained
end

function CityRules.stockStall(inv, districtId: string): (boolean, string)
	CityRules.ensure(inv)
	local stall = inv.stalls[districtId]
	local dist = CityRules.STALLS[districtId]
	if not dist or not stall or not stall.owned then
		return false, "Lease this district stall first."
	end
	local bestId = nil
	local bestQty = 0
	for _, id in CityRules.INVENT_MATS do
		local qty = inv.items[id] or 0
		if qty > bestQty then
			bestId = id
			bestQty = qty
		end
	end
	if not bestId then
		return false, "Pack is empty — nothing to put on the shelf."
	end
	return Market.stockGoods(inv, districtId, bestId, math.min(5, bestQty))
end

function CityRules.tickCustomers(inv, rng): (boolean, string)
	CityRules.ensure(inv)
	local r = Market.tickAllStalls(inv, rng)
	if r.haggle and r.msg then
		return false, r.msg
	end
	if r.ok and r.msg then
		return true, r.msg
	end
	return false, r.msg or ""
end

function CityRules.resolveHaggle(inv, districtId: string, accept: boolean): (boolean, string)
	CityRules.ensure(inv)
	local stall = Market.ensureStall(inv, districtId)
	return Market.resolveHaggle(inv, stall, accept)
end

function CityRules.priceStall(inv, districtId: string, policy: string): (boolean, string)
	CityRules.ensure(inv)
	local stall = Market.ensureStall(inv, districtId)
	local dist = Districts.byId(districtId)
	return Market.applyPolicy(inv, stall, policy, if dist then dist.inventBonus else 1)
end

function CityRules.buyPlot(inv): (boolean, string)
	CityRules.ensure(inv)
	if inv.plot.owned then
		return false, "You already hold the residential pad."
	end
	local price = CityRules.PLOT_PRICE
	if inv.brass < price then
		return false, `Need {price} brass for this plot (you have {inv.brass}).`
	end
	inv.brass -= price
	inv.plot.owned = true
	inv.plot.buildings = {}
	CityRules.applyStanding(inv, 1, "residential", 2)
	return true, `Deed · Residential Ring plot (0,0) −{price}b · residential · vacant lot`
end

function CityRules.plotHas(inv, kind: string): boolean
	for _, building in inv.plot.buildings do
		if building == kind then
			return true
		end
	end
	return false
end

function CityRules.developPlot(inv, kind: string): (boolean, string)
	CityRules.ensure(inv)
	local def = CityRules.PLOT_BUILDS[kind]
	if not def then
		return false, "Unknown build."
	end
	if not inv.plot.owned then
		return false, "Own the plot first."
	end
	if def.primary and CityRules.plotHas(inv, kind) then
		return false, `{def.name} already on deck L0.`
	end
	if kind == "decor" and CityRules.plotHas(inv, "decor") then
		return false, "Décor already on deck L0."
	end
	local mul = if def.zones.residential then 1 else 1.35
	local cost = math.round(def.cost * mul)
	if inv.brass < cost then
		return false, `Need {cost} brass (you have {inv.brass}).`
	end
	inv.brass -= cost
	table.insert(inv.plot.buildings, kind)
	local offZone = mul > 1
	if offZone then
		CityRules.applyStanding(inv, -1, "residential", -2)
	elseif kind == "decor" then
		CityRules.applyStanding(inv, 1, "residential", 2)
	else
		CityRules.applyStanding(inv, 1, "residential", 1)
	end
	if kind == "garden" then
		inv.plantedGarden = true
	end
	if kind == "retail" then
		local stall = Market.ensureStall(inv, "residential")
		stall.owned = true
		stall.open = true
		stall.forcedClosed = false
	end
	local zoneBit = if offZone then " · off-zone surcharge" else ""
	return true, `Built {def.name} @ (0.0, 0.0) yaw 0° (−{cost}b){zoneBit}`
end

function CityRules.clearDebt(inv, neighborId: string): (boolean, string)
	CityRules.ensure(inv)
	local def = CityRules.neighborDef(neighborId)
	if not def then
		return false, "Nobody home."
	end
	local amount = inv.debts[neighborId]
	if type(amount) ~= "number" or amount <= 0 then
		return false, `{def.name} doesn’t owe a landlord right now.`
	end
	local landlord = if neighborId == "neighbor_bolt" then "Dockmaster Dredge" else "Mira Coil"
	if inv.brass < amount then
		return false, `Need {amount} brass to clear debt to {landlord} (you have {inv.brass}).`
	end
	inv.brass -= amount
	inv.debts[neighborId] = 0
	inv.clearedDebt = true
	inv.metNeighbor = true
	inv.knownNeighbors[neighborId] = true
	CityRules.applyStanding(inv, 6, "residential", 10)
	return true, `Paid {landlord} {amount}b for {def.name}. Debt gone · standing up · affinity +18.`
end

function CityRules.hireNeighbor(inv, neighborId: string): (boolean, string)
	CityRules.ensure(inv)
	local def = CityRules.neighborDef(neighborId)
	if not def then
		return false, "Nobody home."
	end
	if not inv.parcelLeased and not inv.cityWorkshopLeased then
		return false, "Lease a workshop first — they need a place to report."
	end
	if inv.bayLevel < 1 then
		inv.bayLevel = 1
		inv.parcelLeased = true
	end
	for _, worker in inv.workers do
		if worker.id == neighborId then
			return false, `{def.name} already works for you ({worker.name}).`
		end
	end
	local cap = CityRules.maxWorkersForBay(inv.bayLevel)
	if #inv.workers >= cap then
		return false, `Bay full ({#inv.workers}/{cap}). Expand bay first, then hire {def.name}.`
	end
	local cost = math.max(20, math.floor(CityRules.hireCost(inv) * 0.85))
	if inv.brass < cost then
		return false, `Need {cost} brass to hire {def.name}.`
	end
	inv.brass -= cost
	table.insert(inv.workers, {
		id = neighborId,
		name = def.name,
		kind = "human",
		payGrade = 0,
		job = "harvest",
		unpaid = false,
	})
	inv.hiredNeighbor = true
	inv.metNeighbor = true
	CityRules.applyStanding(inv, 2)
	return true, `Hired {def.name} (−{cost} brass).`
end

function CityRules.affinity(inv, neighborId: string): number
	CityRules.ensure(inv)
	return inv.neighborAff[neighborId] or 0
end

function CityRules.giftBrass(inv, neighborId: string): (boolean, string)
	CityRules.ensure(inv)
	local def = CityRules.neighborDef(neighborId)
	if not def then
		return false, "Nobody home."
	end
	if inv.brass < 10 then
		return false, "Need 10 brass for a small gift."
	end
	inv.brass -= 10
	inv.neighborAff[neighborId] = math.min(120, CityRules.affinity(inv, neighborId) + 3)
	inv.metNeighbor = true
	inv.knownNeighbors[neighborId] = true
	CityRules.applyStanding(inv, 1, "residential", 1)
	return true, `{def.name} pockets 10b · +affinity ({inv.neighborAff[neighborId]}).`
end

function CityRules.giftGood(inv, neighborId: string, itemId: string): (boolean, string)
	CityRules.ensure(inv)
	local def = CityRules.neighborDef(neighborId)
	if not def then
		return false, "Nobody home."
	end
	local qty = inv.items[itemId] or 0
	if qty < 1 then
		return false, "You don’t have that gift."
	end
	inv.items[itemId] -= 1
	if inv.items[itemId] <= 0 then
		inv.items[itemId] = nil
	end
	local bump = if itemId == "flower_gift" or string.find(itemId, "bloom", 1, true) then 8 elseif itemId == "brass_charm" or itemId == "silk_scarf" then 10 else 4
	inv.neighborAff[neighborId] = math.min(120, CityRules.affinity(inv, neighborId) + bump)
	inv.metNeighbor = true
	inv.knownNeighbors[neighborId] = true
	CityRules.applyStanding(inv, 1, "residential", 1)
	local name = CityRules.itemName(itemId)
	return true, `{def.name} takes the {name} · +{bump} affinity ({inv.neighborAff[neighborId]}).`
end

function CityRules.setJob(inv, workerId: string, job: string): (boolean, string)
	CityRules.ensure(inv)
	if job ~= "harvest" and job ~= "craft" and job ~= "stock" then
		return false, "Jobs: harvest, craft, stock."
	end
	for _, worker in inv.workers do
		if worker.id == workerId then
			worker.job = job
			return true, `{worker.name} assigned to {job}.`
		end
	end
	return false, "No such worker."
end

function CityRules.buyRobot(inv): (boolean, string)
	CityRules.ensure(inv)
	if not inv.parcelLeased or inv.bayLevel < 1 then
		return false, "Lease a bay first — robots need a dock to report."
	end
	local cap = CityRules.maxWorkersForBay(inv.bayLevel)
	if #inv.workers >= cap then
		return false, `Bay full ({#inv.workers}/{cap}). Expand for more slots.`
	end
	for _, worker in inv.workers do
		if worker.id == "yard_bot" then
			return false, "The slip chassis is already docked."
		end
	end
	local hasFrame = #(inv.assembledFrames or {}) > 0
	local hasBroker = (inv.brokerFrameStock or 0) > 0
	if not hasFrame and not hasBroker then
		return false, "Need an assembled frame (workbench) or broker stock."
	end
	if inv.brass < CityRules.ROBOT_BUY_COST then
		return false, `Need {CityRules.ROBOT_BUY_COST} brass to buy a work robot.`
	end
	inv.brass -= CityRules.ROBOT_BUY_COST
	local frame = nil
	if hasBroker and not hasFrame then
		inv.brokerFrameStock -= 1
	else
		table.sort(inv.assembledFrames, function(a, b)
			return (a.quality or 0) > (b.quality or 0)
		end)
		frame = table.remove(inv.assembledFrames, 1)
	end
	local name = if frame and frame.name then string.gsub(frame.name, "%s*Frame$", "") else "Slip chassis"
	table.insert(inv.workers, {
		id = "yard_bot",
		name = name,
		kind = "robot",
		payGrade = if frame and (frame.quality or 0) >= 1.55 then 2 elseif frame and (frame.quality or 0) >= 1.3 then 1 else 0,
		job = "haul",
		unpaid = false,
		rogue = false,
	})
	local q = if frame then ` · {frame.name} (Q{string.format("%.2f", frame.quality)})` else " · broker chassis"
	return true, `Powered work robot {name}{q} (−{CityRules.ROBOT_BUY_COST} brass).`
end

function CityRules.considerRogue(inv, dt: number, roll: number): (boolean, string)
	CityRules.ensure(inv)
	if type(inv.rogueId) == "string" then
		return false, ""
	end
	local target = nil
	for _, worker in inv.workers do
		if worker.kind == "robot" and worker.id ~= "bot_elias" and not worker.unpaid then
			target = worker
			break
		end
	end
	if not target then
		return false, ""
	end
	if roll >= CityRules.ROGUE_CHANCE_PER_SEC * dt then
		return false, ""
	end
	inv.rogueId = target.id
	target.rogue = true
	return true, `{target.name} went rogue on the slips. A Repair Kit restores the chassis.`
end

function CityRules.repairRogue(inv): (boolean, string)
	CityRules.ensure(inv)
	if type(inv.rogueId) ~= "string" then
		return false, "No rogue on the yard."
	end
	if (inv.items.repair_kit or 0) < 1 then
		return false, "Need a Repair Kit to fix a rogue (craft: wire + scrap, or buy at market)."
	end
	inv.items.repair_kit -= 1
	if inv.items.repair_kit <= 0 then
		inv.items.repair_kit = nil
	end
	inv.brass += CityRules.ROGUE_REPAIR_PAY
	inv.repairsDone += 1
	for _, worker in inv.workers do
		if worker.id == inv.rogueId then
			worker.rogue = false
		end
	end
	inv.rogueId = false
	CityRules.applyStanding(inv, 2)
	return true, `Used Repair Kit · restored to its owner's work (yard) · +{CityRules.ROGUE_REPAIR_PAY} brass.`
end

function CityRules.objective(inv): string
	CityRules.ensure(inv)
	local goals = {
		{
			title = "Deed a sky apartment",
			hint = "Training market · 1000 brass · Real Estate east",
			done = inv.apartment == true,
			empire = false,
		},
		{
			title = "Lease empire workshop",
			hint = "Industrial slips west · craft · hire · invent",
			done = inv.cityWorkshopLeased == true or inv.parcelLeased == true,
			empire = true,
		},
		{
			title = "Meet a neighbor",
			hint = "Residential ring · E talk · drama and hire come later",
			done = inv.metNeighbor == true,
			empire = true,
		},
		{
			title = "Hire crew",
			hint = "Workshop hire board · humans or robots",
			done = #inv.workers >= 1,
			empire = true,
		},
		{
			title = "House the labor market",
			hint = "Around 25+ humans · build apartments so migrants arrive and wages ease",
			done = CityRules.humanCount(inv) < CityRules.LABOR_HOUSING_SOFT_START - 5,
			empire = true,
		},
		{
			title = "Open a plaza stall",
			hint = "Lease a district shop · stock shelf · stay open",
			done = CityRules.ownedStallCount(inv) >= 1,
			empire = true,
		},
		{
			title = "Invent a product",
			hint = "Bay L3 / workshop invent desk",
			done = #inv.customRecipes >= 1,
			empire = true,
		},
		{
			title = "Retail network (3 shops)",
			hint = "Multi-plaza stalls · premium plazas pay invent bonus",
			done = CityRules.ownedStallCount(inv) >= 3,
			empire = true,
		},
		{
			title = "Reach Friendly standing",
			hint = "Hire fairly · repair rogues · gifts · open shops",
			done = (inv.empireStanding or 0) >= 25,
			empire = true,
		},
		{
			title = "Clear a neighbor’s debt",
			hint = "Pip / Bolt · E talk · Clear debt to Mira Coil or Dockmaster Dredge",
			done = inv.clearedDebt == true,
			empire = true,
			needsContact = true,
		},
		{
			title = "Own plaza land",
			hint = "Leasing office (Market / Residential) · or buy a neighbor’s home plot",
			done = inv.plot.owned == true,
			empire = true,
			needsContact = true,
		},
		{
			title = "Hire a neighbor",
			hint = "Offer hire on neighbor panel · needs free bay slot",
			done = inv.hiredNeighbor == true,
			empire = true,
			needsContact = true,
		},
		{
			title = "Plant a plot garden",
			hint = "Lease office · Develop · Flower garden on an owned pad",
			done = inv.plantedGarden == true,
			empire = true,
			needsLand = true,
		},
	}
	for _, goal in goals do
		if goal.empire and inv.apartment ~= true then
			continue
		end
		if goal.needsContact and not inv.metNeighbor and CityRules.ownedStallCount(inv) < 1 then
			continue
		end
		if goal.needsLand and not inv.plot.owned then
			continue
		end
		if not goal.done then
			return `{goal.title} · {goal.hint}`
		end
	end
	return `Empire · standing {math.floor(inv.empireStanding)}`
end

return CityRules
