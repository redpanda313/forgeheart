-- Sky-city rules copied from economy.ts and laborMarket.ts.
-- Housing is empty in this slice, so wages stay at the open-market multiplier.
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

CityRules.STALLS = {
	residential = { name = "Residential Ring", cost = 90 },
	grand_market = { name = "Grand Market", cost = 280 },
	industrial = { name = "Industrial Slips", cost = 160 },
}

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
	inv.stalls[districtId] = { owned = true, open = true, forcedClosed = false }
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
			done = false,
			empire = true,
		},
	}
	for _, goal in goals do
		if goal.empire and inv.apartment ~= true then
			continue
		end
		if not goal.done then
			return `{goal.title} · {goal.hint}`
		end
	end
	return `Empire · standing {math.floor(inv.empireStanding)}`
end

return CityRules
