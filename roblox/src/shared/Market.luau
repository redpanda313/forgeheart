-- Stall demand, haggle, and Layer M traffic from economy.ts + marketSim.ts.
local Districts
local Economy
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
		return require(script.Parent.Economy)
	end)
	if ok then
		Economy = loaded
	else
		Economy = require("./Economy")
	end
end

local Market = {}

Market.STALL_PRICE_MUL = 1.12
Market.STALL_ASK_MIN_MUL = 0.5
Market.STALL_ASK_MAX_MUL = 2.0
Market.UNDER_SERVE_MUL = 1.28
Market.BALANCED_SERVE_MUL = 1.0
Market.BUSY_SERVE_MUL = 0.88
Market.OVER_SERVE_MUL = 0.72
Market.UNDER_SERVE_MAX = 1
Market.OVER_SERVE_MIN = 4
Market.STANDING_MAX_BONUS = 0.22
Market.DISTRICT_STANDING_MAX_BONUS = 0.12
Market.DISTRICT_STANDING_MAX_PENALTY = 0.08
Market.AFFINITY_MAX_BONUS = 0.1
Market.DECOR_HALF_WEIGHT = 0.5

local QUALITY = {
	fine_frame = 2,
	polished_wire = 2,
	basic_frame = 2,
	speed_tool = 2,
	repair_kit = 1,
	gear_blank = 1,
	wire = 1,
	fuel_cell = 1,
	glass_pane = 1,
	haul_pack = 1,
}

local function itemName(id: string): string
	local def = Economy.COMMODITIES[id]
	return if def then def.name else id
end

local function baseBuy(id: string): number
	local def = Economy.COMMODITIES[id]
	return if def then def.baseBuy else 1
end

function Market.emptyStall()
	return {
		owned = false,
		open = false,
		shelf = {},
		customShelf = {},
		frameShelf = {},
		asks = {},
		customAsks = {},
		autoFrames = true,
		autoHarvest = false,
		autoWire = false,
		autoInvent = false,
		sales = 0,
		earned = 0,
		lastDemand = "Steady",
		pendingHaggle = nil,
		forcedClosed = false,
		lastSalesDrivers = "",
	}
end

function Market.ensureStall(inv, districtId: string)
	if type(inv.stalls) ~= "table" then
		inv.stalls = {}
	end
	local stall = inv.stalls[districtId]
	if type(stall) ~= "table" then
		stall = Market.emptyStall()
		inv.stalls[districtId] = stall
	end
	if type(stall.shelf) ~= "table" then
		stall.shelf = {}
	end
	if type(stall.customShelf) ~= "table" then
		stall.customShelf = {}
	end
	if type(stall.frameShelf) ~= "table" then
		stall.frameShelf = {}
	end
	if type(stall.asks) ~= "table" then
		stall.asks = {}
	end
	if type(stall.customAsks) ~= "table" then
		stall.customAsks = {}
	end
	if stall.sales == nil then
		stall.sales = 0
	end
	if stall.earned == nil then
		stall.earned = 0
	end
	return stall
end

function Market.ensure(inv)
	if type(inv.marketPressure) ~= "table" then
		inv.marketPressure = {}
	end
	if type(inv.stalls) ~= "table" then
		inv.stalls = {}
	end
	if type(inv.assembledFrames) ~= "table" then
		inv.assembledFrames = {}
	end
	if type(inv.neighborAff) ~= "table" then
		inv.neighborAff = {}
	end
	if type(inv.knownNeighbors) ~= "table" then
		inv.knownNeighbors = {}
	end
	return inv
end

function Market.getPressure(inv, id: string): number
	if type(inv) ~= "table" or type(inv.marketPressure) ~= "table" then
		return 1
	end
	local p = inv.marketPressure[id]
	if type(p) ~= "number" then
		return 1
	end
	return math.clamp(p, 0.72, 1.4)
end

