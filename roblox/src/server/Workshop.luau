-- Voss workshop blockout. Coordinates match buildBrotherWorkshop in
-- src/forgeheart/level.ts, multiplied by Scale.STUD_PER_UNIT.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("ForgeHeart")
local Palette = require(Shared:WaitForChild("Palette"))
local Scale = require(Shared:WaitForChild("Scale"))

local LAB_H = 4.2
local FLOOR_TOP = 0.14

local Workshop = {}

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
	part.Position = Vector3.new(Scale.studs(x), Scale.studs(y), Scale.studs(z))
	part.Color = color
	part.Material = material
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	part.Parent = parent
	return part
end

local function prompt(parent: BasePart, action: string, object: string, hold: number): ProximityPrompt
	local p = Instance.new("ProximityPrompt")
	p.ActionText = action
	p.ObjectText = object
	p.HoldDuration = hold
	p.MaxActivationDistance = 8
	p.RequiresLineOfSight = false
	p.KeyboardKeyCode = Enum.KeyCode.E
	p.Parent = parent
	return p
end

function Workshop.spawnCFrame(): CFrame
	-- Feet sit on the floor. The root is about 3 studs above the feet.
	local feetY = Scale.studs(FLOOR_TOP)
	return CFrame.new(Scale.studs(0), feetY + 3, Scale.studs(-5.5))
end

function Workshop.brotherFeet(): Vector3
	return Vector3.new(Scale.studs(0), Scale.studs(FLOOR_TOP), Scale.studs(1.8))
end

export type Built = {
	folder: Folder,
	photo: ProximityPrompt,
	journal: ProximityPrompt,
	theory: ProximityPrompt,
	talisman: ProximityPrompt,
	wrench: ProximityPrompt,
	boat: ProximityPrompt,
	trays: { ProximityPrompt },
	doors: { BasePart },
	sign: TextLabel,
}

