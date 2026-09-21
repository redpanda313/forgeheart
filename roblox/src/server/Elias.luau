-- Elias, disabled on the workshop floor until the Hand wakes him.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("ForgeHeart")
local Palette = require(Shared:WaitForChild("Palette"))
local RobotConfig = require(Shared:WaitForChild("RobotConfig"))
local Scale = require(Shared:WaitForChild("Scale"))

local Elias = {}

local function part(model: Model, name: string, size: Vector3, offset: Vector3, color: Color3, material: Enum.Material): Part
	local p = Instance.new("Part")
	p.Name = name
	p.Anchored = true
	p.CanCollide = false
	p.Size = size
	p.CFrame = CFrame.new(offset)
	p.Color = color
	p.Material = material
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = model
	return p
end

function Elias.create(parent: Instance, feet: Vector3): Model
	local model = Instance.new("Model")
	model.Name = "Elias"
	model:SetAttribute("Awake", false)

	local pivot = part(model, "Pivot", Vector3.new(0.4, 0.4, 0.4), Vector3.zero, Palette.ironDark, Enum.Material.Metal)
	pivot.Transparency = 1
	model.PrimaryPart = pivot

	part(model, "LeftLeg", Vector3.new(0.8, 2, 0.8), Vector3.new(-0.5, 1, 0), Palette.iron, Enum.Material.Metal)
	part(model, "RightLeg", Vector3.new(0.8, 2, 0.8), Vector3.new(0.5, 1, 0), Palette.iron, Enum.Material.Metal)
	local torso = part(model, "Torso", Vector3.new(2, 1.6, 1.1), Vector3.new(0, 2.7, 0), Palette.brass, Enum.Material.Metal)
	part(model, "LeftArm", Vector3.new(0.55, 1.7, 0.55), Vector3.new(-1.35, 2.7, 0), Palette.brassDark, Enum.Material.Metal)
	part(model, "RightArm", Vector3.new(0.55, 1.7, 0.55), Vector3.new(1.35, 2.7, 0), Palette.brassDark, Enum.Material.Metal)
	local head = part(model, "Head", Vector3.new(1.3, 1.15, 1.2), Vector3.new(0, 4.15, 0), Palette.copper, Enum.Material.Metal)

	local function eye(name: string, x: number): Part
		local e = part(model, name, Vector3.new(0.22, 0.22, 0.12), Vector3.new(x, 4.22, -0.58), Palette.eyeDark, Enum.Material.Neon)
		e.Shape = Enum.PartType.Ball
		return e
	end
	eye("EyeLeft", -0.28)
	eye("EyeRight", 0.28)

	local bill = Instance.new("BillboardGui")
	bill.Name = "Nameplate"
	bill.Size = UDim2.fromOffset(120, 28)
	bill.StudsOffset = Vector3.new(0, 1.2, 0)
	bill.AlwaysOnTop = true
	bill.Parent = head
	local label = Instance.new("TextLabel")
	label.BackgroundTransparency = 1
	label.Size = UDim2.fromScale(1, 1)
	label.Font = Enum.Font.Antique
	label.Text = "Elias"
	label.TextColor3 = Palette.paper
	label.TextStrokeTransparency = 0.4
	label.TextScaled = true
	label.Parent = bill

	local wake = Instance.new("ProximityPrompt")
	wake.Name = "WakePrompt"
	wake.ActionText = "Wake"
	wake.ObjectText = "Elias"
	wake.HoldDuration = 0.55
	wake.MaxActivationDistance = 12
	wake.RequiresLineOfSight = false
	wake.KeyboardKeyCode = Enum.KeyCode.E
	wake.Parent = torso

	model.Parent = parent
	-- Face the spawn (toward -Z) and lean, still shut down.
	model:PivotTo(CFrame.new(feet) * CFrame.Angles(math.rad(16), 0, 0))
	return model
end

function Elias.wake(model: Model)
	model:SetAttribute("Awake", true)
	local prompt = model:FindFirstChild("WakePrompt", true)
	if prompt and prompt:IsA("ProximityPrompt") then
		prompt.Enabled = false
	end
	for _, name in { "EyeLeft", "EyeRight" } do
		local eye = model:FindFirstChild(name)
		if eye and eye:IsA("BasePart") then
			eye.Color = Palette.eyeAlive
		end
	end
	local feet = model:GetPivot().Position
	model:PivotTo(CFrame.new(feet.X, feet.Y, feet.Z))
end

function Elias.step(model: Model, target: Vector3, dt: number)
	if model:GetAttribute("Awake") ~= true then
		return
	end
	local pivot = model:GetPivot()
	local pos = pivot.Position
	local flat = Vector3.new(target.X - pos.X, 0, target.Z - pos.Z)
	local dist = flat.Magnitude
	local hold = 7
	if dist <= hold then
		local look = Vector3.new(target.X, pos.Y, target.Z)
		model:PivotTo(CFrame.lookAt(pos, look))
		return
	end
	local speed = Scale.studs(RobotConfig.allySpeed)
	local stepDist = math.min(speed * dt, dist - hold)
	local nextPos = pos + flat.Unit * stepDist
	local look = Vector3.new(target.X, nextPos.Y, target.Z)
	model:PivotTo(CFrame.lookAt(nextPos, look))
end

return Elias
