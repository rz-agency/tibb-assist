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
