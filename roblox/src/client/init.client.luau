-- Objective line and the lore card opened by workshop prompts.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

local gui = Instance.new("ScreenGui")
gui.Name = "ForgeHeartHud"
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = true
gui.Parent = playerGui

local panel = Instance.new("Frame")
panel.Name = "Panel"
panel.AnchorPoint = Vector2.new(0, 0)
panel.Position = UDim2.fromOffset(16, 16)
panel.Size = UDim2.fromOffset(360, 118)
panel.BackgroundColor3 = Color3.fromRGB(28, 22, 14)
panel.BackgroundTransparency = 0.18
panel.BorderSizePixel = 0
panel.Parent = gui

local corner = Instance.new("UICorner")
corner.CornerRadius = UDim.new(0, 8)
corner.Parent = panel

local stroke = Instance.new("UIStroke")
stroke.Color = Color3.fromRGB(184, 146, 58)
stroke.Thickness = 1.5
stroke.Parent = panel

local title = Instance.new("TextLabel")
title.BackgroundTransparency = 1
title.Position = UDim2.fromOffset(14, 8)
title.Size = UDim2.new(1, -28, 0, 22)
title.Font = Enum.Font.Antique
title.TextXAlignment = Enum.TextXAlignment.Left
title.Text = "Forge Heart"
title.TextColor3 = Color3.fromRGB(232, 206, 140)
title.TextSize = 20
title.Parent = panel

local stats = Instance.new("TextLabel")
stats.BackgroundTransparency = 1
stats.Position = UDim2.fromOffset(14, 32)
stats.Size = UDim2.new(1, -28, 0, 18)
stats.Font = Enum.Font.Gotham
stats.TextXAlignment = Enum.TextXAlignment.Left
stats.TextColor3 = Color3.fromRGB(216, 206, 186)
stats.TextSize = 14
stats.Text = "Health 100    Plasma 100"
stats.Parent = panel

local objective = Instance.new("TextLabel")
objective.Name = "Objective"
objective.BackgroundTransparency = 1
objective.Position = UDim2.fromOffset(14, 56)
objective.Size = UDim2.new(1, -28, 0, 50)
objective.Font = Enum.Font.GothamMedium
objective.TextXAlignment = Enum.TextXAlignment.Left
objective.TextYAlignment = Enum.TextYAlignment.Top
objective.TextWrapped = true
objective.TextColor3 = Color3.fromRGB(245, 236, 214)
objective.TextSize = 16
objective.Text = ""
objective.Parent = panel

local function refreshObjective()
	objective.Text = player:GetAttribute("Objective") or "Read the photograph on the south wall."
	local health = player:GetAttribute("Health") or 100
	local plasma = player:GetAttribute("Plasma") or 100
	stats.Text = string.format("Health %d    Plasma %d", health, plasma)
end

refreshObjective()
player:GetAttributeChangedSignal("Objective"):Connect(refreshObjective)
player:GetAttributeChangedSignal("Health"):Connect(refreshObjective)
player:GetAttributeChangedSignal("Plasma"):Connect(refreshObjective)

local card = Instance.new("Frame")
card.Name = "Lore"
card.AnchorPoint = Vector2.new(0.5, 1)
card.Position = UDim2.new(0.5, 0, 1, -24)
card.Size = UDim2.fromOffset(520, 150)
card.BackgroundColor3 = Color3.fromRGB(24, 18, 12)
card.BackgroundTransparency = 0.08
card.BorderSizePixel = 0
card.Visible = false
card.Parent = gui

local cardCorner = Instance.new("UICorner")
cardCorner.CornerRadius = UDim.new(0, 8)
cardCorner.Parent = card

local cardStroke = Instance.new("UIStroke")
cardStroke.Color = Color3.fromRGB(184, 146, 58)
cardStroke.Parent = card

local cardTitle = Instance.new("TextLabel")
cardTitle.BackgroundTransparency = 1
cardTitle.Position = UDim2.fromOffset(16, 10)
cardTitle.Size = UDim2.new(1, -32, 0, 24)
cardTitle.Font = Enum.Font.Antique
cardTitle.TextXAlignment = Enum.TextXAlignment.Left
cardTitle.TextColor3 = Color3.fromRGB(232, 206, 140)
cardTitle.TextSize = 20
cardTitle.Text = ""
cardTitle.Parent = card

local cardBody = Instance.new("TextLabel")
cardBody.BackgroundTransparency = 1
cardBody.Position = UDim2.fromOffset(16, 40)
cardBody.Size = UDim2.new(1, -32, 0, 64)
cardBody.Font = Enum.Font.Gotham
cardBody.TextXAlignment = Enum.TextXAlignment.Left
cardBody.TextYAlignment = Enum.TextYAlignment.Top
cardBody.TextWrapped = true
cardBody.TextColor3 = Color3.fromRGB(236, 228, 210)
cardBody.TextSize = 16
cardBody.Text = ""
cardBody.Parent = card

local close = Instance.new("TextButton")
close.AnchorPoint = Vector2.new(1, 1)
close.Position = UDim2.new(1, -12, 1, -10)
close.Size = UDim2.fromOffset(72, 28)
close.BackgroundColor3 = Color3.fromRGB(122, 96, 40)
close.Font = Enum.Font.GothamMedium
close.Text = "Close"
close.TextColor3 = Color3.fromRGB(245, 236, 214)
close.TextSize = 14
close.Parent = card
local closeCorner = Instance.new("UICorner")
closeCorner.CornerRadius = UDim.new(0, 6)
closeCorner.Parent = close
close.MouseButton1Click:Connect(function()
	card.Visible = false
end)

local remotes = ReplicatedStorage:WaitForChild("ForgeHeart"):WaitForChild("Remotes")
local showLore = remotes:WaitForChild("ShowLore")
if showLore:IsA("RemoteEvent") then
	showLore.OnClientEvent:Connect(function(titleText: string, body: string)
		cardTitle.Text = titleText
		cardBody.Text = body
		card.Visible = true
	end)
end
