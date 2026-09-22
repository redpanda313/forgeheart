-- Romance panel: chat, learn, gift, share story.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local RomanceUi = {}

function RomanceUi.start(gui: ScreenGui)
	local remotes = ReplicatedStorage:WaitForChild("ForgeHeart"):WaitForChild("Remotes")
	local openRemote = remotes:WaitForChild("OpenRomance")
	local actRemote = remotes:WaitForChild("RomanceAct")

	local frame = Instance.new("Frame")
	frame.Name = "RomancePanel"
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
	heading.TextColor3 = Color3.fromRGB(232, 206, 140)
	heading.TextSize = 22
	heading.TextXAlignment = Enum.TextXAlignment.Left
	heading.Text = "Talk"
	heading.Parent = frame

	local status = Instance.new("TextLabel")
	status.BackgroundTransparency = 1
	status.Position = UDim2.fromOffset(16, 40)
	status.Size = UDim2.new(1, -32, 0, 36)
	status.Font = Enum.Font.Gotham
	status.TextWrapped = true
	status.TextColor3 = Color3.fromRGB(196, 176, 120)
	status.TextSize = 14
	status.TextXAlignment = Enum.TextXAlignment.Left
	status.Text = ""
	status.Parent = frame

	local log = Instance.new("TextLabel")
	log.BackgroundTransparency = 1
	log.Position = UDim2.fromOffset(16, 78)
	log.Size = UDim2.new(1, -32, 0, 150)
	log.Font = Enum.Font.Gotham
	log.TextWrapped = true
	log.TextXAlignment = Enum.TextXAlignment.Left
	log.TextYAlignment = Enum.TextYAlignment.Top
	log.TextColor3 = Color3.fromRGB(236, 228, 210)
	log.TextSize = 15
	log.Text = ""
	log.Parent = frame

	local actions = Instance.new("ScrollingFrame")
	actions.BackgroundTransparency = 1
	actions.BorderSizePixel = 0
	actions.Position = UDim2.fromOffset(16, 236)
	actions.Size = UDim2.new(1, -32, 0, 208)
	actions.ScrollBarThickness = 6
	actions.CanvasSize = UDim2.new()
	actions.AutomaticCanvasSize = Enum.AutomaticSize.Y
	actions.Parent = frame
	local list = Instance.new("UIListLayout")
	list.Padding = UDim.new(0, 6)
	list.Parent = actions

	local currentId = nil
	local gifts = {}
	local stories = {}

	local function clearActions()
		for _, child in actions:GetChildren() do
			if child:IsA("TextButton") then
				child:Destroy()
			end
		end
	end

	local function addBtn(text: string, action: string, extra: string?)
		local b = Instance.new("TextButton")
		b.Size = UDim2.new(1, -8, 0, 32)
		b.BackgroundColor3 = Color3.fromRGB(42, 34, 22)
		b.Font = Enum.Font.Gotham
		b.Text = text
		b.TextColor3 = Color3.fromRGB(236, 228, 210)
		b.TextSize = 15
		b.Parent = actions
		local c = Instance.new("UICorner")
		c.CornerRadius = UDim.new(0, 5)
		c.Parent = b
		b.MouseButton1Click:Connect(function()
			if currentId and actRemote:IsA("RemoteEvent") then
				actRemote:FireServer(currentId, action, extra)
			end
		end)
	end

	local function paintMenu()
		clearActions()
		addBtn("Chat", "chat")
		addBtn("Learn what she likes", "learn")
		local n = #gifts
		addBtn(if n > 0 then `Give a gift ({n})` else "Give a gift (none in pack)", "giftmenu")
		addBtn("Share a story", "storymenu")
	end

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
		openRemote.OnClientEvent:Connect(function(payload)
			if type(payload) ~= "table" then
				return
			end
			currentId = payload.id
			heading.Text = payload.title or "Talk"
			status.Text = payload.status or ""
			if type(payload.log) == "string" and payload.log ~= "" then
				log.Text = payload.log
			end
			gifts = payload.gifts or {}
			stories = payload.stories or {}
			local view = payload.view or "menu"
			clearActions()
			if view == "gift" then
				if #gifts == 0 then
					addBtn("No gifts in pack", "menu")
				else
					for _, g in gifts do
						addBtn(`Give {g.label}`, "gift", g.id)
					end
				end
				addBtn("Back", "menu")
			elseif view == "story" then
				for _, s in stories do
					local label = if s.locked then `{s.title} — {s.reason or "locked"}` else s.title
					addBtn(label, "story", s.id)
				end
				addBtn("Back", "menu")
			else
				paintMenu()
			end
			frame.Visible = true
		end)
	end

	UserInputService.InputBegan:Connect(function(input)
		if input.KeyCode == Enum.KeyCode.Escape then
			frame.Visible = false
		end
	end)
end

return RomanceUi
