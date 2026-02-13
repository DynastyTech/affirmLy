# Affirmly

Affirmly is a full-stack AI web app that generates personalized therapeutic affirmations.

- Frontend: Next.js (React), hosted on Vercel
- Backend: FastAPI, hosted on Railway
- AI Integration: OpenAI API (live, no mocked responses)

## Live URLs

- App (Frontend): `https://affirm-ly.vercel.app/`
- Backend API: `https://affirmly-production.up.railway.app/`
- GitHub Repository: `https://github.com/DynastyTech/affirmLy.git`

## Current Features

### Backend

- `POST /api/affirmation` endpoint
- Input validation with Pydantic (`name`, `feeling`, optional `details`, `language`)
- Descriptive feeling enforcement (rejects emoji-only or shorthand-style input)
- Safe system prompt and OpenAI completion flow
- Language-aware response generation (English, Afrikaans, Latin, Mandarin, Russian, German, French, Spanish)
- CORS allowlist via `ALLOWED_ORIGINS`
- Structured error handling for validation and server errors
- Simple in-memory rate limiting on `/api/affirmation`
- Health endpoint: `GET /health`

### Frontend

- Inputs for name, feeling, and optional details
- Mood preset chips for fast selection
- Inline field guidance and validation feedback
- Loading state with spinner and robust API error handling
- Result shown in an animated popup dialog
- Modal accessibility improvements (focus management and keyboard support)
- Copy affirmation and generate-another actions in the popup
- Welcome loading screen with circular animated logo and intro text
- Light/dark theme toggle with moon/sun icon button
- Searchable language selector with persisted preference
- Mobile-optimized responsive layout and reduced-motion support
- Privacy microcopy to increase user trust and clarity
- Footer attribution with DynastyTech link

### Quality and CI

- Backend API tests with `pytest`
- GitHub Actions CI:
  - backend tests
  - frontend lint
  - frontend production build

## Environment Variables

### Railway (Backend)

- `OPENAI_API_KEY` (required)
- `OPENAI_MODEL` (optional, default: `gpt-4o-mini`)
- `ALLOWED_ORIGINS` (required in production; include frontend domain)
- `RATE_LIMIT_MAX_REQUESTS` (optional, default: `10`)
- `RATE_LIMIT_WINDOW_SECONDS` (optional, default: `60`)

### Vercel (Frontend)

- `NEXT_PUBLIC_API_URL` (required)
  - Example: `https://affirmly-production.up.railway.app`

## Local Development

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp env.example .env
uvicorn app.main:app --reload --port 8000
```

### Backend Tests

```bash
cd backend
pytest -q
```

### Frontend

```bash
cd frontend
npm install
cp env.example .env.local
npm run dev
```

## Security Notes

- Secrets are environment-based (no hardcoded keys)
- Request payload constraints and sanitization are enforced
- CORS is locked to configured trusted origins
- API error responses avoid stack trace leakage
