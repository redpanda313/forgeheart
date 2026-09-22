-- Home ring, plaza, industrial slips, and grand market after the apartment deed.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("ForgeHeart")
local CityRules = require(Shared:WaitForChild("CityRules"))
local Economy = require(Shared:WaitForChild("Economy"))
local Palette = require(Shared:WaitForChild("Palette"))
local Scale = require(Shared:WaitForChild("Scale"))

local SkyCity = {}

local CITY_Z = 520
local DAY = 120

local function world(x: number, y: number, z: number): Vector3
	return Vector3.new(Scale.studs(x), Scale.studs(y), Scale.studs(CITY_Z + z))
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
	return CFrame.new(world(0, 0, -6) + Vector3.new(0, 4, 0))
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
		box(dressing, "HomeSkirt", 14 + skirt, 0.25, 12 + skirt, 0, 0.28, 2, Palette.wood, Enum.Material.Wood)
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
		box(dressing, "GardenCourt", 4, 0.15, 4, -6, 0.45, 4, Color3.fromRGB(70, 120, 70), Enum.Material.Grass)
		box(dressing, "GardenBloom", 0.6, 0.8, 0.6, -6, 0.9, 4, Color3.fromRGB(180, 90, 120), Enum.Material.Neon, false)
	end
	if has("gallery") then
		box(dressing, "Gallery", 3.2, 2.2, 2.6, 6, 1.4, 3, Palette.glass, Enum.Material.Glass)
	end
	if has("workshop") then
		box(dressing, "HomeWorkshop", 3.4, 2, 2.8, 6, 1.3, -1, Palette.brassDark, Enum.Material.Metal)
	end
	if has("invent_lab") then
		box(dressing, "InventLab", 2.8, 2, 2.4, -6, 1.3, -1, Palette.copper, Enum.Material.Metal)
	end
end

