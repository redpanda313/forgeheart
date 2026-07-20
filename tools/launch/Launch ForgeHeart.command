#!/bin/bash
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH"
cd "$(dirname "$0")/../.." || exit 1
echo "Starting ForgeHeart at http://localhost:5180 …"
if curl -sf -o /dev/null --max-time 1 http://localhost:5180/; then
  open http://localhost:5180/
  echo "Already running — opened browser."
  read -r -p "Press Enter to close…"
  exit 0
fi
npm run dev
