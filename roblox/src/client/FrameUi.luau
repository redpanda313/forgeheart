-- Five-slot frame assembly from frameAssembly.ts.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local FrameUi = {}

function FrameUi.start(gui: ScreenGui)
	local remotes = ReplicatedStorage:WaitForChild("ForgeHeart"):WaitForChild("Remotes")
	local openRemote = remotes:WaitForChild("OpenFrame")
	local actRemote = remotes:WaitForChild("AssembleFrame")

	local frame = Instance.new("Frame")
	frame.Name = "FrameBench"
	frame.AnchorPoint = Vector2.new(0.5, 0.5)
	frame.Position = UDim2.fromScale(0.5, 0.5)
	frame.Size = UDim2.fromOffset(480, 420)
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
	heading.Text = "Frame bench"
	heading.TextColor3 = Color3.fromRGB(232, 206, 140)
	heading.TextSize = 22
	heading.TextXAlignment = Enum.TextXAlignment.Left
	heading.Parent = frame
	local body = Instance.new("TextLabel")
	body.BackgroundTransparency = 1
	body.Position = UDim2.fromOffset(16, 48)
	body.Size = UDim2.new(1, -32, 0, 280)
	body.Font = Enum.Font.Gotham
	body.TextWrapped = true
	body.TextXAlignment = Enum.TextXAlignment.Left
	body.TextYAlignment = Enum.TextYAlignment.Top
	body.TextColor3 = Color3.fromRGB(236, 228, 210)
	body.TextSize = 16
	body.Text = "Chassis · mechanisms · power · wiring · personality"
	body.Parent = frame
	local assemble = Instance.new("TextButton")
	assemble.Position = UDim2.fromOffset(16, 340)
	assemble.Size = UDim2.new(1, -32, 0, 40)
	assemble.BackgroundColor3 = Color3.fromRGB(122, 96, 40)
	assemble.Font = Enum.Font.GothamMedium
	assemble.Text = "Auto-assemble from inventory"
	assemble.TextColor3 = Color3.fromRGB(245, 236, 214)
	assemble.TextSize = 16
	assemble.Parent = frame
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
	assemble.MouseButton1Click:Connect(function()
		if actRemote:IsA("RemoteEvent") then
			actRemote:FireServer()
		end
	end)
	if openRemote:IsA("RemoteEvent") then
		openRemote.OnClientEvent:Connect(function(text: string)
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

return FrameUi