function SkyCity.build(parent: Instance)
	local folder = Instance.new("Folder")
	folder.Name = "SkyCity"
	folder.Parent = parent
	dressing = Instance.new("Folder")
	dressing.Name = "HomeDressing"
	dressing.Parent = folder
	table.clear(walkers)

	local function pad(name: string, w: number, d: number, x: number, z: number, color: Color3, material: Enum.Material?)
		return box(folder, name, w, 0.45, d, x, 0.15, z, color, material or Enum.Material.Concrete)
	end

	pad("HomePad", 16, 14, 0, 2, Palette.wood, Enum.Material.Wood)
	pad("PipPad", 8, 8, -18, 16, Palette.woodDark, Enum.Material.Wood)
	pad("SeraPad", 8, 8, 18, 16, Palette.woodDark, Enum.Material.Wood)
	pad("BoltPad", 8, 8, 0, 28, Palette.iron, Enum.Material.DiamondPlate)
	pad("Plaza", 28, 18, 0, -22, Palette.brassDark, Enum.Material.Slate)
	pad("Industrial", 22, 16, -62, -22, Palette.iron, Enum.Material.DiamondPlate)
	pad("GrandMarket", 22, 16, 62, -22, Palette.brass, Enum.Material.Metal)
	pad("Harbor", 18, 12, 0, -58, Palette.ironDark, Enum.Material.Slate)
	pad("ClocktowerPad", 14, 14, 0, -92, Palette.brassDark, Enum.Material.Metal)

	local function span(name: string, w: number, d: number, x: number, z: number)
		box(folder, name, w, 0.28, d, x, 0.2, z, Palette.iron, Enum.Material.DiamondPlate)
	end
	span("WalkHomePlaza", 4, 12, 0, -10)
	span("WalkPip", 10, 3, -10, 12)
	span("WalkSera", 10, 3, 10, 12)
	span("WalkBolt", 3, 10, 0, 20)
	span("WalkIndustrial", 28, 4, -32, -22)
	span("WalkMarket", 28, 4, 32, -22)
	span("WalkHarbor", 4, 16, 0, -42)
	span("WalkTower", 4, 16, 0, -76)

	box(folder, "SkyLane", 120, 0.15, 2.2, 0, 6, -22, Color3.fromRGB(80, 200, 220), Enum.Material.Neon, false)
	box(folder, "SkyLaneSouth", 2.2, 0.15, 70, 0, 6, -56, Color3.fromRGB(80, 200, 220), Enum.Material.Neon, false)

	box(folder, "Cottage", 6, 3.2, 5, 0, 1.8, 2, Palette.wood, Enum.Material.Wood)
	box(folder, "CottageRoof", 6.6, 0.35, 5.6, 0, 3.5, 2, Palette.brass, Enum.Material.Metal)
	local door = box(folder, "CottageDoor", 1.4, 2.2, 0.2, 0, 1.3, -0.6, Palette.woodDark, Enum.Material.Wood)
	local homePrompt = prompt(door, "Improve", "Cottage", 0.4)

	local function house(name: string, x: number, z: number, color: Color3): ProximityPrompt
		box(folder, name .. "Walls", 4.2, 2.6, 3.6, x, 1.5, z, color, Enum.Material.Wood)
		box(folder, name .. "Roof", 4.6, 0.3, 4, x, 2.9, z, Palette.brassDark, Enum.Material.Metal)
		local knocker = box(folder, name .. "Door", 1.1, 1.8, 0.16, x, 1.1, z - 1.8, Palette.paper, Enum.Material.Wood)
		return prompt(knocker, "Talk", name, 0.25)
	end

	local neighbors = {
		{ id = "neighbor_pip", prompt = house("Pip Harper", -18, 16, Palette.wood) },
		{ id = "neighbor_sera", prompt = house("Sera Quinn", 18, 16, Color3.fromRGB(90, 110, 120)) },
		{ id = "neighbor_bolt", prompt = house("Bolt Voss", 0, 28, Palette.iron) },
	}

	box(folder, "Fountain", 2.2, 1.1, 2.2, 0, 0.9, -22, Palette.glass, Enum.Material.Glass, false)
	local stallDesk = box(folder, "PlazaStall", 3, 1.6, 2, -8, 1.1, -24, Palette.wood, Enum.Material.Wood)
	local stallPrompt = prompt(stallDesk, "Lease stall", "Residential · 90", 0.45)
	local stockPrompt = prompt(stallDesk, "Stock shelf", "Residential stall", 0.3)
	local marketStall = box(folder, "GrandStall", 3, 1.6, 2, 54, 1.1, -16, Palette.wood, Enum.Material.Wood)
	local grandStallPrompt = prompt(marketStall, "Lease stall", "Grand Market · 280", 0.45)
	local industrialStall = box(folder, "IndustrialStall", 3, 1.4, 2, -54, 1, -28, Palette.iron, Enum.Material.Metal)
	local industrialStallPrompt = prompt(industrialStall, "Lease stall", "Industrial · 160", 0.45)

	local slip = box(folder, "WorkshopSlip", 8, 2.4, 5, -62, 1.4, -22, Palette.ironDark, Enum.Material.Metal)
	local leasePrompt = prompt(slip, "Lease workshop", "80 brass", 0.45)
	local hireDesk = box(folder, "HireBoard", 2.2, 1.8, 0.3, -54, 1.2, -18, Palette.paper, Enum.Material.Wood)
	local hirePrompt = prompt(hireDesk, "Hire", "Crew", 0.4)
	local expandDesk = box(folder, "ExpandBay", 2.2, 1.4, 0.3, -70, 1, -18, Palette.brass, Enum.Material.Metal)
	local expandPrompt = prompt(expandDesk, "Expand bay", "Workshop", 0.4)
	local inventDesk = box(folder, "InventDesk", 2.4, 1.2, 1.2, -66, 0.9, -28, Palette.copper, Enum.Material.Metal)
	local inventPrompt = prompt(inventDesk, "Invent", "Desk", 0.5)
	local craftPrompt = prompt(inventDesk, "Craft invention", "Latest recipe", 0.35)
	local robotDesk = box(folder, "RobotDock", 2, 1.2, 1.4, -58, 0.9, -26, Palette.ironDark, Enum.Material.Metal)
	local robotPrompt = prompt(robotDesk, "Buy chassis", "120 brass", 0.45)

	local reef = box(folder, "CityReef", 3, 1.3, 3, 56, 1, -20, Color3.fromRGB(90, 110, 120), Enum.Material.Slate)
	local reefPrompt = prompt(reef, "Extract", "Cloud reef", 0.3)
	local broker = box(folder, "CityBroker", 3.2, 1.8, 1.6, 68, 1.2, -20, Palette.wood, Enum.Material.Wood)
	local brokerPrompt = prompt(broker, "Sell all", "Broker", 0.3)
	local bench = box(folder, "CityBench", 6, 1, 2, 62, 0.8, -26, Palette.woodDark, Enum.Material.Wood)
	local recipes = {}
	local labels = {
		{ "wire_from_scrap", "Draw wire", -2.2 },
		{ "gear_blank", "Stamp gear", -0.7 },
		{ "repair_kit", "Repair kit", 0.7 },
		{ "haul_pack", "Haul pack", 2.2 },
	}
	for _, spec in labels do
		local anchor = box(folder, spec[1], 0.5, 0.2, 0.5, 62 + spec[3], 1.4, -26, Palette.brass, Enum.Material.Metal)
		recipes[spec[1]] = prompt(anchor, spec[2], "Bench", 0.25)
		recipes[spec[1]].MaxActivationDistance = 4
	end

	pad("PlotPad", 12, 12, 16, -40, Palette.wood, Enum.Material.Wood)
	plotDressing = Instance.new("Folder")
	plotDressing.Name = "PlotDressing"
	plotDressing.Parent = folder
	local plotSign = box(folder, "PlotOffice", 2.4, 1.6, 1.2, 16, 1.1, -34, Palette.brass, Enum.Material.Metal)
	local plotPrompt = prompt(plotSign, "Buy plot", "16,560 brass", 0.5)
	local decorPrompt = prompt(plotSign, "Place décor", "1,800", 0.4)
	local gardenPrompt = prompt(plotSign, "Plant garden", "5,500", 0.4)

	local function sidePrompt(name: string, action: string, object: string, x: number, z: number): ProximityPrompt
		local peg = box(folder, name, 0.6, 1.2, 0.2, x, 0.8, z, Palette.paper, Enum.Material.Wood)
		return prompt(peg, action, object, 0.4)
	end
	local debts = {
		neighbor_pip = sidePrompt("PipDebt", "Clear debt", "1,200", -16, 12),
		neighbor_bolt = sidePrompt("BoltDebt", "Clear debt", "6,500", 2, 24),
	}
	local hires = {
		neighbor_pip = sidePrompt("PipHire", "Hire neighbor", "Pip Harper", -20, 12),
		neighbor_sera = sidePrompt("SeraHire", "Hire neighbor", "Sera Quinn", 16, 12),
		neighbor_bolt = sidePrompt("BoltHire", "Hire neighbor", "Bolt Voss", -2, 24),
	}

	local ferry = box(folder, "Ferry", 3, 1.2, 2, 0, 0.9, -64, Palette.wood, Enum.Material.Wood)
	local ferryPrompt = prompt(ferry, "Training market", "Ferry", 0.5)

	sign(folder, "CitySign", "SKY CITY", 0, 5, -14, Enum.NormalId.Back)
	sign(folder, "IndustrialSign", "INDUSTRIAL SLIPS", -62, 4.2, -14, Enum.NormalId.Back)
	sign(folder, "MarketSign", "GRAND MARKET", 62, 4.2, -14, Enum.NormalId.Front)
	sign(folder, "HarborSign", "CLOUD HARBOR", 0, 3.6, -52, Enum.NormalId.Back)
	sign(folder, "TowerSign", "CLOCKTOWER", 0, 6, -92, Enum.NormalId.Front)
	box(folder, "Tower", 2.2, 8, 2.2, 0, 4.2, -92, Palette.brass, Enum.Material.Metal)
	box(folder, "TowerClock", 0.4, 1.4, 1.4, 0, 7.2, -90.7, Palette.paper, Enum.Material.SmoothPlastic, false)

	lamp(folder, 0, 4, 2)
	lamp(folder, 0, 4, -22)
	lamp(folder, -62, 4, -22)
	lamp(folder, 62, 4, -22)

	local sea = box(folder, "CityCloud", 220, 0.4, 160, 0, -8, -30, Color3.fromRGB(184, 196, 208), Enum.Material.SmoothPlastic, false)
	sea.Transparency = 0.4

	local feetY = world(0, 0.45, 0).Y
	local function feet(x: number, z: number): Vector3
		return Vector3.new(world(x, 0, z).X, feetY, world(x, 0, z).Z)
	end
	local marketSpot = feet(62, -22)
	addWalker(folder, "Pip Harper", Color3.fromRGB(90, 140, 170), feet(-18, 16), marketSpot, marketSpot)
	addWalker(folder, "Sera Quinn", Color3.fromRGB(180, 120, 70), feet(18, 16), feet(0, -22), marketSpot)
	addWalker(folder, "Bolt Voss", Palette.iron, feet(0, 28), feet(-62, -22), feet(0, -22))
	addWalker(folder, "Resident", Palette.copper, feet(0, -58), feet(0, -22), marketSpot)
	addWalker(folder, "Courier", Palette.brass, feet(-62, -22), feet(62, -22), feet(0, -58))

	refreshHome({ tier = "cottage", rooms = { "living" } })

	local standing = SkyCity.spawnCFrame()
	local floorTop = Scale.studs(0.34)
	local spawn = Instance.new("SpawnLocation")
	spawn.Name = "CitySpawn"
	spawn.Anchored = true
	spawn.Neutral = false
	spawn.Duration = 0
	spawn.CanCollide = false
	spawn.Transparency = 1
	spawn.Size = Vector3.new(6, 1, 6)
	spawn.CFrame = CFrame.new(standing.Position.X, floorTop - 0.5, standing.Position.Z)
	spawn.Parent = folder

	rogueModel = person(folder, "Slip chassis", Palette.ironDark)
	placeRig(rogueModel, feet(-62, -16), feet(-62, -22))
	local rogueTorso = rogueModel:FindFirstChild("Torso")
	if rogueTorso and rogueTorso:IsA("BasePart") then
		roguePrompt = prompt(rogueTorso, "Repair", "Rogue chassis", 0.45)
	end
	SkyCity.setRogue(false)

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
				box(plotDressing, "PlotDecor", 1.2, 1.6, 1.2, 14, 1.1, -42, Palette.brass, Enum.Material.Metal)
			elseif kind == "garden" then
				box(plotDressing, "PlotGarden", 4, 0.2, 4, 16, 0.5, -42, Color3.fromRGB(70, 120, 70), Enum.Material.Grass)
			elseif kind == "apartment" then
				box(plotDressing, "PlotApartment", 4, 3, 3, 18, 1.7, -40, Palette.wood, Enum.Material.Wood)
			elseif kind == "retail" then
				box(plotDressing, "PlotRetail", 3, 2, 2, 12, 1.2, -40, Palette.paper, Enum.Material.Wood)
			elseif kind == "factory" then
				box(plotDressing, "PlotFactory", 4, 2.4, 3, 16, 1.4, -44, Palette.iron, Enum.Material.Metal)
			end
		end
	end

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
		broker = brokerPrompt,
		recipes = recipes,
		ferry = ferryPrompt,
		spawn = spawn,
		refreshHome = refreshHome,
		rules = CityRules,
		economy = Economy,
	}
end

return SkyCity
