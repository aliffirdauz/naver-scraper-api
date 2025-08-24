#!/bin/bash

# Naver Scraper API Setup Script
echo "🚀 Setting up Naver Scraper API..."

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ required. Current: $(node --version)"
    exit 1
fi

echo "✅ Node.js $(node --version) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your proxy settings if needed"
else
    echo "✅ .env file already exists"
fi

# Create logs directory
mkdir -p logs

# Build the project
echo "🔨 Building TypeScript..."
npm run build

# Test compilation
if [ $? -eq 0 ]; then
    echo "✅ Build successful"
else
    echo "❌ Build failed"
    exit 1
fi

echo ""
echo "🎉 Setup complete! Next steps:"
echo ""
echo "1. Start the server:"
echo "   npm run dev"
echo ""
echo "2. Test the API:"
echo "   curl \"http://localhost:3000/health\""
echo ""
echo "3. Test scraping:"
echo "   curl \"http://localhost:3000/naver?url=https://search.shopping.naver.com/ns/search?query=iphone\""
echo ""
echo "4. Run load test:"
echo "   npm run test:load"
echo ""
echo "5. Expose via ngrok:"
echo "   ngrok http 3000"
echo ""
echo "📚 Check README.md for detailed instructions!"