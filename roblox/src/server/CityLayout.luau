-- Sky city geometry from skyCity.ts: district centers, civic pads, 3×3 plots,
-- skyways, apartment, neighbors, reefs, and stall markers.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("ForgeHeart")
local Districts = require(Shared:WaitForChild("Districts"))
local Scale = require(Shared:WaitForChild("Scale"))

local NpcKit = require(script.Parent.NpcKit)

local CityLayout = {}

local function rgb(hex: number): Color3
	local r = math.floor(hex / 65536) % 256
	local g = math.floor(hex / 256) % 256
	local b = hex % 256
	return Color3.fromRGB(r, g, b)
end

local function pos(x: number, y: number, z: number): Vector3
	local wx, wy, wz = Districts.world(x, y, z)
	return Vector3.new(Scale.studs(wx), Scale.studs(wy), Scale.studs(wz))
end

local function box(
	parent: Instance,
	name: string,
	w: number,
	h: number,
	d: number,
	x: number,
	y: number,
	z: number,
	color: Color3,
	material: Enum.Material,
	collide: boolean?
): Part
	local part = Instance.new("Part")
	part.Name = name
	part.Anchored = true
	part.CanCollide = if collide == nil then true else collide
	part.Size = Vector3.new(Scale.studs(w), Scale.studs(h), Scale.studs(d))
	part.Position = pos(x, y, z)
	part.Color = color
	part.Material = material
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	part.Parent = parent
	return part
end

local function disc(parent: Instance, name: string, radius: number, height: number, x: number, y: number, z: number, color: Color3, material: Enum.Material): Part
	local part = Instance.new("Part")
	part.Name = name
	part.Anchored = true
	part.Shape = Enum.PartType.Cylinder
	part.Size = Vector3.new(Scale.studs(height), Scale.studs(radius * 2), Scale.studs(radius * 2))
	part.CFrame = CFrame.new(pos(x, y, z)) * CFrame.Angles(0, 0, math.rad(90))
	part.Color = color
	part.Material = material
	part.Parent = parent
	return part
end

local function floorPad(parent: Instance, name: string, w: number, d: number, x: number, z: number, color: Color3): Part
	return box(parent, name, w, Districts.FLOOR_THICK, d, x, Districts.DECK_Y, z, color, Enum.Material.Concrete, true)
end

local function sign(parent: Instance, name: string, text: string, x: number, y: number, z: number)
	local board = box(parent, name, 8, 1.2, 0.2, x, y, z, Color3.fromRGB(42, 36, 28), Enum.Material.Metal, false)
	local gui = Instance.new("SurfaceGui")
	gui.Face = Enum.NormalId.Front
	gui.CanvasSize = Vector2.new(480, 80)
	gui.Parent = board
	local label = Instance.new("TextLabel")
	label.BackgroundTransparency = 1
	label.Size = UDim2.fromScale(1, 1)
	label.Font = Enum.Font.Antique
	label.Text = text
	label.TextColor3 = Color3.fromRGB(232, 214, 170)
	label.TextScaled = true
	label.Parent = gui
	local back = Instance.new("SurfaceGui")
	back.Face = Enum.NormalId.Back
	back.CanvasSize = Vector2.new(480, 80)
	back.Parent = board
	local backLabel = label:Clone()
	backLabel.Parent = back
	return board
end

local SKY = Color3.fromRGB(80, 200, 220)

local function span(parent: Instance, a: Vector3, b: Vector3, width: number)
	local delta = b - a
	local length = delta.Magnitude
	if length < 0.5 then
		return
	end
	local part = Instance.new("Part")
	part.Name = "Skyway"
	part.Anchored = true
	part.CanCollide = true
	part.Material = Enum.Material.Neon
	part.Color = SKY
	part.Transparency = 0.15
	part.Size = Vector3.new(width, Scale.studs(0.28), length)
	part.CFrame = CFrame.lookAt((a + b) / 2, b)
	part.Parent = parent
end

