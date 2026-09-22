-- Objective line, bay office, empire map, and the lore card.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local Shared = ReplicatedStorage:WaitForChild("ForgeHeart")
local Districts = require(Shared:WaitForChild("Districts"))
local BoardRide = require(script:WaitForChild("BoardRide"))
local Harvest = require(script:WaitForChild("Harvest"))
local VendorUi = require(script:WaitForChild("VendorUi"))

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
panel.Size = UDim2.fromOffset(400, 156)
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

local stock = Instance.new("TextLabel")
stock.Name = "Stock"
stock.BackgroundTransparency = 1
stock.Position = UDim2.fromOffset(14, 52)
stock.Size = UDim2.new(1, -28, 0, 32)
stock.Font = Enum.Font.Gotham
stock.TextXAlignment = Enum.TextXAlignment.Left
stock.TextYAlignment = Enum.TextYAlignment.Top
stock.TextWrapped = true
stock.TextColor3 = Color3.fromRGB(196, 176, 120)
stock.TextSize = 13
stock.Text = "E interact · R scrap a quiet frame"
stock.Parent = panel

local objective = Instance.new("TextLabel")
objective.Name = "Objective"
objective.BackgroundTransparency = 1
objective.Position = UDim2.fromOffset(14, 88)
objective.Size = UDim2.new(1, -28, 0, 58)
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
	stats.Text = string.format("Health %d    Plasma %d    Brass %d", health, plasma, player:GetAttribute("Brass") or 0)
	local carried = player:GetAttribute("Stock")
	if type(carried) == "string" and carried ~= "" then
		stock.Text = carried
	else
		stock.Text = "E interact · R scrap a quiet frame"
	end
end

refreshObjective()
player:GetAttributeChangedSignal("Objective"):Connect(refreshObjective)
player:GetAttributeChangedSignal("Health"):Connect(refreshObjective)
player:GetAttributeChangedSignal("Plasma"):Connect(refreshObjective)
player:GetAttributeChangedSignal("Brass"):Connect(refreshObjective)
player:GetAttributeChangedSignal("Stock"):Connect(refreshObjective)

local card = Instance.new("Frame")
card.Name = "Lore"
card.AnchorPoint = Vector2.new(0.5, 1)
card.Position = UDim2.new(0.5, 0, 1, -24)
card.Size = UDim2.fromOffset(560, 240)
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

local scroll = Instance.new("ScrollingFrame")
scroll.Name = "BodyScroll"
scroll.BackgroundTransparency = 1
scroll.BorderSizePixel = 0
scroll.Position = UDim2.fromOffset(16, 40)
scroll.Size = UDim2.new(1, -32, 1, -84)
scroll.ScrollBarThickness = 6
scroll.CanvasSize = UDim2.new()
scroll.AutomaticCanvasSize = Enum.AutomaticSize.Y
scroll.Parent = card

local cardBody = Instance.new("TextLabel")
cardBody.BackgroundTransparency = 1
cardBody.Size = UDim2.new(1, -8, 0, 0)
cardBody.AutomaticSize = Enum.AutomaticSize.Y
cardBody.Font = Enum.Font.Gotham
cardBody.TextXAlignment = Enum.TextXAlignment.Left
cardBody.TextYAlignment = Enum.TextYAlignment.Top
cardBody.TextWrapped = true
cardBody.TextColor3 = Color3.fromRGB(236, 228, 210)
cardBody.TextSize = 16
cardBody.Text = ""
cardBody.Parent = scroll

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

local remotes = Shared:WaitForChild("Remotes")
local showLore = remotes:WaitForChild("ShowLore")
if showLore:IsA("RemoteEvent") then
	showLore.OnClientEvent:Connect(function(titleText: string, body: string)
		cardTitle.Text = titleText
		cardBody.Text = body
		card.Visible = true
	end)
end

