-- Per-player starter story, workshop siege, then the brass market.
local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local StarterPlayer = game:GetService("StarterPlayer")

local Combat = require(script.Parent.Combat)
local Elias = require(script.Parent.Elias)
local Market = require(script.Parent.Market)
local SkyCity = require(script.Parent.SkyCity)
local Workshop = require(script.Parent.Workshop)

local Shared = ReplicatedStorage:WaitForChild("ForgeHeart")
local Backstory = require(Shared:WaitForChild("Backstory"))
local Board = require(Shared:WaitForChild("Board"))
local BoardMesh = require(Shared:WaitForChild("BoardMesh"))
local CityRules = require(Shared:WaitForChild("CityRules"))
local Frame = require(Shared:WaitForChild("Frame"))
local Economy = require(Shared:WaitForChild("Economy"))
local RobotConfig = require(Shared:WaitForChild("RobotConfig"))
local Scale = require(Shared:WaitForChild("Scale"))
local SpawnProgress = require(Shared:WaitForChild("SpawnProgress"))

local Tutorial = {}
local store = DataStoreService:GetDataStore("ForgeHeartProfile_v1")

local function ensureRemote(name: string): RemoteEvent
	local remotes = Shared:FindFirstChild("Remotes")
	if not remotes then
		remotes = Instance.new("Folder")
		remotes.Name = "Remotes"
		remotes.Parent = Shared
	end
	local existing = remotes:FindFirstChild(name)
	if existing and existing:IsA("RemoteEvent") then
		return existing
	end
	local remote = Instance.new("RemoteEvent")
	remote.Name = name
	remote.Parent = remotes
	return remote
end

local showLore = ensureRemote("ShowLore")
local toggleBoard = ensureRemote("ToggleBoard")
local boardShopRemote = ensureRemote("BoardShop")
local openBoardShop = ensureRemote("OpenBoardShop")
local startHarvest = ensureRemote("StartHarvest")
local harvestResult = ensureRemote("HarvestResult")
local openVendor = ensureRemote("OpenVendor")
local vendorAct = ensureRemote("VendorAct")
local openFrame = ensureRemote("OpenFrame")
local assembleFrame = ensureRemote("AssembleFrame")
local openNeighbor = ensureRemote("OpenNeighbor")
local neighborAct = ensureRemote("NeighborAct")
local openProgram = ensureRemote("OpenProgram")
local requestProgram = ensureRemote("RequestProgram")
local setJob = ensureRemote("SetJob")
local openLease = ensureRemote("OpenLease")
local leaseAct = ensureRemote("LeaseAct")

-- The generator keeps the browser's Hand (1) / scrap (E) wording so seeds still match.
-- Shown copy uses this place's keys: E interacts, R scraps the quiet frame.
local function forRoblox(text: string): string
	text = string.gsub(text, "Hand %(1%)%. Not E%. Not yet%.", "Press E to wake. Scrap is R. Not yet.")
	text = string.gsub(text, "use the Hand %(1%) to wake", "press E to wake")
	text = string.gsub(text, "with the Hand %(1%)", "with E")
	text = string.gsub(text, "not scrap %(E%)", "not scrap (R)")
	text = string.gsub(text, "Hand %(1%)", "E")
	text = string.gsub(text, "Hand weapon%. Click to reprogram%.", "Press E to wake them.")
	text = string.gsub(text, "Reprogram with the Hand", "Wake with E")
	text = string.gsub(text, "with the Hand, not the wrench", "with E, not the wrench")
	return text
end

local function tell(player: Player, title: string, body: string)
	showLore:FireClient(player, forRoblox(title), forRoblox(body))
end

local stories: { [Player]: any } = {}
local profiles: { [Player]: any } = {}
local plasma: { [Player]: number } = {}
local nextSwing: { [Player]: number } = {}
local harvestWait: { [Player]: boolean } = {}

local world = {
	phase = "explore",
	bangs = 0,
	bangTimer = 0,
	doorHp = 4,
	demons = {} :: { Model },
	trays = 0,
	scrapped = false,
	allyHit = 0,
}

local built: any = nil
local market: any = nil
local elias: Model? = nil
local workshopPad: SpawnLocation? = nil
local marketPad: SpawnLocation? = nil
local cityPad: SpawnLocation? = nil

local function storyOf(player: Player)
	return stories[player]
end

local function profileOf(player: Player)
	return profiles[player]
end

local function newSeed(): number
	return bit32.bor(math.floor(math.random() * 4294967295), 0)
end

local function save(player: Player)
	local profile = profileOf(player)
	local story = storyOf(player)
	if not profile or not story then
		return
	end
	local payload = {
		version = 5,
		backstorySeed = story.seed,
		phase = profile.phase,
		spawn = profile.spawn,
		eliasAwake = profile.eliasAwake,
		brass = profile.inv.brass,
		items = profile.inv.items,
		apartment = profile.inv.apartment,
		harvestRuns = profile.inv.harvestRuns,
		cityWorkshopLeased = profile.inv.cityWorkshopLeased,
		parcelLeased = profile.inv.parcelLeased,
		bayLevel = profile.inv.bayLevel,
		empireStanding = profile.inv.empireStanding,
		districtStanding = profile.inv.districtStanding,
		metNeighbor = profile.inv.metNeighbor,
		workers = profile.inv.workers,
		home = profile.inv.home,
		stalls = profile.inv.stalls,
		knownNeighbors = profile.inv.knownNeighbors,
		deedStandingGranted = profile.inv.deedStandingGranted,
		upkeepIn = profile.inv.upkeepIn,
		customRecipes = profile.inv.customRecipes,
		customStock = profile.inv.customStock,
		inventionsMade = profile.inv.inventionsMade,
		repairsDone = profile.inv.repairsDone,
		clearedDebt = profile.inv.clearedDebt,
		hiredNeighbor = profile.inv.hiredNeighbor,
		plantedGarden = profile.inv.plantedGarden,
		debts = profile.inv.debts,
		plot = profile.inv.plot,
		rogueId = profile.inv.rogueId,
		playerBoard = profile.inv.playerBoard,
		neighborAff = profile.inv.neighborAff,
		assembledFrames = profile.inv.assembledFrames,
	}
	pcall(function()
		store:SetAsync("u_" .. player.UserId, payload)
	end)
end

