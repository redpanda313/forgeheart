-- Q mount, WASD ride, Shift powerslide, Space/J jump, Tab camera.
-- Physics stay in browser units; the character CFrame is scaled to studs.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("ForgeHeart")
local Board = require(Shared:WaitForChild("Board"))
local BoardMesh = require(Shared:WaitForChild("BoardMesh"))
local Scale = require(Shared:WaitForChild("Scale"))
local Skyways = require(Shared:WaitForChild("Skyways"))

local BoardRide = {}

local HIP = 2.4
local routes = Skyways.routes()

local function studsToUnits(v: Vector3): (number, number, number)
	return v.X / Scale.STUD_PER_UNIT, v.Y / Scale.STUD_PER_UNIT, v.Z / Scale.STUD_PER_UNIT
end

local function deckRay(x: number, z: number, ignore: { Instance }): number?
	local params = RaycastParams.new()
	params.FilterType = Enum.RaycastFilterType.Exclude
	params.FilterDescendantsInstances = ignore
	local origin = Vector3.new(Scale.studs(x), 400, Scale.studs(z))
	local hit = Workspace:Raycast(origin, Vector3.new(0, -900, 0), params)
	if not hit or not hit.Instance:IsA("BasePart") then
		return nil
	end
	if hit.Instance.CanCollide ~= true then
		return nil
	end
	if hit.Instance.Name == "Cloud" or hit.Instance.Parent and hit.Instance.Parent.Name == "CloudSea" then
		return nil
	end
	return hit.Position.Y / Scale.STUD_PER_UNIT
end

local function sampleFloor(x: number, z: number, ignore: { Instance }): number?
	local sky = Skyways.sampleFloor(x, z, routes)
	local deck = deckRay(x, z, ignore)
	if sky and deck then
		return math.max(sky, deck)
	end
	return sky or deck
end

