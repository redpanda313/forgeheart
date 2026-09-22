-- Worker jobs and programs from economy.ts (JOB_DEFS, PROGRAM_NODE_DEFS, templates).
local Economy
local Frame
local Market
do
	local ok, loaded = pcall(function()
		return require(script.Parent.Economy)
	end)
	if ok then
		Economy = loaded
	else
		Economy = require("./Economy")
	end
	ok, loaded = pcall(function()
		return require(script.Parent.Frame)
	end)
	if ok then
		Frame = loaded
	else
		Frame = require("./Frame")
	end
	ok, loaded = pcall(function()
		return require(script.Parent.Market)
	end)
	if ok then
		Market = loaded
	else
		Market = require("./Market")
	end
end

local Programs = {}

Programs.FREE_NODES = 3
Programs.APPRENTICE_GRADE = 5
Programs.PAY_RAISE_COST = 40
Programs.FRAME_BROKER_PRICE = 75
Programs.REPAIR_PAY = 18
Programs.MAX_PROGRAMS = 32
Programs.MAX_NODES = 20

Programs.RANKS = {
	{ grade = 0, title = "Dock Hand" },
	{ grade = 1, title = "Bay Runner" },
	{ grade = 2, title = "Floor Hand" },
	{ grade = 3, title = "Journeyman" },
	{ grade = 4, title = "Specialist" },
	{ grade = 5, title = "Apprentice Inventor" },
	{ grade = 6, title = "Workshop Lead" },
	{ grade = 7, title = "Master Artisan" },
	{ grade = 8, title = "Chief Inventor" },
}

Programs.JOBS = {
	{ id = "idle", name = "Idle", blurb = "Stand by at the bay." },
	{ id = "harvest", name = "Reef Haul", blurb = "Walk to the reef, extract scrap, return to bay." },
	{ id = "pick_flowers", name = "Pick Flowers", blurb = "Plaza blooms · personality mats." },
	{ id = "craft_wire", name = "Draw Wire", blurb = "Scrap → wire at the bench." },
	{ id = "craft_frame", name = "Build Frames", blurb = "Assemble five-slot frames." },
	{ id = "sell_frame", name = "Broker Run", blurb = "Sell a frame to the broker." },
	{ id = "repair", name = "Field Repair", blurb = "Spend a kit, earn brass." },
	{ id = "program", name = "Run Program", blurb = "Execute the assigned program graph." },
	{ id = "craft", name = "Craft (legacy)", blurb = "First recipe that has mats." },
	{ id = "stock", name = "Stock (legacy)", blurb = "Stock an owned stall." },
}

