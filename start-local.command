#!/bin/bash
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo 'Node.js and npm are required. Install them before continuing.'
  exit 1
fi
if [ ! -f .env ]; then
  cp .env.example .env
  echo 'Created .env. Edit your MySQL password and database configuration in .env, then run this script again.'
  exit 1
fi
if [ ! -d node_modules ]; then
  echo 'Installing project dependencies...'
  npm ci
fi
echo 'Checking JavaScript files...'
npm run check
echo 'Starting LocalTrails at http://localhost:3000'
npm start
