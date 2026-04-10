#!/bin/bash
# VoiceSell — One-command project setup
# Run: chmod +x scripts/setup.sh && ./scripts/setup.sh

set -e

echo "================================================"
echo "  VoiceSell — AI Sales Bot Setup"
echo "  Setting up your $0 bootstrap stack..."
echo "================================================"
echo ""

# ─── Check prerequisites ───
echo "🔍 Checking prerequisites..."

check_cmd() {
  if ! command -v $1 &> /dev/null; then
    echo "❌ $1 not found. Install it first:"
    echo "   $2"
    exit 1
  else
    echo "✅ $1 found: $(command -v $1)"
  fi
}

check_cmd "node" "https://nodejs.org (v18+ required)"
check_cmd "npm" "Comes with Node.js"
check_cmd "python3" "https://python.org (v3.10+ required)"
check_cmd "pip3" "Comes with Python3"
check_cmd "git" "apt install git / brew install git"

# Check Node version
NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VER" -lt 18 ]; then
  echo "❌ Node.js v18+ required. You have $(node -v)"
  exit 1
fi
echo "✅ Node.js version: $(node -v)"

# Check Python version
PY_VER=$(python3 -c 'import sys; print(sys.version_info.minor)')
if [ "$PY_VER" -lt 10 ]; then
  echo "❌ Python 3.10+ required."
  exit 1
fi
echo "✅ Python version: $(python3 --version)"

echo ""
echo "─── Installing global tools ───"

# Install turbo for monorepo management
npm list -g turbo &>/dev/null || npm install -g turbo
echo "✅ Turborepo installed"

echo ""
echo "─── Setting up monorepo ───"

# Initialize root package.json if not exists
if [ ! -f "package.json" ]; then
  cat > package.json << 'ROOTPKG'
{
  "name": "voicesell",
  "version": "0.1.0",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "dev": "turbo run dev",
    "dev:server": "npm run dev -w packages/server",
    "dev:widget": "npm run dev -w packages/widget",
    "dev:dashboard": "npm run dev -w packages/dashboard",
    "dev:ai": "cd packages/ai-service && python3 -m uvicorn main:app --reload --port 8000",
    "build": "turbo run build",
    "build:widget": "npm run build -w packages/widget",
    "test": "turbo run test",
    "crawl": "npx tsx packages/server/src/scripts/crawl-products.ts",
    "db:migrate": "npm run db:migrate -w packages/server",
    "db:studio": "npm run db:studio -w packages/server",
    "db:seed": "npm run db:seed -w packages/server"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.4.0"
  }
}
ROOTPKG
  echo "✅ Root package.json created"
fi

# Create turbo.json
cat > turbo.json << 'TURBO'
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env.local"],
  "pipeline": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "test": {
      "dependsOn": ["build"]
    }
  }
}
TURBO
echo "✅ turbo.json created"

echo ""
echo "─── Setting up packages ───"

# ═══ SERVER PACKAGE ═══
mkdir -p packages/server/src/{routes,services,adapters,voice,db}
mkdir -p packages/server/prisma