Programs.NODES = {
	{ id = "harvest", name = "Harvest Reef", blurb = "Reef · extract mats", category = "haul" },
	{ id = "pick_flowers", name = "Pick Flowers", blurb = "Plaza blooms", category = "haul" },
	{ id = "return_bay", name = "Return Bay", blurb = "Walk home", category = "haul" },
	{ id = "craft_wire", name = "Craft Wire", blurb = "2 scrap → wire", category = "craft" },
	{ id = "craft_gear", name = "Craft Gear Blank", blurb = "iron + scrap → gear", category = "craft" },
	{ id = "craft_kit", name = "Craft Repair Kit", blurb = "wire + scrap → kit", category = "craft" },
	{ id = "craft_frame", name = "Make Frame", blurb = "Fill five slots · assemble", category = "craft" },
	{ id = "craft_speed_tool", name = "Craft Rivet Spanner", blurb = "gear · wire · iron", category = "craft" },
	{ id = "craft_haul_pack", name = "Craft Haul Pack", blurb = "silk + scrap", category = "craft" },
	{ id = "craft_polished_wire", name = "Craft Polished Wire", blurb = "Fine Q2 wire", category = "craft" },
	{ id = "craft_fine_frame", name = "Make Fine Frame", blurb = "Make Frame · fine parts", category = "craft" },
	{ id = "craft_custom", name = "Craft Invention", blurb = "Craft from your book", category = "craft" },
	{ id = "invent_recipe", name = "Invent New Recipe", blurb = "Needs Apprentice Inventor (G5)", category = "craft" },
	{ id = "sell_cloud_iron", name = "Sell Cloud Iron", category = "market_sell" },
	{ id = "sell_scrap_brass", name = "Sell Scrap Brass", category = "market_sell" },
	{ id = "sell_spore_silk", name = "Sell Spore Silk", category = "market_sell" },
	{ id = "sell_sky_salt", name = "Sell Sky Salt", category = "market_sell" },
	{ id = "sell_wire", name = "Sell Wire", category = "market_sell" },
	{ id = "sell_gear_blank", name = "Sell Gear Blank", category = "market_sell" },
	{ id = "sell_repair_kit", name = "Sell Repair Kit", category = "market_sell" },
	{ id = "sell_fuel_cell", name = "Sell Fuel Cell", category = "market_sell" },
	{ id = "sell_glass", name = "Sell Glass Pane", category = "market_sell" },
	{ id = "sell_invention", name = "Sell Invention", category = "market_sell" },
	{ id = "sell_frame", name = "Sell Frame (Broker)", category = "market_sell" },
	{ id = "sell_all_cloud_iron", name = "Sell ALL Cloud Iron", category = "market_sell" },
	{ id = "sell_all_scrap_brass", name = "Sell ALL Scrap", category = "market_sell" },
	{ id = "sell_all_spore_silk", name = "Sell ALL Silk", category = "market_sell" },
	{ id = "sell_all_sky_salt", name = "Sell ALL Salt", category = "market_sell" },
	{ id = "sell_all_wire", name = "Sell ALL Wire", category = "market_sell" },
	{ id = "sell_all_harvest", name = "Sell ALL Harvest Mats", category = "market_sell" },
	{ id = "buy_cloud_iron", name = "Buy Cloud Iron", category = "market_buy" },
	{ id = "buy_scrap_brass", name = "Buy Scrap Brass", category = "market_buy" },
	{ id = "buy_spore_silk", name = "Buy Spore Silk", category = "market_buy" },
	{ id = "buy_sky_salt", name = "Buy Sky Salt", category = "market_buy" },
	{ id = "buy_wire", name = "Buy Wire", category = "market_buy" },
	{ id = "buy_gear_blank", name = "Buy Gear Blank", category = "market_buy" },
	{ id = "buy_repair_kit", name = "Buy Repair Kit", category = "market_buy" },
	{ id = "buy_fuel_cell", name = "Buy Fuel Cell", category = "market_buy" },
	{ id = "buy_glass", name = "Buy Glass Pane", category = "market_buy" },
	{ id = "buy_5_fuel_cell", name = "Buy 5× Fuel Cell", category = "market_buy" },
	{ id = "buy_5_scrap_brass", name = "Buy 5× Scrap", category = "market_buy" },
	{ id = "buy_5_wire", name = "Buy 5× Wire", category = "market_buy" },
	{ id = "buy_5_cloud_iron", name = "Buy 5× Cloud Iron", category = "market_buy" },
	{ id = "repair", name = "Field Repair", category = "service" },
	{ id = "stock_stall_frame", name = "Stock Stall · Frame", category = "stall" },
	{ id = "stock_stall_wire", name = "Stock Stall · Wire", category = "stall" },
	{ id = "stock_stall_scrap", name = "Stock Stall · Scrap", category = "stall" },
	{ id = "stock_stall_invention", name = "Stock Stall · Invention", category = "stall" },
	{ id = "stock_stall_goods", name = "Stock Stall · Goods", category = "stall" },
	{ id = "price_deal_shelf", name = "Price Shelf · Deals", category = "stall" },
	{ id = "price_fair_shelf", name = "Price Shelf · Fair", category = "stall" },
	{ id = "price_premium_shelf", name = "Price Shelf · Premium", category = "stall" },
}

