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

function Frame.partQuality(id: string): number
	return QUALITY[id] or 1
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
	return out
end

function Frame.evaluate(slots)
	local sum = 0
	local material = 0
	for _, slot in Frame.SLOTS do
		local id = slots[slot]
		sum += Frame.partQuality(id)
		local def = Economy.COMMODITIES[id]
		material += if def then def.baseSell else 8
	end
	local quality = math.round(sum / #Frame.SLOTS * 100) / 100
	local sellValue = math.max(55, math.round(material * 1.15 + quality * 38))
	local chassis = Frame.TOKENS[slots.chassis] or "Part"
	local mech = Frame.TOKENS[slots.mechanisms] or "Part"
	local power = Frame.TOKENS[slots.power] or "Part"
	local wire = Frame.TOKENS[slots.wiring] or "Part"
	local persona = Frame.TOKENS[slots.personality] or "Part"
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
		if type(id) ~= "string" or not Frame.ACCEPTS[slot][id] then
			return false
		end
		counts[id] = (counts[id] or 0) + 1
	end
	for id, n in counts do
		if (inv.items[id] or 0) < n then
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
		inv.items[id] = (inv.items[id] or 0) - 1
		if inv.items[id] <= 0 then
			inv.items[id] = nil
		end
	end
	local stats = Frame.evaluate(fill)
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

function Frame.autoFill(inv)
	local fill = {}
	local reserved = {}
	for _, slot in Frame.SLOTS do
		local picked = nil
		local best = -1
		for _, id in Frame.listForSlot(inv, slot) do
			local used = reserved[id] or 0
			if (inv.items[id] or 0) - used > 0 then
				local q = Frame.partQuality(id)
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
