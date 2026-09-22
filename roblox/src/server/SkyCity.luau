-- Home ring, plaza, industrial slips, and grand market after the apartment deed.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("ForgeHeart")
local CityRules = require(Shared:WaitForChild("CityRules"))
local Districts = require(Shared:WaitForChild("Districts"))
local Economy = require(Shared:WaitForChild("Economy"))
local Palette = require(Shared:WaitForChild("Palette"))
local Scale = require(Shared:WaitForChild("Scale"))
local Storage = require(Shared:WaitForChild("Storage"))

local CityLayout = require(script.Parent.CityLayout)
local NpcKit = require(script.Parent.NpcKit)

local SkyCity = {}

local DAY = 120

local function world(x: number, y: number, z: number): Vector3
	local wx, wy, wz = Districts.world(x, y, z)
	return Vector3.new(Scale.studs(wx), Scale.studs(wy), Scale.studs(wz))
end

local function box(
	parent: Instance,
	name: string,
	w: number,
	h: number,
	d: number,
	x: number,
	y: number,
	z: number,
	color: Color3,
	material: Enum.Material,
	collide: boolean?
): Part
	local part = Instance.new("Part")
	part.Name = name
	part.Anchored = true
	part.CanCollide = if collide == nil then true else collide
	part.Size = Vector3.new(Scale.studs(w), Scale.studs(h), Scale.studs(d))
	part.Position = world(x, y, z)
	part.Color = color
	part.Material = material
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	part.Parent = parent
	return part
end

local function prompt(parent: BasePart, action: string, object: string, hold: number?): ProximityPrompt
	local p = Instance.new("ProximityPrompt")
	p.ActionText = action
	p.ObjectText = object
	p.HoldDuration = hold or 0.35
	p.MaxActivationDistance = 10
	p.RequiresLineOfSight = false
	p.KeyboardKeyCode = Enum.KeyCode.E
	p.Parent = parent
	return p
end

local function sign(parent: Instance, name: string, text: string, x: number, y: number, z: number, face: Enum.NormalId?)
	local board = box(parent, name, 8, 1.4, 0.2, x, y, z, Palette.brassDark, Enum.Material.Metal)
	local gui = Instance.new("SurfaceGui")
	gui.Face = face or Enum.NormalId.Front
	gui.CanvasSize = Vector2.new(400, 80)
	gui.Parent = board
	local label = Instance.new("TextLabel")
	label.BackgroundTransparency = 1
	label.Size = UDim2.fromScale(1, 1)
	label.Font = Enum.Font.Antique
	label.Text = text
	label.TextColor3 = Palette.paper
	label.TextScaled = true
	label.Parent = gui
	return board
end

local function lamp(parent: Instance, x: number, y: number, z: number)
	local bulb = box(parent, "Lamp", 0.35, 0.35, 0.35, x, y, z, Palette.amber, Enum.Material.Neon, false)
	bulb.Shape = Enum.PartType.Ball
	local light = Instance.new("PointLight")
	light.Color = Palette.amber
	light.Brightness = 1.4
	light.Range = 28
	light.Parent = bulb
end

local function person(parent: Instance, name: string, shirt: Color3): Model
	local model = Instance.new("Model")
	model.Name = name
	local function piece(partName: string, size: Vector3, offset: Vector3, color: Color3): Part
		local part = Instance.new("Part")
		part.Name = partName
		part.Anchored = true
		part.CanCollide = false
		part.Size = size
		part.Color = color
		part.Material = Enum.Material.SmoothPlastic
		part.CFrame = CFrame.new(offset)
		part.Parent = model
		return part
	end
	local pivot = piece("Pivot", Vector3.new(0.4, 0.4, 0.4), Vector3.zero, shirt)
	pivot.Transparency = 1
	model.PrimaryPart = pivot
	piece("Legs", Vector3.new(1.2, 2, 0.7), Vector3.new(0, 1, 0), Palette.ironDark)
	piece("Torso", Vector3.new(1.6, 1.5, 0.8), Vector3.new(0, 2.6, 0), shirt)
	local head = piece("Head", Vector3.new(1.1, 1.1, 1.1), Vector3.new(0, 3.9, 0), Palette.skin)
	local bill = Instance.new("BillboardGui")
	bill.Size = UDim2.fromOffset(140, 28)
	bill.StudsOffset = Vector3.new(0, 1.3, 0)
	bill.AlwaysOnTop = true
	bill.Parent = head
	local label = Instance.new("TextLabel")
	label.BackgroundTransparency = 1
	label.Size = UDim2.fromScale(1, 1)
	label.Font = Enum.Font.Antique
	label.Text = name
	label.TextColor3 = Palette.paper
	label.TextStrokeTransparency = 0.45
	label.TextScaled = true
	label.Parent = bill
	model.Parent = parent
	return model
