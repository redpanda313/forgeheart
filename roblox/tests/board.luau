local Board = require("../src/shared/Board")

local function fail(message: string)
	error(message, 0)
end

if Board.BASE_COST ~= 55 or Board.THRUSTER_COST ~= 30 or Board.RAILS_COST ~= 25 or Board.DECK_COST ~= 20 then
	fail("board shop prices")
end
if Board.BOARD.maxSpeed ~= 24 or Board.BOARD.accel ~= 18 or Board.BOARD.jumpVel ~= 9.5 then
	fail("board movement constants")
end
if Board.BOARD.slideTurnMul ~= 1.65 or Board.BOARD.hoverHeight ~= 0.55 then
	fail("slide / hover constants")
end

local inv = { brass = 40, playerBoard = nil }
Board.ensure(inv)
local ok, msg = Board.buy(inv)
if ok or not string.find(msg, "55", 1, true) then
	fail("too poor for chassis " .. tostring(msg))
end
inv.brass = 55
ok, msg = Board.buy(inv)
if not ok or inv.brass ~= 0 or inv.playerBoard.owned ~= true then
	fail("buy chassis " .. tostring(msg) .. " " .. tostring(inv.brass))
end
ok = Board.buy(inv)
if ok then
	fail("one purchase forever")
end
if Board.speedMul(inv) ~= 0.72 or Board.walkSpeedMul(inv) ~= 1.12 or Board.turnMul(inv) ~= 1 then
	fail("base muls")
end
inv.brass = 100
ok = Board.upgrade(inv, "thruster")
if not ok or inv.playerBoard.thruster ~= true or inv.brass ~= 70 then
	fail("thruster")
end
ok = Board.upgrade(inv, "rails")
if not ok or Board.turnMul(inv) ~= 1.12 then
	fail("rails turn")
end
ok = Board.upgrade(inv, "deck")
if not ok or math.abs(Board.speedMul(inv) - 1.07) > 1e-9 then
	fail("full speed mul " .. tostring(Board.speedMul(inv)))
end
if math.abs(Board.walkSpeedMul(inv) - 1.38) > 1e-9 then
	fail("walk mul " .. tostring(Board.walkSpeedMul(inv)))
end

local state = Board.newState(0, 1, 0, 0)
Board.mount(state)
if state.speed ~= 2 or state.mounted ~= true then
	fail("mount speed")
end
Board.tick(state, 1, 1, 0, false, 0.2)
if state.speed < 19.9 or state.speed > 20.1 then
	fail("accel one second " .. tostring(state.speed))
end
if math.abs(state.z - 20) > 0.2 then
	fail("forward along +Z " .. tostring(state.z))
end

state = Board.newState(0, 1, 0, 0)
Board.mount(state)
state.speed = 20
state.speedNorm = 20 / 24
Board.tick(state, 0.2, 0, 1, true, 0.2)
if state.sliding ~= true or state.slideCharge <= 0 then
	fail("powerslide")
end
Board.tick(state, 0.2, 0, 0, false, 0.2)
if state.sliding ~= false or state.speed <= 20 then
	fail("slide boost " .. tostring(state.speed))
end

state = Board.newState(0, 0.75, 0, 0)
Board.mount(state)
Board.requestJump(state)
Board.tick(state, 1 / 60, 0, 0, false, 0.2)
local expectedVy = Board.BOARD.jumpVel - Board.BOARD.gravity / 60
if state.onGround ~= false or math.abs(state.vy - expectedVy) > 0.05 then
	fail("jump " .. tostring(state.vy) .. " ground " .. tostring(state.onGround))
end

local dx, _, dz = Board.dismount(state)
if state.mounted ~= false or math.abs(dx - 1.4) > 0.01 then
	fail("dismount side " .. tostring(dx) .. " " .. tostring(dz))
end

print("board rules match")