function Market.noteSupply(inv, id: string, units: number?)
	Market.ensure(inv)
	local n = math.min(units or 1, 8)
	local cur = Market.getPressure(inv, id)
	inv.marketPressure[id] = math.max(0.72, cur - 0.018 * n)
end

function Market.noteDemand(inv, id: string, units: number?)
	Market.ensure(inv)
	local n = math.min(units or 1, 8)
	local cur = Market.getPressure(inv, id)
	inv.marketPressure[id] = math.min(1.4, cur + 0.014 * n)
end

function Market.tickPressure(inv)
	Market.ensure(inv)
	for key, v in inv.marketPressure do
		if type(v) == "number" then
			local nextV = v + (1 - v) * 0.1
			if math.abs(nextV - 1) < 0.01 then
				inv.marketPressure[key] = nil
			else
				inv.marketPressure[key] = nextV
			end
		end
	end
end

function Market.fairStallPrice(id: string, inv: any?): number
	local pressure = if inv then Market.getPressure(inv, id) else 1
	return math.max(1, math.round(baseBuy(id) * Market.STALL_PRICE_MUL * pressure))
end

function Market.productQuality(id: string): number
	return QUALITY[id] or 0
end

function Market.stallDemandInfo(ask: number, fair: number, quality: number)
	local fairSafe = math.max(1, fair)
	local ratio = ask / fairSafe
	local adj = ratio / (1 + 0.3 * quality)
	local factor
	local label
	if adj <= 0.88 then
		factor = 1.5
		label = "Hot"
	elseif adj <= 1.06 then
		factor = 1.0
		label = "Steady"
	elseif adj <= 1.28 then
		factor = 0.52
		label = "Cool"
	elseif adj <= 1.55 then
		factor = 0.26
		label = "Slow"
	else
		factor = 0.09
		label = "Dead"
	end
	return { factor = factor, label = label, ratio = ratio }
end

function Market.clampAsk(id: string, price: number, inv: any?): number
	local fair = Market.fairStallPrice(id, inv)
	local minP = math.max(1, math.round(fair * Market.STALL_ASK_MIN_MUL))
	local maxP = math.max(minP, math.round(fair * Market.STALL_ASK_MAX_MUL))
	return math.clamp(math.round(price), minP, maxP)
end

function Market.getAsk(inv, stall, id: string): number
	local fair = Market.fairStallPrice(id, inv)
	local raw = stall.asks[id]
	if type(raw) == "number" and raw >= 1 then
		return Market.clampAsk(id, raw, inv)
	end
	return fair
end

function Market.setAsk(inv, stall, id: string, price: number): (boolean, string, number)
	if not stall.owned then
		return false, "Lease a stall first.", 0
	end
	local ask = Market.clampAsk(id, price, inv)
	stall.asks[id] = ask
	local fair = Market.fairStallPrice(id, inv)
	local d = Market.stallDemandInfo(ask, fair, Market.productQuality(id))
	return true, `{itemName(id)} ask {ask}b · fair {fair}b · demand {d.label}`, ask
end

function Market.fairInventionAsk(recipe, inventBonus: number?): number
	local q = recipe.quality or 1
	local bonus = inventBonus or 1
	return math.max(1, math.round(recipe.sellValue * bonus * (0.95 + q * 0.08)))
end

function Market.clampInventionAsk(recipe, price: number, inventBonus: number?): number
	local fair = Market.fairInventionAsk(recipe, inventBonus)
	local minP = math.max(1, math.round(fair * Market.STALL_ASK_MIN_MUL))
	local maxP = math.max(minP, math.round(fair * Market.STALL_ASK_MAX_MUL))
	return math.clamp(math.round(price), minP, maxP)
end

function Market.getInventionAsk(stall, recipe, inventBonus: number?): number
	if type(stall.customAsks) ~= "table" then
		stall.customAsks = {}
	end
	local fair = Market.fairInventionAsk(recipe, inventBonus)
	local raw = stall.customAsks[recipe.id]
	if type(raw) == "number" and raw >= 1 then
		return Market.clampInventionAsk(recipe, raw, inventBonus)
	end
	return fair
