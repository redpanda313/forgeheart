-- Slot-by-slot frame picker from frameAssembly.ts.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local FrameUi = {}

local SLOT_ORDER = { "chassis", "mechanisms", "power", "wiring", "personality" }
local SLOT_LABEL = {
	chassis = "Chassis",
	mechanisms = "Mechanisms",
	power = "Power",
	wiring = "Wiring",
	personality = "Personality",
}

function FrameUi.start(gui: ScreenGui)
	local remotes = ReplicatedStorage:WaitForChild("ForgeHeart"):WaitForChild("Remotes")
	local openRemote = remotes:WaitForChild("OpenFrame")
	local actRemote = remotes:WaitForChild("AssembleFrame")

	local frame = Instance.new("Frame")
	frame.Name = "FrameBench"
	frame.AnchorPoint = Vector2.new(0.5, 0.5)
	frame.Position = UDim2.fromScale(0.5, 0.5)
	frame.Size = UDim2.fromOffset(560, 500)
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

	local status = Instance.new("TextLabel")
	status.BackgroundTransparency = 1
	status.Position = UDim2.fromOffset(16, 40)
	status.Size = UDim2.new(1, -32, 0, 48)
	status.Font = Enum.Font.Gotham
	status.TextWrapped = true
	status.TextXAlignment = Enum.TextXAlignment.Left
	status.TextYAlignment = Enum.TextYAlignment.Top
	status.TextColor3 = Color3.fromRGB(196, 176, 120)
	status.TextSize = 14
	status.Text = "Pick a space, then a part you own."
	status.Parent = frame

	local slotRow = Instance.new("Frame")
	slotRow.BackgroundTransparency = 1
	slotRow.Position = UDim2.fromOffset(16, 92)
	slotRow.Size = UDim2.new(1, -32, 0, 72)
	slotRow.Parent = frame

	local partsFrame = Instance.new("ScrollingFrame")
	partsFrame.BackgroundTransparency = 1
	partsFrame.BorderSizePixel = 0
	partsFrame.Position = UDim2.fromOffset(16, 176)
	partsFrame.Size = UDim2.new(1, -32, 0, 230)
	partsFrame.ScrollBarThickness = 6
	partsFrame.CanvasSize = UDim2.new()
	partsFrame.AutomaticCanvasSize = Enum.AutomaticSize.Y
	partsFrame.Parent = frame
	local list = Instance.new("UIListLayout")
	list.Padding = UDim.new(0, 6)
	list.Parent = partsFrame

	local assemble = Instance.new("TextButton")
	assemble.Position = UDim2.fromOffset(16, 416)
	assemble.Size = UDim2.new(1, -32, 0, 40)
	assemble.BackgroundColor3 = Color3.fromRGB(122, 96, 40)
	assemble.Font = Enum.Font.GothamMedium
	assemble.Text = "Assemble"
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

	local state = { fill = {}, parts = {}, canAssemble = false }
	local selected = "chassis"
	local slotButtons = {}

	local function fire(action: string, slot: string?, ref: string?)
		if actRemote:IsA("RemoteEvent") then
			actRemote:FireServer(action, slot, ref)
		end
	end

	local function paintSlots()
		for _, slot in SLOT_ORDER do
			local btn = slotButtons[slot]
			if btn then
				local filled = state.fill and state.fill[slot]
				local label = (state.fillLabels and state.fillLabels[slot]) or filled or "empty"
				btn.Text = `{SLOT_LABEL[slot]}\n{label}`
				btn.BackgroundColor3 = if slot == selected
					then Color3.fromRGB(122, 96, 40)
					elseif filled then Color3.fromRGB(64, 52, 28)
					else Color3.fromRGB(42, 34, 22)
			end
		end
	end

	local function paintParts()
		for _, child in partsFrame:GetChildren() do
			if child:IsA("TextButton") then
				child:Destroy()
			end
		end
		local rows = (state.parts and state.parts[selected]) or {}
		if #rows == 0 then
			local empty = Instance.new("TextButton")
			empty.Size = UDim2.new(1, -8, 0, 32)
			empty.BackgroundColor3 = Color3.fromRGB(42, 34, 22)
			empty.Font = Enum.Font.Gotham
			empty.Text = "No valid parts in pack for this space."
			empty.TextColor3 = Color3.fromRGB(196, 176, 120)
			empty.TextSize = 14
			empty.Parent = partsFrame
		else
			for _, row in rows do
				local b = Instance.new("TextButton")
				b.Size = UDim2.new(1, -8, 0, 32)
				b.BackgroundColor3 = Color3.fromRGB(42, 34, 22)
				b.Font = Enum.Font.Gotham
				b.Text = row.label or row.id
				b.TextColor3 = Color3.fromRGB(236, 228, 210)
				b.TextSize = 15
				b.Parent = partsFrame
				b.MouseButton1Click:Connect(function()
					fire("pick", selected, row.id)
				end)
			end
		end
		local clear = Instance.new("TextButton")
		clear.Size = UDim2.new(1, -8, 0, 32)
		clear.BackgroundColor3 = Color3.fromRGB(70, 40, 32)
		clear.Font = Enum.Font.Gotham
		clear.Text = "Clear this space"
		clear.TextColor3 = Color3.fromRGB(236, 228, 210)
		clear.TextSize = 15
		clear.Parent = partsFrame
		clear.MouseButton1Click:Connect(function()
			fire("clear", selected)
		end)
	end

	for i, slot in SLOT_ORDER do
		local b = Instance.new("TextButton")
		b.Size = UDim2.new(0, 98, 1, 0)
		b.Position = UDim2.fromOffset((i - 1) * 104, 0)
		b.BackgroundColor3 = Color3.fromRGB(42, 34, 22)
		b.Font = Enum.Font.Gotham
		b.Text = SLOT_LABEL[slot]
		b.TextColor3 = Color3.fromRGB(236, 228, 210)
		b.TextSize = 12
		b.TextWrapped = true
		b.Parent = slotRow
		slotButtons[slot] = b
		b.MouseButton1Click:Connect(function()
			selected = slot
			paintSlots()
			paintParts()
		end)
	end

	assemble.MouseButton1Click:Connect(function()
		fire("assemble")
	end)

	if openRemote:IsA("RemoteEvent") then
		openRemote.OnClientEvent:Connect(function(payload)
			if type(payload) == "string" then
				status.Text = payload
				frame.Visible = true
				return
			end
			if type(payload) ~= "table" then
				return
			end
			state = payload
			if type(payload.text) == "string" then
				status.Text = payload.text
			end
			assemble.Text = if payload.canAssemble then "Assemble" else "Assemble (fill all five)"
			paintSlots()
			paintParts()
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