function BoardRide.start(gui: ScreenGui)
	local player = Players.LocalPlayer
	local remotes = Shared:WaitForChild("Remotes")
	local toggleRemote = remotes:WaitForChild("ToggleBoard")
	local shopRemote = remotes:WaitForChild("BoardShop")
	local openShop = remotes:WaitForChild("OpenBoardShop")

	local keys = {}
	local state = nil
	local lastSafe = nil
	local camMode = "third"
	local boardModel: Model? = nil
	local speedMul = 0.72
	local turnMul = 1
	local controls = nil
	pcall(function()
		local scripts = player:WaitForChild("PlayerScripts")
		local playerModule = require(scripts:WaitForChild("PlayerModule"))
		controls = playerModule:GetControls()
	end)

	local hud = Instance.new("TextLabel")
	hud.Name = "BoardHud"
	hud.AnchorPoint = Vector2.new(0.5, 1)
	hud.Position = UDim2.new(0.5, 0, 1, -72)
	hud.Size = UDim2.fromOffset(520, 28)
	hud.BackgroundTransparency = 1
	hud.Font = Enum.Font.GothamMedium
	hud.TextColor3 = Color3.fromRGB(180, 230, 245)
	hud.TextSize = 16
	hud.Text = ""
	hud.Visible = false
	hud.Parent = gui

	local shop = Instance.new("Frame")
	shop.Name = "BoardShop"
	shop.AnchorPoint = Vector2.new(0.5, 0.5)
	shop.Position = UDim2.fromScale(0.5, 0.5)
	shop.Size = UDim2.fromOffset(440, 360)
	shop.BackgroundColor3 = Color3.fromRGB(24, 18, 12)
	shop.BackgroundTransparency = 0.04
	shop.Visible = false
	shop.Parent = gui
	local shopCorner = Instance.new("UICorner")
	shopCorner.CornerRadius = UDim.new(0, 8)
	shopCorner.Parent = shop
	local shopStroke = Instance.new("UIStroke")
	shopStroke.Color = Color3.fromRGB(80, 200, 220)
	shopStroke.Parent = shop
	local shopTitle = Instance.new("TextLabel")
	shopTitle.BackgroundTransparency = 1
	shopTitle.Position = UDim2.fromOffset(16, 10)
	shopTitle.Size = UDim2.new(1, -120, 0, 28)
	shopTitle.Font = Enum.Font.Antique
	shopTitle.TextXAlignment = Enum.TextXAlignment.Left
	shopTitle.TextColor3 = Color3.fromRGB(180, 230, 245)
	shopTitle.TextSize = 22
	shopTitle.Text = "Board shop"
	shopTitle.Parent = shop
	local shopClose = Instance.new("TextButton")
	shopClose.AnchorPoint = Vector2.new(1, 0)
	shopClose.Position = UDim2.new(1, -12, 0, 10)
	shopClose.Size = UDim2.fromOffset(72, 28)
	shopClose.BackgroundColor3 = Color3.fromRGB(42, 90, 110)
	shopClose.Font = Enum.Font.GothamMedium
	shopClose.Text = "Close"
	shopClose.TextColor3 = Color3.fromRGB(245, 236, 214)
	shopClose.TextSize = 14
	shopClose.Parent = shop
	local shopLog = Instance.new("TextLabel")
	shopLog.BackgroundTransparency = 1
	shopLog.Position = UDim2.fromOffset(16, 300)
	shopLog.Size = UDim2.new(1, -32, 0, 44)
	shopLog.Font = Enum.Font.Gotham
	shopLog.TextWrapped = true
	shopLog.TextXAlignment = Enum.TextXAlignment.Left
	shopLog.TextColor3 = Color3.fromRGB(216, 206, 186)
	shopLog.TextSize = 14
	shopLog.Text = "One purchase forever. Q rides anywhere. Islands connect by wind skyways only."
	shopLog.Parent = shop

	local function mkBtn(text: string, y: number, action: string)
		local btn = Instance.new("TextButton")
		btn.Position = UDim2.fromOffset(16, y)
		btn.Size = UDim2.new(1, -32, 0, 40)
		btn.BackgroundColor3 = Color3.fromRGB(36, 56, 68)
		btn.Font = Enum.Font.GothamMedium
		btn.Text = text
		btn.TextColor3 = Color3.fromRGB(232, 240, 245)
		btn.TextSize = 16
		btn.Parent = shop
		local corner = Instance.new("UICorner")
		corner.CornerRadius = UDim.new(0, 6)
		corner.Parent = btn
		btn.MouseButton1Click:Connect(function()
			if shopRemote:IsA("RemoteEvent") then
				shopRemote:FireServer(action)
			end
		end)
	end
	mkBtn(`Buy board chassis ({Board.BASE_COST} brass)`, 52, "buy")
	mkBtn(`Fit thruster ({Board.THRUSTER_COST}b) — walk speed`, 100, "thruster")
	mkBtn(`Fit rails ({Board.RAILS_COST}b)`, 148, "rails")
	mkBtn(`Upgrade deck ({Board.DECK_COST}b)`, 196, "deck")
	shopClose.MouseButton1Click:Connect(function()
		shop.Visible = false
	end)

	local function owned(): boolean
		return player:GetAttribute("BoardOwned") == true
	end

	local function riding(): boolean
		return state ~= nil and state.mounted == true
	end

	local function applyCamera()
		if camMode == "first" and riding() then
			player.CameraMode = Enum.CameraMode.LockFirstPerson
		else
			player.CameraMode = Enum.CameraMode.Classic
			player.CameraMinZoomDistance = if riding() then 8 else 6
			player.CameraMaxZoomDistance = if riding() then 22 else 20
		end
	end

	local function setHumanoidRide(on: boolean)
		local character = player.Character
		local humanoid = character and character:FindFirstChildOfClass("Humanoid")
		if not humanoid then
			return
		end
		humanoid.AutoRotate = not on
		humanoid:SetStateEnabled(Enum.HumanoidStateType.Jumping, not on)
		humanoid:SetStateEnabled(Enum.HumanoidStateType.Falling, not on)
		if on then
			humanoid.WalkSpeed = 0
			humanoid.JumpHeight = 0
			if controls then
				pcall(function()
					controls:Disable()
				end)
			end
		else
			humanoid.WalkSpeed = Scale.studs(7) * (player:GetAttribute("WalkMul") or 1)
			humanoid.JumpHeight = Scale.studs(1.6)
			if controls then
				pcall(function()
					controls:Enable()
				end)
			end
		end
	end

	local function ensureBoardModel(): Model
		if boardModel and boardModel.Parent then
			return boardModel
		end
		boardModel = BoardMesh.make(Workspace, "PlayerBoard")
		for _, part in boardModel:GetDescendants() do
			if part:IsA("BasePart") then
				part.Anchored = true
				part.CanCollide = false
			end
		end
		return boardModel
	end

	local function hideBoardModel()
		if boardModel then
			boardModel:Destroy()
			boardModel = nil
		end
	end

	local function applyPose()
		if not state then
			return
		end
		local character = player.Character
		local root = character and character:FindFirstChild("HumanoidRootPart")
		if not root or not root:IsA("BasePart") then
			return
		end
		local look = Vector3.new(math.sin(state.yaw), 0, math.cos(state.yaw))
		if look.Magnitude < 0.01 then
			look = Vector3.new(0, 0, -1)
		end
		local pos = Vector3.new(Scale.studs(state.x), Scale.studs(state.visualY or state.y) + HIP, Scale.studs(state.z))
		local cf = CFrame.lookAt(pos, pos + look)
		cf = cf * CFrame.Angles(state.pitch or 0, 0, state.visualBank or state.bank or 0)
		root.CFrame = cf
		root.AssemblyLinearVelocity = look * Scale.studs(state.speed) + Vector3.new(0, Scale.studs(state.vy), 0)
		root.AssemblyAngularVelocity = Vector3.zero
		local model = ensureBoardModel()
		local deck = Vector3.new(Scale.studs(state.x), Scale.studs(state.visualY or state.y), Scale.studs(state.z))
		model:PivotTo(CFrame.lookAt(deck, deck + look) * CFrame.Angles(state.pitch or 0, 0, state.visualBank or 0))
	end

	local function mountHere()
		if not owned() then
			return
		end
		local character = player.Character
		local root = character and character:FindFirstChild("HumanoidRootPart")
		if not root or not root:IsA("BasePart") then
			return
		end
		local x, y, z = studsToUnits(root.Position)
		local ignore = { character }
		local floorY = sampleFloor(x, z, ignore)
		local look = root.CFrame.LookVector
		local yaw = math.atan2(look.X, look.Z)
		state = Board.newState(x, (if floorY then floorY else y - HIP / Scale.STUD_PER_UNIT) + Board.BOARD.hoverHeight, z, yaw)
		Board.mount(state)
		setHumanoidRide(true)
		applyCamera()
		hud.Visible = true
		if toggleRemote:IsA("RemoteEvent") then
			toggleRemote:FireServer(true)
		end
		applyPose()
	end

	local function stow()
		if not riding() then
			return
		end
		local sx, sy, sz = Board.dismount(state)
		local character = player.Character
		local root = character and character:FindFirstChild("HumanoidRootPart")
		local ignore = { character }
		if boardModel then
			table.insert(ignore, boardModel)
		end
		local floorY = sampleFloor(sx, sz, ignore)
		if root and root:IsA("BasePart") then
			local y = if floorY then Scale.studs(floorY) + HIP else Scale.studs(sy) + HIP
			local look = Vector3.new(math.sin(state.yaw), 0, math.cos(state.yaw))
			root.CFrame = CFrame.lookAt(Vector3.new(Scale.studs(sx), y, Scale.studs(sz)), Vector3.new(Scale.studs(sx), y, Scale.studs(sz)) + look)
			root.AssemblyLinearVelocity = Vector3.zero
		end
		state = nil
		hideBoardModel()
		setHumanoidRide(false)
		camMode = "third"
		applyCamera()
		hud.Visible = false
		local cam = Workspace.CurrentCamera
		if cam then
			cam.FieldOfView = 70
		end
		if toggleRemote:IsA("RemoteEvent") then
			toggleRemote:FireServer(false)
		end
	end

	local function toggle()
		if shop.Visible then
			return
		end
		if riding() then
			stow()
		elseif owned() then
			mountHere()
		end
	end

	UserInputService.InputBegan:Connect(function(input, processed)
		if input.KeyCode == Enum.KeyCode.Q and not processed then
			toggle()
			return
		end
		if input.KeyCode == Enum.KeyCode.Escape and shop.Visible then
			shop.Visible = false
			return
		end
		if not riding() then
			return
		end
		if input.KeyCode == Enum.KeyCode.Tab then
			camMode = if camMode == "first" then "third" else "first"
			applyCamera()
			return
		end
		if input.KeyCode == Enum.KeyCode.Space or input.KeyCode == Enum.KeyCode.J then
			if state then
				Board.requestJump(state)
			end
		end
		if input.UserInputType == Enum.UserInputType.Keyboard then
			keys[input.KeyCode] = true
		end
	end)

	UserInputService.InputEnded:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.Keyboard then
			keys[input.KeyCode] = nil
		end
	end)

	if openShop:IsA("RemoteEvent") then
		openShop.OnClientEvent:Connect(function(message: string?)
			if riding() then
				stow()
			end
			shop.Visible = true
			if type(message) == "string" and message ~= "" then
				shopLog.Text = message
			end
		end)
	end

	player:GetAttributeChangedSignal("BoardShopLog"):Connect(function()
		local text = player:GetAttribute("BoardShopLog")
		if type(text) == "string" and text ~= "" then
			shopLog.Text = text
		end
	end)
	player:GetAttributeChangedSignal("BoardOwned"):Connect(function()
		if not owned() and riding() then
			stow()
		end
	end)

	RunService.RenderStepped:Connect(function(dt)
		speedMul = player:GetAttribute("BoardSpeedMul") or speedMul
		turnMul = player:GetAttribute("BoardTurnMul") or turnMul
		if not riding() or not state then
			return
		end
		local character = player.Character
		if not character then
			return
		end
		local ignore = { character }
		if boardModel then
			table.insert(ignore, boardModel)
		end
		local accel = 0
		if keys[Enum.KeyCode.W] or keys[Enum.KeyCode.Up] then
			accel += 1
		end
		if keys[Enum.KeyCode.S] or keys[Enum.KeyCode.Down] then
			accel -= 1
		end
		local steer = 0
		if keys[Enum.KeyCode.A] or keys[Enum.KeyCode.Left] then
			steer -= 1
		end
		if keys[Enum.KeyCode.D] or keys[Enum.KeyCode.Right] then
			steer += 1
		end
		local slide = keys[Enum.KeyCode.LeftShift] == true or keys[Enum.KeyCode.RightShift] == true
		local floorY = sampleFloor(state.x, state.z, ignore)
		Board.tick(state, dt, accel, steer * turnMul, slide, floorY)
		Board.capSpeed(state, speedMul)
		if state.onGround and floorY then
			lastSafe = { x = state.x, y = state.y, z = state.z, yaw = state.yaw }
		end
		if state.y < -20 then
			local safe = lastSafe
			if safe then
				state.x = safe.x
				state.y = safe.y
				state.z = safe.z
				state.yaw = safe.yaw
				state.velYaw = safe.yaw
				state.vy = 0
				state.onGround = true
				state.speed = math.max(state.speed * 0.5, 4)
			else
				stow()
				return
			end
		end
		applyPose()
		hud.Text = string.format(
			"Board  %.0f  ·  %s  ·  WASD  Shift slide  Space jump  Tab cam  Q stow",
			state.speed,
			if state.sliding then "slide" elseif state.onGround then "lane" else "air"
		)
		local cam = Workspace.CurrentCamera
		if cam then
			local sn = state.speedNorm
			cam.FieldOfView = 70 + (108 - 70) * sn * sn
		end
	end)

	player.CharacterAdded:Connect(function()
		if riding() then
			stow()
		end
	end)
end

return BoardRide