local function officeCard(name: string, titleText: string): (Frame, TextLabel)
	local frame = Instance.new("Frame")
	frame.Name = name
	frame.AnchorPoint = Vector2.new(0.5, 0.5)
	frame.Position = UDim2.fromScale(0.5, 0.5)
	frame.Size = UDim2.fromOffset(520, 420)
	frame.BackgroundColor3 = Color3.fromRGB(24, 18, 12)
	frame.BackgroundTransparency = 0.04
	frame.BorderSizePixel = 0
	frame.Visible = false
	frame.Parent = gui
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 8)
	corner.Parent = frame
	local stroke = Instance.new("UIStroke")
	stroke.Color = Color3.fromRGB(184, 146, 58)
	stroke.Thickness = 1.5
	stroke.Parent = frame
	local heading = Instance.new("TextLabel")
	heading.BackgroundTransparency = 1
	heading.Position = UDim2.fromOffset(16, 10)
	heading.Size = UDim2.new(1, -120, 0, 28)
	heading.Font = Enum.Font.Antique
	heading.TextXAlignment = Enum.TextXAlignment.Left
	heading.TextColor3 = Color3.fromRGB(232, 206, 140)
	heading.TextSize = 22
	heading.Text = titleText
	heading.Parent = frame
	local closeBtn = Instance.new("TextButton")
	closeBtn.AnchorPoint = Vector2.new(1, 0)
	closeBtn.Position = UDim2.new(1, -12, 0, 10)
	closeBtn.Size = UDim2.fromOffset(72, 28)
	closeBtn.BackgroundColor3 = Color3.fromRGB(122, 96, 40)
	closeBtn.Font = Enum.Font.GothamMedium
	closeBtn.Text = "Close"
	closeBtn.TextColor3 = Color3.fromRGB(245, 236, 214)
	closeBtn.TextSize = 14
	closeBtn.Parent = frame
	local closeCorner = Instance.new("UICorner")
	closeCorner.CornerRadius = UDim.new(0, 6)
	closeCorner.Parent = closeBtn
	closeBtn.MouseButton1Click:Connect(function()
		frame.Visible = false
	end)
	local body = Instance.new("TextLabel")
	body.Name = "Body"
	body.BackgroundTransparency = 1
	body.Position = UDim2.fromOffset(16, 48)
	body.Size = UDim2.new(1, -32, 1, -64)
	body.Font = Enum.Font.Gotham
	body.TextXAlignment = Enum.TextXAlignment.Left
	body.TextYAlignment = Enum.TextYAlignment.Top
	body.TextWrapped = true
	body.TextColor3 = Color3.fromRGB(236, 228, 210)
	body.TextSize = 16
	body.Text = ""
	body.Parent = frame
	return frame, body
end

local bay, bayBody = officeCard("BayOffice", "Bay office")
local mapCard, mapBody = officeCard("EmpireMap", "Empire map")

local function refreshBay()
	local lines = {
		"Inventory, crew, and the work in front of you.",
		"",
		`Brass  {player:GetAttribute("Brass") or 0}`,
		`Crew  {player:GetAttribute("Crew") or "No crew yet"}`,
		"",
		"Stock",
		player:GetAttribute("Stock") or "Empty",
		"",
		"Objective",
		player:GetAttribute("Objective") or "",
		"",
		"I closes this office. M opens the empire map. E uses whatever is in front of you.",
	}
	bayBody.Text = table.concat(lines, "\n")
end

local mapLines = { "No roads between islands — only wind skyways. Q board and ride the cyan lanes.", "" }
for _, district in Districts.LIST do
	table.insert(
		mapLines,
		`{district.name}  ·  {district.role}  ·  stall {district.stallCost} brass`
	)
end
mapBody.Text = table.concat(mapLines, "\n")

local function toggle(frame: Frame)
	local open = not frame.Visible
	bay.Visible = false
	mapCard.Visible = false
	frame.Visible = open
	if frame == bay and open then
		refreshBay()
	end
end

UserInputService.InputBegan:Connect(function(input, processed)
	if processed then
		return
	end
	if input.KeyCode == Enum.KeyCode.I then
		toggle(bay)
	elseif input.KeyCode == Enum.KeyCode.M then
		toggle(mapCard)
	end
end)

BoardRide.start(gui)
Harvest.start(gui)
VendorUi.start(gui)