function Workshop.build(parent: Instance): Built
	local folder = Instance.new("Folder")
	folder.Name = "VossWorkshop"
	folder.Parent = parent

	box(folder, "Floor", 22, 0.28, 16, 0, 0, 0, Palette.wood, Enum.Material.Wood)
	local stain = box(folder, "OilStain", 5, 0.04, 4, 0, FLOOR_TOP + 0.03, 1, Palette.oil, Enum.Material.Slate, false)
	stain.CanCollide = false

	box(folder, "WallSouth", 22.5, LAB_H, 0.45, 0, LAB_H / 2, -8, Palette.iron, Enum.Material.Metal)
	box(folder, "WallWest", 0.45, LAB_H, 16.5, -11, LAB_H / 2, 0, Palette.iron, Enum.Material.Metal)
	box(folder, "WallEast", 0.45, LAB_H, 16.5, 11, LAB_H / 2, 0, Palette.brassDark, Enum.Material.Metal)
	box(folder, "WallNorthLeft", 9, LAB_H, 0.45, -6.7, LAB_H / 2, 8, Palette.brass, Enum.Material.Metal)
	box(folder, "WallNorthRight", 9, LAB_H, 0.45, 6.7, LAB_H / 2, 8, Palette.brass, Enum.Material.Metal)

	local doorH = LAB_H + 0.05
	local doorLeft = box(folder, "DoorLeft", 2.45, doorH, 0.55, -1.15, doorH / 2, 8, Palette.ironDark, Enum.Material.DiamondPlate)
	local doorRight = box(folder, "DoorRight", 2.45, doorH, 0.55, 1.15, doorH / 2, 8, Palette.ironDark, Enum.Material.DiamondPlate)
	local doorSeam = box(folder, "DoorSeam", 0.28, doorH, 0.63, 0, doorH / 2, 8, Palette.brass, Enum.Material.Metal)
	local lintel = box(folder, "Lintel", 5, 0.35, 0.67, 0, doorH - 0.1, 8, Palette.brass, Enum.Material.Metal)
	local seal = box(folder, "DoorSeal", 4.7, doorH, 0.7, 0, doorH / 2, 8, Palette.iron, Enum.Material.Metal)
	seal.Transparency = 1

	local sign = Instance.new("SurfaceGui")
	sign.Name = "Sign"
	sign.Face = Enum.NormalId.Front
	sign.CanvasSize = Vector2.new(400, 80)
	sign.Parent = lintel
	local signText = Instance.new("TextLabel")
	signText.BackgroundTransparency = 1
	signText.Size = UDim2.fromScale(1, 1)
	signText.Font = Enum.Font.Antique
	signText.Text = "VOSS WORKSHOP"
	signText.TextColor3 = Palette.brass
	signText.TextScaled = true
	signText.Parent = sign

	for _, x in { -1.8, -0.5, 0.5, 1.8 } do
		for _, y in { 0.8, 1.8, 2.9, 3.6 } do
			local rivet = box(folder, "Rivet", 0.14, 0.14, 0.14, x, y, 8.32, Palette.brass, Enum.Material.Metal, false)
			rivet.Shape = Enum.PartType.Ball
		end
	end

	box(folder, "Ceiling", 22, 0.35, 16.5, 0, LAB_H + 0.12, 0, Palette.woodDark, Enum.Material.Wood)
	for _, bx in { -7, 0, 7 } do
		box(folder, "Beam", 0.4, 0.35, 15, bx, LAB_H - 0.3, 0, Palette.wood, Enum.Material.Wood)
	end

	for _, side in { -1, 1 } do
		local x = side * 10.85
		for _, wz in { -4.5, -1.5, 1.5, 4.5 } do
			box(folder, "WindowFrame", 0.2, 2.2, 2.0, x, 1.6, wz, Palette.brassDark, Enum.Material.Metal, false)
			local pane = box(folder, "WindowPane", 0.08, 1.7, 1.55, side * 10.95, 1.6, wz, Palette.glass, Enum.Material.Glass, false)
			pane.Transparency = 0.45
			local lamp = box(folder, "WindowLamp", 0.2, 0.2, 0.2, side * 9.5, 2.2, wz, Palette.amber, Enum.Material.Neon, false)
			lamp.Shape = Enum.PartType.Ball
			local light = Instance.new("PointLight")
			light.Color = Palette.amber
			light.Brightness = 1.1
			light.Range = 28
			light.Parent = lamp
		end
	end

	for _, pz in { -5, -2, 2, 5 } do
		local pipe = box(folder, "Pipe", 10, 0.2, 0.2, 0, 2.6, pz, Palette.copper, Enum.Material.Metal, false)
		pipe.Shape = Enum.PartType.Cylinder
	end

	local gear = box(folder, "Gear", 0.18, 1.8, 1.8, -9, 1.8, -6, Palette.brass, Enum.Material.Metal, false)
	gear.Shape = Enum.PartType.Cylinder
	gear.CFrame = CFrame.new(gear.Position) * CFrame.Angles(0, math.rad(90), 0)

	box(folder, "Bench", 3.2, 0.9, 1.6, 0, 0.45, 0.5, Palette.wood, Enum.Material.Wood)
	box(folder, "TableWest", 1.4, 0.8, 1.0, -2.8, 0.4, 0.2, Palette.woodDark, Enum.Material.Wood)
	box(folder, "TableEast", 1.4, 0.8, 1.0, 2.8, 0.4, 0.2, Palette.woodDark, Enum.Material.Wood)
	box(folder, "TableNorth", 1.4, 0.8, 1.0, 0, 0.4, -1.6, Palette.woodDark, Enum.Material.Wood)

	local benchLight = box(folder, "BenchLight", 0.3, 0.15, 0.3, 0, 3.4, 0.4, Palette.amber, Enum.Material.Neon, false)
	local overhead = Instance.new("PointLight")
	overhead.Color = Color3.fromRGB(255, 214, 160)
	overhead.Brightness = 1.6
	overhead.Range = 36
	overhead.Parent = benchLight

	local frame = box(folder, "Photograph", 0.9, 1.1, 0.08, -3.5, 1.7, -7.7, Palette.brass, Enum.Material.Metal, false)
	box(folder, "PhotographPlate", 0.7, 0.85, 0.02, -3.5, 1.7, -7.62, Palette.photo, Enum.Material.Fabric, false)
	local face = box(folder, "PhotographFace", 0.24, 0.24, 0.02, -3.5, 1.9, -7.6, Palette.skin, Enum.Material.SmoothPlastic, false)
	face.Shape = Enum.PartType.Ball
	local photoPrompt = prompt(frame, "Read", "Photograph", 0.3)

	local function note(name: string, x: number, y: number, z: number, object: string): ProximityPrompt
		local paper = box(folder, name, 0.45, 0.04, 0.35, x, y, z, Palette.paper, Enum.Material.SmoothPlastic, false)
		return prompt(paper, "Read", object, 0.25)
	end

	local journal = note("Journal", 1.2, 1.0, 0.5, "Journal")
	local theory = note("Theory", -1.1, 1.0, 0.6, "Theory")
	local talisman = note("TalismanNote", 0.2, 1.0, -1.5, "Talisman note")

	box(folder, "WrenchRack", 0.8, 1.4, 0.3, 4.5, 0.7, -6.8, Palette.iron, Enum.Material.Metal)
	local wrenchHandle = box(folder, "WrenchHandle", 0.12, 0.7, 0.12, 4.5, 1.05, -6.5, Palette.ironDark, Enum.Material.Metal, false)
	box(folder, "WrenchHead", 0.35, 0.15, 0.2, 4.5, 1.45, -6.5, Palette.brass, Enum.Material.Metal, false)
	local wrenchPrompt = prompt(wrenchHandle, "Take", "Arc wrench", 0.2)
	wrenchPrompt.Enabled = false

	local trays = {}
	local traySpots = {
		{ -2.8, 0.95, 0.2 },
		{ 2.8, 0.95, 0.2 },
		{ 0, 0.95, -1.6 },
	}
	for index, spot in traySpots do
		local tray = box(folder, "Tray" .. index, 0.7, 0.08, 0.5, spot[1], spot[2], spot[3], Palette.brass, Enum.Material.Metal, false)
		tray.Transparency = 1
		local trayPrompt = prompt(tray, "Reclaim", "Tray", 0.25)
		trayPrompt.Enabled = false
		table.insert(trays, trayPrompt)
	end

	-- Exterior dock: apron, deck, walkway, skiff. Same layout as level.ts.
	local function slab(name: string, w: number, d: number, x: number, y: number, z: number, color: Color3, material: Enum.Material)
		box(folder, name, w, 0.28, d, x, y, z, color, material)
	end
	slab("Apron", 8, 5.5, 0, 0.01, 9.2, Palette.brass, Enum.Material.Metal)
	slab("Deck", 12, 7, 0, 0, 13.5, Palette.brass, Enum.Material.Metal)
	slab("Walkway", 4.4, 11, 0, 0, 21, Palette.iron, Enum.Material.DiamondPlate)
	slab("SkiffPad", 7.5, 6.5, 0, 0, 28.5, Palette.wood, Enum.Material.Wood)
	box(folder, "CurbNorth", 12, 0.45, 0.18, 0, 0.28, 17, Palette.iron, Enum.Material.Metal)
	box(folder, "CurbWest", 0.18, 0.45, 7, -6, 0.28, 13.5, Palette.iron, Enum.Material.Metal)
	box(folder, "CurbEast", 0.18, 0.45, 7, 6, 0.28, 13.5, Palette.iron, Enum.Material.Metal)
	box(folder, "RailWest", 0.16, 0.4, 11, -2.3, 0.28, 21, Palette.iron, Enum.Material.Metal)
	box(folder, "RailEast", 0.16, 0.4, 11, 2.3, 0.28, 21, Palette.iron, Enum.Material.Metal)
	box(folder, "RailEnd", 7.5, 0.4, 0.16, 0, 0.28, 31.6, Palette.iron, Enum.Material.Metal)
	local shelf = box(folder, "RecoveryShelf", 14, 0.5, 28, 0, -0.35, 18, Palette.iron, Enum.Material.Slate)
	shelf.Transparency = 1

	box(folder, "Hull", 2.8, 0.8, 4.5, 0, 0.5, 29, Palette.woodDark, Enum.Material.Wood, false)
	box(folder, "Cabin", 1.6, 1.0, 1.8, 0, 1.3, 28.5, Palette.brassDark, Enum.Material.Metal, false)
	local stack = box(folder, "Stack", 0.45, 1.2, 0.45, 0, 2.2, 28.7, Palette.iron, Enum.Material.Metal, false)
	stack.Shape = Enum.PartType.Cylinder
	local controls = box(folder, "SkiffControls", 0.8, 0.5, 0.4, 0, 1.35, 27.6, Palette.brass, Enum.Material.Metal, false)
	local boatPrompt = prompt(controls, "Cast off", "Skiff", 0.6)
	boatPrompt.Enabled = false

	local cloud = box(folder, "CloudSea", 180, 0.4, 120, 0, -9, 36, Color3.fromRGB(184, 196, 208), Enum.Material.SmoothPlastic, false)
	cloud.Transparency = 0.35

	local spawn = Instance.new("SpawnLocation")
	spawn.Name = "WorkshopSpawn"
	spawn.Anchored = true
	spawn.Neutral = true
	spawn.Duration = 0
	spawn.CanCollide = false
	spawn.Transparency = 1
	spawn.Size = Vector3.new(6, 1, 6)
	spawn.CFrame = CFrame.new(Scale.studs(0), Scale.studs(FLOOR_TOP) + 0.5, Scale.studs(-5.5))
	spawn.Parent = folder

	return {
		folder = folder,
		photo = photoPrompt,
		journal = journal,
		theory = theory,
		talisman = talisman,
		wrench = wrenchPrompt,
		boat = boatPrompt,
		trays = trays,
		doors = { doorLeft, doorRight, doorSeam, seal },
		sign = signText,
	}
end

return Workshop