cat > packages/server/package.json << 'SERVERPKG'
{
  "name": "@voicesell/server",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio",
    "db:seed": "tsx src/db/seed.ts",
    "test": "vitest"
  },
  "dependencies": {
    "@google/generative-ai": "^0.21.0",
    "@prisma/client": "^5.19.0",
    "chromadb": "^1.8.0",
    "cors": "^2.8.5",
    "express": "^4.21.0",
    "ioredis": "^5.4.0",
    "socket.io": "^4.7.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^22.0.0",
    "prisma": "^5.19.0",
    "tsx": "^4.19.0",
    "typescript": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
SERVERPKG
echo "✅ Server package created"

# Server tsconfig
cat > packages/server/tsconfig.json << 'TSCONF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "resolveJsonModule": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
TSCONF

# Prisma schema
cat > packages/server/prisma/schema.prisma << 'PRISMA'
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Merchant {
  id            String         @id @default(cuid())
  name          String
  domain        String         @unique
  platform      String         @default("generic")
  apiKey        String         @unique @default(cuid())
  config        String         @default("{}")
  couponRules   String?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  products      Product[]
  conversations Conversation[]
}

model Product {
  id            String   @id @default(cuid())
  merchantId    String
  merchant      Merchant @relation(fields: [merchantId], references: [id])
  externalId    String?
  name          String
  description   String   @default("")
  price         Float    @default(0)
  currency      String   @default("INR")
  url           String   @default("")
  imageUrl      String?
  category      String?
  tags          String   @default("[]")
  useCases      String   @default("[]")
  sellingPoints String   @default("[]")
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model Conversation {
  id         String              @id @default(cuid())
  merchantId String
  merchant   Merchant            @relation(fields: [merchantId], references: [id])
  sessionId  String
  language   String?
  state      String              @default("GREETING")
  channel    String              @default("text")
  metadata   String?
  createdAt  DateTime            @default(now())
  updatedAt  DateTime            @updatedAt
  messages   Message[]
  events     ConversationEvent[]
}

model Message {
  id             String       @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  role           String
  content        String
  products       String?
  createdAt      DateTime     @default(now())
}

model ConversationEvent {
  id             String       @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  type           String
  data           String?
  createdAt      DateTime     @default(now())
}
PRISMA

# ═══ AI SERVICE PACKAGE ═══
mkdir -p packages/ai-service

cat > packages/ai-service/requirements.txt << 'PYREQ'
fastapi==0.115.0
uvicorn==0.30.0
faster-whisper==1.0.3
chromadb==0.5.5
beautifulsoup4==4.12.3
httpx==0.27.0
pydantic==2.9.0
python-multipart==0.0.9
edge-tts==6.1.12
numpy==1.26.4
PYREQ

cat > packages/ai-service/main.py << 'PYMAIN'
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import chromadb
import os

app = FastAPI(title="VoiceSell AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ChromaDB client (persistent storage)
chroma_client = chromadb.PersistentClient(path="./chroma_data")

@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-service"}

@app.post("/stt")
async def speech_to_text(audio: UploadFile = File(...)):
    """Transcribe audio to text with language detection."""
    # Lazy import — model loads on first request
    from stt import transcribe
    audio_bytes = await audio.read()
    result = await transcribe(audio_bytes)
    return result

class EmbedRequest(BaseModel):
    texts: list[str]
    ids: list[str]
    collection: str = "products"
    metadata: list[dict] | None = None

@app.post("/embed")
async def embed_texts(req: EmbedRequest):
    """Embed texts and store in ChromaDB."""
    collection = chroma_client.get_or_create_collection(req.collection)
    collection.upsert(
        documents=req.texts,
        ids=req.ids,
        metadatas=req.metadata,
    )
    return {"stored": len(req.texts)}

class SearchRequest(BaseModel):
    query: str
    collection: str = "products"
    n_results: int = 3

@app.post("/search")
async def search_similar(req: SearchRequest):
    """Search for similar products in ChromaDB."""
    collection = chroma_client.get_or_create_collection(req.collection)
    results = collection.query(
        query_texts=[req.query],
        n_results=req.n_results,
    )
    return results

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
PYMAIN
echo "✅ AI service package created"

# ═══ WIDGET PACKAGE ═══
mkdir -p packages/widget/src/{components,hooks,styles}
mkdir -p packages/widget/public

cat > packages/widget/package.json << 'WIDGETPKG'
{
  "name": "@voicesell/widget",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "preact": "^10.23.0",
    "socket.io-client": "^4.7.0"
  },
  "devDependencies": {
    "@preact/preset-vite": "^2.9.0",
    "typescript": "^5.4.0",
    "vite": "^5.4.0"
  }
}
WIDGETPKG
echo "✅ Widget package created"

# ═══ DASHBOARD PACKAGE ═══
# Dashboard will be initialized via create-next-app in a later step
mkdir -p packages/dashboard
cat > packages/dashboard/package.json << 'DASHPKG'
{
  "name": "@voicesell/dashboard",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "next-auth": "^4.24.0",
    "@tanstack/react-query": "^5.56.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.45",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.4.0"
  }
}
DASHPKG
echo "✅ Dashboard package created"

# ═══ ENV FILE ═══
if [ ! -f ".env.local" ]; then
  cat > .env.local << 'ENVFILE'
# ═══ VoiceSell Environment Variables ═══
# Copy this to .env.local and fill in your values

# Gemini API (free: https://aistudio.google.com/app/apikey)
GEMINI_API_KEY=your_gemini_api_key_here

# Server
PORT=3001
NODE_ENV=development
DATABASE_URL=file:./dev.db

# AI Service
AI_SERVICE_URL=http://localhost:8000

# Redis (optional for dev — server falls back to in-memory)
REDIS_URL=redis://localhost:6379

# NextAuth
NEXTAUTH_SECRET=change-this-to-a-random-secret
NEXTAUTH_URL=http://localhost:3000

# Widget dev
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
ENVFILE
  echo "✅ .env.local created (edit with your GEMINI_API_KEY)"
fi

# ═══ GITIGNORE ═══
cat > .gitignore << 'GITIGNORE'
node_modules/
dist/
.next/
*.db
*.db-journal
chroma_data/
__pycache__/
*.pyc
.env
.env.local
.env.production
.turbo/
coverage/
*.log
.DS_Store
GITIGNORE
echo "✅ .gitignore created"

echo ""
echo "─── Installing dependencies ───"

# Install Node dependencies
npm install
echo "✅ Node.js dependencies installed"

# Install Python dependencies
cd packages/ai-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt --quiet
deactivate
cd ../..
echo "✅ Python dependencies installed"

# Initialize Prisma
cd packages/server
npx prisma generate
npx prisma migrate dev --name init --skip-generate
cd ../..
echo "✅ Database initialized"

echo ""
echo "================================================"
echo "  ✅ Setup complete!"
echo "================================================"
echo ""
echo "  Next steps:"
echo ""
echo "  1. Get a free Gemini API key:"
echo "     → https://aistudio.google.com/app/apikey"
echo "     → Paste it in .env.local as GEMINI_API_KEY"
echo ""
echo "  2. Start developing:"
echo "     → npm run dev"
echo ""
echo "  3. Open in browser:"
echo "     → Widget:    http://localhost:5173"
echo "     → Server:    http://localhost:3001/health"
echo "     → AI:        http://localhost:8000/health"
echo "     → Dashboard: http://localhost:3000"
echo ""
echo "  Happy building! 🚀"
echo ""
