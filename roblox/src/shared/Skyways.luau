-- Wind skyways from skyCity.ts windSkyway(): cubic ribbons, board-only.
-- Coordinates are browser units. worldize() applies the city Z offset.
local Districts
do
	local ok, loaded = pcall(function()
		return require(script.Parent.Districts)
	end)
	if ok then
		Districts = loaded
	else
		Districts = require("./Districts")
	end
end

local Skyways = {}

local function point(x: number, y: number, z: number)
	return { x = x, y = y, z = z }
end

local function hypot(dx: number, dz: number): number
	return math.sqrt(dx * dx + dz * dz)
end

function Skyways.reefOffset(district): (number, number)
	local hz = district.z + (if district.role == "premium" then 4 else 0)
	return district.x - district.size * 0.55, hz
end

function Skyways.extraPads()
	local pads = {}
	for i = 0, 39 do
		local a = (i / 40) * math.pi * 2
		local r = 180 + (i % 5) * 55
		table.insert(pads, {
			x = math.cos(a) * r + (i % 3) * 20,
			z = math.sin(a) * r + ((i * 7) % 5) * 15,
			w = 14 + (i % 4) * 2,
			d = 12 + (i % 3) * 2,
		})
	end
	return pads
end

-- Bezier ribbon in district space (no city offset). Matches windSkyway().
function Skyways.curve(ax: number, az: number, bx: number, bz: number, opts)
	opts = opts or {}
	local arch = opts.arch or 10
	local width = opts.width or 9
	local entryLift = opts.entryLift or 0.85
	local endInset = opts.endInset or 8
	local dx = bx - ax
	local dz = bz - az
	local dist = hypot(dx, dz)
	if dist < 2 then
		return nil
	end
	local ux = dx / dist
	local uz = dz / dist
	local px = -uz
	local pz = ux
	local curve = math.min(28, dist * 0.12) * (if math.sin(ax * 0.01 + az * 0.007) > 0 then 1 else -1)
	local inset = math.min(endInset, dist * 0.22)
	local deck = Districts.DECK_Y
	local a0 = point(ax + ux * inset, deck + entryLift, az + uz * inset)
	local b0 = point(bx - ux * inset, deck + entryLift, bz - uz * inset)
	local mid = point((ax + bx) / 2 + px * curve, deck + entryLift + arch, (az + bz) / 2 + pz * curve)
	local q1 = point(
		a0.x + (mid.x - a0.x) * 0.45 + px * curve * 0.35,
		a0.y + (mid.y - a0.y) * 0.45 + arch * 0.15,
		a0.z + (mid.z - a0.z) * 0.45 + pz * curve * 0.35
	)
	local q2 = point(
		mid.x + (b0.x - mid.x) * 0.55 - px * curve * 0.35,
		mid.y + (b0.y - mid.y) * 0.55 + arch * 0.1,
		mid.z + (b0.z - mid.z) * 0.55 - pz * curve * 0.35
	)
	local segs = math.max(12, math.ceil(dist / 14))
	local points = {}
	for i = 0, segs do
		local t = i / segs
		local u = 1 - t
		table.insert(
			points,
			point(
				u * u * u * a0.x + 3 * u * u * t * q1.x + 3 * u * t * t * q2.x + t * t * t * b0.x,
				u * u * u * a0.y + 3 * u * u * t * q1.y + 3 * u * t * t * q2.y + t * t * t * b0.y,
				u * u * u * a0.z + 3 * u * u * t * q1.z + 3 * u * t * t * q2.z + t * t * t * b0.z
			)
		)
	end
	return {
		points = points,
		width = width,
		a0 = a0,
		b0 = b0,
		ax = ax,
		az = az,
		bx = bx,
		bz = bz,
		arch = arch,
		dist = dist,
	}
end

