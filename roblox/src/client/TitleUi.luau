-- Title screen + pause menu from src/main.ts (3 slots, New Game, Continue).
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local TitleUi = {}

local function stylePanel(frame: Frame)
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 10)
	corner.Parent = frame
	local stroke = Instance.new("UIStroke")
	stroke.Color = Color3.fromRGB(184, 146, 58)
	stroke.Thickness = 1.5
	stroke.Parent = frame
end

local function textBtn(parent: Instance, name: string, label: string, size: UDim2, pos: UDim2): TextButton
	local b = Instance.new("TextButton")
	b.Name = name
	b.Size = size
	b.Position = pos
	b.BackgroundColor3 = Color3.fromRGB(122, 96, 40)
	b.Font = Enum.Font.GothamMedium
	b.Text = label
	b.TextColor3 = Color3.fromRGB(245, 236, 214)
	b.TextSize = 16
	b.AutoButtonColor = true
	b.Parent = parent
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 6)
	c.Parent = b
	return b
end

function TitleUi.start(gui: ScreenGui)
	local remotes = ReplicatedStorage:WaitForChild("ForgeHeart"):WaitForChild("Remotes")
	local listRemote = remotes:WaitForChild("SlotList")
	local selectRemote = remotes:WaitForChild("SelectSlot")
	local newRemote = remotes:WaitForChild("NewGameSlot")
	local continueRemote = remotes:WaitForChild("ContinueSlot")
	local saveRemote = remotes:WaitForChild("PauseSave")
	local titleRemote = remotes:WaitForChild("GoTitle")

	local overlay = Instance.new("Frame")
	overlay.Name = "TitleScreen"
	overlay.Size = UDim2.fromScale(1, 1)
	overlay.BackgroundColor3 = Color3.fromRGB(12, 10, 8)
	overlay.BackgroundTransparency = 0.12
	overlay.Visible = false
	overlay.ZIndex = 40
	overlay.Parent = gui

	local card = Instance.new("Frame")
	card.AnchorPoint = Vector2.new(0.5, 0.5)
	card.Position = UDim2.fromScale(0.5, 0.5)
	card.Size = UDim2.fromOffset(560, 520)
	card.BackgroundColor3 = Color3.fromRGB(24, 18, 12)
	card.ZIndex = 41
	card.Parent = overlay
	stylePanel(card)

	local heading = Instance.new("TextLabel")
	heading.BackgroundTransparency = 1
	heading.Position = UDim2.fromOffset(24, 16)
	heading.Size = UDim2.new(1, -48, 0, 36)
	heading.Font = Enum.Font.Antique
	heading.Text = "Forge Heart"
	heading.TextColor3 = Color3.fromRGB(232, 206, 140)
	heading.TextSize = 28
	heading.TextXAlignment = Enum.TextXAlignment.Left
	heading.ZIndex = 42
	heading.Parent = card

	local sub = Instance.new("TextLabel")
	sub.BackgroundTransparency = 1
	sub.Position = UDim2.fromOffset(24, 52)
	sub.Size = UDim2.new(1, -48, 0, 22)
	sub.Font = Enum.Font.Gotham
	sub.Text = "Gift of the Brass Gods · three save slots"
	sub.TextColor3 = Color3.fromRGB(196, 176, 120)
	sub.TextSize = 14
	sub.TextXAlignment = Enum.TextXAlignment.Left
	sub.ZIndex = 42
	sub.Parent = card

	local info = Instance.new("TextLabel")
	info.Name = "SaveInfo"
	info.BackgroundTransparency = 1
	info.Position = UDim2.fromOffset(24, 82)
	info.Size = UDim2.new(1, -48, 0, 40)
	info.Font = Enum.Font.Gotham
	info.TextWrapped = true
	info.Text = "Select a slot · New Game or Continue for that slot"
	info.TextColor3 = Color3.fromRGB(216, 206, 186)
	info.TextSize = 14
	info.TextXAlignment = Enum.TextXAlignment.Left
	info.ZIndex = 42
	info.Parent = card

	local slotsFrame = Instance.new("Frame")
	slotsFrame.BackgroundTransparency = 1
	slotsFrame.Position = UDim2.fromOffset(24, 128)
	slotsFrame.Size = UDim2.new(1, -48, 0, 220)
	slotsFrame.ZIndex = 42
	slotsFrame.Parent = card

	local selected = 1
	local slots = {}

	local continueBtn = textBtn(card, "Continue", "CONTINUE", UDim2.new(1, -48, 0, 40), UDim2.new(0, 24, 1, -120))
	continueBtn.ZIndex = 42
	local newBtn = textBtn(card, "NewGame", "NEW GAME (Slot 1)", UDim2.new(1, -48, 0, 40), UDim2.new(0, 24, 1, -68))
	newBtn.ZIndex = 42

	local function paint()
		for i, btn in slotsFrame:GetChildren() do
			if btn:IsA("TextButton") then
				local s = slots[tonumber(btn.Name)]
				local on = tonumber(btn.Name) == selected
				btn.BackgroundColor3 = if on then Color3.fromRGB(122, 96, 40) else Color3.fromRGB(42, 34, 22)
				if s then
					if s.empty then
						btn.Text = `{s.label}\n{s.sublabel}`
					else
						btn.Text = `{s.label}\n{s.sublabel} · {s.progress}`
					end
				end
			end
		end
		local s = slots[selected]
		if s and not s.empty then
			continueBtn.Visible = true
			continueBtn.Text = `CONTINUE — Slot {selected} · {s.label}`
			newBtn.Text = `NEW GAME (overwrite Slot {selected})`
			info.Text = `Selected Slot {selected}: {s.label} · Continue loads this save`
		else
			continueBtn.Visible = false
			newBtn.Text = `NEW GAME (Slot {selected})`
			info.Text = `Slot {selected} is empty · New Game starts Voss Workshop`
		end
	end

	local function rebuild()
		for _, child in slotsFrame:GetChildren() do
			child:Destroy()
		end
		for i = 1, 3 do
			local s = slots[i]
			local btn = Instance.new("TextButton")
			btn.Name = tostring(i)
			btn.Size = UDim2.new(1, 0, 0, 64)
			btn.Position = UDim2.fromOffset(0, (i - 1) * 72)
			btn.BackgroundColor3 = Color3.fromRGB(42, 34, 22)
			btn.Font = Enum.Font.Gotham
			btn.TextColor3 = Color3.fromRGB(236, 228, 210)
			btn.TextSize = 15
			btn.TextWrapped = true
			btn.ZIndex = 43
			btn.Parent = slotsFrame
			local c = Instance.new("UICorner")
			c.CornerRadius = UDim.new(0, 6)
			c.Parent = btn
			btn.MouseButton1Click:Connect(function()
				selected = i
				if selectRemote:IsA("RemoteEvent") then
					selectRemote:FireServer(i)
				end
				paint()
			end)
		end
		paint()
	end

	continueBtn.MouseButton1Click:Connect(function()
		if continueRemote:IsA("RemoteEvent") then
			continueRemote:FireServer(selected)
		end
	end)
	newBtn.MouseButton1Click:Connect(function()
		if newRemote:IsA("RemoteEvent") then
			newRemote:FireServer(selected)
		end
	end)

	if listRemote:IsA("RemoteEvent") then
		listRemote.OnClientEvent:Connect(function(payload)
			if type(payload) ~= "table" then
				return
			end
			slots = payload.slots or {}
			selected = payload.selected or payload.lastSlot or 1
			overlay.Visible = payload.open == true
			rebuild()
		end)
	end

	local pause = Instance.new("Frame")
	pause.Name = "PauseMenu"
	pause.AnchorPoint = Vector2.new(0.5, 0.5)
	pause.Position = UDim2.fromScale(0.5, 0.5)
	pause.Size = UDim2.fromOffset(360, 260)
	pause.BackgroundColor3 = Color3.fromRGB(24, 18, 12)
	pause.Visible = false
	pause.ZIndex = 50
	pause.Parent = gui
	stylePanel(pause)
	local pauseTitle = Instance.new("TextLabel")
	pauseTitle.BackgroundTransparency = 1
	pauseTitle.Position = UDim2.fromOffset(20, 14)
	pauseTitle.Size = UDim2.new(1, -40, 0, 28)
	pauseTitle.Font = Enum.Font.Antique
	pauseTitle.Text = "Paused"
	pauseTitle.TextColor3 = Color3.fromRGB(232, 206, 140)
	pauseTitle.TextSize = 24
	pauseTitle.TextXAlignment = Enum.TextXAlignment.Left
	pauseTitle.ZIndex = 51
	pauseTitle.Parent = pause
	local resume = textBtn(pause, "Resume", "Resume", UDim2.new(1, -40, 0, 40), UDim2.fromOffset(20, 60))
	resume.ZIndex = 51
	local saveBtn = textBtn(pause, "Save", "Save", UDim2.new(1, -40, 0, 40), UDim2.fromOffset(20, 112))
	saveBtn.ZIndex = 51
	local toTitle = textBtn(pause, "Title", "Title screen", UDim2.new(1, -40, 0, 40), UDim2.fromOffset(20, 164))
	toTitle.ZIndex = 51
	resume.MouseButton1Click:Connect(function()
		pause.Visible = false
	end)
	saveBtn.MouseButton1Click:Connect(function()
		if saveRemote:IsA("RemoteEvent") then
			saveRemote:FireServer()
		end
		pause.Visible = false
	end)
	toTitle.MouseButton1Click:Connect(function()
		pause.Visible = false
		if titleRemote:IsA("RemoteEvent") then
			titleRemote:FireServer()
		end
	end)

	local function otherCardOpen(): boolean
		for _, name in {
			"RomancePanel",
			"StallOffice",
			"HaggleCard",
			"StorageVault",
			"FrameBench",
			"Vendor",
			"BayOffice",
			"EmpireMap",
			"Lore",
			"NeighborPanel",
			"Programs",
			"LeaseOffice",
		} do
			local card = gui:FindFirstChild(name)
			if card and card:IsA("GuiObject") and card.Visible then
				return true
			end
		end
		return false
	end

	UserInputService.InputBegan:Connect(function(input, processed)
		if processed then
			return
		end
		if input.KeyCode == Enum.KeyCode.Escape then
			if overlay.Visible or otherCardOpen() then
				return
			end
			pause.Visible = not pause.Visible
		end
	end)
end

return TitleUi
