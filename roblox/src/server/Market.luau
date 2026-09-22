-- Brass market training yard. Harvest, craft, sell, and the 1000-brass apartment.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("ForgeHeart")
local Economy = require(Shared:WaitForChild("Economy"))
local Palette = require(Shared:WaitForChild("Palette"))
local Scale = require(Shared:WaitForChild("Scale"))

local NpcKit = require(script.Parent.NpcKit)

local Market = {}

local ORIGIN = Vector3.new(0, 0, Scale.studs(220))

local function box(parent: Instance, name: string, size: Vector3, center: Vector3, color: Color3, material: Enum.Material): Part
	local part = Instance.new("Part")
	part.Name = name
	part.Anchored = true
	part.Size = size
	part.Position = center
	part.Color = color
	part.Material = material
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	part.Parent = parent
	return part
end

local function prompt(parent: BasePart, action: string, object: string, reach: number?): ProximityPrompt
	local p = Instance.new("ProximityPrompt")
	p.ActionText = action
	p.ObjectText = object
	p.HoldDuration = 0.35
	p.MaxActivationDistance = reach or 10
	p.RequiresLineOfSight = false
	p.KeyboardKeyCode = Enum.KeyCode.E
	p.Parent = parent
	return p
end

function Market.origin(): Vector3
	return ORIGIN
end

function Market.spawnCFrame(): CFrame
	-- Arrival dock in marketHub.ts: spawn (0, 1.55, 34), facing the plaza.
	local deckTop = Scale.studs(0.35)
	return CFrame.new(ORIGIN + Vector3.new(0, deckTop + 3, Scale.studs(34)))
end

export type Built = {
	folder: Folder,
	reef: ProximityPrompt,
	broker: ProximityPrompt,
	apartment: ProximityPrompt,
	recipes: { [string]: ProximityPrompt },
	spawn: SpawnLocation,
}