function Skyways.worldize(route)
	if not route then
		return nil
	end
	local points = {}
	for _, p in route.points do
		local x, y, z = Districts.world(p.x, p.y, p.z)
		table.insert(points, point(x, y, z))
	end
	local a0x, a0y, a0z = Districts.world(route.a0.x, route.a0.y, route.a0.z)
	local b0x, b0y, b0z = Districts.world(route.b0.x, route.b0.y, route.b0.z)
	return {
		points = points,
		width = route.width,
		a0 = point(a0x, a0y, a0z),
		b0 = point(b0x, b0y, b0z),
		arch = route.arch,
		dist = route.dist,
	}
end

-- Static wind links that always exist in the shipping city (not plot airways).
function Skyways.links()
	local out = {}
	local function add(ax, az, bx, bz, arch, width, entryLift)
		table.insert(out, {
			ax = ax,
			az = az,
			bx = bx,
			bz = bz,
			arch = arch,
			width = width,
			entryLift = entryLift,
		})
	end
	for _, pair in Districts.SKYWAYS do
		local a = Districts.byId(pair[1])
		local b = Districts.byId(pair[2])
		local dist = hypot(a.x - b.x, a.z - b.z)
		add(a.x, a.z, b.x, b.z, math.min(22, 6 + dist * 0.035), 8, 0.85)
	end
	local residential = Districts.byId("residential")
	local ax, az = Districts.apartment()
	add(ax, az, residential.x, residential.z, 4, 6.5, 0.7)
	for _, spot in Districts.NEIGHBORS do
		add(residential.x + spot.dx, residential.z + spot.dz, residential.x, residential.z, 5, 6, 0.7)
	end
	add(residential.x, residential.z, residential.x, residential.z + 36, 5, 6.5, 0.7)
	for _, district in Districts.LIST do
		if Districts.hasReef(district) then
			local rx, rz = Skyways.reefOffset(district)
			add(district.x, district.z, rx, rz, 6, 6.5, 0.85)
		end
	end
	local pads = Skyways.extraPads()
	for i = 1, #pads, 3 do
		local pad = pads[i]
		local best = Districts.LIST[1]
		local bestD = math.huge
		for _, district in Districts.LIST do
			local dd = hypot(district.x - pad.x, district.z - pad.z)
			if dd < bestD then
				bestD = dd
				best = district
			end
		end
		if bestD > 30 and bestD < 220 then
			add(best.x, best.z, pad.x, pad.z, 8 + bestD * 0.02, 6.5, 0.85)
		end
	end
	return out
end

function Skyways.routes()
	local routes = {}
	for _, link in Skyways.links() do
		local localRoute = Skyways.curve(link.ax, link.az, link.bx, link.bz, link)
		local world = Skyways.worldize(localRoute)
		if world then
			table.insert(routes, world)
		end
	end
	return routes
end

local function closestOnSegment(px: number, pz: number, a, b): (number, number, number, number)
	local abx = b.x - a.x
	local abz = b.z - a.z
	local denom = abx * abx + abz * abz
	local t = 0
	if denom > 1e-8 then
		t = math.clamp(((px - a.x) * abx + (pz - a.z) * abz) / denom, 0, 1)
	end
	local x = a.x + abx * t
	local z = a.z + abz * t
	local y = a.y + (b.y - a.y) * t
	local dist = hypot(px - x, pz - z)
	return x, y, z, dist
end

function Skyways.nearest(x: number, z: number, routes)
	local best = nil
	local bestDist = math.huge
	for _, route in routes do
		local pts = route.points
		for i = 1, #pts - 1 do
			local nx, ny, nz, dist = closestOnSegment(x, z, pts[i], pts[i + 1])
			if dist < bestDist then
				bestDist = dist
				local dx = pts[i + 1].x - pts[i].x
				local dz = pts[i + 1].z - pts[i].z
				best = {
					x = nx,
					y = ny,
					z = nz,
					dist = dist,
					width = route.width,
					yaw = math.atan2(dx, dz),
				}
			end
		end
	end
	return best
end

-- Board-only floor: same half-width as the web skyway colliders (width * 0.62).
function Skyways.sampleFloor(x: number, z: number, routes): number?
	local hit = Skyways.nearest(x, z, routes)
	if not hit then
		return nil
	end
	if hit.dist <= hit.width * 0.62 then
		return hit.y
	end
	return nil
end

return Skyways
