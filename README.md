# Affirmly

Affirmly is a small full-stack AI web app that generates personalized therapeutic affirmations.

- Frontend: Next.js (React), deploy to Vercel
- Backend: FastAPI, deploy to Railway
- AI: OpenAI API (no mocked responses)

## Project Structure

```text
affirmLy/
  backend/
    app/
      main.py
    requirements.txt
    env.example
    Procfile
  frontend/
    app/
      layout.tsx
      page.tsx
      globals.css
      page.module.css
    package.json
    env.example
```

## Backend (FastAPI)

### Features Implemented

- `POST /api/affirmation`
- Input validation with Pydantic (`name`, `feeling`, optional `details`)
- CORS config via `ALLOWED_ORIGINS`
- Simple in-memory rate limiting middleware for `/api/affirmation`
- Structured error handling (validation, HTTP, and fallback)
- OpenAI API call via official SDK
- Safe system prompt with boundaries against unsafe output

### Local Run

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp env.example .env
# set OPENAI_API_KEY in .env
uvicorn app.main:app --reload --port 8000
```

### Local API Test

```bash
curl -X POST http://localhost:8000/api/affirmation \
  -H "Content-Type: application/json" \
  -d '{"name":"Alex","feeling":"anxious about my interview","details":"I want to feel grounded"}'
```

### Run Backend Tests

```bash
cd backend
pytest -q
```

## Frontend (Next.js)

### UI Features Implemented

- Name input
- Feeling input
- Optional details field
- Submit button
- Loading state
- Error state
- Result display

### Local Run

```bash
cd frontend
npm install
cp env.example .env.local
# adjust NEXT_PUBLIC_API_URL if needed
npm run dev
```

Open `http://localhost:3000`.

## Deployment

### Backend on Railway

1. Create a Railway project from `backend` directory.
2. Set start command:
   - `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. Add environment variables:
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL` (optional, default `gpt-4o-mini`)
   - `ALLOWED_ORIGINS` (include Vercel URL)

### Frontend on Vercel

1. Import repository into Vercel.
2. Set root directory to `frontend`.
3. Add environment variable:
   - `NEXT_PUBLIC_API_URL` = your Railway backend URL (without trailing slash)
4. Redeploy.

## Security Best Practices Applied

- No hardcoded secrets in source code
- Environment variable based credentials
- Request schema validation and field length constraints
- Controlled CORS allowlist
- Basic abuse protection with request rate limiting
- Centralized error handling without stack trace leakage in responses
- Defensive prompt design for safer model behavior
- Minimal API surface (`/health` and `/api/affirmation`)

## CI

GitHub Actions workflow at `.github/workflows/ci.yml` runs:

- Backend tests (`pytest`)
- Frontend lint (`next lint`)
- Frontend production build (`next build`)

## What I Need From You

1. OpenAI API key for backend environment (`OPENAI_API_KEY`)
2. Your final frontend domain to add into `ALLOWED_ORIGINS`
3. Confirmation to initialize git here and push to:
   - `https://github.com/DynastyTech/affirmLy.git`
4. If you want, I can also add:
   - backend unit tests
   - GitHub Actions CI
   - stricter rate limiting and request-size middleware
