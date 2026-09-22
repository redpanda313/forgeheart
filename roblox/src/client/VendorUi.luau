-- Market stall buy/sell from economy.ts VENDORS.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local Economy = require(ReplicatedStorage:WaitForChild("ForgeHeart"):WaitForChild("Economy"))

local VendorUi = {}

function VendorUi.start(gui: ScreenGui)
	local player = Players.LocalPlayer
	local remotes = ReplicatedStorage:WaitForChild("ForgeHeart"):WaitForChild("Remotes")
	local openRemote = remotes:WaitForChild("OpenVendor")
	local actRemote = remotes:WaitForChild("VendorAct")

	local frame = Instance.new("Frame")
	frame.Name = "Vendor"
	frame.AnchorPoint = Vector2.new(0.5, 0.5)
	frame.Position = UDim2.fromScale(0.5, 0.5)
	frame.Size = UDim2.fromOffset(480, 460)
	frame.BackgroundColor3 = Color3.fromRGB(24, 18, 12)
	frame.Visible = false
	frame.Parent = gui
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 8)
	corner.Parent = frame
	local stroke = Instance.new("UIStroke")
	stroke.Color = Color3.fromRGB(184, 146, 58)
	stroke.Parent = frame
	local heading = Instance.new("TextLabel")
	heading.BackgroundTransparency = 1
	heading.Position = UDim2.fromOffset(16, 10)
	heading.Size = UDim2.new(1, -120, 0, 28)
	heading.Font = Enum.Font.Antique
	heading.TextXAlignment = Enum.TextXAlignment.Left
	heading.TextColor3 = Color3.fromRGB(232, 206, 140)
	heading.TextSize = 22
	heading.Text = "Stall"
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
	local greet = Instance.new("TextLabel")
	greet.BackgroundTransparency = 1
	greet.Position = UDim2.fromOffset(16, 42)
	greet.Size = UDim2.new(1, -32, 0, 36)
	greet.Font = Enum.Font.Gotham
	greet.TextWrapped = true
	greet.TextXAlignment = Enum.TextXAlignment.Left
	greet.TextColor3 = Color3.fromRGB(216, 206, 186)
	greet.TextSize = 14
	greet.Text = ""
	greet.Parent = frame
	local list = Instance.new("ScrollingFrame")
	list.BackgroundTransparency = 1
	list.Position = UDim2.fromOffset(16, 84)
	list.Size = UDim2.new(1, -32, 1, -100)
	list.ScrollBarThickness = 6
	list.AutomaticCanvasSize = Enum.AutomaticSize.Y
	list.CanvasSize = UDim2.new()
	list.Parent = frame
	local layout = Instance.new("UIListLayout")
	layout.Padding = UDim.new(0, 6)
	layout.Parent = list

	local currentId = nil

	local function clear()
		for _, child in list:GetChildren() do
			if child:IsA("TextButton") then
				child:Destroy()
			end
		end
	end

	local function row(text: string, action: string, id: string)
		local btn = Instance.new("TextButton")
		btn.Size = UDim2.new(1, -8, 0, 34)
		btn.BackgroundColor3 = Color3.fromRGB(42, 34, 22)
		btn.Font = Enum.Font.Gotham
		btn.Text = text
		btn.TextColor3 = Color3.fromRGB(236, 228, 210)
		btn.TextSize = 15
		btn.TextXAlignment = Enum.TextXAlignment.Left
		btn.Parent = list
		local pad = Instance.new("UIPadding")
		pad.PaddingLeft = UDim.new(0, 10)
		pad.Parent = btn
		btn.MouseButton1Click:Connect(function()
			if currentId and actRemote:IsA("RemoteEvent") then
				actRemote:FireServer(currentId, action, id)
			end
		end)
	end

	local function refresh(vendorId: string)
		local vendor = Economy.VENDORS[vendorId]
		if not vendor then
			return
		end
		currentId = vendorId
		heading.Text = `{vendor.name} · {vendor.title}`
		greet.Text = vendor.greeting
		clear()
		for _, id in vendor.stock do
			local def = Economy.COMMODITIES[id]
			if def then
				local buy = Economy.vendorSellPrice(vendor, id)
				local sell = Economy.vendorBuyPrice(vendor, id)
				row(`Buy {def.name}  ·  {buy} brass`, "buy", id)
				row(`Sell {def.name}  ·  they pay {sell}`, "sell", id)
			end
		end
		frame.Visible = true
	end

	closeBtn.MouseButton1Click:Connect(function()
		frame.Visible = false
	end)
	if openRemote:IsA("RemoteEvent") then
		openRemote.OnClientEvent:Connect(function(vendorId: string)
			refresh(vendorId)
		end)
	end
	UserInputService.InputBegan:Connect(function(input)
		if input.KeyCode == Enum.KeyCode.Escape then
			frame.Visible = false
		end
	end)
	player:GetAttributeChangedSignal("Brass"):Connect(function()
		if frame.Visible and currentId then
			refresh(currentId)
		end
	end)
end

return VendorUi
