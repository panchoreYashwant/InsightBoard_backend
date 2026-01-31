# REMOVED: Backed up to removed_backup/backend/start.sh — original contents archived.
  echo ""
  echo "DATABASE_URL=mongodb+srv://user:pass@cluster.mongodb.net/insightboard"
  echo "OPENAI_API_KEY=sk-..."
  echo "PORT=3000"
  echo "NODE_ENV=development"
  exit 1
fi

echo "✅ .env found"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install --silent
echo "✅ Dependencies installed"
echo ""

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate --silent
echo "✅ Prisma client generated"
echo ""

# Initialize database
echo "🗄️  Pushing schema to MongoDB..."
npx prisma db push --skip-generate
echo "✅ Database initialized"
echo ""

# Start development server
echo "🚀 Starting development server..."
echo "📍 http://localhost:3000"
echo "📍 Health check: http://localhost:3000/health"
echo ""
echo "Press Ctrl+C to stop"
echo ""

npm run dev
