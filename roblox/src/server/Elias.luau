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

	local scrap = Instance.new("ProximityPrompt")
	scrap.Name = "ScrapPrompt"
	scrap.ActionText = "Scrap"
	scrap.ObjectText = "Elias"
	scrap.HoldDuration = 0.8
	scrap.MaxActivationDistance = 12
	scrap.RequiresLineOfSight = false
	scrap.KeyboardKeyCode = Enum.KeyCode.R
	scrap.Parent = torso

	model.Parent = parent
	-- Face the spawn (toward -Z) and lean, still shut down.
	model:PivotTo(CFrame.new(feet) * CFrame.Angles(math.rad(16), 0, 0))
	return model
end

function Elias.setName(model: Model, name: string)
	local plate = model:FindFirstChild("Nameplate", true)
	if plate then
		local label = plate:FindFirstChildWhichIsA("TextLabel")
		if label then
			label.Text = name
		end
	end
	local prompt = model:FindFirstChild("WakePrompt", true)
	if prompt and prompt:IsA("ProximityPrompt") then
		prompt.ObjectText = name
	end
	local scrap = model:FindFirstChild("ScrapPrompt", true)
	if scrap and scrap:IsA("ProximityPrompt") then
		scrap.ObjectText = name
	end
end

function Elias.setVisible(model: Model, visible: boolean)
	for _, child in model:GetDescendants() do
		if child:IsA("BasePart") and child.Name ~= "Pivot" then
			child.Transparency = if visible then 0 else 1
		elseif child:IsA("BillboardGui") then
			child.Enabled = visible
		elseif child:IsA("ProximityPrompt") then
			if not visible then
				child.Enabled = false
			end
		end
	end
end

function Elias.rest(model: Model, feet: Vector3)
	model:SetAttribute("Awake", false)
	Elias.setVisible(model, true)
	local wake = model:FindFirstChild("WakePrompt", true)
	if wake and wake:IsA("ProximityPrompt") then
		wake.Enabled = true
	end
	local scrap = model:FindFirstChild("ScrapPrompt", true)
	if scrap and scrap:IsA("ProximityPrompt") then
		scrap.Enabled = true
	end
	for _, name in { "EyeLeft", "EyeRight" } do
		local eye = model:FindFirstChild(name)
		if eye and eye:IsA("BasePart") then
			eye.Color = Palette.eyeDark
			eye.Transparency = 0
		end
	end
	model:PivotTo(CFrame.new(feet) * CFrame.Angles(math.rad(16), 0, 0))
end

function Elias.wake(model: Model)
	model:SetAttribute("Awake", true)
	local prompt = model:FindFirstChild("WakePrompt", true)
	if prompt and prompt:IsA("ProximityPrompt") then
		prompt.Enabled = false
	end
	local scrap = model:FindFirstChild("ScrapPrompt", true)
	if scrap and scrap:IsA("ProximityPrompt") then
		scrap.Enabled = false
	end
	for _, name in { "EyeLeft", "EyeRight" } do
		local eye = model:FindFirstChild(name)
		if eye and eye:IsA("BasePart") then
			eye.Color = Palette.eyeAlive
			eye.Transparency = 0
		end
	end
	local feet = model:GetPivot().Position
	model:PivotTo(CFrame.new(feet.X, feet.Y, feet.Z))
end

local ridePos: Vector3? = nil
local rideYaw = 0
local boardVisual: Model? = nil

function Elias.attachBoard(board: Model)
	boardVisual = board
	board:SetAttribute("Riding", false)
	for _, part in board:GetDescendants() do
		if part:IsA("BasePart") then
			part.Transparency = 1
		end
	end
end

function Elias.step(model: Model, target: Vector3, dt: number)
	if model:GetAttribute("Awake") ~= true then
		return
	end
	ridePos = nil
	if boardVisual then
		boardVisual:SetAttribute("Riding", false)
		for _, part in boardVisual:GetDescendants() do
			if part:IsA("BasePart") then
				part.Transparency = 1
			end
		end
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

function Elias.stepBoard(model: Model, leader: CFrame, dt: number)
	if model:GetAttribute("Awake") ~= true then
		return
	end
	local look = Vector3.new(leader.LookVector.X, 0, leader.LookVector.Z)
	if look.Magnitude < 0.05 then
		look = Vector3.new(0, 0, -1)
	else
		look = look.Unit
	end
	local right = Vector3.new(look.Z, 0, -look.X)
	local target = leader.Position - look * Scale.studs(4.8) - right * Scale.studs(1.1)
	if ridePos == nil then
		ridePos = target
		rideYaw = math.atan2(look.X, look.Z)
	end
	ridePos = (ridePos :: Vector3):Lerp(target, 1 - math.exp(-5.5 * dt))
	local goalYaw = math.atan2(look.X, look.Z)
	local diff = goalYaw - rideYaw
	while diff > math.pi do
		diff -= math.pi * 2
	end
	while diff < -math.pi do
		diff += math.pi * 2
	end
	rideYaw += diff * (1 - math.exp(-7 * dt))
	local face = Vector3.new(math.sin(rideYaw), 0, math.cos(rideYaw))
	local boardAt = Vector3.new(ridePos.X, leader.Position.Y - 2.2, ridePos.Z)
	if boardVisual then
		boardVisual:SetAttribute("Riding", true)
		for _, part in boardVisual:GetDescendants() do
			if part:IsA("BasePart") then
				part.Transparency = if part.Name == "Keel" then 0.15 else 0
			end
		end
		boardVisual:PivotTo(CFrame.lookAt(boardAt, boardAt + face))
	end
	model:PivotTo(CFrame.lookAt(boardAt + Vector3.new(0, Scale.studs(0.12), 0), boardAt + face + Vector3.new(0, Scale.studs(0.12), 0)))
end

return Elias
