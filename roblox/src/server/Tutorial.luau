-- Workshop session: lore prompts, waking Elias, and a per-player flag.
local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local StarterPlayer = game:GetService("StarterPlayer")

local Elias = require(script.Parent.Elias)
local Workshop = require(script.Parent.Workshop)

local Scale = require(ReplicatedStorage:WaitForChild("ForgeHeart"):WaitForChild("Scale"))

local Tutorial = {}

local OBJECTIVE_READ = "Read the photograph on the south wall."
local OBJECTIVE_WAKE = "Wake Elias at the bench. Hold E."
local OBJECTIVE_WITH = "Elias walks with you. The doors stay shut until the siege."

local store = DataStoreService:GetDataStore("ForgeHeartProfile_v1")

local function loreFolder(): RemoteEvent
	local shared = ReplicatedStorage:WaitForChild("ForgeHeart")
	local remotes = shared:FindFirstChild("Remotes")
	if not remotes then
		remotes = Instance.new("Folder")
		remotes.Name = "Remotes"
		remotes.Parent = shared
	end
	local existing = remotes:FindFirstChild("ShowLore")
	if existing and existing:IsA("RemoteEvent") then
		return existing
	end
	local remote = Instance.new("RemoteEvent")
	remote.Name = "ShowLore"
	remote.Parent = remotes
	return remote
end

local showLore = loreFolder()

local function tell(player: Player, title: string, body: string)
	showLore:FireClient(player, title, body)
end

local function saveAwake(player: Player)
	pcall(function()
		store:SetAsync("u_" .. player.UserId, { eliasAwake = true, version = 1 })
	end)
end

local function loadAwake(player: Player): boolean
	local ok, data = pcall(function()
		return store:GetAsync("u_" .. player.UserId)
	end)
	return ok and type(data) == "table" and data.eliasAwake == true
end

local function placeCharacter(character: Model)
	local root = character:WaitForChild("HumanoidRootPart", 8)
	local humanoid = character:FindFirstChildOfClass("Humanoid")
	if humanoid then
		humanoid.WalkSpeed = Scale.studs(7)
		humanoid.UseJumpPower = false
		humanoid.JumpHeight = Scale.studs(1.6)
	end
	if root and root:IsA("BasePart") then
		root.CFrame = Workshop.spawnCFrame()
	end
end

function Tutorial.start()
	StarterPlayer.CameraMode = Enum.CameraMode.Classic
	StarterPlayer.CameraMinZoomDistance = 6
	StarterPlayer.CameraMaxZoomDistance = 20

	local built = Workshop.build(workspace)
	local elias = Elias.create(built.folder, Workshop.brotherFeet())

	local function setObjective(player: Player, text: string)
		player:SetAttribute("Objective", text)
	end

	local function markAwake(player: Player)
		player:SetAttribute("EliasAwake", true)
		setObjective(player, OBJECTIVE_WITH)
		saveAwake(player)
	end

	built.photo.Triggered:Connect(function(player)
		tell(
			player,
			"Photograph",
			"Elias, in the light of this lab. A tragedy took him. The frame by the bench can hold a soul."
		)
		if player:GetAttribute("EliasAwake") ~= true then
			setObjective(player, OBJECTIVE_WAKE)
		end
	end)

	built.journal.Triggered:Connect(function(player)
		tell(player, "Journal", "The Hand seats a soul. The wrench only breaks a frame. Elias comes first.")
	end)

	built.theory.Triggered:Connect(function(player)
		tell(
			player,
			"Theory",
			"Integrity falls to rapid blows. Scramble stays. When the eyes go dark, the Hand can bring someone home."
		)
	end)

	built.talisman.Triggered:Connect(function(player)
		tell(player, "Talisman note", "His talisman is in the chassis. Stand close to Elias and wake him.")
	end)

	built.wrench.Triggered:Connect(function(player)
		tell(player, "Arc wrench", "The rack is quiet. The siege has not started. Wake Elias first.")
	end)

	local wakePrompt = elias:FindFirstChild("WakePrompt", true)
	if wakePrompt and wakePrompt:IsA("ProximityPrompt") then
		wakePrompt.Triggered:Connect(function(player)
			if elias:GetAttribute("Awake") == true then
				return
			end
			Elias.wake(elias)
			markAwake(player)
			for _, other in Players:GetPlayers() do
				other:SetAttribute("EliasAwake", true)
				setObjective(other, OBJECTIVE_WITH)
			end
			tell(player, "Elias", "The eyes light. He knows you. Stay close. He will follow.")
		end)
	end

	local function onPlayer(player: Player)
		setObjective(player, OBJECTIVE_READ)
		player:SetAttribute("Health", 100)
		player:SetAttribute("Plasma", 100)
		task.spawn(function()
			if loadAwake(player) and elias:GetAttribute("Awake") ~= true then
				Elias.wake(elias)
			end
			if elias:GetAttribute("Awake") == true then
				markAwake(player)
			end
		end)
		player.CharacterAdded:Connect(placeCharacter)
		if player.Character then
			placeCharacter(player.Character)
		end
	end

	Players.PlayerAdded:Connect(onPlayer)
	for _, player in Players:GetPlayers() do
		onPlayer(player)
	end

	RunService.Heartbeat:Connect(function(dt)
		if elias:GetAttribute("Awake") ~= true then
			return
		end
		local closest: BasePart? = nil
		local closestDist = math.huge
		for _, player in Players:GetPlayers() do
			local character = player.Character
			local root = character and character:FindFirstChild("HumanoidRootPart")
			if root and root:IsA("BasePart") then
				local dist = (root.Position - elias:GetPivot().Position).Magnitude
				if dist < closestDist then
					closestDist = dist
					closest = root
				end
			end
		end
		if closest then
			local rescue = Scale.studs(16)
			if closestDist > rescue then
				local flat = Vector3.new(closest.Position.X, elias:GetPivot().Position.Y, closest.Position.Z)
				local back = (elias:GetPivot().Position - flat)
				if back.Magnitude < 0.1 then
					back = Vector3.new(0, 0, 6)
				end
				local snap = flat + back.Unit * 8
				elias:PivotTo(CFrame.lookAt(Vector3.new(snap.X, elias:GetPivot().Position.Y, snap.Z), flat))
			else
				Elias.step(elias, closest.Position, dt)
			end
		end
	end)
end

return Tutorial