Programs.CRAFT_RECIPE = {
	craft_wire = "wire_from_scrap",
	craft_gear = "gear_blank",
	craft_kit = "repair_kit",
	craft_speed_tool = "speed_tool",
	craft_haul_pack = "haul_pack",
	craft_polished_wire = "polished_wire",
}

Programs.TRADE_ITEM = {
	sell_cloud_iron = "cloud_iron",
	sell_scrap_brass = "scrap_brass",
	sell_spore_silk = "spore_silk",
	sell_sky_salt = "sky_salt",
	sell_wire = "wire",
	sell_gear_blank = "gear_blank",
	sell_repair_kit = "repair_kit",
	sell_fuel_cell = "fuel_cell",
	sell_glass = "glass_pane",
	buy_cloud_iron = "cloud_iron",
	buy_scrap_brass = "scrap_brass",
	buy_spore_silk = "spore_silk",
	buy_sky_salt = "sky_salt",
	buy_wire = "wire",
	buy_gear_blank = "gear_blank",
	buy_repair_kit = "repair_kit",
	buy_fuel_cell = "fuel_cell",
	buy_glass = "glass_pane",
	sell_all_cloud_iron = "cloud_iron",
	sell_all_scrap_brass = "scrap_brass",
	sell_all_spore_silk = "spore_silk",
	sell_all_sky_salt = "sky_salt",
	sell_all_wire = "wire",
	buy_5_fuel_cell = "fuel_cell",
	buy_5_scrap_brass = "scrap_brass",
	buy_5_wire = "wire",
	buy_5_cloud_iron = "cloud_iron",
}

Programs.TEMPLATES = {
	{
		id = "frame_line",
		name = "Frame Line",
		blurb = "Reef → buy fuel → make frame → bay · 4 steps",
		nodes = { "harvest", "buy_fuel_cell", "craft_frame", "return_bay" },
		framePref = "service",
	},
	{
		id = "frame_broker",
		name = "Frame → Broker",
		blurb = "Make frames & sell to broker · 5 steps",
		nodes = { "harvest", "buy_fuel_cell", "craft_frame", "sell_frame", "return_bay" },
		framePref = "service",
	},
	{
		id = "frame_stall",
		name = "Frame → Stall",
		blurb = "Make a frame & stock your stall · 4 steps",
		nodes = { "buy_fuel_cell", "craft_frame", "stock_stall_frame", "return_bay" },
		framePref = "service",
	},
	{
		id = "harvest_loop",
		name = "Harvest Loop",
		blurb = "Reef haul home · 2 steps",
		nodes = { "harvest", "return_bay" },
	},
	{
		id = "flower_loop",
		name = "Flower Loop",
		blurb = "Pick plaza blooms · return · 2 steps",
		nodes = { "pick_flowers", "return_bay" },
	},
}

local FLOWER_IDS = { "flower_gift", "bloom_brass", "bloom_sky", "bloom_spore", "bloom_harbor", "bloom_aether" }

function Programs.ensure(inv)
	if type(inv.programs) ~= "table" then
		inv.programs = {}
	end
	if type(inv.workers) ~= "table" then
		inv.workers = {}
	end
	if type(inv.assembledFrames) ~= "table" then
		inv.assembledFrames = {}
	end
	return inv
end

function Programs.jobName(id: string): string
	for _, job in Programs.JOBS do
		if job.id == id then
			return job.name
		end
	end
	return id
end

function Programs.nodeName(id: string): string
	for _, node in Programs.NODES do
		if node.id == id then
			return node.name
		end
	end
	return id
end

function Programs.isJob(id: string): boolean
	for _, job in Programs.JOBS do
		if job.id == id then
			return true
		end
	end
	return false
end