local function skyway(parent: Instance, x1: number, z1: number, x2: number, z2: number, arch: number, width: number)
	local dist = math.sqrt((x2 - x1) ^ 2 + (z2 - z1) ^ 2)
	local segments = math.clamp(math.ceil(dist / 48), 2, 18)
	local deck = 0.4
	local function at(t: number): Vector3
		local x = x1 + (x2 - x1) * t
		local z = z1 + (z2 - z1) * t
		local y = deck + math.sin(t * math.pi) * arch
		return pos(x, y, z)
	end
	for i = 0, segments - 1 do
		span(parent, at(i / segments), at((i + 1) / segments), Scale.studs(width))
	end
end

local function tree(parent: Instance, x: number, z: number)
	box(parent, "Trunk", 0.35, 1.6, 0.35, x, 1.1, z, Color3.fromRGB(90, 62, 36), Enum.Material.Wood, false)
	local crown = box(parent, "Crown", 1.6, 1.4, 1.6, x, 2.3, z, Color3.fromRGB(70, 120, 78), Enum.Material.Grass, false)
	crown.Shape = Enum.PartType.Ball
end

function CityLayout.build(folder: Folder)
	local layout = Instance.new("Folder")
	layout.Name = "Districts"
	layout.Parent = folder
	local links = Instance.new("Folder")
	links.Name = "Skyways"
	links.Parent = folder

	local stallParts = {}
	local reefParts = {}

	for index, district in Districts.LIST do
		local di = index - 1
		local cx = district.x
		local cz = district.z
		local sz = district.size
		local color = rgb(district.color)
		local island = Instance.new("Folder")
		island.Name = district.id
		island.Parent = layout

		local center = Districts.centerSize(district)
		floorPad(island, "Civic", center, center, cx, cz, color)
		box(island, "Fountain", 3.5, 1.1, 3.5, cx, 0.9, cz, Color3.fromRGB(196, 163, 90), Enum.Material.Metal, true)
		sign(island, "Name", string.upper(district.name), cx, 4.2, cz + sz * 0.35)

		for i = 0, 3 do
			local angle = (i / 4) * math.pi * 2 + 0.5
			local radius = sz * 0.42
			tree(island, cx + math.cos(angle) * radius, cz + math.sin(angle) * radius)
			local lampA = (i / 4) * math.pi * 2 + di * 0.1
			local lx = cx + math.cos(lampA) * (sz * 0.46)
			local lz = cz + math.sin(lampA) * (sz * 0.46)
			box(island, "Lamp", 0.18, 2.2, 0.18, lx, 1.3, lz, Color3.fromRGB(184, 146, 58), Enum.Material.Metal, false)
			local glow = box(island, "LampGlow", 0.32, 0.32, 0.32, lx, 2.5, lz, Color3.fromRGB(255, 220, 140), Enum.Material.Neon, false)
			glow.Shape = Enum.PartType.Ball
		end

		local cell = sz * 0.26
		for cellX = 0, 2 do
			for cellY = 0, 2 do
				local px, pz = Districts.plotCenter(district, cellX, cellY)
				floorPad(island, `Plot_{cellX}_{cellY}`, cell * 0.82, cell * 0.82, px, pz, color)
			end
		end

		local stallX = cx + sz * 0.28
		local stallZ = cz + sz * 0.18
		local stall = box(island, "Stall", 3, 1.6, 2, stallX, 1.1, stallZ, Color3.fromRGB(120, 78, 42), Enum.Material.Wood, true)
		stallParts[district.id] = stall
		sign(island, "StallSign", `STALL · {district.stallCost}`, stallX, 2.9, stallZ + 1.4)
		skyway(links, cx, cz, stallX, stallZ, 4, 6)
		if district.role == "market" or district.role == "premium" or district.role == "mixed" then
			NpcKit.make(island, "vendor", di, "Vendor", pos(stallX - 1.2, 0.55, stallZ))
		end

		local homeA = di * 0.7 + 0.8
		local homeR = sz * 0.38
		local hx = cx + math.cos(homeA) * homeR
		local hz = cz + math.sin(homeA) * homeR
		floorPad(island, "HomePad", 10, 8, hx, hz, color)
		box(island, "Home", 7, 3.2, 6.2, hx, 1.8, hz, color, Enum.Material.Wood, true)
		local standX = hx + math.cos(homeA + math.pi) * 2.2
		local standZ = hz + math.sin(homeA + math.pi) * 2.2
		NpcKit.make(island, "resident", di, "Resident", pos(standX, 0.55, standZ))
		skyway(links, cx, cz, hx, hz, 4, 6)

		if Districts.hasReef(district) then
			local reefX = cx - sz * 0.55
			local reefZ = cz + (if district.role == "premium" then 4 else 0)
			disc(island, "Reef", 10, Districts.FLOOR_THICK, reefX, Districts.DECK_Y, reefZ, Color3.fromRGB(74, 106, 120), Enum.Material.Slate)
			local node = box(island, "ReefNode", 2.2, 1.2, 2.2, reefX, 1.0, reefZ, Color3.fromRGB(90, 140, 150), Enum.Material.Slate, true)
			reefParts[district.id] = node
			skyway(links, cx, cz, reefX, reefZ, 6, 6.5)
		end
	end

	for _, pair in Districts.SKYWAYS do
		local a = Districts.byId(pair[1])
		local b = Districts.byId(pair[2])
		local dist = math.sqrt((a.x - b.x) ^ 2 + (a.z - b.z) ^ 2)
		skyway(links, a.x, a.z, b.x, b.z, math.min(22, 6 + dist * 0.035), 8)
	end

	local residential = Districts.byId("residential")
	local ax, az = Districts.apartment()
	floorPad(folder, "ApartmentPad", 22, 18, ax, az, Color3.fromRGB(106, 95, 80))
	box(folder, "Cottage", 6, 3.2, 5, ax, 1.8, az, Color3.fromRGB(107, 74, 42), Enum.Material.Wood, true)
	box(folder, "CottageRoof", 6.6, 0.35, 5.6, ax, 3.5, az, Color3.fromRGB(184, 146, 58), Enum.Material.Metal, true)
	local homeMark = box(folder, "HomeMark", 1.2, 1.4, 0.3, ax + 2, 1.25, az + 6, Color3.fromRGB(232, 200, 120), Enum.Material.Neon, false)
	sign(folder, "HomeSign", "YOUR HOME", ax, 5.2, az + 2)
	skyway(links, ax, az, residential.x, residential.z, 4, 6.5)
	tree(folder, ax + 10, az + 7)

	local neighbors = {}
	for _, spot in Districts.NEIGHBORS do
		local nx = residential.x + spot.dx
		local nz = residential.z + spot.dz
		floorPad(folder, spot.id .. "Pad", 14, 12, nx, nz, Color3.fromRGB(85, 80, 72))
		box(folder, spot.id .. "House", 5, 3.2, 5, nx, 2, nz, Color3.fromRGB(107, 74, 42), Enum.Material.Wood, true)
		local role = if spot.id == "neighbor_sera" then "girl" else "resident"
		NpcKit.make(folder, role, 0, spot.name, pos(nx + 3, 0.55, nz + 1.2))
		local mark = box(folder, spot.id .. "Door", 1.1, 1.8, 0.2, nx + 3, 1.2, nz, Color3.fromRGB(216, 196, 154), Enum.Material.Wood, false)
		sign(folder, spot.id .. "Sign", string.upper(spot.name), nx, 3.8, nz + 2)
		skyway(links, nx, nz, residential.x, residential.z, 5, 6)
		table.insert(neighbors, { id = spot.id, name = spot.name, part = mark })
	end

	floorPad(folder, "FerryPad", 12, 10, residential.x, residential.z + 36, Color3.fromRGB(74, 80, 96))
	local ferry = box(folder, "Ferry", 3, 1.2, 2, residential.x, 1.2, residential.z + 38, Color3.fromRGB(120, 90, 52), Enum.Material.Wood, true)
	sign(folder, "FerrySign", "FERRY · TRAINING MARKET", residential.x, 2.8, residential.z + 40)
	skyway(links, residential.x, residential.z, residential.x, residential.z + 36, 5, 6.5)

	box(folder, "BoardRack", 2.5, 1.2, 0.5, residential.x + 14, 1.0, residential.z - 12, Color3.fromRGB(74, 78, 85), Enum.Material.Metal, true)
	sign(folder, "BoardSign", "CITY BOARD SHOP", residential.x + 14, 2.8, residential.z - 10)

	local industrial = Districts.byId("industrial")
	local ix = industrial.x + 18
	local iz = industrial.z + 10
	floorPad(folder, "SlipPad", 22, 16, ix, iz, rgb(industrial.color))
	local workshop = box(folder, "WorkshopSlip", 8, 2.4, 5, ix, 1.4, iz, Color3.fromRGB(42, 46, 51), Enum.Material.Metal, true)
	local hire = box(folder, "HireBoard", 2.2, 1.8, 0.3, ix + 6, 1.2, iz, Color3.fromRGB(216, 196, 154), Enum.Material.Wood, true)
	local expand = box(folder, "ExpandBay", 2.2, 1.4, 0.3, ix - 6, 1.2, iz, Color3.fromRGB(184, 146, 58), Enum.Material.Metal, true)
	local invent = box(folder, "InventDesk", 2.4, 1.2, 1.2, ix, 0.9, iz + 6, Color3.fromRGB(184, 115, 51), Enum.Material.Metal, true)
	local robot = box(folder, "RobotDock", 2, 1.2, 1.4, ix, 0.9, iz - 6, Color3.fromRGB(42, 46, 51), Enum.Material.Metal, true)
	skyway(links, industrial.x, industrial.z, ix, iz, 4, 6.5)
	sign(folder, "SlipSign", "INDUSTRIAL SLIPS", ix, 4.2, iz - 6)

	local market = Districts.byId("grand_market")
	local mx = market.x + market.size * 0.28
	local mz = market.z + market.size * 0.18
	local broker = box(folder, "CityBroker", 3.2, 1.8, 1.6, mx + 6, 1.2, mz, Color3.fromRGB(107, 74, 42), Enum.Material.Wood, true)
	local bench = box(folder, "CityBench", 6, 1, 2, mx + 6, 0.8, mz + 6, Color3.fromRGB(74, 50, 24), Enum.Material.Wood, true)
	sign(folder, "MarketSign", "GRAND MARKET", market.x, 5, market.z)

	local px, pz = Districts.plotCenter(residential, 0, 0)
	local plotOffice = box(folder, "PlotOffice", 2.4, 1.6, 1.2, px, 1.1, pz, Color3.fromRGB(184, 146, 58), Enum.Material.Metal, true)
	sign(folder, "PlotSign", "LEASING OFFICE", px, 3.2, pz + 2)

	local dressing = Instance.new("Folder")
	dressing.Name = "HomeDressing"
	dressing.Parent = folder
	local plotDressing = Instance.new("Folder")
	plotDressing.Name = "PlotDressing"
	plotDressing.Parent = folder

	-- Cloud under the empire, tiled so no part exceeds Roblox's size limit.
	local sea = Instance.new("Folder")
	sea.Name = "CloudSea"
	sea.Parent = folder
	for gx = -2, 2 do
		for gz = -2, 2 do
			local tile = box(sea, "Cloud", 400, 0.4, 400, gx * 380, -8, gz * 380, Color3.fromRGB(184, 196, 208), Enum.Material.SmoothPlastic, false)
			tile.Transparency = 0.45
		end
	end

	return {
		stalls = stallParts,
		reefs = reefParts,
		neighbors = neighbors,
		home = homeMark,
		ferry = ferry,
		workshop = workshop,
		hire = hire,
		expand = expand,
		invent = invent,
		robot = robot,
		broker = broker,
		bench = bench,
		plot = plotOffice,
		dressing = dressing,
		plotDressing = plotDressing,
		plotX = px,
		plotZ = pz,
	}
end

return CityLayout