end

local walkers: { any } = {}
local clock = 0.2
local dressing: Folder? = nil
local plotDressing: Folder? = nil
local rogueModel: Model? = nil
local roguePrompt: ProximityPrompt? = nil
local rogueActive = false
local rogueTarget: Vector3? = nil

local function placeRig(model: Model, feet: Vector3, look: Vector3)
	local flat = Vector3.new(look.X, feet.Y, look.Z)
	if (flat - feet).Magnitude < 0.05 then
		model:PivotTo(CFrame.new(feet))
	else
		model:PivotTo(CFrame.lookAt(feet, flat))
	end
end

local function routePoint(clockT: number, home: Vector3, work: Vector3, market: Vector3): Vector3
	if clockT < 0.15 or clockT >= 0.9 then
		return home
	end
	if clockT < 0.3 then
		return home:Lerp(work, (clockT - 0.15) / 0.15)
	end
	if clockT < 0.55 then
		return work
	end
	if clockT < 0.75 then
		return work:Lerp(market, (clockT - 0.55) / 0.2)
	end
	return market:Lerp(home, (clockT - 0.75) / 0.15)
end

function SkyCity.step(dt: number)
	clock = (clock + dt / DAY) % 1
	for _, walker in walkers do
		local pos = routePoint(clock, walker.home, walker.work, walker.market)
		placeRig(walker.model, pos, walker.work)
	end
	if rogueActive and rogueModel and rogueTarget then
		local pos = rogueModel:GetPivot().Position
		local flat = Vector3.new(rogueTarget.X - pos.X, 0, rogueTarget.Z - pos.Z)
		if flat.Magnitude > 6 then
			local nextPos = pos + flat.Unit * math.min(Scale.studs(1.55) * dt, flat.Magnitude - 6)
			placeRig(rogueModel, Vector3.new(nextPos.X, pos.Y, nextPos.Z), rogueTarget)
		end
	end
end

function SkyCity.setRogueTarget(target: Vector3?)
	rogueTarget = target
end

function SkyCity.roguePosition(): Vector3?
	if rogueModel then
		return rogueModel:GetPivot().Position
	end
	return nil
end

function SkyCity.setRogue(active: boolean)
	rogueActive = active
	if not rogueModel then
		return
	end
	for _, child in rogueModel:GetDescendants() do
		if child:IsA("BasePart") and child.Name ~= "Pivot" then
			child.Transparency = if active then 0 else 1
		elseif child:IsA("BillboardGui") then
			child.Enabled = active
		end
	end
	if roguePrompt then
		roguePrompt.Enabled = active
	end
	local eye = rogueModel:FindFirstChild("Head")
	if eye and eye:IsA("BasePart") then
		eye.Color = if active then Color3.fromRGB(180, 40, 30) else Palette.skin
	end
end

function SkyCity.spawnCFrame(): CFrame
	local x, _, z = Districts.apartmentSpawn()
	local deckTop = Scale.studs(Districts.DECK_Y + Districts.FLOOR_THICK / 2)
	return CFrame.new(world(x, 0, z) + Vector3.new(0, deckTop + 3, 0))
end

local function addWalker(parent: Instance, name: string, shirt: Color3, home: Vector3, work: Vector3, market: Vector3)
	local model = person(parent, name, shirt)
	placeRig(model, home, work)
	table.insert(walkers, { model = model, home = home, work = work, market = market })
end

local function refreshHome(homeState)
	if not dressing then
		return
	end
	dressing:ClearAllChildren()
	local tier = homeState.tier or "cottage"
	local skirt = if tier == "island"
		then 18
		elseif tier == "estate" then 14
		elseif tier == "manor" then 10
		elseif tier == "house" then 6
		else 0
	if skirt > 0 then
		box(dressing, "HomeSkirt", 14 + skirt, 0.25, 12 + skirt, -32, 0.28, 22, Palette.wood, Enum.Material.Wood)
	end
	local function has(kind: string): boolean
		for _, room in homeState.rooms or {} do
			if room == kind then
				return true
			end
		end
		return false
	end
	if has("garden") then
		box(dressing, "GardenCourt", 4, 0.15, 4, -38, 0.45, 24, Color3.fromRGB(70, 120, 70), Enum.Material.Grass)
		box(dressing, "GardenBloom", 0.6, 0.8, 0.6, -38, 0.9, 24, Color3.fromRGB(180, 90, 120), Enum.Material.Neon, false)
	end
	if has("gallery") then
		box(dressing, "Gallery", 3.2, 2.2, 2.6, -26, 1.4, 23, Palette.glass, Enum.Material.Glass)
	end
	if has("workshop") then
		box(dressing, "HomeWorkshop", 3.4, 2, 2.8, -26, 1.3, 19, Palette.brassDark, Enum.Material.Metal)
	end
	if has("invent_lab") then
		box(dressing, "InventLab", 2.8, 2, 2.4, -38, 1.3, 19, Palette.copper, Enum.Material.Metal)
	end
