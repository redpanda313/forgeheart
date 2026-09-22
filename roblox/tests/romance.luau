local CityRules = require("../src/shared/CityRules")
local Romance = require("../src/shared/Romance")

local function fail(message: string)
	error(message, 0)
end

if Romance.STAGE_NAMES[1] ~= "stranger" or Romance.STAGE_NAMES[5] ~= "sweetheart" then
	fail("stage names")
end

local lira = Romance.generate("girl_lira", 1)
if not lira or not string.find(lira.name, "Lira", 1, true) then
	fail("lira name")
end
local again = Romance.generate("girl_lira", 1)
if again.name ~= lira.name or again.chatByStage[1] ~= lira.chatByStage[1] then
	fail("persona unstable")
end
local other = Romance.generate("girl_lira", 2)
if other.name == lira.name and other.origin == lira.origin then
	fail("seed should change lives")
end

local inv = CityRules.ensure({ brass = 40, items = { flower_gift = 2, brass_charm = 1 } })
local ok, msg, stage = Romance.chat(inv, "girl_lira", 1)
if not ok or stage ~= 0 or inv.relationships[1].affinity ~= 3 then
	fail(msg .. " stage " .. tostring(stage) .. " aff " .. tostring(inv.relationships[1] and inv.relationships[1].affinity))
end

local gifted, giftMsg, _, delta = Romance.gift(inv, "girl_lira", "flower_gift", 1)
if not gifted or delta ~= 18 then
	fail(giftMsg)
end
if inv.relationships[1].affinity ~= 21 or inv.relationships[1].stage ~= 1 then
	fail("acquaintance " .. tostring(inv.relationships[1].affinity) .. " " .. tostring(inv.relationships[1].stage))
end

local miss, missMsg, _, missDelta = Romance.gift(inv, "girl_lira", "brass_charm", 1)
if not miss or missDelta ~= -18 then
	fail(missMsg)
end

inv.relationships[1].affinity = 40
Romance.recompute(inv.relationships[1])
if inv.relationships[1].stage ~= 2 then
	fail("friendly")
end
inv.relationships[1].affinity = 70
Romance.recompute(inv.relationships[1])
if Romance.stageName(inv.relationships[1].stage) ~= "close" then
	fail("close")
end
inv.relationships[1].affinity = 100
Romance.recompute(inv.relationships[1])
if Romance.stageName(inv.relationships[1].stage) ~= "sweetheart" then
	fail("sweetheart")
end

local stories = Romance.listStories(inv, "girl_lira", { companionName = "Ada", worldSeed = 1 })
if stories[1].id ~= "origin" or stories[1].locked ~= false then
	fail("origin unlocked at close+")
end

print("romance stages match")