end

function Market.applyPolicy(inv, stall, policy: string, inventBonus: number?): (boolean, string)
	if not stall.owned then
		return false, "Lease a stall first."
	end
	local ids = {}
	for id, qty in stall.shelf do
		if type(qty) == "number" and qty > 0 then
			table.insert(ids, id)
		end
	end
	local inventIds = {}
	for rid, qty in stall.customShelf do
		if type(qty) == "number" and qty > 0 then
			table.insert(inventIds, rid)
		end
	end
	if #ids == 0 and #inventIds == 0 then
		return false, "Shelf empty — nothing to price."
	end
	local mul = if policy == "deal" then 0.85 elseif policy == "premium" then 1.18 else 1
	for _, id in ids do
		local fair = Market.fairStallPrice(id, inv)
		stall.asks[id] = Market.clampAsk(id, math.round(fair * mul), inv)
	end
	local bonus = inventBonus or 1
	for _, rid in inventIds do
		local recipe = nil
		for _, r in inv.customRecipes or {} do
			if r.id == rid then
				recipe = r
				break
			end
		end
		if recipe then
			local fair = Market.fairInventionAsk(recipe, bonus)
			stall.customAsks[rid] = Market.clampInventionAsk(recipe, math.round(fair * mul), bonus)
		end
	end
	local label = if policy == "deal" then "deals (−15%)" elseif policy == "premium" then "premium (+18%)" else "fair"
	return true, `Shelf priced at {label} · {#ids + #inventIds} lines`
end

function Market.needFor(id: string): string
	if id == "basic_frame" or id == "fine_frame" then
		return "frames"
	end
	if
		id == "flower_gift"
		or id == "bloom_brass"
		or id == "bloom_sky"
		or id == "bloom_spore"
		or id == "bloom_harbor"
		or id == "bloom_aether"
	then
		return "flowers"
	end
	if id == "brass_charm" or id == "silk_scarf" then
		return "gifts"
	end
	if
		id == "wire"
		or id == "gear_blank"
		or id == "glass_pane"
		or id == "fuel_cell"
		or id == "repair_kit"
		or id == "polished_wire"
		or id == "speed_tool"
		or id == "haul_pack"
	then
		return "parts"
	end
	return "mats"
end

function Market.stallStocksNeed(stall, need: string): boolean
	if not stall.owned or not stall.open then
		return false
	end
	if need == "inventions" then
		for _, n in stall.customShelf do
			if type(n) == "number" and n > 0 then
				return true
			end
		end
		return false
	end
	if need == "frames" then
		return #(stall.frameShelf or {}) > 0
	end
	for id, n in stall.shelf do
		if type(n) == "number" and n > 0 and Market.needFor(id) == need then
			return true
		end
	end
	return false
end

function Market.dominantNeed(stall): string?
	if not stall.owned or not stall.open then
		return nil
	end
	for _, n in stall.customShelf do
		if type(n) == "number" and n > 0 then
			return "inventions"
		end
	end
	if #(stall.frameShelf or {}) > 0 then
		return "frames"
	end
	local counts = {}
	for id, n in stall.shelf do
		if type(n) == "number" and n > 0 then
			local cat = Market.needFor(id)
			counts[cat] = (counts[cat] or 0) + n
		end
	end
	local best: string? = nil
	local bestN = 0
	for cat, n in counts do
		if n > bestN then
			bestN = n
			best = cat
		end
	end
	return best
end

function Market.categoryServeMul(openCount: number)
	local n = math.max(0, math.floor(openCount))
	if n <= Market.UNDER_SERVE_MAX then
		return { mul = Market.UNDER_SERVE_MUL, label = "Underserved niche", count = n }
	end
	if n == 2 then
		return { mul = Market.BALANCED_SERVE_MUL, label = "Balanced supply", count = n }
	end
	if n == 3 then
		return { mul = Market.BUSY_SERVE_MUL, label = "Busy niche", count = n }
	end
	return { mul = Market.OVER_SERVE_MUL, label = "Overserved", count = n }
