#!/bin/bash

set -e

echo "Starting AI App Builder development environment..."

# Navigate to project root
cd "$(dirname "$0")/.."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "Installing pnpm..."
    npm install -g pnpm
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    pnpm install
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
fi

# Build shared packages
echo "Building shared packages..."
pnpm --filter @ai-app-builder/shared build || true

# Start Docker containers
echo "Starting Docker containers..."
cd docker
docker compose up --build -d

echo ""
echo "Development environment started!"
echo ""
echo "Services:"
echo "  - Web:      http://localhost:3000"
echo "  - API:      http://localhost:4000"
echo "  - Health:   http://localhost:4000/health"
echo "  - Database: postgresql://localhost:5432/ai_app_builder"
echo ""
echo "Useful commands:"
echo "  - View logs:     docker compose logs -f"
echo "  - Stop:          docker compose down"
echo "  - Restart:       docker compose restart"
echo "  - DB migrations: pnpm db:migrate"
echo ""
