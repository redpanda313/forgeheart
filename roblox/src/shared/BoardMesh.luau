-- Deck mesh from surfboard.ts buildBoardMesh: 0.85 × 0.12 × 2.8 plus rails and keel.
local Scale
do
	local ok, loaded = pcall(function()
		return require(script.Parent.Scale)
	end)
	if ok then
		Scale = loaded
	else
		Scale = require("./Scale")
	end
end

local BoardMesh = {}

local function box(parent: Instance, name: string, w: number, h: number, d: number, x: number, y: number, z: number, color: Color3, material: Enum.Material): Part
	local part = Instance.new("Part")
	part.Name = name
	part.Anchored = true
	part.CanCollide = false
	part.Massless = true
	part.Size = Vector3.new(Scale.studs(w), Scale.studs(h), Scale.studs(d))
	part.CFrame = CFrame.new(Scale.studs(x), Scale.studs(y), Scale.studs(z))
	part.Color = color
	part.Material = material
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	part.Parent = parent
	return part
end

function BoardMesh.make(parent: Instance, name: string, keelColor: Color3?): Model
	local model = Instance.new("Model")
	model.Name = name
	local deckColor = Color3.fromRGB(232, 212, 168)
	local railColor = Color3.fromRGB(42, 143, 191)
	local keel = keelColor or Color3.fromRGB(102, 224, 255)
	local deck = box(model, "Deck", 0.85, 0.12, 2.8, 0, 0, 0, deckColor, Enum.Material.SmoothPlastic)
	box(model, "Nose", 0.385, 0.1, 0.7, 0, 0.02, 1.5, deckColor, Enum.Material.SmoothPlastic)
	box(model, "RailL", 0.08, 0.16, 2.6, -0.42, 0.02, 0, railColor, Enum.Material.Metal)
	box(model, "RailR", 0.08, 0.16, 2.6, 0.42, 0.02, 0, railColor, Enum.Material.Metal)
	local glow = box(model, "Keel", 0.2, 0.08, 2.2, 0, -0.1, 0, keel, Enum.Material.Neon)
	glow.Transparency = 0.15
	box(model, "Fin", 0.08, 0.45, 0.5, 0, -0.28, -0.9, Color3.fromRGB(184, 146, 58), Enum.Material.Metal)
	box(model, "Pad", 0.5, 0.04, 0.9, 0, 0.1, -0.2, Color3.fromRGB(58, 48, 64), Enum.Material.SmoothPlastic)
	model.PrimaryPart = deck
	model.Parent = parent
	return model
end

return BoardMesh
