-- Block NPCs from npcKit.ts. Sizes are browser units; Scale makes them match the world.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("ForgeHeart")
local Scale = require(Shared:WaitForChild("Scale"))

local NpcKit = {}

local function rgb(hex: number): Color3
	local r = math.floor(hex / 65536) % 256
	local g = math.floor(hex / 256) % 256
	local b = hex % 256
	return Color3.fromRGB(r, g, b)
end

local PALETTES = {
	resident = {
		{ skin = 0xE8C4A8, shirt = 0x5A7A9A, pants = 0x3A3A48, accent = 0xC4A35A, hair = 0x3A2820 },
		{ skin = 0xD4A888, shirt = 0x6A8A5A, pants = 0x4A4038, accent = 0x886644, hair = 0x5A3A20 },
		{ skin = 0xC49878, shirt = 0x8A5A5A, pants = 0x2A2A30, accent = 0xAA8866, hair = 0x1A1210 },
	},
	flyer = {
		{ skin = 0xE0C0A8, shirt = 0x3A6A8A, pants = 0x2A3A48, accent = 0x44C8E8, hair = 0x4A3028 },
	},
	vendor = {
		{ skin = 0xE8C4A0, shirt = 0xC4A35A, pants = 0x4A4038, accent = 0x886622, hair = 0x5A4030 },
		{ skin = 0xD4A888, shirt = 0x8A4A3A, pants = 0x3A3030, accent = 0xC45A3A, hair = 0x2A1814 },
		{ skin = 0xE0C0A8, shirt = 0x3A7A8A, pants = 0x2A3A40, accent = 0x44AACC, hair = 0x4A3028 },
		{ skin = 0xC49878, shirt = 0x5A7A48, pants = 0x3A3A30, accent = 0x88AA44, hair = 0x1A1210 },
		{ skin = 0xF0D0B0, shirt = 0x6A5A8A, pants = 0x3A3048, accent = 0xAA88CC, hair = 0x5A4038 },
	},
	shopkeeper = {
		{ skin = 0xE0B898, shirt = 0x5A6A7A, pants = 0x3A3840, accent = 0xC4A35A, hair = 0x4A3830 },
		{ skin = 0xD4A888, shirt = 0x7A5A48, pants = 0x3A3028, accent = 0xE0A040, hair = 0x2A2018 },
		{ skin = 0xE8C4A8, shirt = 0x4A5A68, pants = 0x2A2A38, accent = 0x88AACC, hair = 0x3A2820 },
	},
	girl = {
		{ skin = 0xF0D0B8, shirt = 0xD47898, pants = 0x6A4058, accent = 0xFFAACC, hair = 0x3A2018 },
		{ skin = 0xE8C8B0, shirt = 0x88A0D0, pants = 0x4A4A68, accent = 0xFFCCDD, hair = 0x8A5030 },
		{ skin = 0xF2D4BC, shirt = 0xE8A070, pants = 0x5A4850, accent = 0xFFE0C0, hair = 0x2A1814 },
	},
	robot_helper = {
		{ skin = 0x8899AA, shirt = 0x6A7A88, pants = 0x4A5560, accent = 0xC4A35A, hair = 0x556677 },
	},
	rogue = {
		{ skin = 0xAA5555, shirt = 0x883333, pants = 0x442222, accent = 0xFF6644, hair = 0x331111 },
	},
}

local function part(model: Model, name: string, w: number, h: number, d: number, x: number, y: number, z: number, color: Color3, material: Enum.Material?): Part
	local piece = Instance.new("Part")
	piece.Name = name
	piece.Anchored = true
	piece.CanCollide = false
	piece.Size = Vector3.new(Scale.studs(w), Scale.studs(h), Scale.studs(d))
	piece.CFrame = CFrame.new(Scale.studs(x), Scale.studs(y), Scale.studs(z))
	piece.Color = color
	piece.Material = material or Enum.Material.SmoothPlastic
	piece.TopSurface = Enum.SurfaceType.Smooth
	piece.BottomSurface = Enum.SurfaceType.Smooth
	piece.Parent = model
	return piece
end

local function cylinder(model: Model, name: string, radius: number, height: number, x: number, y: number, z: number, color: Color3): Part
	local piece = part(model, name, height, radius * 2, radius * 2, x, y, z, color, Enum.Material.SmoothPlastic)
	piece.Shape = Enum.PartType.Cylinder
	piece.CFrame = CFrame.new(Scale.studs(x), Scale.studs(y), Scale.studs(z)) * CFrame.Angles(0, 0, math.rad(90))
	return piece
end

