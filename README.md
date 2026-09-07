# Tibb Assist

Tibb Assist is an AI-powered maternal healthcare platform for underserved communities in Pakistan, with pregnancy care and emergency triage as the core module.

## Project structure

- `client/` - React + Vite frontend
- `server/` - Node.js + Express backend
- `.gitignore` - project ignore rules

## Start the frontend

```bash
cd client
npm install
npm run dev
```

Then open the local URL shown in the terminal.

## Start the backend

```bash
cd server
npm install
npm start
```

The backend will run on http://localhost:3001.

## Health check

Visit:

```text
http://localhost:3001/api/health
```

This should return a JSON message confirming the backend is running.

## Deployment

The app is deployed as two separate Vercel projects, backed by a Railway MySQL database.

- Frontend: https://tibb-assist.vercel.app (Root Directory: `client`)
- Backend: https://tibb-assist-server.vercel.app (Root Directory: `server`)

### Environment variables

**Backend (Vercel project settings):**
- `DATABASE_URL` — Railway MySQL connection string
- `SESSION_SECRET` — session signing secret

**Frontend (Vercel project settings):**
- `VITE_API_URL` — `https://tibb-assist-server.vercel.app/api`

### Notes

- The frontend calls the backend directly (cross-origin), not via a Vercel rewrite — the backend has CORS configured for `https://tibb-assist.vercel.app` with credentials enabled.
- Sessions are stored in MySQL (via `express-mysql-session`), not in-memory, since the backend runs as a Vercel serverless function.
- Before pushing frontend changes, run `npm run build` inside `client/` locally to catch any errors before they reach production.