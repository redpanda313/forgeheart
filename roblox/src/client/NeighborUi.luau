-- Neighbor panel: talk, gift brass or blooms, hire, debt.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local NeighborUi = {}

function NeighborUi.start(gui: ScreenGui)
	local remotes = ReplicatedStorage:WaitForChild("ForgeHeart"):WaitForChild("Remotes")
	local openRemote = remotes:WaitForChild("OpenNeighbor")
	local actRemote = remotes:WaitForChild("NeighborAct")

	local frame = Instance.new("Frame")
	frame.Name = "NeighborPanel"
	frame.AnchorPoint = Vector2.new(0.5, 0.5)
	frame.Position = UDim2.fromScale(0.5, 0.5)
	frame.Size = UDim2.fromOffset(480, 380)
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
	heading.TextColor3 = Color3.fromRGB(232, 206, 140)
	heading.TextSize = 22
	heading.TextXAlignment = Enum.TextXAlignment.Left
	heading.Text = "Neighbor"
	heading.Parent = frame
	local body = Instance.new("TextLabel")
	body.BackgroundTransparency = 1
	body.Position = UDim2.fromOffset(16, 44)
	body.Size = UDim2.new(1, -32, 0, 180)
	body.Font = Enum.Font.Gotham
	body.TextWrapped = true
	body.TextXAlignment = Enum.TextXAlignment.Left
	body.TextYAlignment = Enum.TextYAlignment.Top
	body.TextColor3 = Color3.fromRGB(236, 228, 210)
	body.TextSize = 16
	body.Text = ""
	body.Parent = frame
	local currentId = nil
	local function btn(text: string, y: number, action: string)
		local b = Instance.new("TextButton")
		b.Position = UDim2.fromOffset(16, y)
		b.Size = UDim2.new(1, -32, 0, 32)
		b.BackgroundColor3 = Color3.fromRGB(42, 34, 22)
		b.Font = Enum.Font.Gotham
		b.Text = text
		b.TextColor3 = Color3.fromRGB(236, 228, 210)
		b.TextSize = 15
		b.Parent = frame
		b.MouseButton1Click:Connect(function()
			if currentId and actRemote:IsA("RemoteEvent") then
				actRemote:FireServer(currentId, action)
			end
		end)
	end
	btn("Gift 10 brass", 232, "brass")
	btn("Gift Cloud Blooms", 268, "bloom")
	btn("Offer hire", 304, "hire")
	btn("Clear debt", 340, "debt")
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
	UserInputService.InputBegan:Connect(function(input)
		if input.KeyCode == Enum.KeyCode.Escape then
			frame.Visible = false
		end
	end)
end

return NeighborUi