function Market.build(parent: Instance): Built
	local folder = Instance.new("Folder")
	folder.Name = "BrassMarket"
	folder.Parent = parent

	local function at(x: number, y: number, z: number): Vector3
		return ORIGIN + Vector3.new(Scale.studs(x), Scale.studs(y), Scale.studs(z))
	end
	local function slab(name: string, w: number, h: number, d: number, x: number, y: number, z: number, color: Color3, material: Enum.Material): Part
		return box(folder, name, Vector3.new(Scale.studs(w), Scale.studs(h), Scale.studs(d)), at(x, y, z), color, material)
	end
	local function disc(name: string, radius: number, height: number, x: number, y: number, z: number, color: Color3, material: Enum.Material): Part
		local part = slab(name, height, radius * 2, radius * 2, x, y, z, color, material)
		part.Shape = Enum.PartType.Cylinder
		part.CFrame = CFrame.new(at(x, y, z)) * CFrame.Angles(0, 0, math.rad(90))
		return part
	end

	disc("Plaza", 22, 0.4, 0, 0.15, 0, Palette.brassDark, Enum.Material.Slate)
	disc("Fountain", 2.4, 0.5, 0, 0.45, 0, Palette.glass, Enum.Material.Glass)
	slab("ArchBeam", 10, 0.4, 0.5, 0, 4.2, 18, Palette.brass, Enum.Material.Metal)
	slab("ArchPostL", 0.4, 4.2, 0.4, -5, 2.1, 18, Palette.brass, Enum.Material.Metal)
	slab("ArchPostR", 0.4, 4.2, 0.4, 5, 2.1, 18, Palette.brass, Enum.Material.Metal)
	local signPart = slab("MarketSign", 10, 1.2, 0.3, 0, 5.2, 18, Palette.brassDark, Enum.Material.Metal)
	local gui = Instance.new("SurfaceGui")
	gui.Face = Enum.NormalId.Front
	gui.CanvasSize = Vector2.new(600, 80)
	gui.Parent = signPart
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.Font = Enum.Font.Antique
	label.Text = "BRASS MARKET"
	label.TextColor3 = Palette.paper
	label.TextScaled = true
	label.Parent = gui

	-- Four vendor stands on the r=12 ring. The broker uses the first counter.
	local brokerPart: BasePart? = nil
	local angles = { -0.9, -0.3, 0.3, 0.9 }
	for index, angle in angles do
		local x = math.cos(angle) * 12
		local z = math.sin(angle) * 12
		local yaw = math.atan2(-x, -z)
		local stand = Instance.new("Model")
		stand.Name = "Vendor" .. index
		stand.Parent = folder
		local pad = slab("Pad", 5.2, 0.22, 4.2, x, 0.2, z, Palette.wood, Enum.Material.Wood)
		pad.Parent = stand
		local counter = slab("Counter", 3.4, 1.0, 0.72, x, 0.62, z, Palette.woodDark, Enum.Material.Wood)
		counter.CFrame = CFrame.new(at(x, 0.62, z)) * CFrame.Angles(0, yaw, 0)
		counter.Parent = stand
		NpcKit.make(stand, "vendor", index - 1, "Vendor", at(x * 1.12, 0.45, z * 1.12))
		if index == 1 then
			brokerPart = counter
		end
	end

	slab("Dock", 14, 0.4, 16, 0, 0.2, 30, Palette.iron, Enum.Material.Slate)
	slab("Bridge", 6, 0.35, 10, 0, 0.22, 22, Palette.iron, Enum.Material.DiamondPlate)
	disc("DockDome", 5, 0.3, 0, 0.35, 30, Palette.brass, Enum.Material.Metal)

	disc("Reef", 10, 0.5, -38, 0.3, 0, Color3.fromRGB(74, 90, 72), Enum.Material.Slate)
	slab("ReefBridge", 14, 0.3, 5, -28, 0.25, 0, Palette.iron, Enum.Material.DiamondPlate)
	local reef = slab("CloudReef", 3, 1.4, 3, -38, 1.1, 0, Color3.fromRGB(90, 110, 120), Enum.Material.Slate)
	local reefPrompt = prompt(reef, "Extract", "Cloud reef")

	disc("Bay", 9, 0.4, 0, 0.2, -36, Palette.ironDark, Enum.Material.Metal)
	slab("BayChest", 1.4, 0.8, 1, 0, 0.7, -36, Palette.brass, Enum.Material.Metal)
	local bench = slab("CraftBench", 3.2, 1, 1.4, -3, 0.65, -34, Palette.woodDark, Enum.Material.Wood)
	local recipes = {}
	local labels = {
		{ "wire_from_scrap", "Draw wire", -1.2 },
		{ "gear_blank", "Stamp gear", -0.4 },
		{ "repair_kit", "Repair kit", 0.4 },
		{ "haul_pack", "Haul pack", 1.2 },
	}
	for _, spec in labels do
		local anchor = slab(spec[1], 0.5, 0.2, 0.5, -3 + spec[3], 1.2, -34, Palette.brass, Enum.Material.Metal)
		recipes[spec[1]] = prompt(anchor, spec[2], "Bench", 6)
	end

	slab("RealEstatePad", 14, 0.3, 12, 42, 0.2, 0, Palette.brassDark, Enum.Material.Slate)
	slab("RealEstateWall", 1, 7, 10, 47, 3.6, 0, Palette.brass, Enum.Material.Metal)
	local desk = slab("RealEstate", 5, 1.6, 2, 42, 1.1, 0, Palette.brass, Enum.Material.Metal)
	local apartment = prompt(desk, "Buy apartment", `{Economy.APARTMENT_COST} brass`)
	NpcKit.make(folder, "shopkeeper", 0, "Clerk", at(42, 0.4, 2))

	slab("HireBoard", 2.2, 2.8, 0.15, 22, 1.8, 14, Palette.paper, Enum.Material.Wood)
	slab("BoardShop", 7, 0.3, 7, 12, 0.2, 28, Palette.wood, Enum.Material.Wood)
	slab("BoardRack", 2.2, 1.2, 0.5, 12, 0.9, 28, Palette.iron, Enum.Material.Metal)

	local broker = prompt(brokerPart :: BasePart, "Sell all", "Broker")

	local standing = Market.spawnCFrame()
	local spawn = Instance.new("SpawnLocation")
	spawn.Name = "MarketSpawn"
	spawn.Anchored = true
	spawn.Neutral = false
	spawn.Duration = 0
	spawn.CanCollide = false
	spawn.Transparency = 1
	spawn.Size = Vector3.new(8, 1, 8)
	spawn.CFrame = CFrame.new(standing.Position.X, ORIGIN.Y + Scale.studs(0.35) - 0.5, standing.Position.Z)
	spawn.Parent = folder

	return {
		folder = folder,
		reef = reefPrompt,
		broker = broker,
		apartment = apartment,
		recipes = recipes,
		spawn = spawn,
	}
end

return Market
