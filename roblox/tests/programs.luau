local Economy = require("../src/shared/Economy")
local CityRules = require("../src/shared/CityRules")
local Programs = require("../src/shared/Programs")

local function fail(message: string)
	error(message, 0)
end

if Programs.FREE_NODES ~= 3 or Programs.APPRENTICE_GRADE ~= 5 or Programs.PAY_RAISE_COST ~= 40 then
	fail("program constants")
end
if Programs.raiseCost(0) ~= 40 or Programs.raiseCost(1) ~= 65 or Programs.raiseCost(2) ~= 90 then
	fail("raise cost")
end
if Programs.minGradeForNodes(3) ~= 0 or Programs.minGradeForNodes(4) ~= 1 or Programs.minGradeForNodes(7) ~= 2 then
	fail("min grade")
end
if Programs.payTitle(0) ~= "Dock Hand" or Programs.payTitle(5) ~= "Apprentice Inventor" then
	fail(Programs.payTitle(0) .. " / " .. Programs.payTitle(5))
end
if Programs.jobName("craft_frame") ~= "Build Frames" or Programs.nodeName("sell_frame") ~= "Sell Frame (Broker)" then
	fail("names")
end

local inv = Economy.empty(100)
CityRules.ensure(inv)
if inv.parcelLeased or inv.bayLevel ~= 0 then
	fail("fresh lease")
end
local noHire, noHireMsg = CityRules.hireHuman(inv)
if noHire or not string.find(noHireMsg, "Lease a bay", 1, true) then
	fail(noHireMsg)
end
if CityRules.PARCEL_LEASE_COST ~= 25 then
	fail("lease cost")
end
local leased, leaseMsg = CityRules.leaseParcel(inv)
if not leased or inv.brass ~= 75 or inv.bayLevel ~= 1 or inv.parcelLeased ~= true then
	fail(leaseMsg .. " " .. tostring(inv.brass))
end
if not string.find(leaseMsg, "Starter Bay", 1, true) then
	fail(leaseMsg)
end
local hired, hireMsg = CityRules.hireHuman(inv)
if not hired or #inv.workers ~= 1 or inv.brass ~= 40 then
	fail(hireMsg .. " brass " .. tostring(inv.brass) .. " crew " .. tostring(#inv.workers))
end
local worker = inv.workers[1]
if worker.job ~= "harvest" or worker.payGrade ~= 0 then
	fail("new hire job")
end

local jobOk, jobMsg = Programs.setJob(inv, worker.id, "craft_wire")
if not jobOk or worker.job ~= "craft_wire" then
	fail(jobMsg)
end
local legacy, _ = CityRules.setJob(inv, worker.id, "craft")
if not legacy or worker.job ~= "craft_wire" then
	fail("legacy craft alias")
end

inv.brass = 40
local raised, raiseMsg = Programs.raisePay(inv, worker.id)
if not raised or worker.payGrade ~= 1 or inv.brass ~= 0 then
	fail(raiseMsg .. " " .. tostring(inv.brass))
end
if not string.find(raiseMsg, "Bay Runner", 1, true) then
	fail(raiseMsg)
end

local created, createMsg, program = Programs.createFromTemplate(inv, "harvest_loop")
if not created or not program or #program.nodes ~= 2 then
	fail(createMsg)
end
if Programs.minGradeForProgram(program) ~= 0 then
	fail("harvest loop grade")
end
local assigned, assignMsg = Programs.assign(inv, worker.id, program.id)
if not assigned or worker.job ~= "program" or worker.programId ~= program.id then
	fail(assignMsg)
end

local added, addMsg = Programs.addNode(inv, program.id, "sell_all_harvest")
if not added or #program.nodes ~= 3 then
	fail(addMsg)
end
local moved, moveMsg = Programs.moveNode(inv, program.id, 3, -1)
if not moved or program.nodes[2] ~= "sell_all_harvest" then
	fail(moveMsg)
end
local removed, removeMsg = Programs.removeNode(inv, program.id, 2)
if not removed or #program.nodes ~= 2 or program.nodes[2] ~= "return_bay" then
	fail(removeMsg)
end

local broker, brokerMsg, brokerProg = Programs.createFromTemplate(inv, "frame_broker")
if not broker or #brokerProg.nodes ~= 5 then
	fail(brokerMsg)
end
if Programs.minGradeForProgram(brokerProg) ~= 1 then
	fail("broker grade " .. tostring(Programs.minGradeForProgram(brokerProg)))
end
inv.workers[1].payGrade = 0
local refuse, refuseMsg = Programs.assign(inv, worker.id, brokerProg.id)
if refuse or not string.find(refuseMsg, "need", 1, true) then
	fail(refuseMsg)
end
inv.workers[1].payGrade = 1
local take, takeMsg = Programs.assign(inv, worker.id, brokerProg.id)
if not take then
	fail(takeMsg)
end

Economy.add(inv, "scrap_brass", 4)
local nodeOk, nodeMsg = Programs.runNode(inv, worker, "craft_wire")
if not nodeOk or (inv.items.wire or 0) < 1 then
	fail(nodeMsg)
end
local flowerOk, flowerMsg = Programs.runNode(inv, worker, "pick_flowers")
if not flowerOk or not string.find(flowerMsg, "picked", 1, true) then
	fail(flowerMsg)
end
local harvestOk, harvestMsg = Programs.runWorker(inv, { id = "tmp", name = "Temp", job = "harvest" })
if not harvestOk or inv.harvestRuns < 1 then
	fail(harvestMsg)
end

worker.job = "program"
worker.programId = program.id
worker.programStep = 1
program.nodes = { "return_bay", "harvest" }
local step1, msg1 = Programs.runWorker(inv, worker)
if not step1 or worker.programStep ~= 2 then
	fail(msg1 .. " step " .. tostring(worker.programStep))
end
local step2, msg2 = Programs.runWorker(inv, worker)
if not step2 or worker.programStep ~= 1 then
	fail(msg2)
end

local payload = Programs.payload(inv, "ok", program.id)
if #payload.crew ~= 1 or #payload.programs < 2 or #payload.templates ~= 5 then
	fail("payload")
end
if payload.jobs[1].id ~= "idle" or payload.hireCost < 35 then
	fail("payload jobs")
end

local fired, fireMsg = Programs.fire(inv, worker.id)
if not fired or #inv.workers ~= 0 then
	fail(fireMsg)
end

local broke = Economy.empty(10)
CityRules.ensure(broke)
local need, needMsg = CityRules.leaseParcel(broke)
if need or not string.find(needMsg, "Need 25", 1, true) then
	fail(needMsg)
end

print("programs match")
