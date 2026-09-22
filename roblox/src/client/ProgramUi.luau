-- Crew programs: harvest → craft → stock, assigned per worker.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local ProgramUi = {}

function ProgramUi.start(gui: ScreenGui)
	local remotes = ReplicatedStorage:WaitForChild("ForgeHeart"):WaitForChild("Remotes")
	local openRemote = remotes:WaitForChild("OpenProgram")
	local actRemote = remotes:WaitForChild("SetJob")

	local frame = Instance.new("Frame")
	frame.Name = "Programs"
	frame.AnchorPoint = Vector2.new(0.5, 0.5)
	frame.Position = UDim2.fromScale(0.5, 0.5)
	frame.Size = UDim2.fromOffset(520, 420)
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
	heading.Text = "Programs"
	heading.TextColor3 = Color3.fromRGB(232, 206, 140)
	heading.TextSize = 22
	heading.TextXAlignment = Enum.TextXAlignment.Left
	heading.Parent = frame
	local list = Instance.new("ScrollingFrame")
	list.BackgroundTransparency = 1
	list.Position = UDim2.fromOffset(16, 48)
	list.Size = UDim2.new(1, -32, 1, -64)
	list.ScrollBarThickness = 6
	list.AutomaticCanvasSize = Enum.AutomaticSize.Y
	list.CanvasSize = UDim2.new()
	list.Parent = frame
	local layout = Instance.new("UIListLayout")
	layout.Padding = UDim.new(0, 6)
	layout.Parent = list
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

	local function row(text: string, workerId: string?, job: string?)
		local btn = Instance.new("TextButton")
		btn.Size = UDim2.new(1, -8, 0, 32)
		btn.BackgroundColor3 = Color3.fromRGB(42, 34, 22)
		btn.Font = Enum.Font.Gotham
		btn.Text = text
		btn.TextColor3 = Color3.fromRGB(236, 228, 210)
		btn.TextSize = 15
		btn.TextXAlignment = Enum.TextXAlignment.Left
		btn.Parent = list
		if workerId and job and actRemote:IsA("RemoteEvent") then
			btn.MouseButton1Click:Connect(function()
				actRemote:FireServer(workerId, job)
			end)
		end
	end

	if openRemote:IsA("RemoteEvent") then
		openRemote.OnClientEvent:Connect(function(crew: { { id: string, name: string, job: string } })
			for _, child in list:GetChildren() do
				if child:IsA("TextButton") then
					child:Destroy()
				end
			end
			row("Harvest → craft → stock. Tap a job to assign.", nil, nil)
			for _, worker in crew do
				row(`{worker.name}  now {worker.job}  ·  harvest`, worker.id, "harvest")
				row(`{worker.name}  ·  craft`, worker.id, "craft")
				row(`{worker.name}  ·  stock`, worker.id, "stock")
			end
			frame.Visible = true
		end)
	end
	UserInputService.InputBegan:Connect(function(input, processed)
		if processed then
			return
		end
		if input.KeyCode == Enum.KeyCode.P then
			-- server refreshes via attribute poke; client asks by firing empty open
			if openRemote:IsA("RemoteEvent") then
				-- request is server-driven; P is handled server-side via attribute? use a remote
			end
		end
		if input.KeyCode == Enum.KeyCode.Escape then
			frame.Visible = false
		end
	end)
end

return ProgramUi
