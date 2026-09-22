-- Starter market numbers from economy.ts: harvest ores, bench recipes, apartment deed.
local Economy = {}

Economy.APARTMENT_COST = 1000
Economy.STARTER_BRASS = 40

Economy.COMMODITIES = {
	cloud_iron = { name = "Cloud Iron", baseBuy = 4, baseSell = 8 },
	scrap_brass = { name = "Scrap Brass", baseBuy = 3, baseSell = 6 },
	spore_silk = { name = "Spore Silk", baseBuy = 6, baseSell = 12 },
	sky_salt = { name = "Sky Salt", baseBuy = 2, baseSell = 5 },
	wire = { name = "Copper Wire", baseBuy = 5, baseSell = 11 },
	gear_blank = { name = "Gear Blank", baseBuy = 8, baseSell = 16 },
	repair_kit = { name = "Repair Kit", baseBuy = 6, baseSell = 14 },
	speed_tool = { name = "Rivet Spanner", baseBuy = 12, baseSell = 28 },
	haul_pack = { name = "Haul Pack", baseBuy = 10, baseSell = 24 },
	glass_pane = { name = "Glass Pane", baseBuy = 7, baseSell = 14 },
	fuel_cell = { name = "Fuel Cell", baseBuy = 10, baseSell = 20 },
	flower_gift = { name = "Cloud Blooms", baseBuy = 2, baseSell = 5 },
	brass_charm = { name = "Brass Charm", baseBuy = 35, baseSell = 12 },
	silk_scarf = { name = "Spore-Silk Scarf", baseBuy = 55, baseSell = 22 },
	polished_wire = { name = "Polished Wire", baseBuy = 11, baseSell = 22 },
	bloom_brass = { name = "Brass Petals", baseBuy = 2, baseSell = 5 },
	bloom_sky = { name = "Skyblooms", baseBuy = 2, baseSell = 5 },
	bloom_spore = { name = "Spore Lilies", baseBuy = 2, baseSell = 5 },
	bloom_harbor = { name = "Harbor Roses", baseBuy = 2, baseSell = 5 },
	bloom_aether = { name = "Aether Orchids", baseBuy = 2, baseSell = 5 },
}

Economy.HARVEST_POOL = { "cloud_iron", "scrap_brass", "spore_silk", "sky_salt" }

Economy.RECIPES = {
	{
		id = "wire_from_scrap",
		name = "Draw Wire",
		inputs = { { id = "scrap_brass", n = 2 } },
		output = { id = "wire", n = 1 },
	},
	{
		id = "gear_blank",
		name = "Stamp Gear Blank",
		inputs = { { id = "cloud_iron", n = 2 }, { id = "scrap_brass", n = 1 } },
		output = { id = "gear_blank", n = 1 },
	},
	{
		id = "repair_kit",
		name = "Assemble Repair Kit",
		inputs = { { id = "wire", n = 1 }, { id = "scrap_brass", n = 1 } },
		output = { id = "repair_kit", n = 1 },
	},
	{
		id = "haul_pack",
		name = "Stitch Haul Pack",
		inputs = { { id = "spore_silk", n = 2 }, { id = "scrap_brass", n = 1 } },
		output = { id = "haul_pack", n = 1 },
	},
}

function Economy.empty(brass: number?)
	return {
		brass = brass or Economy.STARTER_BRASS,
		aether = 0,
		items = {},
		harvestRuns = 0,
		apartment = false,
	}
end

function Economy.count(inv, id: string): number
	return inv.items[id] or 0
end

function Economy.add(inv, id: string, qty: number)
	inv.items[id] = Economy.count(inv, id) + qty
end