local function load(player: Player)
	local ok, data = pcall(function()
		return store:GetAsync("u_" .. player.UserId)
	end)
	local seed = newSeed()
	local phase = "explore"
	local awake = false
	local inv = Economy.empty(Economy.STARTER_BRASS)
	CityRules.ensure(inv)
	if ok and type(data) == "table" then
		if type(data.backstorySeed) == "number" then
			seed = data.backstorySeed
		end
		if type(data.phase) == "string" then
			phase = data.phase
		elseif data.eliasAwake == true then
			phase = "siege"
		end
		awake = data.eliasAwake == true or phase ~= "explore"
		if type(data.brass) == "number" then
			inv.brass = data.brass
		end
		if type(data.items) == "table" then
			inv.items = data.items
		end
		inv.apartment = data.apartment == true
		inv.harvestRuns = data.harvestRuns or 0
		if data.cityWorkshopLeased ~= nil then
			inv.cityWorkshopLeased = data.cityWorkshopLeased == true
		end
		if data.parcelLeased ~= nil then
			inv.parcelLeased = data.parcelLeased == true
		end
		if type(data.bayLevel) == "number" then
			inv.bayLevel = data.bayLevel
		end
		if type(data.empireStanding) == "number" then
			inv.empireStanding = data.empireStanding
		end
		if type(data.districtStanding) == "table" then
			inv.districtStanding = data.districtStanding
		end
		inv.metNeighbor = data.metNeighbor == true
		if type(data.workers) == "table" then
			inv.workers = data.workers
		end
		if type(data.home) == "table" then
			inv.home = data.home
		end
		if type(data.stalls) == "table" then
			inv.stalls = data.stalls
		end
		if type(data.knownNeighbors) == "table" then
			inv.knownNeighbors = data.knownNeighbors
		end
		inv.deedStandingGranted = data.deedStandingGranted == true
		if type(data.upkeepIn) == "number" then
			inv.upkeepIn = data.upkeepIn
		end
		if type(data.customRecipes) == "table" then
			inv.customRecipes = data.customRecipes
		end
		if type(data.customStock) == "table" then
			inv.customStock = data.customStock
		end
		if type(data.inventionsMade) == "number" then
			inv.inventionsMade = data.inventionsMade
		end
		if type(data.repairsDone) == "number" then
			inv.repairsDone = data.repairsDone
		end
		inv.clearedDebt = data.clearedDebt == true
		inv.hiredNeighbor = data.hiredNeighbor == true
		inv.plantedGarden = data.plantedGarden == true
		if type(data.debts) == "table" then
			inv.debts = data.debts
		end
		if type(data.plot) == "table" then
			inv.plot = data.plot
		end
		if type(data.rogueId) == "string" then
			inv.rogueId = data.rogueId
		end
		if type(data.playerBoard) == "table" then
			inv.playerBoard = data.playerBoard
		elseif data.boardOwned == true then
			inv.playerBoard = { owned = true, thruster = false, rails = false, deck = false }
		end
		if type(data.neighborAff) == "table" then
			inv.neighborAff = data.neighborAff
		end
		if type(data.assembledFrames) == "table" then
			inv.assembledFrames = data.assembledFrames
		end
		Board.ensure(inv)
	end
	Board.ensure(inv)
	local savedSpawn = if ok and type(data) == "table" then data.spawn else nil
	local spawn = SpawnProgress.resolve(savedSpawn, phase, inv.apartment)
	-- A market visit or an old siege overwrite does not resume behind the checkpoint.
	if spawn == SpawnProgress.CITY then
		phase = "city"
		awake = true
	elseif spawn == SpawnProgress.MARKET then
		phase = "market"
		awake = true
	end
	return seed, {
		phase = phase,
		spawn = spawn,
		eliasAwake = awake,
		inv = inv,
	}
end

local function stockText(inv): string
	local parts = {}
	for id, qty in inv.items do
		local def = Economy.COMMODITIES[id]
		if def and type(qty) == "number" and qty > 0 then
			table.insert(parts, `{def.name} {qty}`)
		end
	end
	if type(inv.customRecipes) == "table" and type(inv.customStock) == "table" then
		for _, recipe in inv.customRecipes do
			local n = inv.customStock[recipe.id] or 0
			if n > 0 then
				table.insert(parts, `{recipe.name} {n}`)
			end
		end
	end
	table.sort(parts)
	if #parts == 0 then
		return ""
	end
	return table.concat(parts, " · ")
end