function NpcKit.make(parent: Instance, role: string, variant: number, displayName: string?, feet: Vector3?): Model
	local list = PALETTES[role] or PALETTES.resident
	local pal = list[(variant % #list) + 1]
	local skin = rgb(pal.skin)
	local shirt = rgb(pal.shirt)
	local pants = rgb(pal.pants)
	local accent = rgb(pal.accent)
	local hair = rgb(pal.hair)

	local model = Instance.new("Model")
	model.Name = displayName or role
	local pivot = part(model, "Pivot", 0.2, 0.2, 0.2, 0, 0, 0, shirt)
	pivot.Transparency = 1
	model.PrimaryPart = pivot

	part(model, "Hip", 0.5, 0.22, 0.3, 0, 0.72, 0, pants)
	local torso = part(model, "Torso", 0.55, 0.62, 0.32, 0, 1.15, 0, shirt)
	if role == "rogue" or role == "robot_helper" then
		torso.Material = Enum.Material.Metal
	end
	part(model, "Head", 0.42, 0.42, 0.42, 0, 1.72, 0, skin)
	part(model, "EyeL", 0.08, 0.08, 0.04, -0.1, 1.74, 0.22, Color3.new(1, 1, 1))
	part(model, "EyeR", 0.08, 0.08, 0.04, 0.1, 1.74, 0.22, Color3.new(1, 1, 1))
	local pupil = if role == "rogue" then Color3.fromRGB(255, 34, 34) else Color3.fromRGB(34, 34, 48)
	part(model, "PupilL", 0.045, 0.05, 0.03, -0.1, 1.74, 0.24, pupil, if role == "rogue" then Enum.Material.Neon else nil)
	part(model, "PupilR", 0.045, 0.05, 0.03, 0.1, 1.74, 0.24, pupil, if role == "rogue" then Enum.Material.Neon else nil)
	local smile = if role == "girl" then Color3.fromRGB(208, 96, 128) else Color3.fromRGB(176, 112, 96)
	part(model, "Smile", 0.16, 0.04, 0.03, 0, 1.58, 0.22, smile)

	if role == "girl" then
		part(model, "Hair", 0.48, 0.2, 0.5, 0, 1.92, -0.02, hair)
		part(model, "LockL", 0.14, 0.45, 0.14, -0.28, 1.55, 0, hair)
		part(model, "LockR", 0.14, 0.45, 0.14, 0.28, 1.55, 0, hair)
		part(model, "Skirt", 0.58, 0.35, 0.36, 0, 0.78, 0, accent)
	elseif role == "vendor" or role == "shopkeeper" then
		cylinder(model, "HatBrim", 0.32, 0.04, 0, 1.92, 0, accent)
		cylinder(model, "HatTop", 0.21, 0.2, 0, 2.05, 0, accent)
	elseif role == "resident" and variant % 2 == 0 then
		local brim = cylinder(model, "HatBrim", 0.32, 0.04, 0, 1.94, 0, accent)
		brim.Size = Vector3.new(Scale.studs(0.04), Scale.studs(0.54), Scale.studs(0.54))
	else
		part(model, "Hair", 0.46, 0.12, 0.44, 0, 1.9, -0.04, hair)
	end

	part(model, "LegL", 0.16, 0.5, 0.16, -0.14, 0.38, 0, pants)
	part(model, "LegR", 0.16, 0.5, 0.16, 0.14, 0.38, 0, pants)
	part(model, "FootL", 0.18, 0.12, 0.28, -0.14, 0.08, 0.04, Color3.fromRGB(42, 42, 48))
	part(model, "FootR", 0.18, 0.12, 0.28, 0.14, 0.08, 0.04, Color3.fromRGB(42, 42, 48))
	part(model, "ArmL", 0.16, 0.5, 0.16, -0.4, 1.15, 0, shirt)
	part(model, "ArmR", 0.16, 0.5, 0.16, 0.4, 1.15, 0, shirt)
	part(model, "HandL", 0.14, 0.14, 0.14, -0.4, 0.85, 0, skin)
	part(model, "HandR", 0.14, 0.14, 0.14, 0.4, 0.85, 0, skin)

	if role == "flyer" then
		local board = part(model, "Board", 0.42, 0.08, 1.2, 0, 0.14, 0, Color3.fromRGB(58, 208, 240), Enum.Material.Neon)
		board.CanCollide = false
		part(model, "Fin", 0.06, 0.2, 0.24, 0, 0.28, -0.38, Color3.fromRGB(200, 240, 255), Enum.Material.Neon)
	end

	if displayName and displayName ~= "" then
		local head = model:FindFirstChild("Head")
		local bill = Instance.new("BillboardGui")
		bill.Name = "Nameplate"
		bill.Size = UDim2.fromOffset(140, 28)
		bill.StudsOffset = Vector3.new(0, 1.2, 0)
		bill.AlwaysOnTop = true
		bill.Parent = head
		local label = Instance.new("TextLabel")
		label.BackgroundTransparency = 1
		label.Size = UDim2.fromScale(1, 1)
		label.Font = Enum.Font.Antique
		label.Text = displayName
		label.TextColor3 = Color3.fromRGB(232, 220, 196)
		label.TextStrokeTransparency = 0.45
		label.TextScaled = true
		label.Parent = bill
	end

	model.Parent = parent
	if feet then
		model:PivotTo(CFrame.new(feet))
	end
	return model
end

return NpcKit