function Economy.harvest(inv, rng): (string, number, string)
	local pool = Economy.HARVEST_POOL
	local index = math.floor(rng() * #pool) % #pool + 1
	local id = pool[index]
	local qty = 1 + math.floor(rng() * 3)
	Economy.add(inv, id, qty)
	inv.harvestRuns += 1
	local name = Economy.COMMODITIES[id].name
	return id, qty, `Extracted {qty}× {name}`
end

function Economy.sellAll(inv): (number, string)
	local gained = 0
	local parts = {}
	for id, qty in inv.items do
		local def = Economy.COMMODITIES[id]
		if def and qty > 0 then
			gained += def.baseSell * qty
			table.insert(parts, `{qty}× {def.name}`)
			inv.items[id] = nil
		end
	end
	inv.brass += gained
	if gained == 0 then
		return 0, "Nothing to sell."
	end
	return gained, `Sold {table.concat(parts, ", ")} for {gained} brass.`
end

function Economy.canCraft(inv, recipe): boolean
	for _, input in recipe.inputs do
		if Economy.count(inv, input.id) < input.n then
			return false
		end
	end
	return true
end

function Economy.craft(inv, recipeId: string): (boolean, string)
	local recipe = nil
	for _, item in Economy.RECIPES do
		if item.id == recipeId then
			recipe = item
			break
		end
	end
	if not recipe then
		return false, "Unknown recipe."
	end
	if not Economy.canCraft(inv, recipe) then
		local needs = {}
		for _, input in recipe.inputs do
			local name = Economy.COMMODITIES[input.id].name
			table.insert(needs, `{input.n} {name}`)
		end
		return false, `{recipe.name} needs {table.concat(needs, " + ")}.`
	end
	for _, input in recipe.inputs do
		inv.items[input.id] = Economy.count(inv, input.id) - input.n
		if inv.items[input.id] <= 0 then
			inv.items[input.id] = nil
		end
	end
	Economy.add(inv, recipe.output.id, recipe.output.n)
	local outName = Economy.COMMODITIES[recipe.output.id].name
	return true, `{recipe.name}: {recipe.output.n}× {outName}.`
end

Economy.VENDORS = {
	mira = {
		id = "mira",
		name = "Mira Cole",
		title = "General Goods",
		buyMul = 1.0,
		sellMul = 1.0,
		stock = { "cloud_iron", "scrap_brass", "sky_salt", "wire", "flower_gift", "brass_charm" },
		greeting = "Cloud iron’s steady today.",
	},
	hark = {
		id = "hark",
		name = "Hark Voss",
		title = "Scrap & Gears",
		buyMul = 1.15,
		sellMul = 0.95,
		stock = { "scrap_brass", "gear_blank", "wire", "repair_kit", "speed_tool", "fuel_cell" },
		greeting = "Bring me scrap. I’ll pay fair — for scrap.",
	},
	sela = {
		id = "sela",
		name = "Sela Quinn",
		title = "Silk & Soft Goods",
		buyMul = 1.1,
		sellMul = 1.05,
		stock = { "spore_silk", "sky_salt", "haul_pack", "flower_gift", "silk_scarf" },
		greeting = "Spore silk from the reefs? I’ll take every spool.",
	},
	dock = {
		id = "dock",
		name = "Ferry Clerk Jon",
		title = "Dock Exchange",
		buyMul = 0.9,
		sellMul = 1.1,
		stock = { "cloud_iron", "scrap_brass", "sky_salt" },
		greeting = "Quick trades for haulers. Prices favor the dock, not you.",
	},
}

local function round(n: number): number
	return math.floor(n + 0.5)
end

function Economy.vendorBuyPrice(vendor, id: string): number
	local def = Economy.COMMODITIES[id]
	return math.max(1, round(def.baseBuy * vendor.buyMul))
end

function Economy.vendorSellPrice(vendor, id: string): number
	local def = Economy.COMMODITIES[id]
	return math.max(1, round(def.baseSell * vendor.sellMul))
end

local function vendorHas(vendor, id: string): boolean
	for _, stockId in vendor.stock do
		if stockId == id then
			return true
		end
	end
	return false
end

function Economy.sellToVendor(inv, vendorId: string, id: string, qty: number): (boolean, number, string)
	local vendor = Economy.VENDORS[vendorId]
	if not vendor then
		return false, 0, "No such stall."
	end
	if not vendorHas(vendor, id) then
		return false, 0, "They don’t buy that."
	end
	if qty < 1 or Economy.count(inv, id) < qty then
		return false, 0, "Not enough goods."
	end
	local unit = Economy.vendorBuyPrice(vendor, id)
	local gained = unit * qty
	inv.items[id] = Economy.count(inv, id) - qty
	if inv.items[id] <= 0 then
		inv.items[id] = nil
	end
	inv.brass += gained
	return true, gained, `Sold {qty}× {Economy.COMMODITIES[id].name} for {gained} brass.`
end

function Economy.buyFromVendor(inv, vendorId: string, id: string, qty: number): (boolean, number, string)
	local vendor = Economy.VENDORS[vendorId]
	if not vendor then
		return false, 0, "No such stall."
	end
	if not vendorHas(vendor, id) then
		return false, 0, "Not in stock."
	end
	if qty < 1 then
		return false, 0, "Invalid amount."
	end
	local unit = Economy.vendorSellPrice(vendor, id)
	local spent = unit * qty
	if inv.brass < spent then
		return false, 0, "Not enough brass."
	end
	inv.brass -= spent
	Economy.add(inv, id, qty)
	return true, spent, `Bought {qty}× {Economy.COMMODITIES[id].name} for {spent} brass.`
end

function Economy.buyApartment(inv): (boolean, string)
	if inv.apartment then
		return false, "You already hold the sky apartment deed."
	end
	if inv.brass < Economy.APARTMENT_COST then
		return false, `Need {Economy.APARTMENT_COST} brass for a starter apartment (you have {inv.brass}).`
	end
	inv.brass -= Economy.APARTMENT_COST
	inv.apartment = true
	return true, `Deed signed · sky cottage yours (−{Economy.APARTMENT_COST} brass). Improve it from the door!`
end

return Economy
