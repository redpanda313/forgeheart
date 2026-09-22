-- Crew programs: hire, pay grades, jobs, templates, and node graphs.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local ProgramUi = {}

local CATS = {
	{ id = "haul", label = "Haul" },
	{ id = "craft", label = "Craft" },
	{ id = "market_sell", label = "Sell" },
	{ id = "market_buy", label = "Buy" },
	{ id = "stall", label = "Stall" },
	{ id = "service", label = "Service" },
}

local function style(btn: TextButton)
	btn.BackgroundColor3 = Color3.fromRGB(42, 34, 22)
	btn.Font = Enum.Font.Gotham
	btn.TextColor3 = Color3.fromRGB(236, 228, 210)
	btn.TextSize = 13
	btn.TextWrapped = true
	btn.AutoButtonColor = true
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 4)
	corner.Parent = btn
end

local function clear(list: Instance)
	for _, child in list:GetChildren() do
		if child:IsA("GuiButton") or child:IsA("TextLabel") or child:IsA("Frame") then
			child:Destroy()
		end
	end
end

function ProgramUi.start(gui: ScreenGui)
	local remotes = ReplicatedStorage:WaitForChild("ForgeHeart"):WaitForChild("Remotes")
	local openRemote = remotes:WaitForChild("OpenProgram")
	local actRemote = remotes:WaitForChild("ProgramAct")

	local frame = Instance.new("Frame")
	frame.Name = "Programs"
	frame.AnchorPoint = Vector2.new(0.5, 0.5)
	frame.Position = UDim2.fromScale(0.5, 0.5)
	frame.Size = UDim2.fromOffset(860, 520)
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
	heading.Position = UDim2.fromOffset(16, 8)
	heading.Size = UDim2.new(1, -120, 0, 26)
	heading.Font = Enum.Font.Antique
	heading.Text = "Programs"
	heading.TextColor3 = Color3.fromRGB(232, 206, 140)
	heading.TextSize = 22
	heading.TextXAlignment = Enum.TextXAlignment.Left
	heading.Parent = frame

	local closeBtn = Instance.new("TextButton")
	closeBtn.AnchorPoint = Vector2.new(1, 0)
	closeBtn.Position = UDim2.new(1, -12, 0, 8)
	closeBtn.Size = UDim2.fromOffset(72, 26)
	closeBtn.BackgroundColor3 = Color3.fromRGB(122, 96, 40)
	closeBtn.Font = Enum.Font.GothamMedium
	closeBtn.Text = "Close"
	closeBtn.TextColor3 = Color3.fromRGB(245, 236, 214)
	closeBtn.TextSize = 14
	closeBtn.Parent = frame
	style(closeBtn)
	closeBtn.BackgroundColor3 = Color3.fromRGB(122, 96, 40)
	closeBtn.MouseButton1Click:Connect(function()
		frame.Visible = false
	end)

	local log = Instance.new("TextLabel")
	log.BackgroundTransparency = 1
	log.Position = UDim2.fromOffset(16, 34)
	log.Size = UDim2.new(1, -32, 0, 28)
	log.Font = Enum.Font.Gotham
	log.Text = "Lease the starter bay (25 brass), hire at the work post, then assign jobs or a program."
	log.TextColor3 = Color3.fromRGB(196, 176, 120)
	log.TextSize = 13
	log.TextWrapped = true
	log.TextXAlignment = Enum.TextXAlignment.Left
	log.Parent = frame

	local function column(title: string, x: number, width: number)
		local label = Instance.new("TextLabel")
		label.BackgroundTransparency = 1
		label.Position = UDim2.fromOffset(x, 64)
		label.Size = UDim2.fromOffset(width, 20)
		label.Font = Enum.Font.GothamMedium
		label.Text = title
		label.TextColor3 = Color3.fromRGB(232, 206, 140)
		label.TextSize = 14
		label.TextXAlignment = Enum.TextXAlignment.Left
		label.Parent = frame
		local list = Instance.new("ScrollingFrame")
		list.BackgroundTransparency = 1
		list.BorderSizePixel = 0
		list.Position = UDim2.fromOffset(x, 86)
		list.Size = UDim2.fromOffset(width, 420)
		list.ScrollBarThickness = 6
		list.AutomaticCanvasSize = Enum.AutomaticSize.Y
		list.CanvasSize = UDim2.new()
		list.Parent = frame
		local layout = Instance.new("UIListLayout")
		layout.Padding = UDim.new(0, 5)
		layout.Parent = list
		return list
	end

	local crewList = column("Crew", 16, 268)
	local progList = column("Programs", 296, 268)
	local nodeList = column("Add a step", 576, 268)

	local selectedWorker = ""
	local selectedProgram = ""
	local selectedNode = "harvest"
	local filter = "haul"
	local lastPayload = nil

	local function act(...)
		if actRemote:IsA("RemoteEvent") then
			actRemote:FireServer(...)
		end
	end

	local function chip(parent, text, selected, onClick)
		local btn = Instance.new("TextButton")
		btn.Size = UDim2.new(1, -8, 0, 28)
		style(btn)
		btn.Text = text
		if selected then
			btn.BackgroundColor3 = Color3.fromRGB(90, 68, 32)
		end
		btn.Parent = parent
		btn.MouseButton1Click:Connect(onClick)
		return btn
	end

	local function render(payload)
		lastPayload = payload
		if type(payload.log) == "string" and payload.log ~= "" then
			log.Text = payload.log
		end
		if type(payload.activeId) == "string" and payload.activeId ~= "" then
			selectedProgram = payload.activeId
		end
		local crew = payload.crew or {}
		if selectedWorker == "" and crew[1] then
			selectedWorker = crew[1].id
		end
		local still = false
		for _, worker in crew do
			if worker.id == selectedWorker then
				still = true
				break
			end
		end
		if not still then
			selectedWorker = if crew[1] then crew[1].id else ""
		end
		local programs = payload.programs or {}
		local haveProg = false
		for _, program in programs do
			if program.id == selectedProgram then
				haveProg = true
				break
			end
		end
		if not haveProg then
			selectedProgram = if programs[1] then programs[1].id else ""
		end

		clear(crewList)
		local hireCost = payload.hireCost or 35
		local leaseNote = if payload.leased then "Bay leased" else "Lease 25b first"
		chip(crewList, `Hire laborer · {hireCost}b · {leaseNote} · L{payload.bayLevel or 0}`, false, function()
			act("hire")
		end)
		local jobs = payload.jobs or {}
		local jobRows = math.ceil(math.max(1, #jobs) / 3)
		for _, worker in crew do
			local row = Instance.new("Frame")
			row.Size = UDim2.new(1, -8, 0, 66 + jobRows * 22)
			row.BackgroundColor3 = if worker.id == selectedWorker
				then Color3.fromRGB(64, 48, 26)
				else Color3.fromRGB(36, 28, 18)
			row.Parent = crewList
			local rc = Instance.new("UICorner")
			rc.CornerRadius = UDim.new(0, 4)
			rc.Parent = row
			local name = Instance.new("TextButton")
			name.BackgroundTransparency = 1
			name.Size = UDim2.new(1, -8, 0, 36)
			name.Position = UDim2.fromOffset(6, 2)
			name.Font = Enum.Font.Gotham
			name.TextXAlignment = Enum.TextXAlignment.Left
			name.TextColor3 = Color3.fromRGB(236, 228, 210)
			name.TextSize = 13
			name.TextWrapped = true
			local unpaid = if worker.unpaid then " · UNPAID" else ""
			name.Text = `{worker.name} · {worker.jobName or worker.job}{unpaid}\n{worker.payTitle} G{worker.payGrade}`
			name.Parent = row
			name.MouseButton1Click:Connect(function()
				selectedWorker = worker.id
				if lastPayload then
					render(lastPayload)
				end
			end)
			local raise = Instance.new("TextButton")
			raise.Position = UDim2.fromOffset(6, 40)
			raise.Size = UDim2.fromOffset(80, 22)
			style(raise)
			raise.Text = `Raise {worker.raiseCost}b`
			raise.TextSize = 11
			raise.Parent = row
			raise.MouseButton1Click:Connect(function()
				selectedWorker = worker.id
				act("raise", worker.id)
			end)
			local assign = Instance.new("TextButton")
			assign.Position = UDim2.fromOffset(90, 40)
			assign.Size = UDim2.fromOffset(86, 22)
			style(assign)
			assign.Text = "Run program"
			assign.TextSize = 11
			assign.Parent = row
			assign.MouseButton1Click:Connect(function()
				selectedWorker = worker.id
				if selectedProgram ~= "" then
					act("assign", worker.id, selectedProgram)
				end
			end)
			local fire = Instance.new("TextButton")
			fire.Position = UDim2.fromOffset(180, 40)
			fire.Size = UDim2.fromOffset(70, 22)
			style(fire)
			fire.Text = "Fire"
			fire.TextSize = 11
			fire.Parent = row
			fire.MouseButton1Click:Connect(function()
				act("fire", worker.id)
			end)
			for i, job in jobs do
				local col = (i - 1) % 3
				local jr = math.floor((i - 1) / 3)
				local jb = Instance.new("TextButton")
				jb.Position = UDim2.fromOffset(6 + col * 84, 66 + jr * 22)
				jb.Size = UDim2.fromOffset(80, 20)
				style(jb)
				jb.Text = job.name
				jb.TextSize = 10
				if worker.job == job.id then
					jb.BackgroundColor3 = Color3.fromRGB(90, 68, 32)
				end
				jb.Parent = row
				jb.MouseButton1Click:Connect(function()
					selectedWorker = worker.id
					act("job", worker.id, job.id)
				end)
			end
		end

		clear(progList)
		chip(progList, "New harvest loop", false, function()
			act("new")
		end)
		for _, template in payload.templates or {} do
			chip(progList, `{template.name} · {template.blurb}`, false, function()
				act("template", template.id)
			end)
		end
		for _, program in programs do
			local selected = program.id == selectedProgram
			local need = if (program.needGrade or 0) > 0 then ` · G{program.needGrade}+` else ""
			chip(progList, `{program.name} · {#(program.nodes or {})} steps{need}`, selected, function()
				selectedProgram = program.id
				if lastPayload then
					payload.activeId = program.id
					render(payload)
				end
			end)
			if selected then
				for index, step in program.steps or {} do
					local row = Instance.new("Frame")
					row.Size = UDim2.new(1, -8, 0, 26)
					row.BackgroundColor3 = Color3.fromRGB(36, 28, 18)
					row.Parent = progList
					local label = Instance.new("TextLabel")
					label.BackgroundTransparency = 1
					label.Position = UDim2.fromOffset(6, 0)
					label.Size = UDim2.new(1, -90, 1, 0)
					label.Font = Enum.Font.Gotham
					label.Text = `{index}. {step}`
					label.TextColor3 = Color3.fromRGB(236, 228, 210)
					label.TextSize = 12
					label.TextXAlignment = Enum.TextXAlignment.Left
					label.Parent = row
					local up = Instance.new("TextButton")
					up.Position = UDim2.new(1, -84, 0, 2)
					up.Size = UDim2.fromOffset(24, 22)
					style(up)
					up.Text = "↑"
					up.Parent = row
					up.MouseButton1Click:Connect(function()
						act("move", program.id, index, -1)
					end)
					local dn = Instance.new("TextButton")
					dn.Position = UDim2.new(1, -56, 0, 2)
					dn.Size = UDim2.fromOffset(24, 22)
					style(dn)
					dn.Text = "↓"
					dn.Parent = row
					dn.MouseButton1Click:Connect(function()
						act("move", program.id, index, 1)
					end)
					local rm = Instance.new("TextButton")
					rm.Position = UDim2.new(1, -28, 0, 2)
					rm.Size = UDim2.fromOffset(24, 22)
					style(rm)
					rm.Text = "×"
					rm.Parent = row
					rm.MouseButton1Click:Connect(function()
						act("remove", program.id, index)
					end)
				end
			end
		end

		clear(nodeList)
		for _, cat in CATS do
			chip(nodeList, cat.label, filter == cat.id, function()
				filter = cat.id
				if lastPayload then
					render(lastPayload)
				end
			end)
		end
		for _, node in payload.nodes or {} do
			if node.category == filter and node.id ~= "craft_fine_frame" then
				local picked = node.id == selectedNode
				chip(nodeList, node.name, picked, function()
					selectedNode = node.id
					if lastPayload then
						render(lastPayload)
					end
				end)
			end
		end
		chip(nodeList, if selectedProgram ~= "" then `Add · {selectedNode}` else "Pick a program first", false, function()
			if selectedProgram ~= "" and selectedNode ~= "" then
				act("add", selectedProgram, selectedNode)
			end
		end)
	end

	if openRemote:IsA("RemoteEvent") then
		openRemote.OnClientEvent:Connect(function(payload)
			if type(payload) ~= "table" then
				return
			end
			-- Legacy crew-only payload from older servers.
			if payload.crew == nil and payload[1] then
				payload = { crew = payload, programs = {}, jobs = {}, nodes = {}, templates = {}, log = "" }
			end
			render(payload)
			frame.Visible = true
		end)
	end
	UserInputService.InputBegan:Connect(function(input, processed)
		if processed then
			return
		end
		if input.KeyCode == Enum.KeyCode.Escape then
			frame.Visible = false
		end
	end)
end

return ProgramUi
