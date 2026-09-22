-- Furthest place a player has earned. Death and rejoin use this, never an earlier pad.
-- Market and city SpawnLocations must stay Neutral=true so Roblox honors RespawnLocation.
local SpawnProgress = {}

SpawnProgress.WORKSHOP = "workshop"
SpawnProgress.MARKET = "market"
SpawnProgress.CITY = "city"

local RANK = {
	workshop = 1,
	market = 2,
	city = 3,
}

function SpawnProgress.rank(id: any): number
	if type(id) == "string" and RANK[id] then
		return RANK[id]
	end
	return 1
end

-- Saved checkpoint, story phase, and the apartment deed. The highest one wins.
function SpawnProgress.resolve(savedSpawn: any, phase: any, apartment: boolean): string
	local rank = SpawnProgress.rank(savedSpawn)
	if phase == "market" then
		rank = math.max(rank, RANK.market)
	end
	if phase == "city" or apartment then
		rank = math.max(rank, RANK.city)
	end
	if rank >= RANK.city then
		return SpawnProgress.CITY
	end
	if rank >= RANK.market then
		return SpawnProgress.MARKET
	end
	return SpawnProgress.WORKSHOP
end

function SpawnProgress.advance(current: any, nextCheckpoint: string): string
	if SpawnProgress.rank(nextCheckpoint) > SpawnProgress.rank(current) then
		return nextCheckpoint
	end
	return if SpawnProgress.rank(current) > 1 then current else SpawnProgress.WORKSHOP
end

-- Workshop siege flags must not rewrite a player who already left the lab.
function SpawnProgress.locked(spawn: any): boolean
	return SpawnProgress.rank(spawn) >= RANK.market
end

return SpawnProgress
