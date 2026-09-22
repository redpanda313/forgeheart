-- Plasma surfboard: numbers and tick from src/forgeheart/surfboard.ts
-- plus the one-purchase shop from economy.ts. Units are browser world units.
local Board = {}

Board.BOARD = {
	maxSpeed = 24,
	accel = 18,
	brake = 18,
	drag = 1.2,
	turnRateSlow = 2.5,
	turnRateFast = 0.85,
	slideTurnMul = 1.65,
	bankMax = 0.58,
	bankLerp = 7,
	slideMinSpeed = 0.28,
	gripAlign = 9,
	slideGripAlign = 0.55,
	slideLateral = 0.42,
	slideChargeFull = 1.15,
	slideBoostMin = 3,
	slideBoostMax = 9,
	jumpVel = 9.5,
	gravity = 26,
	rampBoostJump = 14,
	hoverHeight = 0.55,
	bobAmp = 0.12,
	bobHz = 1.4,
	offPathLimit = 55,
}

Board.BASE_COST = 55
Board.THRUSTER_COST = 30
Board.RAILS_COST = 25
Board.DECK_COST = 20

local B = Board.BOARD

local function damp(current: number, target: number, lambda: number, dt: number): number
	return current + (target - current) * (1 - math.exp(-lambda * dt))
end

local function dampAngle(current: number, target: number, lambda: number, dt: number): number
	local diff = target - current
	while diff > math.pi do
		diff -= math.pi * 2
	end
	while diff < -math.pi do
		diff += math.pi * 2
	end
	return current + diff * (1 - math.exp(-lambda * dt))
end

local function lerp(a: number, b: number, t: number): number
	return a + (b - a) * t
end

function Board.ensure(inv)
	if type(inv.playerBoard) ~= "table" then
		inv.playerBoard = { owned = false, thruster = false, rails = false, deck = false }
	end
	local board = inv.playerBoard
	if board.owned == nil then
		board.owned = false
	end
	if board.thruster == nil then
		board.thruster = false
	end
	if board.rails == nil then
		board.rails = false
	end
	if board.deck == nil then
		board.deck = false
	end
	if board.aetherDrive == nil then
		board.aetherDrive = false
	end
	if board.gyro == nil then
		board.gyro = false
	end
	return board
end

function Board.buy(inv): (boolean, string)
	Board.ensure(inv)
	if inv.playerBoard.owned then
		return false, "You already own a market board base."
	end
	if inv.brass < Board.BASE_COST then
		return false, `Need {Board.BASE_COST} brass for a board chassis.`
	end
	inv.brass -= Board.BASE_COST
	inv.playerBoard.owned = true
	return true, `Board base purchased (−{Board.BASE_COST}). Upgrade thruster, rails, deck here.`
end

function Board.upgrade(inv, part: string): (boolean, string)
	Board.ensure(inv)
	if not inv.playerBoard.owned then
		return false, "Buy a board base first."
	end
	if part == "thruster" then
		if inv.playerBoard.thruster then
			return false, "Thruster already fitted."
		end
		if inv.brass < Board.THRUSTER_COST then
			return false, `Need {Board.THRUSTER_COST} brass.`
		end
		inv.brass -= Board.THRUSTER_COST
		inv.playerBoard.thruster = true
		return true, `Thruster fitted (−{Board.THRUSTER_COST}). Walk speed up on market.`
	end
	if part == "rails" then
		if inv.playerBoard.rails then
			return false, "Rails already fitted."
		end
		if inv.brass < Board.RAILS_COST then
			return false, `Need {Board.RAILS_COST} brass.`
		end
		inv.brass -= Board.RAILS_COST
		inv.playerBoard.rails = true
		return true, `Grip rails fitted (−{Board.RAILS_COST}).`
	end
	if part == "deck" then
		if inv.playerBoard.deck then
			return false, "Deck already upgraded."
		end
		if inv.brass < Board.DECK_COST then
			return false, `Need {Board.DECK_COST} brass.`
		end
		inv.brass -= Board.DECK_COST
		inv.playerBoard.deck = true
		return true, `Reinforced deck (−{Board.DECK_COST}). Status flex, future race use.`
	end
	return false, "Unknown board part."
end

function Board.walkSpeedMul(inv): number
	Board.ensure(inv)
	if not inv.playerBoard.owned then
		return 1
	end
	local m = 1.12
	if inv.playerBoard.thruster then
		m += 0.18
	end
	if inv.playerBoard.rails then
		m += 0.08
	end
	if inv.playerBoard.aetherDrive then
		m += 0.1
	end
	return m
end

function Board.speedMul(inv): number
	Board.ensure(inv)
	if not inv.playerBoard.owned then
		return 1
	end
	local m = 0.72
	if inv.playerBoard.thruster then
		m += 0.22
	end
	if inv.playerBoard.rails then
		m += 0.08
	end
	if inv.playerBoard.deck then
		m += 0.05
	end
	if inv.playerBoard.aetherDrive then
		m += 0.28
	end
	if inv.playerBoard.gyro then
		m += 0.06
	end
	return m
end

function Board.turnMul(inv): number
	Board.ensure(inv)
	if not inv.playerBoard.owned then
		return 1
	end
	local m = 1
	if inv.playerBoard.rails then
		m += 0.12
	end
	if inv.playerBoard.gyro then
		m += 0.35
	end
	return m
end