end

function SkyCity.build(parent: Instance)
	local folder = Instance.new("Folder")
	folder.Name = "SkyCity"
	folder.Parent = parent
	table.clear(walkers)

	local layout = CityLayout.build(folder)
	dressing = layout.dressing
	plotDressing = layout.plotDressing

	local function peg(name: string, near: BasePart, dx: number, dz: number): Part
		local part = near:Clone()
		part.Name = name
		part.Size = Vector3.new(1.2, 1.4, 0.3)
		part.CFrame = near.CFrame + Vector3.new(dx, 0, dz)
		part.Parent = near.Parent
		return part
	end

	local neighbors = {}
	local debts = {}
	local hires = {}
	for _, spot in layout.neighbors do
		local talk = prompt(spot.part, "Talk", spot.name, 0.25)
		table.insert(neighbors, { id = spot.id, prompt = talk })
		if spot.id == "neighbor_pip" then
			debts[spot.id] = prompt(peg("PipDebt", spot.part, -6, 4), "Clear debt", "1,200", 0.4)
			hires[spot.id] = prompt(peg("PipHire", spot.part, -8, 2), "Hire neighbor", spot.name, 0.4)
		elseif spot.id == "neighbor_bolt" then
			debts[spot.id] = prompt(peg("BoltDebt", spot.part, 4, 4), "Clear debt", "6,500", 0.4)
			hires[spot.id] = prompt(peg("BoltHire", spot.part, 6, 2), "Hire neighbor", spot.name, 0.4)
		elseif spot.id == "neighbor_sera" then
			hires[spot.id] = prompt(peg("SeraHire", spot.part, -6, 2), "Hire neighbor", spot.name, 0.4)
		end
	end

	local homePrompt = prompt(layout.home, "Improve", "Cottage", 0.4)
	local stallOffices = {}
	for districtId, stallPart in layout.stalls do
		local dist = Districts.byId(districtId)
		local cost = if dist then dist.stallCost else 90
		local name = if dist then dist.name else districtId
		stallOffices[districtId] = {
			lease = prompt(stallPart, "Lease stall", `{name} · {cost}`, 0.45),
			office = prompt(stallPart, "Stall office", name, 0.25),
		}
	end
	local stallPrompt = stallOffices.residential.lease
	local stockPrompt = stallOffices.residential.office
	local grandStallPrompt = stallOffices.grand_market.lease
	local industrialStallPrompt = stallOffices.industrial.lease

	local romancePrompts = {}
	for id, spot in layout.romance or {} do
		if spot.part then
			romancePrompts[id] = prompt(spot.part, "Talk", spot.name, 0.25)
		end
	end

	local vaultPrompts = {}
	for track, part in layout.vaults or {} do
		vaultPrompts[track] = prompt(part, "Vault", Storage.trackLabel(track), 0.3)
	end
	local leasePrompt = prompt(layout.workshop, "Lease workshop", "80 brass", 0.45)
	local hirePrompt = prompt(layout.hire, "Hire", "Crew", 0.4)
	local expandPrompt = prompt(layout.expand, "Expand bay", "Workshop", 0.4)
	local inventPrompt = prompt(layout.invent, "Invent", "Desk", 0.5)
	local craftPrompt = prompt(layout.invent, "Craft invention", "Latest recipe", 0.35)
	local assemblePrompt = prompt(peg("Assemble", layout.invent, 4, 0), "Assemble frame", "Five slots", 0.4)
	local robotPrompt = prompt(layout.robot, "Buy chassis", "120 brass", 0.45)
	local reefPrompts = {}
	for districtId, reefPart in layout.reefs or {} do
		reefPrompts[districtId] = prompt(reefPart, "Extract", "Cloud reef", 0)
	end
	local reefPrompt = reefPrompts.grand_market
	local brokerPrompt = prompt(layout.broker, "Sell all", "Broker", 0.3)
	local plotPrompt = prompt(layout.plot, "Buy plot", "16,560 brass", 0.5)
	local decorPrompt = prompt(layout.plot, "Place décor", "1,800", 0.4)
	local gardenPrompt = prompt(layout.plot, "Plant garden", "5,500", 0.4)
	local ferryPrompt = prompt(layout.ferry, "Training market", "Ferry", 0.5)
	local boardShopPrompt = prompt(layout.boardShop, "Board shop", "Buy once, ride forever", 0.35)

	local recipes = {}
	local labels = {
		{ "wire_from_scrap", "Draw wire", -2.2 },
		{ "gear_blank", "Stamp gear", -0.7 },
		{ "repair_kit", "Repair kit", 0.7 },
		{ "haul_pack", "Haul pack", 2.2 },
	}
	for _, spec in labels do
		local anchor = box(folder, spec[1], 0.5, 0.2, 0.5, 0, 1.4, 0, Palette.brass, Enum.Material.Metal, false)
		anchor.CFrame = layout.bench.CFrame * CFrame.new(Scale.studs(spec[3]), Scale.studs(0.7), 0)
		recipes[spec[1]] = prompt(anchor, spec[2], "Bench", 0.25)
		recipes[spec[1]].MaxActivationDistance = 8
	end

	local standing = SkyCity.spawnCFrame()
	local deckTop = Scale.studs(Districts.DECK_Y + Districts.FLOOR_THICK / 2)
	local spawn = Instance.new("SpawnLocation")
	spawn.Name = "CitySpawn"
	spawn.Anchored = true
	-- Neutral so death uses this pad when it is RespawnLocation.
	spawn.Neutral = true
	spawn.Duration = 0
	spawn.CanCollide = false
	spawn.Transparency = 1
	spawn.Size = Vector3.new(6, 1, 6)
	spawn.CFrame = CFrame.new(standing.Position.X, deckTop - 0.5, standing.Position.Z)
	spawn.Parent = folder

	local industrial = Districts.byId("industrial")
	rogueModel = NpcKit.make(folder, "rogue", 0, "Slip chassis", world(industrial.x + 12, 0.55, industrial.z + 4))
	local rogueTorso = rogueModel:FindFirstChild("Torso")
	if rogueTorso and rogueTorso:IsA("BasePart") then
		roguePrompt = prompt(rogueTorso, "Repair", "Rogue chassis", 0.45)
	end
	SkyCity.setRogue(false)

	local plotX = layout.plotX
	local plotZ = layout.plotZ
	local function refreshPlot(plot)
		if not plotDressing then
			return
		end
		plotDressing:ClearAllChildren()
		if not plot or not plot.owned then
			return
		end
		for _, kind in plot.buildings or {} do
			if kind == "decor" then
				box(plotDressing, "PlotDecor", 1.2, 1.6, 1.2, plotX, 1.1, plotZ, Palette.brass, Enum.Material.Metal)
			elseif kind == "garden" then
				box(plotDressing, "PlotGarden", 4, 0.2, 4, plotX + 3, 0.5, plotZ, Color3.fromRGB(70, 120, 70), Enum.Material.Grass)
			elseif kind == "apartment" then
				box(plotDressing, "PlotApartment", 4, 3, 3, plotX - 3, 1.7, plotZ, Palette.wood, Enum.Material.Wood)
			elseif kind == "retail" then
				box(plotDressing, "PlotRetail", 3, 2, 2, plotX, 1.2, plotZ + 3, Palette.paper, Enum.Material.Wood)
			elseif kind == "factory" then
				box(plotDressing, "PlotFactory", 4, 2.4, 3, plotX, 1.4, plotZ - 3, Palette.iron, Enum.Material.Metal)
			end
		end
	end

	refreshHome({ tier = "cottage", rooms = { "living" } })

	return {
		folder = folder,
		neighbors = neighbors,
		home = homePrompt,
		stall = stallPrompt,
		stock = stockPrompt,
		grandStall = grandStallPrompt,
		industrialStall = industrialStallPrompt,
		invent = inventPrompt,
		craft = craftPrompt,
		assemble = assemblePrompt,
		robot = robotPrompt,
		plot = plotPrompt,
		decor = decorPrompt,
		garden = gardenPrompt,
		debts = debts,
		hires = hires,
		repair = roguePrompt,
		refreshPlot = refreshPlot,
		workshop = leasePrompt,
		hire = hirePrompt,
		expand = expandPrompt,
		reef = reefPrompt,
		reefs = reefPrompts,
		broker = brokerPrompt,
		recipes = recipes,
		ferry = ferryPrompt,
		boardShop = boardShopPrompt,
		spawn = spawn,
		refreshHome = refreshHome,
		rules = CityRules,
		economy = Economy,
		stallOffices = stallOffices,
		romance = romancePrompts,
		vaults = vaultPrompts,
	}
end

return SkyCity
