-- Slot frame assembly from frameAssembly.ts.
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

local Frame = {}

Frame.SLOTS = { "chassis", "mechanisms", "power", "wiring", "personality" }

Frame.ACCEPTS = {
	chassis = { cloud_iron = true, scrap_brass = true, spore_silk = true, sky_salt = true, glass_pane = true },
	mechanisms = { gear_blank = true },
	power = { fuel_cell = true },
	wiring = { wire = true, polished_wire = true },
	personality = {
		flower_gift = true,
		bloom_brass = true,
		bloom_sky = true,
		bloom_spore = true,
		bloom_harbor = true,
		bloom_aether = true,
	},
}

Frame.TOKENS = {
	cloud_iron = "Iron",
	scrap_brass = "Brass",
	spore_silk = "Silk",
	sky_salt = "Salt",
	glass_pane = "Glass",
	gear_blank = "Gear",
	fuel_cell = "Cell",
	wire = "Wire",
	polished_wire = "Gleam",
	bloom_brass = "Petal",
	bloom_sky = "Skybloom",
	bloom_spore = "Sporelily",
	bloom_harbor = "Harborose",
	bloom_aether = "Orchid",
	flower_gift = "Cloudbloom",
}

local QUALITY = {
	polished_wire = 1.55,
	spore_silk = 1.25,
	glass_pane = 1.2,
	bloom_aether = 1.7,
	bloom_harbor = 1.45,
	bloom_sky = 1.4,
	bloom_spore = 1.35,
	bloom_brass = 1.3,
	flower_gift = 1.15,
	fuel_cell = 1.1,
	gear_blank = 1.05,
	cloud_iron = 1.0,
	scrap_brass = 0.95,
	wire = 1.0,
	sky_salt = 0.9,
}

function Frame.ensure(inv)
	if type(inv.assembledFrames) ~= "table" then
		inv.assembledFrames = {}
	end
	return inv
end

function Frame.commodityQuality(id: string): number
	return QUALITY[id] or 1
end

function Frame.isCustom(ref: string): boolean
	return string.sub(ref, 1, 7) == "custom:"
end

function Frame.recipeId(ref: string): string
	return string.sub(ref, 8)
end

function Frame.inventionSlots(recipe): { string }
	local has = {}
	for _, input in recipe.inputs or {} do
		local id = input.id
		if id == "gear_blank" then
			has.mechanisms = true
		end
		if id == "wire" or id == "polished_wire" then
			has.wiring = true
		end
		if id == "fuel_cell" then
			has.power = true
		end
		if id == "cloud_iron" or id == "scrap_brass" or id == "spore_silk" or id == "sky_salt" or id == "glass_pane" then
			has.chassis = true
		end
		if Frame.ACCEPTS.personality[id] then
			has.personality = true
		end
	end
	if not has.chassis and not has.mechanisms and not has.power and not has.wiring and not has.personality then
		has.chassis = true
		has.power = true
	end
	local out = {}
	for _, slot in Frame.SLOTS do
		if has[slot] then
			table.insert(out, slot)
		end
	end
	return out
end

function Frame.inventionFits(recipe, slot: string): boolean
	for _, s in Frame.inventionSlots(recipe) do
		if s == slot then
			return true
		end
	end
	return false
end

function Frame.partLabel(inv, ref: string): string
	if Frame.isCustom(ref) then
		local rid = Frame.recipeId(ref)
		for _, recipe in inv.customRecipes or {} do
			if recipe.id == rid then
				return recipe.name
			end
		end
		return "Invention"
	end
	local def = Economy.COMMODITIES[ref]
	return if def then def.name else ref
end

function Frame.slotAccepts(inv, slot: string, ref: string): boolean
	if Frame.isCustom(ref) then
		local rid = Frame.recipeId(ref)
		local recipe = nil
		for _, r in inv.customRecipes or {} do
			if r.id == rid then
				recipe = r
				break
			end
		end
		if not recipe then
			return false
		end
		if (inv.customStock[rid] or 0) < 1 then
			return false
		end
		return Frame.inventionFits(recipe, slot)
	end
	if (inv.items[ref] or 0) < 1 then
		return false
	end
	return Frame.ACCEPTS[slot] ~= nil and Frame.ACCEPTS[slot][ref] == true
end

function Frame.listForSlot(inv, slot: string)
	local out = {}
	local accept = Frame.ACCEPTS[slot]
	if not accept then
		return out
	end
	for id in accept do
		if (inv.items[id] or 0) > 0 then
			table.insert(out, id)
		end
	end
	table.sort(out)
	for _, recipe in inv.customRecipes or {} do
		if (inv.customStock[recipe.id] or 0) >= 1 and Frame.inventionFits(recipe, slot) then
			table.insert(out, `custom:{recipe.id}`)
		end
	end
	return out
end

function Frame.partQuality(inv, ref: string): number
	if type(inv) == "string" then
		return QUALITY[inv] or 1
	end
	if Frame.isCustom(ref) then
		local rid = Frame.recipeId(ref)
		for _, recipe in inv.customRecipes or {} do
			if recipe.id == rid then
				return 1.35 + (recipe.quality or 1) * 0.35
			end
		end
		return 1.35
	end
	return QUALITY[ref] or 1
end