function Board.newState(x: number, y: number, z: number, yaw: number)
	return {
		x = x,
		y = y,
		z = z,
		yaw = yaw,
		velYaw = yaw,
		bank = 0,
		speed = 0,
		vy = 0,
		mounted = false,
		speedNorm = 0,
		onGround = true,
		surface = "road",
		slideCharge = 0,
		sliding = false,
		bobT = 0,
		jumpBuffer = 0,
		visualY = y,
		pitch = 0,
	}
end

function Board.mount(state)
	state.mounted = true
	state.speed = 2
	state.velYaw = state.yaw
	state.bank = 0
	state.vy = 0
	state.sliding = false
	state.slideCharge = 0
	state.onGround = true
	state.surface = "road"
	state.speedNorm = 0
	state.jumpBuffer = 0
end

function Board.dismount(state): (number, number, number)
	state.mounted = false
	state.speed = 0
	state.bank = 0
	state.sliding = false
	state.slideCharge = 0
	state.speedNorm = 0
	state.vy = 0
	state.jumpBuffer = 0
	local sideX = math.cos(state.yaw) * 1.4
	local sideZ = -math.sin(state.yaw) * 1.4
	return state.x + sideX, state.y + 0.5, state.z + sideZ
end

function Board.requestJump(state)
	state.jumpBuffer = 0.28
end

local function endPowerslide(state)
	if not state.sliding then
		return
	end
	local charge = state.slideCharge
	state.sliding = false
	state.slideCharge = 0
	state.velYaw = state.yaw
	local boost = lerp(B.slideBoostMin, B.slideBoostMax, charge)
	state.speed = math.min(B.maxSpeed, state.speed + boost)
end

-- Free-roam tick used in the market and sky city (no race path magnet).
-- floorY is the deck / wind-lane top, or nil if nothing is under the board.
function Board.tick(state, dt: number, accel: number, steer: number, slideHeld: boolean, floorY: number?)
	state.bobT += dt
	local wantJump = state.jumpBuffer > 0
	if state.jumpBuffer > 0 then
		state.jumpBuffer = math.max(0, state.jumpBuffer - dt)
	end

	local roadY = if floorY ~= nil then floorY + B.hoverHeight else state.y - 80

	local canSlide = state.speedNorm >= B.slideMinSpeed and state.onGround
	local wantSlide = slideHeld and canSlide and math.abs(steer) > 0.15
	if wantSlide then
		state.sliding = true
		state.slideCharge = math.min(1, state.slideCharge + dt / B.slideChargeFull)
	elseif state.sliding then
		endPowerslide(state)
	end

	if accel > 0.1 then
		state.speed += B.accel * accel * dt
	elseif accel < -0.1 then
		state.speed -= B.brake * -accel * dt
	else
		state.speed -= B.drag * dt * (if state.sliding then 0.5 else 1)
	end
	state.speed = math.max(0, math.min(B.maxSpeed, state.speed))
	state.speedNorm = state.speed / B.maxSpeed

	local bankTarget = math.clamp(steer, -1, 1) * B.bankMax * (if state.sliding then 1.15 else 1)
	local bankSpeed = B.bankLerp * (1.2 - state.speedNorm * 0.5)
	state.bank = damp(state.bank, bankTarget, bankSpeed, dt)

	local turnBase = lerp(B.turnRateSlow, B.turnRateFast, state.speedNorm)
	local turnMul = if state.sliding then B.slideTurnMul else 1
	state.yaw += -state.bank * turnBase * turnMul * 1.75 * dt

	local align = if state.sliding then B.slideGripAlign else B.gripAlign
	state.velYaw = dampAngle(state.velYaw, state.yaw, align, dt)

	local velFwdX = math.sin(state.velYaw)
	local velFwdZ = math.cos(state.velYaw)
	local faceFwdX = math.sin(state.yaw)
	local faceFwdZ = math.cos(state.yaw)
	local faceRightX = faceFwdZ
	local faceRightZ = -faceFwdX

	local moveX = velFwdX * state.speed * dt
	local moveZ = velFwdZ * state.speed * dt
	if state.sliding then
		local sign = if state.bank ~= 0 then math.sign(state.bank) elseif steer ~= 0 then math.sign(steer) else 1
		moveX += -sign * state.speed * B.slideLateral * dt * faceRightX
		moveZ += -sign * state.speed * B.slideLateral * dt * faceRightZ
	end

	if wantJump and state.onGround then
		state.jumpBuffer = 0
		state.vy = B.jumpVel
		state.onGround = false
		state.surface = "air"
		state.sliding = false
	end

	if not state.onGround or state.surface == "air" then
		state.vy -= B.gravity * dt
		state.y += state.vy * dt
		if state.y <= roadY and state.vy <= 0 then
			state.y = roadY
			state.vy = 0
			state.onGround = true
			state.surface = "road"
		end
	else
		state.y = damp(state.y, roadY, 8, dt)
		state.vy = 0
	end
	state.x += moveX
	state.z += moveZ

	local bob = math.sin(state.bobT * B.bobHz * math.pi * 2)
		* B.bobAmp
		* (if state.onGround then 0.35 + state.speedNorm * 0.25 else 0)
	state.visualY = state.y + bob
	local slideKick = if state.sliding then -math.sign(if steer ~= 0 then steer elseif state.bank ~= 0 then state.bank else 1) * 0.2 else 0
	state.pitch = -state.speedNorm * 0.08 + (if accel > 0 then -0.05 elseif accel < 0 then 0.06 else 0) + (if state.onGround then 0 else -0.12)
	state.visualBank = state.bank + slideKick
end

function Board.capSpeed(state, mul: number)
	local cap = B.maxSpeed * mul
	if state.speed > cap then
		state.speed = cap
		state.speedNorm = state.speed / B.maxSpeed
	end
end

return Board