function Programs.payTitle(grade: number): string
	local g = math.max(0, math.floor(grade or 0))
	local best = Programs.RANKS[1]
	for _, rank in Programs.RANKS do
		if rank.grade == g then
			return rank.title
		end
		if rank.grade <= g then
			best = rank
		end
	end
	local top = Programs.RANKS[#Programs.RANKS]
	if g > top.grade then
		return `{top.title} {g - top.grade + 1}`
	end
	return best.title
end

function Programs.raiseCost(payGrade: number): number
	return Programs.PAY_RAISE_COST + math.max(0, payGrade) * 25
end

function Programs.minGradeForNodes(nodeCount: number): number
	return math.max(0, math.ceil((nodeCount - Programs.FREE_NODES) / 2))
end

function Programs.minGradeForProgram(program): number
	local byLen = Programs.minGradeForNodes(#(program.nodes or {}))
	for _, node in program.nodes or {} do
		if node == "invent_recipe" then
			return math.max(byLen, Programs.APPRENTICE_GRADE)
		end
	end
	return byLen
end

function Programs.maxNodes(worker): number
	if worker.kind == "robot" and worker.hasMedallion ~= true then
		return 3 + math.max(0, worker.frameProgramBonus or 0)
	end
	return 8
end

function Programs.findWorker(inv, workerId: string)
	for _, worker in inv.workers or {} do
		if worker.id == workerId then
			return worker
		end
	end
	return nil
end

function Programs.findProgram(inv, programId: string)
	for _, program in inv.programs or {} do
		if program.id == programId then
			return program
		end
	end
	return nil
end

function Programs.setJob(inv, workerId: string, job: string): (boolean, string)
	Programs.ensure(inv)
	if job == "craft" then
		job = "craft_wire"
	end
	if not Programs.isJob(job) then
		return false, "Unknown job."
	end
	local worker = Programs.findWorker(inv, workerId)
	if not worker then
		return false, "No such worker."
	end
	worker.job = job
	if job ~= "program" then
		worker.programId = nil
	end
	return true, `{worker.name} assigned: {Programs.jobName(job)}`
end

function Programs.raisePay(inv, workerId: string): (boolean, string)
	Programs.ensure(inv)
	local worker = Programs.findWorker(inv, workerId)
	if not worker then
		return false, "Worker not found."
	end
	local cost = Programs.raiseCost(worker.payGrade or 0)
	if inv.brass < cost then
		return false, `Need {cost} brass to raise {worker.name} to {Programs.payTitle((worker.payGrade or 0) + 1)}.`
	end
	inv.brass -= cost
	worker.payGrade = (worker.payGrade or 0) + 1
	local nodes = Programs.FREE_NODES + worker.payGrade * 2
	local inventBit = if worker.payGrade == Programs.APPRENTICE_GRADE
		then " · can invent new recipes on programs!"
		elseif worker.payGrade > Programs.APPRENTICE_GRADE then " · invent rights kept"
		else ` · invent at G{Programs.APPRENTICE_GRADE}`
	return true, `{worker.name} → {Programs.payTitle(worker.payGrade)} (G{worker.payGrade}, −{cost}b). Programs up to ~{nodes} steps{inventBit}`
end

function Programs.create(inv, name: string?): (boolean, string, any)
	Programs.ensure(inv)
	if #inv.programs >= Programs.MAX_PROGRAMS then
		return false, "Max 32 programs on this empire bay.", nil
	end
	local program = {
		id = `prog_{math.floor(os.clock() * 1000)}_{#inv.programs}`,
		name = if name and name ~= "" then name else `Program {#inv.programs + 1}`,
		nodes = { "harvest", "return_bay" },
	}
	table.insert(inv.programs, program)
	return true, `Created {program.name}`, program
end

function Programs.createFromTemplate(inv, templateId: string): (boolean, string, any)
	Programs.ensure(inv)
	if #inv.programs >= Programs.MAX_PROGRAMS then
		return false, "Max 32 programs on this empire bay.", nil
	end
	local template = nil
	for _, row in Programs.TEMPLATES do
		if row.id == templateId then
			template = row
			break
		end
	end
	if not template then
		return false, "Unknown template.", nil
	end
	local program = {
		id = `prog_{math.floor(os.clock() * 1000)}_{#inv.programs}`,
		name = template.name,
		nodes = table.clone(template.nodes),
		framePref = template.framePref or "service",
	}
	table.insert(inv.programs, program)
	local grade = Programs.minGradeForNodes(#program.nodes)
	local note = if grade > 0 then ` · needs pay grade {grade}` else " · free for grade 0"
	return true, `Created “{program.name}” ({#program.nodes} steps{note})`, program
end

function Programs.addNode(inv, programId: string, nodeId: string): (boolean, string)
	local program = Programs.findProgram(inv, programId)
	if not program then
		return false, "Program not found."
	end
	if #program.nodes >= Programs.MAX_NODES then
		return false, "Max 20 nodes per program."
	end
	local known = false
	for _, node in Programs.NODES do
		if node.id == nodeId then
			known = true
			break
		end
	end
	if not known then
		return false, "Unknown step."
	end
	table.insert(program.nodes, nodeId)
	return true, `Added {Programs.nodeName(nodeId)}`
end

function Programs.removeNode(inv, programId: string, index: number): (boolean, string)
	local program = Programs.findProgram(inv, programId)
	if not program then
		return false, "Program not found."
	end
	index = math.floor(index)
	if index < 1 or index > #program.nodes then
		return false, "No such step."
	end
	local removed = table.remove(program.nodes, index)
	return true, `Removed {Programs.nodeName(removed)}`
end

function Programs.moveNode(inv, programId: string, index: number, delta: number): (boolean, string)
	local program = Programs.findProgram(inv, programId)
	if not program then
		return false, "Program not found."
	end
	index = math.floor(index)
	local dest = index + math.floor(delta)
	if index < 1 or index > #program.nodes or dest < 1 or dest > #program.nodes then
		return false, "Can't move that step."
	end
	program.nodes[index], program.nodes[dest] = program.nodes[dest], program.nodes[index]
	return true, `Moved {Programs.nodeName(program.nodes[dest])}`
end

function Programs.fire(inv, workerId: string): (boolean, string)
	Programs.ensure(inv)
	for index, worker in inv.workers do
		if worker.id == workerId then
			table.remove(inv.workers, index)
			return true, `Fired {worker.name}. Wages drop next upkeep.`
		end
	end
	return false, "Worker not found."
end

function Programs.assign(inv, workerId: string, programId: string): (boolean, string)
	Programs.ensure(inv)
	local worker = Programs.findWorker(inv, workerId)
	if not worker then
		return false, "Worker not found."
	end
	local program = Programs.findProgram(inv, programId)
	if not program then
		return false, "Program not found."
	end
	if #(program.nodes or {}) < 1 then
		return false, "Program has no nodes."
	end
	local need = Programs.minGradeForProgram(program)
	if (worker.payGrade or 0) < need then
		return false,
			`{worker.name} refuses “{program.name}” — need {Programs.payTitle(need)} (G{need}); is {Programs.payTitle(worker.payGrade or 0)} (G{worker.payGrade or 0}). Raise pay first.`
	end
	if #program.nodes > Programs.maxNodes(worker) then
		return false, `{worker.name} is a bare robot — max {Programs.maxNodes(worker)} tasks (has {#program.nodes}).`
	end
	worker.job = "program"
	worker.programId = programId
	worker.programStep = 1
	return true, `{worker.name} running “{program.name}” ({#program.nodes} steps)`
end

local function findVendor(id: string, wantBuy: boolean)
	for vendorId, vendor in Economy.VENDORS do
		for _, stockId in vendor.stock do
			if stockId == id then
				return vendorId, vendor
			end
		end
	end
	return nil, nil
end

local function firstOwnedStall(inv): string?
	for districtId, stall in inv.stalls or {} do
		if stall.owned then
			return districtId
		end
	end
	return "training"
end

local function sellFrame(inv): (boolean, string, number)
	if #(inv.assembledFrames or {}) < 1 then
		return false, "No assembled frames to sell. Build one at the workbench slots.", 0
	end
	table.sort(inv.assembledFrames, function(a, b)
		return (a.sellValue or 0) > (b.sellValue or 0)
	end)
	local frame = table.remove(inv.assembledFrames, 1)
	local gained = math.max(Programs.FRAME_BROKER_PRICE, frame.sellValue or 0)
	inv.brass += gained
	inv.brokerFrameStock = math.min(12, (inv.brokerFrameStock or 0) + 1)
	return true, `Sold {frame.name} for {gained} brass. Broker stock {inv.brokerFrameStock}.`, gained
end

local function fieldRepair(inv): (boolean, string)
	if (inv.items.repair_kit or 0) < 1 then
		return false, "Need a Repair Kit (craft at bay: wire + scrap)."
	end
	inv.items.repair_kit -= 1
	if inv.items.repair_kit <= 0 then
		inv.items.repair_kit = nil
	end
	inv.brass += Programs.REPAIR_PAY
	inv.repairsDone = (inv.repairsDone or 0) + 1
	return true, `Repair complete · +{Programs.REPAIR_PAY} brass · jobs done: {inv.repairsDone}`
end

local function pickFlower(inv, worker): (boolean, string)
	local id = FLOWER_IDS[math.floor(math.random() * #FLOWER_IDS) % #FLOWER_IDS + 1]
	Economy.add(inv, id, 1)
	inv.harvestRuns = (inv.harvestRuns or 0) + 1
	local def = Economy.COMMODITIES[id]
	return true, `{worker.name} picked 1× {if def then def.name else id}`
end

local function makeFrame(inv): (boolean, string)
	Frame.ensure(inv)
	if not inv.parcelLeased and not inv.cityWorkshopLeased then
		return false, "Lease a bay before assembling frames."
	end
	if (inv.items.wire or 0) < 1 and (inv.items.polished_wire or 0) < 1 then
		Economy.craft(inv, "wire_from_scrap")
	end
	if (inv.items.gear_blank or 0) < 1 then
		Economy.craft(inv, "gear_blank")
	end
	if (inv.items.fuel_cell or 0) < 1 then
		local vendorId = findVendor("fuel_cell", true)
		if vendorId then
			Economy.buyFromVendor(inv, vendorId, "fuel_cell", 1)
		end
	end
	local hasBloom = false
	for _, id in FLOWER_IDS do
		if (inv.items[id] or 0) > 0 then
			hasBloom = true
			break
		end
	end
	if not hasBloom then
		local vendorId = findVendor("flower_gift", true)
		if vendorId then
			Economy.buyFromVendor(inv, vendorId, "flower_gift", 1)
		end
	end
	local fill = Frame.autoFill(inv)
	return Frame.assemble(inv, fill)
end

function Programs.runNode(inv, worker, node: string): (boolean, string)
	local name = worker.name or "Worker"
	if node == "return_bay" then
		return true, `{name} returned to bay`
	end
	if node == "harvest" then
		local _, _, message = Economy.harvest(inv, math.random)
		return true, `{name}: {message}`
	end
	if node == "pick_flowers" then
		return pickFlower(inv, worker)
	end
	if node == "craft_frame" or node == "craft_fine_frame" then
		local ok, message = makeFrame(inv)
		return ok, `{name}: {message}`
	end
	local recipeId = Programs.CRAFT_RECIPE[node]
	if recipeId then
		local ok, message = Economy.craft(inv, recipeId)
		return ok, `{name}: {message}`
	end
	if node == "craft_custom" then
		local CityRules
		local okReq, loaded = pcall(function()
			return require(script.Parent.CityRules)
		end)
		if okReq then
			CityRules = loaded
			local ok, message = CityRules.craftInvention(inv)
			return ok, `{name}: {message}`
		end
		return false, `{name}: no inventions`
	end
	if node == "invent_recipe" then
		if (worker.payGrade or 0) < Programs.APPRENTICE_GRADE then
			return false, `{name}: invent needs {Programs.payTitle(Programs.APPRENTICE_GRADE)} (G{Programs.APPRENTICE_GRADE})`
		end
		local okReq, CityRules = pcall(function()
			return require(script.Parent.CityRules)
		end)
		if okReq then
			local ok, message = CityRules.invent(inv)
			return ok, `{name}: {message}`
		end
		return false, `{name}: invent desk unavailable`
	end
	if node == "sell_frame" then
		local ok, message = sellFrame(inv)
		return ok, `{name}: {message}`
	end
	if node == "repair" then
		local ok, message = fieldRepair(inv)
		return ok, `{name}: {message}`
	end
	if node == "sell_invention" then
		local okReq, CityRules = pcall(function()
			return require(script.Parent.CityRules)
		end)
		if okReq then
			local ok, message = CityRules.sellInventions(inv)
			return ok, `{name}: {message}`
		end
		return false, `{name}: no inventions in stock`
	end
	if node == "sell_all_harvest" then
		local gained = 0
		local parts = {}
		for _, id in { "cloud_iron", "scrap_brass", "spore_silk", "sky_salt" } do
			local q = inv.items[id] or 0
			if q > 0 then
				local vendorId = findVendor(id, false)
				if vendorId then
					local ok, gold = Economy.sellToVendor(inv, vendorId, id, q)
					if ok then
						gained += gold
						table.insert(parts, `{q}× {Economy.COMMODITIES[id].name}`)
					end
				end
			end
		end
		if #parts == 0 then
			return false, `{name}: no harvest mats to sell`
		end
		return true, `{name} sold harvest ({table.concat(parts, ", ")}) +{gained}`
	end
	if node == "stock_stall_frame" or node == "stock_stall_wire" or node == "stock_stall_scrap" or node == "stock_stall_invention" or node == "stock_stall_goods" then
		local districtId = firstOwnedStall(inv)
		Market.ensureStall(inv, districtId)
		if not inv.stalls[districtId].owned then
			return false, `{name}: lease a stall first`
		end
		if node == "stock_stall_frame" then
			return Market.stockFrame(inv, districtId)
		end
		if node == "stock_stall_invention" then
			local recipe = inv.customRecipes and inv.customRecipes[#inv.customRecipes]
			if not recipe then
				return false, `{name}: no invention to stock`
			end
			return Market.stockInvention(inv, districtId, recipe.id, 1)
		end
		local id = if node == "stock_stall_scrap" then "scrap_brass" else "wire"
		local qty = if node == "stock_stall_scrap" then 5 else 3
		return Market.stockGoods(inv, districtId, id, qty)
	end
	if node == "price_deal_shelf" or node == "price_fair_shelf" or node == "price_premium_shelf" then
		local districtId = firstOwnedStall(inv)
		local policy = if node == "price_deal_shelf" then "deal" elseif node == "price_premium_shelf" then "premium" else "fair"
		local stall = Market.ensureStall(inv, districtId)
		return Market.applyPolicy(inv, stall, policy)
	end
	local tradeId = Programs.TRADE_ITEM[node]
	if tradeId then
		local isBuy = string.sub(node, 1, 4) == "buy_"
		local vendorId = findVendor(tradeId, isBuy)
		if not vendorId then
			return false, `{name}: no vendor trades {Economy.COMMODITIES[tradeId].name}`
		end
		local qty = if string.sub(node, 1, 6) == "buy_5_" then 5 elseif string.sub(node, 1, 9) == "sell_all_" then (inv.items[tradeId] or 0) else 1
		if qty < 1 then
			return false, `{name}: nothing to trade`
		end
		if isBuy then
			local ok, _, message = Economy.buyFromVendor(inv, vendorId, tradeId, qty)
			return ok, `{name}: {message}`
		end
		local ok, _, message = Economy.sellToVendor(inv, vendorId, tradeId, qty)
		return ok, `{name}: {message}`
	end
	return false, `{name}: unknown program step`
end

function Programs.runWorker(inv, worker): (boolean, string)
	if worker.unpaid then
		return false, ""
	end
	local job = worker.job or "harvest"
	if job == "idle" then
		return true, ""
	end
	if job == "program" and worker.programId then
		local program = Programs.findProgram(inv, worker.programId)
		if not program or #(program.nodes or {}) < 1 then
			return false, `{worker.name}: program empty`
		end
		local step = worker.programStep or 1
		if step < 1 or step > #program.nodes then
			step = 1
		end
		local node = program.nodes[step]
		local ok, message = Programs.runNode(inv, worker, node)
		worker.programStep = (step % #program.nodes) + 1
		return ok, message
	end
	if job == "craft" then
		for _, recipe in Economy.RECIPES do
			local ok, message = Economy.craft(inv, recipe.id)
			if ok then
				return true, `{worker.name}: {message}`
			end
		end
		return false, `{worker.name}: missing craft mats`
	end
	if job == "stock" then
		for districtId, stall in inv.stalls or {} do
			if stall.owned then
				local ok, message = Market.stockGoods(inv, districtId, "cloud_iron", 1)
				if not ok then
					ok, message = Market.stockGoods(inv, districtId, "wire", 1)
				end
				return ok, if message then `{worker.name}: {message}` else ""
			end
		end
		return false, `{worker.name}: no stall`
	end
	return Programs.runNode(inv, worker, job)
end

function Programs.payload(inv, log: string?, activeId: string?)
	Programs.ensure(inv)
	local crew = {}
	for _, worker in inv.workers do
		table.insert(crew, {
			id = worker.id,
			name = worker.name,
			kind = worker.kind or "human",
			job = worker.job or "harvest",
			jobName = Programs.jobName(worker.job or "harvest"),
			programId = worker.programId,
			payGrade = worker.payGrade or 0,
			payTitle = Programs.payTitle(worker.payGrade or 0),
			raiseCost = Programs.raiseCost(worker.payGrade or 0),
			unpaid = worker.unpaid == true,
		})
	end
	local programs = {}
	for _, program in inv.programs do
		local steps = {}
		for _, node in program.nodes or {} do
			table.insert(steps, Programs.nodeName(node))
		end
		table.insert(programs, {
			id = program.id,
			name = program.name,
			nodes = program.nodes,
			steps = steps,
			needGrade = Programs.minGradeForProgram(program),
		})
	end
	local jobs = {}
	for _, job in Programs.JOBS do
		if job.id ~= "program" and job.id ~= "craft" and job.id ~= "stock" then
			table.insert(jobs, { id = job.id, name = job.name })
		end
	end
	local nodes = {}
	for _, node in Programs.NODES do
		table.insert(nodes, { id = node.id, name = node.name, category = node.category })
	end
	local templates = {}
	for _, row in Programs.TEMPLATES do
		table.insert(templates, { id = row.id, name = row.name, blurb = row.blurb })
	end
	return {
		crew = crew,
		programs = programs,
		jobs = jobs,
		nodes = nodes,
		templates = templates,
		activeId = activeId or (programs[1] and programs[1].id) or "",
		log = log or "",
		hireCost = if type(inv.brass) == "number" then (35 + #inv.workers * 18) else 35,
		bayLevel = inv.bayLevel or 0,
		leased = inv.parcelLeased == true or inv.cityWorkshopLeased == true,
	}
end

return Programs