end

function Market.reputationMul(empire: number, district: number, affinity: number)
	local e = (math.clamp(empire, 0, 100) / 100) * Market.STANDING_MAX_BONUS
	local dRaw = math.clamp(district, -20, 100)
	local dBonus = if dRaw >= 0
		then (dRaw / 100) * Market.DISTRICT_STANDING_MAX_BONUS
		else (dRaw / 20) * Market.DISTRICT_STANDING_MAX_PENALTY
	local a = (math.clamp(affinity, 0, 100) / 100) * Market.AFFINITY_MAX_BONUS
	local mul = math.clamp(1 + e + dBonus + a, 0.75, 1.55)
	local parts = {}
	if e >= 0.02 then
		table.insert(parts, `Standing +{math.round(e * 100)}%`)
	end
	if dBonus >= 0.02 then
		table.insert(parts, `District +{math.round(dBonus * 100)}%`)
	end
	if dBonus <= -0.02 then
		table.insert(parts, `District {math.round(dBonus * 100)}%`)
	end
	if a >= 0.02 then
		table.insert(parts, `Goodwill +{math.round(a * 100)}%`)
	end
	return { mul = mul, parts = parts }
end

function Market.decorMul(placementMul: number)
	local p = math.clamp(placementMul or 1, 0.8, 2.2)
	local extra = (p - 1) * Market.DECOR_HALF_WEIGHT
	local mul = math.clamp(1 + extra, 0.85, 1.35)
	if math.abs(extra) < 0.03 then
		return { mul = 1, part = nil }
	end
	local pct = math.round(extra * 100)
	return { mul = mul, part = if pct >= 0 then `Décor +{pct}%` else `Décor {pct}%` }
end

function Market.combineDemand(opts)
	local base = math.max(0.5, opts.districtDemandMul or 1)
	local serve = Market.categoryServeMul(opts.openStallsStockingNeed or 0)
	local rep = Market.reputationMul(opts.empireStanding or 0, opts.districtStanding or 0, opts.avgKnownAffinity or 0)
	local decor = Market.decorMul(opts.placementMul or 1)
	local demandMul = math.clamp(base * serve.mul * rep.mul * decor.mul, 0.35, 3.2)
	local drivers = {}
	if opts.need then
		local labels = {
			mats = "raw mats",
			parts = "parts & tools",
			frames = "frames",
			inventions = "inventions",
			gifts = "gifts",
			flowers = "flowers",
		}
		table.insert(drivers, `{labels[opts.need] or opts.need} · {serve.label}`)
	else
		table.insert(drivers, serve.label)
	end
	for _, part in rep.parts do
		table.insert(drivers, part)
	end
	if decor.part then
		table.insert(drivers, decor.part)
	end
	if base ~= 1 then
		table.insert(drivers, string.format("Plaza ×%.2f", base))
	end
	return { demandMul = demandMul, drivers = drivers, serveLabel = serve.label, need = opts.need }
end

function Market.formatDrivers(drivers): string
	if type(drivers) ~= "table" or #drivers == 0 then
		return "Traffic: baseline"
	end
	return table.concat(drivers, " · ")
end

function Market.countOpenByNeed(inv)
	local counts = { mats = 0, parts = 0, frames = 0, inventions = 0, gifts = 0, flowers = 0 }
	for _, stall in inv.stalls or {} do
		if stall.owned and stall.open then
			for need in counts do
				if Market.stallStocksNeed(stall, need) then
					counts[need] += 1
				end
			end
		end
	end
	return counts
end

function Market.avgAffinity(inv): number
	local sum = 0
	local n = 0
	for id, known in inv.knownNeighbors or {} do
		if known then
			sum += (inv.neighborAff and inv.neighborAff[id]) or 0
			n += 1
		end
	end
	if n == 0 then
		return 0
	end
	return sum / n
end

