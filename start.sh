#!/bin/bash
cd "$(dirname "$0")"
echo "🚗 Phương Nam Vehicle Manager"
echo "==============================="
echo "Installing dependencies..."
npm install --silent
echo ""
echo "✅ Starting app..."
echo "   Open http://localhost:${PORT:-3000}"
echo "   Login: admin / admin123"
echo ""
node src/index.js