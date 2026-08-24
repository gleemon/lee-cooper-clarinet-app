#!/bin/sh
cd "$(dirname "$0")/../frontend"
export VITE_API_URL="http://dockernuc.local:5000"
exec npm run dev