function Market.demandForStall(inv, stall, districtId: string?)
	Market.ensure(inv)
	local need = Market.dominantNeed(stall)
	local byNeed = Market.countOpenByNeed(inv)
	local openForNeed = if need then byNeed[need] else 1
	local dist = if districtId then Districts.byId(districtId) else nil
	local districtStand = 0
	if districtId and type(inv.districtStanding) == "table" then
		districtStand = inv.districtStanding[districtId] or 0
	end
	local bundle = Market.combineDemand({
		districtDemandMul = if dist then dist.demandMul else 1,
		openStallsStockingNeed = openForNeed,
		empireStanding = inv.empireStanding or 0,
		districtStanding = districtStand,
		avgKnownAffinity = Market.avgAffinity(inv),
		placementMul = 1,
		need = need,
	})
	stall.lastSalesDrivers = Market.formatDrivers(bundle.drivers)
	local inventBonus = (if dist then dist.inventBonus else 1)
		* math.min(1.15, 0.92 + (inv.empireStanding or 0) * 0.002)
	return { demandMul = bundle.demandMul, inventBonus = inventBonus, drivers = bundle.drivers }
end

local function autoRestock(inv, stall)
	if stall.autoFrames and #(stall.frameShelf or {}) < 1 and #(inv.assembledFrames or {}) > 0 then
		table.sort(inv.assembledFrames, function(a, b)
			return (a.sellValue or 0) > (b.sellValue or 0)
		end)
		table.insert(stall.frameShelf, table.remove(inv.assembledFrames, 1))
	end
	if stall.autoWire and (stall.shelf.wire or 0) < 1 and (inv.items.wire or 0) > 0 then
		inv.items.wire -= 1
		if inv.items.wire <= 0 then
			inv.items.wire = nil
		end
		stall.shelf.wire = (stall.shelf.wire or 0) + 1
		if stall.asks.wire == nil then
			stall.asks.wire = Market.fairStallPrice("wire", inv)
		end
	end
	if stall.autoHarvest then
		for _, id in { "cloud_iron", "scrap_brass", "spore_silk", "sky_salt" } do
			if (stall.shelf[id] or 0) < 1 and (inv.items[id] or 0) > 0 then
				inv.items[id] -= 1
				if inv.items[id] <= 0 then
					inv.items[id] = nil
				end
				stall.shelf[id] = (stall.shelf[id] or 0) + 1
				if stall.asks[id] == nil then
					stall.asks[id] = Market.fairStallPrice(id, inv)
				end
				break
			end
		end
	end
	if stall.autoInvent then
		for rid, qty in inv.customStock or {} do
			if type(qty) == "number" and qty > 0 and (stall.customShelf[rid] or 0) < 1 then
				inv.customStock[rid] -= 1
				if inv.customStock[rid] <= 0 then
					inv.customStock[rid] = nil
				end
				stall.customShelf[rid] = (stall.customShelf[rid] or 0) + 1
				if stall.customAsks[rid] == nil then
					for _, recipe in inv.customRecipes or {} do
						if recipe.id == rid then
							stall.customAsks[rid] = Market.fairInventionAsk(recipe)
							break
						end
					end
				end
				break
			end
		end
	end
end

function Market.resolveHaggle(inv, stall, accept: boolean): (boolean, string)
	local h = stall.pendingHaggle
	if type(h) ~= "table" then
		return false, "No haggle pending."
	end
	stall.pendingHaggle = nil
	if not accept then
		return true, "Haggle refused — customer walked."
	end
	local onShelf = stall.shelf[h.id] or 0
	if onShelf < 1 then
		return false, "That good left the shelf — haggle expired."
	end
	stall.shelf[h.id] = onShelf - 1
	if stall.shelf[h.id] <= 0 then
		stall.shelf[h.id] = nil
	end
	inv.brass += h.offer
	stall.sales += 1
	stall.earned += h.offer
	Market.noteDemand(inv, h.id, 1)
	return true, `Haggle closed · sold 1× {itemName(h.id)} @ {h.offer}b (ask was {h.ask}b)`
end