local function sync(player: Player)
	local profile = profileOf(player)
	local story = storyOf(player)
	if not profile or not story then
		return
	end
	Board.ensure(profile.inv)
	player:SetAttribute("Brass", profile.inv.brass)
	player:SetAttribute("Plasma", math.floor(plasma[player] or 100))
	player:SetAttribute("BoardOwned", profile.inv.playerBoard.owned == true)
	player:SetAttribute("BoardSpeedMul", Board.speedMul(profile.inv))
	player:SetAttribute("BoardTurnMul", Board.turnMul(profile.inv))
	player:SetAttribute("WalkMul", Board.walkSpeedMul(profile.inv))
	local carried = stockText(profile.inv)
	if carried == "" and profile.inv.playerBoard.owned then
		carried = "E interact · Q board · wind skyways · I bay · M map"
	elseif carried == "" then
		carried = "E interact · R scrap a quiet frame"
	end
	player:SetAttribute("Stock", carried)
	local crew = {}
	if type(profile.inv.workers) == "table" then
		for _, worker in profile.inv.workers do
			if type(worker) == "table" and type(worker.name) == "string" then
				table.insert(crew, worker.name)
			end
		end
	end
	player:SetAttribute("Crew", if #crew > 0 then table.concat(crew, ", ") else "No crew yet")
	player:SetAttribute("EliasAwake", profile.eliasAwake)
	local tutorial = story.tutorial
	local text = tutorial.objectiveExplore
	if profile.phase == "rebuild" then
		text = tutorial.trayObjective(world.trays)
	elseif profile.phase == "siege" then
		local bashed = 4 - world.doorHp
		text = `Door {world.bangs}/10 · bash {bashed}/4`
	elseif profile.phase == "breach" then
		text = tutorial.surviveObjective
	elseif profile.phase == "escape" then
		text = `Cast off with {story.companionName}.`
	elseif profile.phase == "market" then
		if profile.inv.apartment then
			text = CityRules.objective(profile.inv)
		else
			text = `Harvest the reef, sell at the broker, earn {Economy.APARTMENT_COST} brass.`
		end
	elseif profile.phase == "city" or profile.inv.apartment then
		text = CityRules.objective(profile.inv)
	end
	player:SetAttribute("Objective", forRoblox(text))
end

local function applySign(story)
	if built and built.sign then
		built.sign.Text = string.upper(story.tutorial.workshopName)
	end
	if elias then
		Elias.setName(elias, story.companionName)
	end
end

local function openDoor()
	if not built then
		return
	end
	for _, door in built.doors do
		door.CanCollide = false
		door.Transparency = 1
	end
end

local function closeDoor()
	if not built then
		return
	end
	for _, door in built.doors do
		door.CanCollide = true
		door.Transparency = if door.Name == "DoorSeal" then 1 else 0
	end
end

local function spawnDemons()
	if not built or #world.demons > 0 then
		return
	end
	local feetY = Workshop.brotherFeet().Y
	local spots = { Vector3.new(Scale.studs(-2), feetY, Scale.studs(11)), Vector3.new(Scale.studs(2), feetY, Scale.studs(11.4)) }
	for index, spot in spots do
		table.insert(world.demons, Combat.spawnDemon(built.folder, spot, "Demon" .. index))
	end
end

local function hostilesLeft(): number
	local left = 0
	for _, demon in world.demons do
		if demon.Parent and demon:GetAttribute("Phase") == "active" then
			left += 1
		end
	end
	return left
end

local function eachStory(callback: (Player, any) -> ())
	for _, player in Players:GetPlayers() do
		local story = storyOf(player)
		if story then
			callback(player, story)
		end
	end
end

local function stillInWorkshop(profile): boolean
	return profile ~= nil and not SpawnProgress.locked(profile.spawn)
end

local function setPhase(phase: string)
	world.phase = phase
	for _, player in Players:GetPlayers() do
		local profile = profileOf(player)
		if stillInWorkshop(profile) then
			profile.phase = phase
			sync(player)
			save(player)
		end
	end
end

local function beginSiege()
	if world.phase ~= "explore" and world.phase ~= "rebuild" then
		return
	end
	world.bangs = 0
	world.bangTimer = 1.2
	world.doorHp = 4
	setPhase("siege")
	if built then
		built.wrench.Enabled = true
	end
	eachStory(function(player, story)
		tell(player, "A BANG at the lab door —", story.tutorial.siegeToast)
	end)
end

local function breach(forced: boolean)
	if world.phase == "breach" or world.phase == "escape" or world.phase == "market" then
		return
	end
	openDoor()
	spawnDemons()
	setPhase("breach")
	eachStory(function(player, story)
		local title = if forced then "DOOR BREACHED — you forced it open!" else "The door gives —"
		tell(player, title, story.tutorial.breachToastFight)
	end)
end

local function beginEscape()
	if world.phase ~= "breach" then
		return
	end
	setPhase("escape")
	if built then
		built.boat.Enabled = true
	end
	eachStory(function(player, story)
		tell(player, "The dock is clear", `Reach the skiff. Cast off with {story.companionName}.`)
	end)
end

local swing: (Player) -> ()

local function makeWrench(): Tool
	local tool = Instance.new("Tool")
	tool.Name = "Arc Wrench"
	tool.RequiresHandle = true
	tool.ToolTip = "Arc a frame or the sealed door"
	local handle = Instance.new("Part")
	handle.Name = "Handle"
	handle.Size = Vector3.new(0.35, 1.5, 0.35)
	handle.Color = Color3.fromRGB(184, 146, 58)
	handle.Material = Enum.Material.Metal
	handle.Parent = tool
	return tool
end

local function giveWrench(player: Player)
	local function holding(): boolean
		local backpack = player:FindFirstChildOfClass("Backpack")
		local character = player.Character
		return (backpack and backpack:FindFirstChild("Arc Wrench") ~= nil)
			or (character and character:FindFirstChild("Arc Wrench") ~= nil)
	end
	if holding() then
		return
	end
	local tool = makeWrench()
	tool.Activated:Connect(function()
		swing(player)
	end)
	local backpack = player:FindFirstChildOfClass("Backpack")
	if not backpack then
		local waited = player:WaitForChild("Backpack", 4)
		if waited and waited:IsA("Backpack") then
			backpack = waited
		end
	end
	if backpack then
		tool.Parent = backpack
	end
end

swing = function(player: Player)
	local now = os.clock()
	if (nextSwing[player] or 0) > now then
		return
	end
	local character = player.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	if not root or not root:IsA("BasePart") then
		return
	end
	local profile = profileOf(player)
	if not profile then
		return
	end
	if world.phase ~= "siege" and world.phase ~= "breach" then
		return
	end
	local pool = plasma[player] or 100
	if pool < RobotConfig.arcPlasmaCost then
		nextSwing[player] = now + 0.36
		tell(player, "Arc wrench", "Plasma too thin — let it settle.")
		return
	end
	nextSwing[player] = now + 0.36
	plasma[player] = pool - RobotConfig.arcPlasmaCost
	sync(player)
	if world.phase == "siege" then
		local door = Vector3.new(0, root.Position.Y, Scale.studs(8))
		if root.Position.Z < door.Z and (root.Position - door).Magnitude < Scale.studs(4) then
			world.doorHp -= 1
			if world.doorHp <= 0 then
				tell(player, "DOOR BREACHED — you forced it open!", "The seal yields to the arc. Whatever was banging is coming through.")
				breach(true)
			else
				tell(player, "The iron rings", if world.doorHp == 1 then "Door almost broken — one more arc!" else `{world.doorHp} hits left.`)
				sync(player)
			end
			return
		end
	end
	local best: Model? = nil
	local bestDist = Combat.arcRange()
	for _, demon in world.demons do
		if demon.Parent and demon:GetAttribute("Phase") == "active" then
			local dist = (demon:GetPivot().Position - root.Position).Magnitude
			if dist < bestDist then
				best = demon
				bestDist = dist
			end
		end
	end
	if best then
		local result = Combat.hit(best)
		if result == "disabled" or result == "scrambled" then
			tell(player, "Frame down", if result == "scrambled" then "Eyes dark. The pattern broke." else "Integrity gone.")
		end
		if hostilesLeft() == 0 then
			beginEscape()
		end
	end
end

local function applyRespawn(player: Player)
	local profile = profileOf(player)
	local checkpoint = if profile then profile.spawn else SpawnProgress.WORKSHOP
	local pad = workshopPad
	if checkpoint == SpawnProgress.CITY then
		pad = cityPad
	elseif checkpoint == SpawnProgress.MARKET then
		pad = marketPad
	end
	if pad then
		player.RespawnLocation = pad
	end
end

local function goMarket(player: Player)
	local profile = profileOf(player)
	if not profile then
		return
	end
	profile.phase = "market"
	profile.spawn = SpawnProgress.advance(profile.spawn, SpawnProgress.MARKET)
	profile.eliasAwake = true
	applyRespawn(player)
	sync(player)
	save(player)
	local character = player.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	if root and root:IsA("BasePart") then
		root.CFrame = Market.spawnCFrame()
	end
	if elias and elias:GetAttribute("Awake") == true then
		elias:PivotTo(CFrame.new(Market.spawnCFrame().Position + Vector3.new(4, -3, 2)))
	end
end

local function goCity(player: Player)
	local profile = profileOf(player)
	local story = storyOf(player)
	if not profile or not story then
		return
	end
	profile.phase = "city"
	profile.spawn = SpawnProgress.advance(profile.spawn, SpawnProgress.CITY)
	profile.eliasAwake = true
	CityRules.onDeed(profile.inv, story.companionName)
	applyRespawn(player)
	sync(player)
	save(player)
	local character = player.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	if root and root:IsA("BasePart") then
		root.CFrame = SkyCity.spawnCFrame()
	end
	if elias and elias:GetAttribute("Awake") == true then
		elias:PivotTo(CFrame.new(SkyCity.spawnCFrame().Position + Vector3.new(4, -3, 2)))
	end
end

local function placeCharacter(player: Player, character: Model)
	local root = character:WaitForChild("HumanoidRootPart", 8)
	local humanoid = character:FindFirstChildOfClass("Humanoid")
	local profile = profileOf(player)
	if humanoid then
		local walkMul = if profile then Board.walkSpeedMul(profile.inv) else 1
		humanoid.WalkSpeed = Scale.studs(7) * walkMul
		humanoid.UseJumpPower = false
		humanoid.JumpHeight = Scale.studs(1.6)
		humanoid.MaxHealth = 100
		humanoid.Health = 100
	end
	-- Dying on a ferry visit, or rejoining after one, resumes at the cottage.
	if profile and profile.spawn == SpawnProgress.CITY and profile.phase ~= "city" then
		profile.phase = "city"
		sync(player)
		save(player)
	end
	if root and root:IsA("BasePart") then
		if profile and profile.spawn == SpawnProgress.CITY then
			root.CFrame = SkyCity.spawnCFrame()
		elseif profile and profile.spawn == SpawnProgress.MARKET then
			root.CFrame = Market.spawnCFrame()
		else
			root.CFrame = Workshop.spawnCFrame()
		end
	end
	applyRespawn(player)
	player:SetAttribute("Health", 100)
	if profile and (profile.phase == "siege" or profile.phase == "breach" or profile.phase == "escape") then
		giveWrench(player)
	end
end

function Tutorial.start()
	StarterPlayer.CameraMode = Enum.CameraMode.Classic
	StarterPlayer.CameraMinZoomDistance = 6
	StarterPlayer.CameraMaxZoomDistance = 20

	built = Workshop.build(workspace)
	market = Market.build(workspace)
	local city = SkyCity.build(workspace)
	workshopPad = built.spawn
	marketPad = market.spawn
	cityPad = city.spawn
	elias = Elias.create(built.folder, Workshop.brotherFeet())
	local companion = elias :: Model
	local eliasBoard = BoardMesh.make(workspace, "EliasBoard")
	Elias.attachBoard(eliasBoard)

	built.photo.Triggered:Connect(function(player)
		local story = storyOf(player)
		if not story then
			return
		end
		tell(player, story.tutorial.photoTitle, story.tutorial.photoText)
	end)
	local notes = { built.journal, built.theory, built.talisman }
	for index, notePrompt in notes do
		notePrompt.Triggered:Connect(function(player)
			local story = storyOf(player)
			if not story then
				return
			end
			local note = story.tutorial.notes[index]
			if note then
				notePrompt.ObjectText = note.title
				tell(player, note.title, note.text)
			end
		end)
	end

	built.wrench.Triggered:Connect(function(player)
		local story = storyOf(player)
		if world.phase ~= "siege" and world.phase ~= "breach" and world.phase ~= "escape" then
			tell(player, "Arc wrench", "The rack is quiet. Wake your frame first.")
			return
		end
		giveWrench(player)
		if story then
			tell(player, "Arc wrench", story.tutorial.wrenchText)
		end
	end)

	for index, trayPrompt in built.trays do
		trayPrompt.Triggered:Connect(function(player)
			local story = storyOf(player)
			if not story or not world.scrapped or trayPrompt:GetAttribute("Taken") == true then
				return
			end
			trayPrompt:SetAttribute("Taken", true)
			trayPrompt.Enabled = false
			local trayPart = trayPrompt.Parent
			if trayPart and trayPart:IsA("BasePart") then
				trayPart.Transparency = 0.35
			end
			world.trays += 1
			local label = story.tutorial.trayLabels[index]
			tell(player, label, story.tutorial.trayPartFlash(label, world.trays))
			if world.trays >= 3 then
				world.scrapped = false
				Elias.setVisible(companion, true)
				local wake = companion:FindFirstChild("WakePrompt", true)
				local scrap = companion:FindFirstChild("ScrapPrompt", true)
				if wake and wake:IsA("ProximityPrompt") then
					wake.Enabled = true
				end
				if scrap and scrap:IsA("ProximityPrompt") then
					scrap.Enabled = true
				end
				for _, other in Players:GetPlayers() do
					local profile = profileOf(other)
					if stillInWorkshop(profile) then
						profile.phase = "explore"
					end
				end
				setPhase("explore")
				tell(player, story.tutorial.rebuildFlash, story.tutorial.rebuildToast)
			else
				for _, other in Players:GetPlayers() do
					local profile = profileOf(other)
					if stillInWorkshop(profile) then
						profile.phase = "rebuild"
						sync(other)
					end
				end
			end
		end)
	end

	local wakePrompt = companion:FindFirstChild("WakePrompt", true)
	if wakePrompt and wakePrompt:IsA("ProximityPrompt") then
		wakePrompt.Triggered:Connect(function(player)
			local story = storyOf(player)
			local profile = profileOf(player)
			if not story or not profile or companion:GetAttribute("Awake") == true or world.scrapped then
				return
			end
			Elias.wake(companion)
			profile.eliasAwake = true
			for _, other in Players:GetPlayers() do
				local otherProfile = profileOf(other)
				if otherProfile then
					otherProfile.eliasAwake = true
				end
			end
			tell(player, story.tutorial.wakeFlash, story.tutorial.wakeToast)
			beginSiege()
		end)
	end

	local scrapPrompt = companion:FindFirstChild("ScrapPrompt", true)
	if scrapPrompt and scrapPrompt:IsA("ProximityPrompt") then
		scrapPrompt.Triggered:Connect(function(player)
			local story = storyOf(player)
			if not story or companion:GetAttribute("Awake") == true or world.phase ~= "explore" or world.scrapped then
				return
			end
			world.scrapped = true
			world.trays = 0
			Elias.setVisible(companion, false)
			for index, trayPrompt in built.trays do
				trayPrompt:SetAttribute("Taken", false)
				trayPrompt.Enabled = true
				trayPrompt.ObjectText = story.tutorial.trayLabels[index]
				local trayPart = trayPrompt.Parent
				if trayPart and trayPart:IsA("BasePart") then
					trayPart.Transparency = 0
				end
			end
			for _, other in Players:GetPlayers() do
				local profile = profileOf(other)
				if stillInWorkshop(profile) then
					profile.phase = "rebuild"
					sync(other)
				end
			end
			tell(player, story.tutorial.scrapFlash, story.tutorial.scrapToast)
		end)
	end

	built.boat.Triggered:Connect(function(player)
		local story = storyOf(player)
		local profile = profileOf(player)
		if profile and profile.spawn == SpawnProgress.CITY then
			return
		end
		if world.phase ~= "escape" or not story then
			tell(player, "Skiff", "The levers are cold. The dock is not yours yet.")
			return
		end
		tell(player, story.tutorial.winFlash, story.tutorial.winToast)
		local lines = table.concat(story.tutorial.marketLines, " ")
		task.delay(1.2, function()
			if player.Parent then
				tell(player, story.tutorial.workshopName, lines)
			end
		end)
		goMarket(player)
	end)

	local function beginHarvest(player: Player)
		local profile = profileOf(player)
		if not profile or (profile.phase ~= "market" and profile.phase ~= "city") then
			return
		end
		harvestWait[player] = true
		startHarvest:FireClient(player, "Cloud reef")
	end
	market.reef.Triggered:Connect(beginHarvest)

	harvestResult.OnServerEvent:Connect(function(player: Player, success: boolean)
		if harvestWait[player] ~= true then
			return
		end
		harvestWait[player] = nil
		local profile = profileOf(player)
		if not profile then
			return
		end
		if success == true then
			local _, _, message = Economy.harvest(profile.inv, math.random)
			tell(player, "Cloud reef", message)
			sync(player)
			save(player)
		else
			tell(player, "Cloud reef", "Extraction failed — try again.")
		end
	end)

	for vendorId, tradePrompt in market.trades do
		tradePrompt.Triggered:Connect(function(player)
			local profile = profileOf(player)
			if not profile or (profile.phase ~= "market" and profile.phase ~= "city") then
				return
			end
			openVendor:FireClient(player, vendorId)
		end)
	end

	vendorAct.OnServerEvent:Connect(function(player: Player, vendorId: string, action: string, itemId: string)
		local profile = profileOf(player)
		if not profile or (profile.phase ~= "market" and profile.phase ~= "city") then
			return
		end
		local ok, _, message
		if action == "buy" then
			ok, _, message = Economy.buyFromVendor(profile.inv, vendorId, itemId, 1)
		elseif action == "sell" then
			ok, _, message = Economy.sellToVendor(profile.inv, vendorId, itemId, 1)
		else
			return
		end
		tell(player, "Stall", message)
		if ok then
			sync(player)
			save(player)
		end
	end)

	market.broker.Triggered:Connect(function(player)
		local profile = profileOf(player)
		if not profile or profile.phase ~= "market" then
			return
		end
		local _, message = Economy.sellAll(profile.inv)
		local soldInvent, inventMsg = CityRules.sellInventions(profile.inv)
		if soldInvent then
			message = if message == "Nothing to sell." then inventMsg else `{message} {inventMsg}`
		end
		tell(player, "Broker", message)
		sync(player)
		save(player)
	end)

	for recipeId, recipePrompt in market.recipes do
		recipePrompt.Triggered:Connect(function(player)
			local profile = profileOf(player)
			if not profile or profile.phase ~= "market" then
				return
			end
			local _, message = Economy.craft(profile.inv, recipeId)
			tell(player, "Bench", message)
			sync(player)
			save(player)
		end)
	end

	market.apartment.Triggered:Connect(function(player)
		local profile = profileOf(player)
		local story = storyOf(player)
		if not profile or not story or (profile.phase ~= "market" and profile.phase ~= "city") then
			return
		end
		if profile.inv.apartment then
			tell(player, "Real estate", "The cottage is yours. Traveling home.")
			goCity(player)
			return
		end
		local ok, message = Economy.buyApartment(profile.inv)
		tell(player, "Real estate", message)
		if ok then
			CityRules.onDeed(profile.inv, story.companionName)
			tell(player, story.companionName, story.summary)
			city.refreshHome(profile.inv.home)
			goCity(player)
		else
			sync(player)
			save(player)
		end
	end)

	local function cityPlayer(player: Player)
		local profile = profileOf(player)
		if not profile or profile.phase ~= "city" then
			return nil
		end
		return profile
	end

	for _, neighbor in city.neighbors do
		neighbor.prompt.Triggered:Connect(function(player)
			local profile = cityPlayer(player)
			if not profile then
				return
			end
			local ok, message = CityRules.talk(profile.inv, neighbor.id)
			local aff = CityRules.affinity(profile.inv, neighbor.id)
			local def = CityRules.neighborDef(neighbor.id)
			openNeighbor:FireClient(player, neighbor.id, if def then def.name else neighbor.id, `{message}\n\nAffinity {aff}. Gift brass or blooms, hire, or clear debt.`)
			if ok then
				sync(player)
				save(player)
			end
		end)
	end

	city.workshop.Triggered:Connect(function(player)
		local profile = cityPlayer(player)
		if not profile then
			return
		end
		local _, message = CityRules.leaseWorkshop(profile.inv)
		tell(player, "Industrial slips", message)
		sync(player)
		save(player)
	end)

	city.hire.Triggered:Connect(function(player)
		local profile = cityPlayer(player)
		if not profile then
			return
		end
		local _, message = CityRules.hireHuman(profile.inv)
		tell(player, "Hire board", message)
		sync(player)
		save(player)
	end)

	city.expand.Triggered:Connect(function(player)
		local profile = cityPlayer(player)
		if not profile then
			return
		end
		local _, message = CityRules.expandBay(profile.inv)
		tell(player, "Workshop slip", message)
		sync(player)
		save(player)
	end)

	city.stall.Triggered:Connect(function(player)
		local profile = cityPlayer(player)
		if not profile then
			return
		end
		local _, message = CityRules.leaseStall(profile.inv, "residential")
		tell(player, "Plaza stall", message)
		sync(player)
		save(player)
	end)

	local function cityAct(player: Player, title: string, ok: boolean, message: string)
		tell(player, title, message)
		if ok then
			sync(player)
			save(player)
		end
	end

	city.stock.Triggered:Connect(function(player)
		local profile = cityPlayer(player)
		if not profile then
			return
		end
		local ok, message = CityRules.stockStall(profile.inv, "residential")
		cityAct(player, "Shelf", ok, message)
	end)

	city.grandStall.Triggered:Connect(function(player)
		local profile = cityPlayer(player)
		if not profile then
			return
		end
		local ok, message = CityRules.leaseStall(profile.inv, "grand_market")
		cityAct(player, "Grand Market", ok, message)
	end)

	city.industrialStall.Triggered:Connect(function(player)
		local profile = cityPlayer(player)
		if not profile then
			return
		end
		local ok, message = CityRules.leaseStall(profile.inv, "industrial")
		cityAct(player, "Industrial stall", ok, message)
	end)

	city.invent.Triggered:Connect(function(player)
		local profile = cityPlayer(player)
		if not profile then
			return
		end
		local ok, message = CityRules.invent(profile.inv)
		cityAct(player, "Invent", ok, message)
	end)

	city.craft.Triggered:Connect(function(player)
		local profile = cityPlayer(player)
		if not profile then
			return
		end
		local ok, message = CityRules.craftInvention(profile.inv)
		cityAct(player, "Bench", ok, message)
	end)

	city.robot.Triggered:Connect(function(player)
		local profile = cityPlayer(player)
		if not profile then
			return
		end
		local ok, message = CityRules.buyRobot(profile.inv)
		cityAct(player, "Slip chassis", ok, message)
	end)

	city.plot.Triggered:Connect(function(player)
		local profile = cityPlayer(player)
		if not profile then
			return
		end
		local status = if profile.inv.plot.owned
			then "You hold residential pad (0,0). Décor and garden still use the pegs."
			else "Residential ring 3×3. City pad (0,0) is 16,560 brass. Other cells stay NPC-held."
		openLease:FireClient(player, status)
	end)

	if city.assemble then
		city.assemble.Triggered:Connect(function(player)
			local profile = cityPlayer(player)
			if not profile then
				return
			end
			Frame.ensure(profile.inv)
			local fill = Frame.autoFill(profile.inv)
			local lines = { "Five spaces: chassis · mechanisms · power · wiring · personality.", "" }
			for _, slot in Frame.SLOTS do
				table.insert(lines, `{slot}: {fill[slot] or "empty"}`)
			end
			if #profile.inv.assembledFrames > 0 then
				table.insert(lines, "")
				table.insert(lines, `Frames owned: {#profile.inv.assembledFrames}`)
			end
			openFrame:FireClient(player, table.concat(lines, "\n"))
		end)
	end

	city.decor.Triggered:Connect(function(player)
		local profile = cityPlayer(player)
		if not profile then
			return
		end
		local ok, message = CityRules.developPlot(profile.inv, "decor")
		city.refreshPlot(profile.inv.plot)
		cityAct(player, "Plot", ok, message)
	end)

	city.garden.Triggered:Connect(function(player)
		local profile = cityPlayer(player)
		if not profile then
			return
		end
		local ok, message = CityRules.developPlot(profile.inv, "garden")
		city.refreshPlot(profile.inv.plot)
		cityAct(player, "Plot", ok, message)
	end)

	for neighborId, debtPrompt in city.debts do
		debtPrompt.Triggered:Connect(function(player)
			local profile = cityPlayer(player)
			if not profile then
				return
			end
			local ok, message = CityRules.clearDebt(profile.inv, neighborId)
			cityAct(player, "Debt", ok, message)
		end)
	end

	for neighborId, hirePrompt in city.hires do
		hirePrompt.Triggered:Connect(function(player)
			local profile = cityPlayer(player)
			if not profile then
				return
			end
			local ok, message = CityRules.hireNeighbor(profile.inv, neighborId)
			cityAct(player, "Hire", ok, message)
		end)
	end

	if city.repair then
		city.repair.Triggered:Connect(function(player)
			local profile = cityPlayer(player)
			if not profile then
				return
			end
			local ok, message = CityRules.repairRogue(profile.inv)
			if ok then
				SkyCity.setRogue(false)
			end
			cityAct(player, "Repair", ok, message)
		end)
	end

	city.home.Triggered:Connect(function(player)
		local profile = cityPlayer(player)
		if not profile then
			return
		end
		local _, message = CityRules.improveHome(profile.inv)
		tell(player, "Cottage", message)
		city.home.ObjectText = CityRules.tierDef(profile.inv.home.tier).name
		city.refreshHome(profile.inv.home)
		sync(player)
		save(player)
	end)

	city.reef.Triggered:Connect(beginHarvest)

	city.broker.Triggered:Connect(function(player)
		local profile = cityPlayer(player)
		if not profile then
			return
		end
		local _, message = Economy.sellAll(profile.inv)
		local soldInvent, inventMsg = CityRules.sellInventions(profile.inv)
		if soldInvent then
			message = if message == "Nothing to sell." then inventMsg else `{message} {inventMsg}`
		end
		tell(player, "Broker", message)
		sync(player)
		save(player)
	end)

	for recipeId, recipePrompt in city.recipes do
		recipePrompt.Triggered:Connect(function(player)
			local profile = cityPlayer(player)
			if not profile then
				return
			end
			local _, message = Economy.craft(profile.inv, recipeId)
			tell(player, "Bench", message)
			sync(player)
			save(player)
		end)
	end

	local function openShop(player: Player)
		local profile = profileOf(player)
		if not profile or (profile.phase ~= "market" and profile.phase ~= "city") then
			return
		end
		Board.ensure(profile.inv)
		local board = profile.inv.playerBoard
		local status = if board.owned
			then "Board owned. Q rides anywhere. Fit thruster, rails, or deck."
			else `Buy the chassis for {Board.BASE_COST} brass. One purchase forever.`
		openBoardShop:FireClient(player, status)
	end
	market.boardShop.Triggered:Connect(openShop)
	city.boardShop.Triggered:Connect(openShop)

	boardShopRemote.OnServerEvent:Connect(function(player: Player, action: string)
		local profile = profileOf(player)
		if not profile or (profile.phase ~= "market" and profile.phase ~= "city") then
			return
		end
		Board.ensure(profile.inv)
		local ok, message
		if action == "buy" then
			ok, message = Board.buy(profile.inv)
		elseif action == "thruster" or action == "rails" or action == "deck" then
			ok, message = Board.upgrade(profile.inv, action)
		else
			return
		end
		player:SetAttribute("BoardShopLog", message)
		openBoardShop:FireClient(player, message)
		if ok then
			local character = player.Character
			local humanoid = character and character:FindFirstChildOfClass("Humanoid")
			if humanoid and player:GetAttribute("BoardMounted") ~= true then
				humanoid.WalkSpeed = Scale.studs(7) * Board.walkSpeedMul(profile.inv)
			end
		end
		sync(player)
		save(player)
		if ok and action == "buy" then
			tell(player, "Board shop", "Board stowed. Q rides from anywhere. Wind skyways only — no roads between islands.")
		end
	end)

	assembleFrame.OnServerEvent:Connect(function(player: Player)
		local profile = cityPlayer(player)
		if not profile then
			return
		end
		local fill = Frame.autoFill(profile.inv)
		local ok, message = Frame.assemble(profile.inv, fill)
		tell(player, "Frame bench", message)
		if ok then
			sync(player)
			save(player)
		end
		openFrame:FireClient(player, message)
	end)

	neighborAct.OnServerEvent:Connect(function(player: Player, neighborId: string, action: string)
		local profile = cityPlayer(player)
		if not profile then
			return
		end
		local ok, message = false, "Nothing happens."
		if action == "brass" then
			ok, message = CityRules.giftBrass(profile.inv, neighborId)
		elseif action == "bloom" then
			ok, message = CityRules.giftGood(profile.inv, neighborId, "flower_gift")
		elseif action == "hire" then
			ok, message = CityRules.hireNeighbor(profile.inv, neighborId)
		elseif action == "debt" then
			ok, message = CityRules.clearDebt(profile.inv, neighborId)
		end
		tell(player, "Neighbor", message)
		if ok then
			sync(player)
			save(player)
		end
		openNeighbor:FireClient(player, neighborId, neighborId, `{message}\n\nAffinity {CityRules.affinity(profile.inv, neighborId)}.`)
	end)

	local function sendPrograms(player: Player)
		local profile = profileOf(player)
		if not profile then
			return
		end
		local crew = {}
		for _, worker in profile.inv.workers or {} do
			table.insert(crew, { id = worker.id, name = worker.name, job = worker.job or "harvest" })
		end
		openProgram:FireClient(player, crew)
	end
	requestProgram.OnServerEvent:Connect(sendPrograms)
	setJob.OnServerEvent:Connect(function(player: Player, workerId: string, job: string)
		local profile = profileOf(player)
		if not profile or (profile.phase ~= "market" and profile.phase ~= "city") then
			return
		end
		local ok, message = CityRules.setJob(profile.inv, workerId, job)
		tell(player, "Programs", message)
		if ok then
			sync(player)
			save(player)
		end
		sendPrograms(player)
	end)

	leaseAct.OnServerEvent:Connect(function(player: Player, cellX: number, cellY: number)
		local profile = cityPlayer(player)
		if not profile then
			return
		end
		if cellX ~= 0 or cellY ~= 0 then
			tell(player, "Lease office", "That pad is still held by an NPC household.")
			return
		end
		local ok, message = CityRules.buyPlot(profile.inv)
		if ok then
			city.refreshPlot(profile.inv.plot)
		end
		cityAct(player, "Lease office", ok, message)
		openLease:FireClient(player, message)
	end)

	toggleBoard.OnServerEvent:Connect(function(player: Player, mounted: boolean)
		local profile = profileOf(player)
		if not profile or not profile.inv.playerBoard or not profile.inv.playerBoard.owned then
			player:SetAttribute("BoardMounted", false)
			return
		end
		if profile.phase ~= "market" and profile.phase ~= "city" then
			player:SetAttribute("BoardMounted", false)
			return
		end
		player:SetAttribute("BoardMounted", mounted == true)
	end)

	city.ferry.Triggered:Connect(function(player)
		local profile = profileOf(player)
		local story = storyOf(player)
		if not profile or not story or profile.phase ~= "city" then
			return
		end
		-- A visit. The cottage stays the saved spawn.
		profile.phase = "market"
		applyRespawn(player)
		sync(player)
		save(player)
		local character = player.Character
		local root = character and character:FindFirstChild("HumanoidRootPart")
		if root and root:IsA("BasePart") then
			root.CFrame = Market.spawnCFrame()
		end
		tell(player, "Ferry", "Back at the training market. If you fall, you wake at the cottage. The real-estate desk still knows the way home.")
	end)

	local function onPlayer(player: Player)
		local seed, profile = load(player)
		local story = Backstory.generate(seed)
		stories[player] = story
		profiles[player] = profile
		plasma[player] = plasma[player] or 100
		applyRespawn(player)
		applySign(story)
		for index, notePrompt in { built.journal, built.theory, built.talisman } do
			local note = story.tutorial.notes[index]
			if note then
				notePrompt.ObjectText = note.title
			end
		end
		if profile.phase == "city" then
			if companion:GetAttribute("Awake") ~= true then
				Elias.wake(companion)
			end
			CityRules.ensure(profile.inv)
			CityRules.ensureElias(profile.inv, story.companionName)
			city.refreshHome(profile.inv.home)
			city.refreshPlot(profile.inv.plot)
			SkyCity.setRogue(type(profile.inv.rogueId) == "string")
			tell(player, "Sky City", CityRules.objective(profile.inv))
		elseif profile.phase == "market" then
			if companion:GetAttribute("Awake") ~= true then
				Elias.wake(companion)
			end
			tell(player, "Brass Market", table.concat(story.lines, " "))
		elseif profile.phase == "breach" or profile.phase == "escape" then
			if companion:GetAttribute("Awake") ~= true then
				Elias.wake(companion)
			end
			if world.phase == "explore" or world.phase == "siege" then
				openDoor()
				spawnDemons()
				world.phase = profile.phase
				if built then
					built.wrench.Enabled = true
					built.boat.Enabled = profile.phase == "escape"
				end
			end
			giveWrench(player)
			tell(player, story.tutorial.flashTitle, story.tutorial.openingToast)
		elseif profile.eliasAwake and (world.phase == "explore" or world.phase == "rebuild") then
			if companion:GetAttribute("Awake") ~= true then
				Elias.wake(companion)
			end
			beginSiege()
			giveWrench(player)
			tell(player, story.tutorial.flashTitle, story.tutorial.openingToast)
		else
			tell(player, story.tutorial.flashTitle, story.tutorial.openingToast)
		end
		sync(player)
		player.CharacterAdded:Connect(function(character)
			placeCharacter(player, character)
		end)
		if player.Character then
			placeCharacter(player, player.Character)
		end
	end

	Players.PlayerAdded:Connect(onPlayer)
	Players.PlayerRemoving:Connect(function(player)
		save(player)
		stories[player] = nil
		profiles[player] = nil
		plasma[player] = nil
		nextSwing[player] = nil
		harvestWait[player] = nil
	end)
	for _, player in Players:GetPlayers() do
		onPlayer(player)
	end

	RunService.Heartbeat:Connect(function(dt)
		SkyCity.step(dt)
		for _, player in Players:GetPlayers() do
			local profile = profileOf(player)
			if profile and profile.inv.bayLevel >= 1 then
				profile.inv.upkeepIn -= dt
				if profile.inv.upkeepIn <= 0 then
					profile.inv.upkeepIn = CityRules.UPKEEP_INTERVAL
					local ok, message = CityRules.tickUpkeep(profile.inv)
					if message ~= "" then
						tell(player, if ok then "Upkeep" else "Upkeep missed", message)
					end
					local sold, note = CityRules.tickCustomers(profile.inv)
					if sold then
						tell(player, "Customers", note)
					end
					for _, worker in profile.inv.workers or {} do
						if not worker.unpaid then
							local job = worker.job or "harvest"
							if job == "harvest" then
								Economy.harvest(profile.inv, math.random)
							elseif job == "craft" then
								for _, recipe in Economy.RECIPES do
									local crafted = Economy.craft(profile.inv, recipe.id)
									if crafted then
										break
									end
								end
							elseif job == "stock" then
								for districtId in CityRules.STALLS do
									local stocked = CityRules.stockStall(profile.inv, districtId)
									if stocked then
										break
									end
								end
							end
						end
					end
					sync(player)
					save(player)
				end
			end
		end
		local rogueLive = false
		for _, player in Players:GetPlayers() do
			local profile = profileOf(player)
			if profile and profile.phase == "city" then
				local sparked, message = CityRules.considerRogue(profile.inv, dt, math.random())
				if sparked then
					tell(player, "Rogue", message)
					save(player)
				end
				if type(profile.inv.rogueId) == "string" then
					rogueLive = true
					local character = player.Character
					local root = character and character:FindFirstChild("HumanoidRootPart")
					local humanoid = character and character:FindFirstChildOfClass("Humanoid")
					if root and root:IsA("BasePart") then
						SkyCity.setRogueTarget(root.Position)
						local roguePos = SkyCity.roguePosition()
						if roguePos and humanoid and (roguePos - root.Position).Magnitude < Combat.meleeRange() + 1 then
							local ready = (player:GetAttribute("RogueHit") or 0) <= os.clock()
							if ready then
								player:SetAttribute("RogueHit", os.clock() + RobotConfig.meleeCd)
								humanoid.Health = math.max(0, humanoid.Health - RobotConfig.meleeDamage)
								player:SetAttribute("Health", math.floor(humanoid.Health))
							end
						end
					end
				end
			end
		end
		SkyCity.setRogue(rogueLive)
		if world.phase == "siege" then
			world.bangTimer -= dt
			if world.bangTimer <= 0 then
				world.bangs += 1
				world.bangTimer = 3
				for _, door in built.doors do
					door.Color = if world.bangs % 2 == 0 then Color3.fromRGB(90, 70, 40) else Color3.fromRGB(42, 46, 51)
				end
				if world.bangs == 1 then
					eachStory(function(player)
						tell(player, "BANG", "The iron door shudders.")
					end)
				elseif world.bangs == 8 then
					eachStory(function(player, story)
						tell(player, "The seal bends", story.tutorial.doorAlmostToast)
					end)
				end
				if world.bangs >= 10 then
					breach(false)
				else
					for _, player in Players:GetPlayers() do
						sync(player)
					end
				end
			end
		end

		local nearestRoot: BasePart? = nil
		local nearestDist = math.huge
		for _, player in Players:GetPlayers() do
			local character = player.Character
			local root = character and character:FindFirstChild("HumanoidRootPart")
			local humanoid = character and character:FindFirstChildOfClass("Humanoid")
			if root and root:IsA("BasePart") then
				local dist = (root.Position - companion:GetPivot().Position).Magnitude
				if dist < nearestDist then
					nearestDist = dist
					nearestRoot = root
				end
				if humanoid and world.phase == "breach" then
					for _, demon in world.demons do
						if demon:GetAttribute("Phase") == "active" then
							local gap = (demon:GetPivot().Position - root.Position).Magnitude
							local ready = (demon:GetAttribute("MeleeAt") or 0) <= os.clock()
							if gap < Combat.meleeRange() + 1 and ready then
								demon:SetAttribute("MeleeAt", os.clock() + RobotConfig.meleeCd)
								humanoid.Health = math.max(0, humanoid.Health - RobotConfig.meleeDamage)
								player:SetAttribute("Health", math.floor(humanoid.Health))
							end
						end
					end
				end
			end
		end

		if companion:GetAttribute("Awake") == true and nearestRoot then
			local riding = false
			for _, player in Players:GetPlayers() do
				local character = player.Character
				local root = character and character:FindFirstChild("HumanoidRootPart")
				if root == nearestRoot and player:GetAttribute("BoardMounted") == true then
					riding = true
					break
				end
			end
			if riding then
				Elias.stepBoard(companion, nearestRoot.CFrame, dt)
			elseif nearestDist > Scale.studs(16) then
				local feet = nearestRoot.Position - Vector3.new(0, 3, 0) + nearestRoot.CFrame.LookVector * -6
				companion:PivotTo(CFrame.new(feet))
			else
				Elias.step(companion, nearestRoot.Position, dt)
			end
		end

		for _, player in Players:GetPlayers() do
			local current = plasma[player]
			if current then
				local allies = if companion:GetAttribute("Awake") == true then 1 else 0
				local index = allies + 1
				local eq = RobotConfig.plasmaEq[index]
				local err = eq - current
				if math.abs(err) >= 0.05 then
					local k = if err > 0 then RobotConfig.plasmaRegenK[index] else RobotConfig.plasmaDrainK[index]
					plasma[player] = math.clamp(current + k * err * dt, 0, 100)
				end
				local shown = math.floor(plasma[player])
				if player:GetAttribute("Plasma") ~= shown then
					player:SetAttribute("Plasma", shown)
				end
			end
		end

		if world.phase == "breach" then
			world.allyHit -= dt
			for _, demon in world.demons do
				Combat.repair(demon, dt)
				if nearestRoot and demon:GetAttribute("Phase") == "active" then
					Combat.step(demon, nearestRoot.Position, dt)
				end
				if companion:GetAttribute("Awake") == true and world.allyHit <= 0 and demon:GetAttribute("Phase") == "active" then
					local gap = (demon:GetPivot().Position - companion:GetPivot().Position).Magnitude
					if gap < Combat.arcRange() then
						Combat.hit(demon)
						world.allyHit = RobotConfig.meleeCd
					end
				end
			end
			if hostilesLeft() == 0 and #world.demons > 0 then
				beginEscape()
			end
		end
	end)
end

return Tutorial
