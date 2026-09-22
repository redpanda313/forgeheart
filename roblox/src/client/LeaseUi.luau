-- Residential 3×3 lease office. Cell 0,0 is the city-owner pad from plazaPlots.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local LeaseUi = {}

function LeaseUi.start(gui: ScreenGui)
	local remotes = ReplicatedStorage:WaitForChild("ForgeHeart"):WaitForChild("Remotes")
	local openRemote = remotes:WaitForChild("OpenLease")
	local actRemote = remotes:WaitForChild("LeaseAct")

	local frame = Instance.new("Frame")
	frame.Name = "LeaseOffice"
	frame.AnchorPoint = Vector2.new(0.5, 0.5)
	frame.Position = UDim2.fromScale(0.5, 0.5)
	frame.Size = UDim2.fromOffset(420, 420)
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
	heading.Text = "Leasing office"
	heading.TextColor3 = Color3.fromRGB(232, 206, 140)
	heading.TextSize = 22
	heading.TextXAlignment = Enum.TextXAlignment.Left
	heading.Parent = frame
	local note = Instance.new("TextLabel")
	note.BackgroundTransparency = 1
	note.Position = UDim2.fromOffset(16, 360)
	note.Size = UDim2.new(1, -32, 0, 44)
	note.Font = Enum.Font.Gotham
	note.TextWrapped = true
	note.TextColor3 = Color3.fromRGB(216, 206, 186)
	note.TextSize = 14
	note.Text = "Residential ring · 3×3. City pad (0,0) is 16,560 brass."
	note.Parent = frame
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

	for cellX = 0, 2 do
		for cellY = 0, 2 do
			local btn = Instance.new("TextButton")
			btn.Position = UDim2.fromOffset(16 + cellX * 128, 52 + cellY * 96)
			btn.Size = UDim2.fromOffset(120, 84)
			btn.BackgroundColor3 = Color3.fromRGB(42, 34, 22)
			btn.Font = Enum.Font.Gotham
			btn.Text = if cellX == 0 and cellY == 0 then "0,0\nCity pad\n16,560" else `{cellX},{cellY}\nNPC held`
			btn.TextColor3 = Color3.fromRGB(236, 228, 210)
			btn.TextSize = 14
			btn.Parent = frame
			local x, y = cellX, cellY
			btn.MouseButton1Click:Connect(function()
				if actRemote:IsA("RemoteEvent") then
					actRemote:FireServer(x, y)
				end
			end)
		end
	end

	if openRemote:IsA("RemoteEvent") then
		openRemote.OnClientEvent:Connect(function(text: string)
			note.Text = text
			frame.Visible = true
		end)
	end
	UserInputService.InputBegan:Connect(function(input)
		if input.KeyCode == Enum.KeyCode.Escape then
			frame.Visible = false
		end
	end)
end

return LeaseUi