function Market.tickStallState(inv, stall, opts, rng)
	if not stall.owned or not stall.open then
		return { ok = false }
	end
	local roll = rng or math.random
	local demandMul = if opts then opts.demandMul else 1
	demandMul = demandMul or 1
	local inventBonus = if opts then opts.inventBonus else 1
	inventBonus = inventBonus or 1
	local label = if opts and opts.label then opts.label else "Stall"

	if type(stall.pendingHaggle) == "table" then
		stall.pendingHaggle.ttl -= 1
		if stall.pendingHaggle.ttl <= 0 then
			stall.pendingHaggle = nil
			return { ok = false, msg = `{label}: haggle expired — customer left.` }
		end
		return { ok = false, haggle = true, msg = `{label}: customer waiting on a haggle…` }
	end

	autoRestock(inv, stall)
	Market.tickPressure(inv)

	local inventIds = {}
	for rid, qty in stall.customShelf do
		if type(qty) == "number" and qty > 0 then
			table.insert(inventIds, rid)
		end
	end
	if #inventIds > 0 and roll() < 0.45 + inventBonus * 0.15 then
		local rid = inventIds[math.floor(roll() * #inventIds) % #inventIds + 1]
		local recipe = nil
		for _, r in inv.customRecipes or {} do
			if r.id == rid then
				recipe = r
				break
			end
		end
		if recipe then
			local q = recipe.quality or 1
			local fair = Market.fairInventionAsk(recipe, inventBonus)
			local ask = Market.getInventionAsk(stall, recipe, inventBonus)
			local d = Market.stallDemandInfo(ask, fair, q)
			local chance = math.min(0.95, 0.35 + d.factor * 0.5 * demandMul)
			if roll() > chance then
				stall.lastDemand = d.label
				return {
					ok = false,
					msg = if d.label == "Dead" or d.label == "Slow"
						then `{label}: invention browsers left — {recipe.name} priced high ({d.label}).`
						else nil,
				}
			end
			stall.customShelf[rid] -= 1
			if stall.customShelf[rid] <= 0 then
				stall.customShelf[rid] = nil
			end
			inv.brass += ask
			stall.sales += 1
			stall.earned += ask
			inv.inventionsSold = (inv.inventionsSold or 0) + 1
			stall.lastDemand = d.label
			local vs = if ask == fair then "fair" elseif ask < fair then "deal" else "premium"
			return {
				ok = true,
				msg = `{label} sold invention {recipe.name} @ {ask}b ({vs} · {d.label}) · sales {stall.sales}`,
			}
		end
	end

	if #(stall.frameShelf or {}) > 0 and roll() < 0.38 then
		table.sort(stall.frameShelf, function(a, b)
			return (a.sellValue or 0) > (b.sellValue or 0)
		end)
		local frame = table.remove(stall.frameShelf, 1)
		local price = math.round(frame.sellValue * (0.92 + inventBonus * 0.08))
		inv.brass += price
		stall.sales += 1
		stall.earned += price
		inv.framesSold = (inv.framesSold or 0) + 1
		stall.lastDemand = if (frame.quality or 1) >= 1.35 then "Hot" else "Steady"
		return { ok = true, msg = `{label} sold {frame.name} @ {price}b · sales {stall.sales}` }
	end

	local ids = {}
	for id, qty in stall.shelf do
		if type(qty) == "number" and qty > 0 then
			table.insert(ids, id)
		end
	end
	table.sort(ids)
	if #ids == 0 and #inventIds == 0 and #(stall.frameShelf or {}) == 0 then
		stall.lastDemand = "Dead"
		return { ok = false, msg = `{label} empty — stock goods, frames, or inventions.` }
	end
	if #ids == 0 then
		return { ok = false }
	end

	local weights = {}
	local totalW = 0
	for _, id in ids do
		local d = Market.stallDemandInfo(Market.getAsk(inv, stall, id), Market.fairStallPrice(id, inv), Market.productQuality(id))
		local w = math.max(0.05, d.factor * demandMul)
		table.insert(weights, { id = id, w = w, d = d })
		totalW += w
	end
	local avgFactor = totalW / #weights
	stall.lastDemand = if avgFactor >= 1.2
		then "Hot"
		elseif avgFactor >= 0.85 then "Steady"
		elseif avgFactor >= 0.45 then "Cool"
		elseif avgFactor >= 0.2 then "Slow"
		else "Dead"

	local saleChance = math.min(0.95, 0.22 + avgFactor * 0.45 * demandMul)
	if roll() > saleChance then
		return {
			ok = false,
			msg = if stall.lastDemand == "Dead" or stall.lastDemand == "Slow"
				then `{label}: browsers left — prices high ({stall.lastDemand}).`
				else nil,
		}
	end

	local pickRoll = roll() * totalW
	local picked = weights[1]
	for _, row in weights do
		pickRoll -= row.w
		if pickRoll <= 0 then
			picked = row
			break
		end
	end
	local id = picked.id
	local ask = Market.getAsk(inv, stall, id)
	local fair = Market.fairStallPrice(id, inv)

	if roll() < 0.18 then
		local offer = math.max(1, math.round(ask * (0.78 + roll() * 0.14)))
		stall.pendingHaggle = { id = id, offer = offer, ask = ask, fair = fair, ttl = 3 }
		return {
			ok = false,
			haggle = true,
			msg = `{label} haggle! {offer}b for {itemName(id)} (ask {ask}b).`,
		}
	end

	stall.shelf[id] = (stall.shelf[id] or 1) - 1
	if (stall.shelf[id] or 0) <= 0 then
		stall.shelf[id] = nil
	end
	inv.brass += ask
	stall.sales += 1
	stall.earned += ask
	Market.noteDemand(inv, id, 1)
	local vs = if ask == fair then "fair" elseif ask < fair then "deal" else "premium"
	return {
		ok = true,
		msg = `{label} sold 1× {itemName(id)} @ {ask}b ({vs} · {picked.d.label}) · sales {stall.sales}`,
	}
end

function Market.tickAllStalls(inv, rng)
	Market.ensure(inv)
	local sales = 0
	local lastMsg = nil
	local haggle = false
	local lastDrivers = nil
	local pending = {}
	for districtId, stall in inv.stalls do
		if stall.owned and stall.open then
			local dist = Districts.byId(districtId)
			local m = Market.demandForStall(inv, stall, districtId)
			lastDrivers = stall.lastSalesDrivers
			local r = Market.tickStallState(inv, stall, {
				demandMul = m.demandMul,
				inventBonus = m.inventBonus,
				label = if dist then dist.name else districtId,
			}, rng)
			if r.ok then
				sales += 1
				lastMsg = if r.msg
					then `{r.msg}{if stall.lastSalesDrivers ~= "" then ` · {stall.lastSalesDrivers}` else ""}`
					else lastMsg
			elseif r.msg then
				lastMsg = r.msg
			end
			if r.haggle then
				haggle = true
				table.insert(pending, { districtId = districtId, msg = r.msg, haggle = stall.pendingHaggle })
			end
		end
	end
	return {
		ok = sales > 0,
		msg = lastMsg,
		haggle = haggle,
		sales = sales,
		drivers = lastDrivers,
		pending = pending,
	}
end

function Market.stockGoods(inv, districtId: string, id: string, qty: number): (boolean, string)
	local stall = Market.ensureStall(inv, districtId)
	if not stall.owned then
		return false, "Lease a stall first."
	end
	local n = math.max(1, math.floor(qty))
	if (inv.items[id] or 0) < n then
		return false, `Need {n}× {itemName(id)}`
	end
	inv.items[id] -= n
	if inv.items[id] <= 0 then
		inv.items[id] = nil
	end
	stall.shelf[id] = (stall.shelf[id] or 0) + n
	if stall.asks[id] == nil then
		stall.asks[id] = Market.fairStallPrice(id, inv)
	end
	local ask = Market.getAsk(inv, stall, id)
	return true, `Stocked {n}× {itemName(id)} @ {ask}b ask`
end

function Market.stockInvention(inv, districtId: string, recipeId: string, qty: number, inventBonus: number?): (boolean, string)
	local stall = Market.ensureStall(inv, districtId)
	if not stall.owned then
		return false, "Lease a stall first."
	end
	local recipe = nil
	for _, r in inv.customRecipes or {} do
		if r.id == recipeId then
			recipe = r
			break
		end
	end
	if not recipe then
		return false, "Unknown invention."
	end
	local n = math.max(1, math.floor(qty))
	if (inv.customStock[recipeId] or 0) < n then
		return false, `Need {n}× {recipe.name} in stock.`
	end
	inv.customStock[recipeId] -= n
	if inv.customStock[recipeId] <= 0 then
		inv.customStock[recipeId] = nil
	end
	stall.customShelf[recipeId] = (stall.customShelf[recipeId] or 0) + n
	if stall.customAsks[recipeId] == nil then
		stall.customAsks[recipeId] = Market.fairInventionAsk(recipe, inventBonus)
	end
	return true, `Stocked {n}× {recipe.name} @ {stall.customAsks[recipeId]}b ask (invented goods sell best at premium plazas).`
end

function Market.stockFrame(inv, districtId: string): (boolean, string)
	local stall = Market.ensureStall(inv, districtId)
	if not stall.owned then
		return false, "Lease a stall first."
	end
	if #(inv.assembledFrames or {}) < 1 then
		return false, "No assembled frames to stock"
	end
	table.sort(inv.assembledFrames, function(a, b)
		return (a.sellValue or 0) > (b.sellValue or 0)
	end)
	local frame = table.remove(inv.assembledFrames, 1)
	table.insert(stall.frameShelf, frame)
	return true, `Stocked {frame.name} on stall (~{frame.sellValue}b)`
end

function Market.summary(inv, districtId: string): string
	local stall = Market.ensureStall(inv, districtId)
	local dist = Districts.byId(districtId)
	local name = if dist then dist.name else districtId
	if not stall.owned then
		local cost = if dist then dist.stallCost else 90
		return `{name} stall unleased · {cost} brass.`
	end
	local lines = {
		`{name} · {if stall.open then "open" else "closed"} · demand {stall.lastDemand or "—"}`,
		`Sales {stall.sales} · earned {stall.earned}b`,
	}
	if stall.lastSalesDrivers and stall.lastSalesDrivers ~= "" then
		table.insert(lines, stall.lastSalesDrivers)
	end
	local goods = {}
	for id, qty in stall.shelf do
		if type(qty) == "number" and qty > 0 then
			local ask = Market.getAsk(inv, stall, id)
			local fair = Market.fairStallPrice(id, inv)
			local d = Market.stallDemandInfo(ask, fair, Market.productQuality(id))
			table.insert(goods, `{qty}× {itemName(id)} @ {ask}b ({d.label})`)
		end
	end
	table.sort(goods)
	if #goods == 0 then
		table.insert(lines, "Shelf empty.")
	else
		table.insert(lines, table.concat(goods, "\n"))
	end
	for rid, qty in stall.customShelf do
		if type(qty) == "number" and qty > 0 then
			for _, recipe in inv.customRecipes or {} do
				if recipe.id == rid then
					table.insert(lines, `{qty}× {recipe.name} @ {Market.getInventionAsk(stall, recipe)}b`)
					break
				end
			end
		end
	end
	if #(stall.frameShelf or {}) > 0 then
		table.insert(lines, `Frames on display: {#stall.frameShelf}`)
	end
	if type(stall.pendingHaggle) == "table" then
		table.insert(lines, `Haggle: {stall.pendingHaggle.offer}b for {itemName(stall.pendingHaggle.id)} (ask {stall.pendingHaggle.ask}b, {stall.pendingHaggle.ttl} ticks)`)
	end
	return table.concat(lines, "\n")
end

return Market
