-- Two demon frames. Numbers come from RobotConfig, distances in studs.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("ForgeHeart")
local Palette = require(Shared:WaitForChild("Palette"))
local RobotConfig = require(Shared:WaitForChild("RobotConfig"))
local Scale = require(Shared:WaitForChild("Scale"))

local Combat = {}

local function part(model: Model, name: string, size: Vector3, offset: Vector3, color: Color3): Part
	local piece = Instance.new("Part")
	piece.Name = name
	piece.Anchored = true
	piece.CanCollide = false
	piece.Size = size
	piece.Color = color
	piece.Material = Enum.Material.Metal
	piece.CFrame = CFrame.new(offset)
	piece.TopSurface = Enum.SurfaceType.Smooth
	piece.BottomSurface = Enum.SurfaceType.Smooth
	piece.Parent = model
	return piece
end

function Combat.spawnDemon(parent: Instance, feet: Vector3, name: string): Model
	local model = Instance.new("Model")
	model.Name = name
	model:SetAttribute("Hp", RobotConfig.maxHp)
	model:SetAttribute("Scramble", 0)
	model:SetAttribute("Phase", "active")

	local pivot = part(model, "Pivot", Vector3.new(0.4, 0.4, 0.4), Vector3.zero, Palette.ironDark)
	pivot.Transparency = 1
	model.PrimaryPart = pivot
	part(model, "LeftLeg", Vector3.new(0.8, 2, 0.8), Vector3.new(-0.5, 1, 0), Palette.ironDark)
	part(model, "RightLeg", Vector3.new(0.8, 2, 0.8), Vector3.new(0.5, 1, 0), Palette.ironDark)
	part(model, "Torso", Vector3.new(2.1, 1.7, 1.2), Vector3.new(0, 2.7, 0), Palette.iron)
	part(model, "Head", Vector3.new(1.3, 1.15, 1.2), Vector3.new(0, 4.15, 0), Palette.ironDark)
	local function eye(eyeName: string, x: number)
		local ball = part(model, eyeName, Vector3.new(0.24, 0.24, 0.12), Vector3.new(x, 4.22, -0.58), Palette.amber)
		ball.Material = Enum.Material.Neon
		ball.Color = Color3.fromRGB(255, 70, 40)
		ball.Shape = Enum.PartType.Ball
	end
	eye("EyeLeft", -0.28)
	eye("EyeRight", 0.28)

	model.Parent = parent
	model:PivotTo(CFrame.new(feet))
	return model
end

function Combat.hit(model: Model): string
	if model:GetAttribute("Phase") ~= "active" then
		return "down"
	end
	local hp = (model:GetAttribute("Hp") or RobotConfig.maxHp) - RobotConfig.arcDamage
	local scramble = math.min(100, (model:GetAttribute("Scramble") or 0) + RobotConfig.scramblePerHit)
	model:SetAttribute("Scramble", scramble)
	if hp <= 0 or scramble >= 100 then
		model:SetAttribute("Hp", math.max(0, hp))
		model:SetAttribute("Phase", "disabled")
		for _, eyeName in { "EyeLeft", "EyeRight" } do
			local eye = model:FindFirstChild(eyeName)
			if eye and eye:IsA("BasePart") then
				eye.Color = Color3.fromRGB(20, 16, 18)
			end
		end
		return if scramble >= 100 then "scrambled" else "disabled"
	end
	model:SetAttribute("Hp", hp)
	return "hit"
end

function Combat.repair(model: Model, dt: number)
	if model:GetAttribute("Phase") ~= "active" then
		return
	end
	local hp = model:GetAttribute("Hp") or 0
	model:SetAttribute("Hp", math.min(RobotConfig.maxHp, hp + RobotConfig.repairPerSec * dt))
end

function Combat.step(model: Model, target: Vector3, dt: number)
	if model:GetAttribute("Phase") ~= "active" then
		return
	end
	local pos = model:GetPivot().Position
	local flat = Vector3.new(target.X - pos.X, 0, target.Z - pos.Z)
	local hold = Scale.studs(1.2)
	if flat.Magnitude <= hold then
		model:PivotTo(CFrame.lookAt(pos, Vector3.new(target.X, pos.Y, target.Z)))
		return
	end
	local speed = Scale.studs(RobotConfig.chaseSpeed)
	local nextPos = pos + flat.Unit * math.min(speed * dt, flat.Magnitude - hold)
	model:PivotTo(CFrame.lookAt(nextPos, Vector3.new(target.X, nextPos.Y, target.Z)))
end

function Combat.meleeRange(): number
	return Scale.studs(RobotConfig.meleeRange)
end

function Combat.arcRange(): number
	return Scale.studs(2.4)
end

return Combat
