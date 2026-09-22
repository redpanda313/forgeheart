-- Brass market training yard. Harvest, craft, sell, and the 1000-brass apartment.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("ForgeHeart")
local Economy = require(Shared:WaitForChild("Economy"))
local Palette = require(Shared:WaitForChild("Palette"))
local Scale = require(Shared:WaitForChild("Scale"))

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
	return CFrame.new(ORIGIN + Vector3.new(0, 4, Scale.studs(-6)))
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

	local floor = box(folder, "Floor", Vector3.new(Scale.studs(36), 1.2, Scale.studs(28)), ORIGIN, Palette.brassDark, Enum.Material.Metal)
	box(folder, "ReefPad", Vector3.new(Scale.studs(8), 0.4, Scale.studs(8)), ORIGIN + Vector3.new(Scale.studs(-10), 0.8, Scale.studs(4)), Palette.iron, Enum.Material.Slate)
	local reef = box(folder, "CloudReef", Vector3.new(Scale.studs(3), Scale.studs(1.4), Scale.studs(3)), ORIGIN + Vector3.new(Scale.studs(-10), 1.8, Scale.studs(4)), Color3.fromRGB(90, 110, 120), Enum.Material.Slate)
	local reefPrompt = prompt(reef, "Extract", "Cloud reef")

	local stall = box(folder, "BrokerStall", Vector3.new(Scale.studs(4), Scale.studs(2.2), Scale.studs(2)), ORIGIN + Vector3.new(Scale.studs(8), 1.6, Scale.studs(2)), Palette.wood, Enum.Material.Wood)
	local broker = prompt(stall, "Sell all", "Broker")

	local bench = box(folder, "CraftBench", Vector3.new(Scale.studs(6), Scale.studs(1), Scale.studs(2)), ORIGIN + Vector3.new(0, 1, Scale.studs(-2)), Palette.woodDark, Enum.Material.Wood)
	local recipes = {}
	local labels = {
		{ "wire_from_scrap", "Draw wire", -9 },
		{ "gear_blank", "Stamp gear", -3 },
		{ "repair_kit", "Repair kit", 3 },
		{ "haul_pack", "Haul pack", 9 },
	}
	for _, spec in labels do
		local anchor = box(
			folder,
			spec[1],
			Vector3.new(1.6, 0.35, 1.6),
			bench.Position + Vector3.new(spec[3], 0.8, 0),
			Palette.brass,
			Enum.Material.Metal
		)
		recipes[spec[1]] = prompt(anchor, spec[2], "Bench", 2.8)
	end

	local desk = box(folder, "RealEstate", Vector3.new(Scale.studs(5), Scale.studs(1.6), Scale.studs(2)), ORIGIN + Vector3.new(Scale.studs(8), 1.3, Scale.studs(-6)), Palette.brass, Enum.Material.Metal)
	local apartment = prompt(desk, "Buy apartment", `{Economy.APARTMENT_COST} brass`)

	local lamp = box(folder, "MarketLamp", Vector3.new(0.6, 0.6, 0.6), ORIGIN + Vector3.new(0, 8, 0), Palette.amber, Enum.Material.Neon)
	lamp.Shape = Enum.PartType.Ball
	local light = Instance.new("PointLight")
	light.Color = Palette.amber
	light.Brightness = 2
	light.Range = 60
	light.Parent = lamp

	local signPart = box(folder, "MarketSign", Vector3.new(Scale.studs(10), Scale.studs(1.2), 0.4), ORIGIN + Vector3.new(0, 6, Scale.studs(-12)), Palette.brass, Enum.Material.Metal)
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

	floor.Name = "MarketFloor"

	-- Neutral stays off so a new player is not dropped here by accident.
	-- RespawnLocation points a market player at this pad.
	local standing = Market.spawnCFrame()
	local spawn = Instance.new("SpawnLocation")
	spawn.Name = "MarketSpawn"
	spawn.Anchored = true
	spawn.Neutral = false
	spawn.Duration = 0
	spawn.CanCollide = false
	spawn.Transparency = 1
	spawn.Size = Vector3.new(6, 1, 6)
	spawn.CFrame = CFrame.new(standing.Position.X, ORIGIN.Y + 0.1, standing.Position.Z)
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
