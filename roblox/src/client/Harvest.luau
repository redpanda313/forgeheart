-- Cloud-reef needle minigame from game.ts: tap E or Space in the moving green.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")

local Harvest = {}

function Harvest.start(gui: ScreenGui)
	local player = Players.LocalPlayer
	local remotes = ReplicatedStorage:WaitForChild("ForgeHeart"):WaitForChild("Remotes")
	local startRemote = remotes:WaitForChild("StartHarvest")
	local resultRemote = remotes:WaitForChild("HarvestResult")

	local overlay = Instance.new("Frame")
	overlay.Name = "Harvest"
	overlay.AnchorPoint = Vector2.new(0.5, 0.5)
	overlay.Position = UDim2.fromScale(0.5, 0.72)
	overlay.Size = UDim2.fromOffset(520, 120)
	overlay.BackgroundColor3 = Color3.fromRGB(24, 18, 12)
	overlay.BackgroundTransparency = 0.08
	overlay.Visible = false
	overlay.Parent = gui
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 8)
	corner.Parent = overlay
	local stroke = Instance.new("UIStroke")
	stroke.Color = Color3.fromRGB(184, 146, 58)
	stroke.Parent = overlay
	local title = Instance.new("TextLabel")
	title.BackgroundTransparency = 1
	title.Position = UDim2.fromOffset(16, 8)
	title.Size = UDim2.new(1, -32, 0, 24)
	title.Font = Enum.Font.Antique
	title.Text = "CLOUD REEF HAUL"
	title.TextColor3 = Color3.fromRGB(232, 206, 140)
	title.TextSize = 20
	title.TextXAlignment = Enum.TextXAlignment.Left
	title.Parent = overlay
	local hint = Instance.new("TextLabel")
	hint.BackgroundTransparency = 1
	hint.Position = UDim2.fromOffset(16, 88)
	hint.Size = UDim2.new(1, -32, 0, 24)
	hint.Font = Enum.Font.Gotham
	hint.Text = "tap E or Space in the moving green"
	hint.TextColor3 = Color3.fromRGB(216, 206, 186)
	hint.TextSize = 14
	hint.TextXAlignment = Enum.TextXAlignment.Left
	hint.Parent = overlay
	local bar = Instance.new("Frame")
	bar.Position = UDim2.fromOffset(16, 44)
	bar.Size = UDim2.new(1, -32, 0, 28)
	bar.BackgroundColor3 = Color3.fromRGB(42, 36, 28)
	bar.BorderSizePixel = 0
	bar.Parent = overlay
	local zone = Instance.new("Frame")
	zone.Name = "Zone"
	zone.BackgroundColor3 = Color3.fromRGB(70, 140, 80)
	zone.BorderSizePixel = 0
	zone.Parent = bar
	local needle = Instance.new("Frame")
	needle.Name = "Needle"
	needle.AnchorPoint = Vector2.new(0.5, 0)
	needle.Size = UDim2.new(0, 4, 1, 0)
	needle.BackgroundColor3 = Color3.fromRGB(245, 236, 214)
	needle.BorderSizePixel = 0
	needle.Parent = bar

	local open = false
	local needlePos = 0
	local needleDir = 1
	local needleSpeed = 55
	local zoneLeft = 40
	local zoneWidth = 17
	local zoneVel = 3

	local function close(success: boolean)
		if not open then
			return
		end
		open = false
		overlay.Visible = false
		if resultRemote:IsA("RemoteEvent") then
			resultRemote:FireServer(success)
		end
	end

	local function begin(label: string)
		open = true
		overlay.Visible = true
		title.Text = "CLOUD REEF HAUL"
		local haulTier = 1 + math.floor(math.random() * 3)
		zoneWidth = math.max(8, 17 - haulTier * 2.4)
		zoneLeft = 100 / 3 + math.random() * math.max(0.01, 100 - zoneWidth - 100 / 3)
		zoneVel = (if math.random() < 0.5 then 1 else -1) * (2.8 + haulTier * 1.4 + math.random() * 1.2)
		needleSpeed = 40 + haulTier * 24
		needlePos = 0
		needleDir = 1
		local sizeWord = if haulTier >= 3 then "heavy" elseif haulTier == 2 then "solid" else "light"
		hint.Text = `{label} · {sizeWord} haul · tap E or Space in the moving green`
	end

	if startRemote:IsA("RemoteEvent") then
		startRemote.OnClientEvent:Connect(function(label: string)
			begin(if type(label) == "string" and label ~= "" then label else "Cloud reef")
		end)
	end

	UserInputService.InputBegan:Connect(function(input, processed)
		if not open then
			return
		end
		if input.KeyCode == Enum.KeyCode.Escape then
			close(false)
			return
		end
		if processed and input.KeyCode ~= Enum.KeyCode.E then
			return
		end
		if input.KeyCode == Enum.KeyCode.Space or input.KeyCode == Enum.KeyCode.E then
			close(needlePos >= zoneLeft and needlePos <= zoneLeft + zoneWidth)
		end
	end)

	RunService.RenderStepped:Connect(function(dt)
		if not open then
			return
		end
		needlePos += needleDir * dt * needleSpeed
		if needlePos >= 100 then
			needlePos = 100
			needleDir = -1
		elseif needlePos <= 0 then
			needlePos = 0
			needleDir = 1
		end
		local minL = 100 / 3
		local maxL = 100 - zoneWidth
		zoneLeft += zoneVel * dt
		if zoneLeft <= minL then
			zoneLeft = minL
			zoneVel = math.abs(zoneVel)
		elseif zoneLeft >= maxL then
			zoneLeft = maxL
			zoneVel = -math.abs(zoneVel)
		end
		zone.Position = UDim2.fromScale(zoneLeft / 100, 0)
		zone.Size = UDim2.fromScale(zoneWidth / 100, 1)
		needle.Position = UDim2.fromScale(needlePos / 100, 0)
	end)
end

return Harvest
