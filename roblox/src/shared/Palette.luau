-- Colors from src/forgeheart/materials.ts.
local function rgb(hex: number): Color3
	local r = math.floor(hex / 65536) % 256
	local g = math.floor(hex / 256) % 256
	local b = hex % 256
	return Color3.fromRGB(r, g, b)
end

local Palette = {
	brass = rgb(0xB8923A),
	brassDark = rgb(0x7A6028),
	copper = rgb(0xB87333),
	iron = rgb(0x4A4E55),
	ironDark = rgb(0x2A2E33),
	wood = rgb(0x6B4A2A),
	woodDark = rgb(0x4A3218),
	glass = rgb(0x5A8AAA),
	oil = rgb(0x2A2410),
	paper = rgb(0xD8C49A),
	photo = rgb(0x6A5538),
	skin = rgb(0xC4A882),
	eyeDark = rgb(0x241810),
	eyeAlive = rgb(0x7EC8B0),
	amber = rgb(0xFFAA33),
}

return Palette
