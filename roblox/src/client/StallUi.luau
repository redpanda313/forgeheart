-- Stall office: stock, price policy, demand, haggle.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local StallUi = {}

function StallUi.start(gui: ScreenGui)
	local remotes = ReplicatedStorage:WaitForChild("ForgeHeart"):WaitForChild("Remotes")
	local openRemote = remotes:WaitForChild("OpenStall")
	local actRemote = remotes:WaitForChild("StallAct")
	local haggleRemote = remotes:WaitForChild("HagglePrompt")

	local frame = Instance.new("Frame")
	frame.Name = "StallOffice"
	frame.AnchorPoint = Vector2.new(0.5, 0.5)
	frame.Position = UDim2.fromScale(0.5, 0.5)
	frame.Size = UDim2.fromOffset(520, 460)
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
	heading.Text = "Plaza stall"
	heading.TextColor3 = Color3.fromRGB(232, 206, 140)
	heading.TextSize = 22
	heading.TextXAlignment = Enum.TextXAlignment.Left
	heading.Parent = frame

	local body = Instance.new("TextLabel")
	body.BackgroundTransparency = 1
	body.Position = UDim2.fromOffset(16, 44)
	body.Size = UDim2.new(1, -32, 0, 220)
	body.Font = Enum.Font.Gotham
	body.TextWrapped = true
	body.TextXAlignment = Enum.TextXAlignment.Left
	body.TextYAlignment = Enum.TextYAlignment.Top
	body.TextColor3 = Color3.fromRGB(236, 228, 210)
	body.TextSize = 15
	body.Text = ""
	body.Parent = frame

	local currentId = nil
	local function btn(text: string, y: number, action: string)
		local b = Instance.new("TextButton")
		b.Position = UDim2.fromOffset(16, y)
		b.Size = UDim2.new(1, -32, 0, 30)
		b.BackgroundColor3 = Color3.fromRGB(42, 34, 22)
		b.Font = Enum.Font.Gotham
		b.Text = text
		b.TextColor3 = Color3.fromRGB(236, 228, 210)
		b.TextSize = 14
		b.Parent = frame
		b.MouseButton1Click:Connect(function()
			if currentId and actRemote:IsA("RemoteEvent") then
				actRemote:FireServer(currentId, action)
			end
		end)
	end
	btn("Stock pack goods", 274, "stock")
	btn("Stock an invention", 308, "stock_invent")
	btn("Stock assembled frame", 342, "stock_frame")
	btn("Price: deal / fair / premium", 376, "cycle_price")
	btn("Accept haggle", 410, "haggle_yes")
	btn("Refuse haggle", 444, "haggle_no")
	frame.Size = UDim2.fromOffset(520, 490)

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
	closeBtn.MouseButton1Click:Connect(function()
		frame.Visible = false
	end)

	if openRemote:IsA("RemoteEvent") then
		openRemote.OnClientEvent:Connect(function(id: string, title: string, text: string)
			currentId = id
			heading.Text = title
			body.Text = text
			frame.Visible = true
		end)
	end

	local haggle = Instance.new("Frame")
	haggle.Name = "HaggleCard"
	haggle.AnchorPoint = Vector2.new(0.5, 0)
	haggle.Position = UDim2.new(0.5, 0, 0, 80)
	haggle.Size = UDim2.fromOffset(440, 160)
	haggle.BackgroundColor3 = Color3.fromRGB(24, 18, 12)
	haggle.Visible = false
	haggle.Parent = gui
	local hc = Instance.new("UICorner")
	hc.CornerRadius = UDim.new(0, 8)
	hc.Parent = haggle
	local hs = Instance.new("UIStroke")
	hs.Color = Color3.fromRGB(184, 146, 58)
	hs.Parent = haggle
	local hText = Instance.new("TextLabel")
	hText.BackgroundTransparency = 1
	hText.Position = UDim2.fromOffset(16, 12)
	hText.Size = UDim2.new(1, -32, 0, 80)
	hText.Font = Enum.Font.Gotham
	hText.TextWrapped = true
	hText.TextColor3 = Color3.fromRGB(236, 228, 210)
	hText.TextSize = 16
	hText.TextXAlignment = Enum.TextXAlignment.Left
	hText.TextYAlignment = Enum.TextYAlignment.Top
	hText.Text = ""
	hText.Parent = haggle
	local haggleDistrict = nil
	local yes = Instance.new("TextButton")
	yes.Position = UDim2.fromOffset(16, 104)
	yes.Size = UDim2.fromOffset(190, 36)
	yes.BackgroundColor3 = Color3.fromRGB(122, 96, 40)
	yes.Font = Enum.Font.GothamMedium
	yes.Text = "Accept"
	yes.TextColor3 = Color3.fromRGB(245, 236, 214)
	yes.TextSize = 16
	yes.Parent = haggle
	local no = Instance.new("TextButton")
	no.Position = UDim2.fromOffset(234, 104)
	no.Size = UDim2.fromOffset(190, 36)
	no.BackgroundColor3 = Color3.fromRGB(90, 50, 40)
	no.Font = Enum.Font.GothamMedium
	no.Text = "Refuse"
	no.TextColor3 = Color3.fromRGB(245, 236, 214)
	no.TextSize = 16
	no.Parent = haggle
	yes.MouseButton1Click:Connect(function()
		if haggleDistrict and actRemote:IsA("RemoteEvent") then
			actRemote:FireServer(haggleDistrict, "haggle_yes")
		end
		haggle.Visible = false
	end)
	no.MouseButton1Click:Connect(function()
		if haggleDistrict and actRemote:IsA("RemoteEvent") then
			actRemote:FireServer(haggleDistrict, "haggle_no")
		end
		haggle.Visible = false
	end)
	if haggleRemote:IsA("RemoteEvent") then
		haggleRemote.OnClientEvent:Connect(function(districtId: string, text: string)
			haggleDistrict = districtId
			hText.Text = text
			haggle.Visible = true
		end)
	end

	UserInputService.InputBegan:Connect(function(input)
		if input.KeyCode == Enum.KeyCode.Escape then
			frame.Visible = false
			haggle.Visible = false
		end
	end)
end

return StallUi