function Frame.partValue(inv, ref: string): number
	if Frame.isCustom(ref) then
		local rid = Frame.recipeId(ref)
		for _, recipe in inv.customRecipes or {} do
			if recipe.id == rid then
				return math.max(20, math.round((recipe.sellValue or 40) * 0.55))
			end
		end
		return 20
	end
	local def = Economy.COMMODITIES[ref]
	return if def then def.baseSell else 8
end

function Frame.token(inv, ref: string): string
	if Frame.isCustom(ref) then
		local name = Frame.partLabel(inv, ref)
		local words = string.split(name, " ")
		return words[#words] or "Spark"
	end
	return Frame.TOKENS[ref] or "Part"
end

function Frame.evaluate(slots, inv)
	local sum = 0
	local material = 0
	for _, slot in Frame.SLOTS do
		local id = slots[slot]
		sum += Frame.partQuality(inv or {}, id)
		material += Frame.partValue(inv or {}, id)
	end
	local quality = math.round(sum / #Frame.SLOTS * 100) / 100
	local sellValue = math.max(55, math.round(material * 1.15 + quality * 38))
	local chassis = Frame.token(inv or {}, slots.chassis)
	local mech = Frame.token(inv or {}, slots.mechanisms)
	local power = Frame.token(inv or {}, slots.power)
	local wire = Frame.token(inv or {}, slots.wiring)
	local persona = Frame.token(inv or {}, slots.personality)
	local body = if chassis == mech then chassis else chassis .. mech
	local heart = if power == wire then power else `{power}-{wire}`
	return {
		name = `{persona} {body} {heart} Frame`,
		quality = quality,
		sellValue = sellValue,
	}
end

function Frame.canAssemble(inv, fill): boolean
	if not inv.parcelLeased and not inv.cityWorkshopLeased then
		return false
	end
	local counts = {}
	for _, slot in Frame.SLOTS do
		local id = fill[slot]
		if type(id) ~= "string" or not Frame.slotAccepts(inv, slot, id) then
			return false
		end
		counts[id] = (counts[id] or 0) + 1
	end
	for id, n in counts do
		if Frame.isCustom(id) then
			if (inv.customStock[Frame.recipeId(id)] or 0) < n then
				return false
			end
		elseif (inv.items[id] or 0) < n then
			return false
		end
	end
	return true
end

function Frame.assemble(inv, fill): (boolean, string, any)
	Frame.ensure(inv)
	if not inv.parcelLeased and not inv.cityWorkshopLeased then
		return false, "Lease a bay first — assembly needs a workbench.", nil
	end
	if not Frame.canAssemble(inv, fill) then
		return false, "Fill all five spaces with valid parts you own.", nil
	end
	for _, slot in Frame.SLOTS do
		local id = fill[slot]
		if Frame.isCustom(id) then
			local rid = Frame.recipeId(id)
			inv.customStock[rid] = (inv.customStock[rid] or 0) - 1
			if inv.customStock[rid] <= 0 then
				inv.customStock[rid] = nil
			end
		else
			inv.items[id] = (inv.items[id] or 0) - 1
			if inv.items[id] <= 0 then
				inv.items[id] = nil
			end
		end
	end
	local stats = Frame.evaluate(fill, inv)
	local frame = {
		id = `frame_{math.floor(os.clock() * 1000)}`,
		name = stats.name,
		quality = stats.quality,
		sellValue = stats.sellValue,
		slots = fill,
	}
	table.insert(inv.assembledFrames, frame)
	return true, `Assembled {frame.name} · sell ~{frame.sellValue}b · Q{string.format("%.2f", frame.quality)}`, frame
end

function Frame.pickerState(inv)
	Frame.ensure(inv)
	if type(inv.frameFill) ~= "table" then
		inv.frameFill = {}
	end
	local parts = {}
	local fillLabels = {}
	local lines = { "Fill each space, then assemble. Chassis · mechanisms · power · wiring · personality." }
	for _, slot in Frame.SLOTS do
		local list = {}
		for _, ref in Frame.listForSlot(inv, slot) do
			table.insert(list, { id = ref, label = Frame.partLabel(inv, ref) })
		end
		parts[slot] = list
		local filled = inv.frameFill[slot]
		local label = if filled then Frame.partLabel(inv, filled) else "empty"
		fillLabels[slot] = label
		table.insert(lines, `{slot}: {label}`)
	end
	table.insert(lines, `Frames owned: {#inv.assembledFrames}`)
	return {
		fill = inv.frameFill,
		fillLabels = fillLabels,
		parts = parts,
		canAssemble = Frame.canAssemble(inv, inv.frameFill),
		assembled = #inv.assembledFrames,
		text = table.concat(lines, "\n"),
	}
end

function Frame.autoFill(inv)
	local fill = {}
	local reserved = {}
	for _, slot in Frame.SLOTS do
		local picked = nil
		local best = -1
		for _, id in Frame.listForSlot(inv, slot) do
			local used = reserved[id] or 0
			if (inv.items[id] or 0) - used > 0 then
				local q = Frame.partQuality(inv, id)
				if q > best then
					best = q
					picked = id
				end
			end
		end
		if picked then
			fill[slot] = picked
			reserved[picked] = (reserved[picked] or 0) + 1
		end
	end
	return fill
end

return Frame
