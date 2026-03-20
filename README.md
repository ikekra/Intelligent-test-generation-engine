# Student Test Studio

A student-built, student-focused AI test generator for assignments. It combines a React + Vite frontend with an Express + MongoDB backend and the OpenAI Responses API.

## Features
- AI test generation for student assignments
- Assignment contexts with course, rubric, and due date
- Collaborative workspaces for group projects (teams + shared workspaces)
- Teacher/admin dashboard for usage visibility
- Plagiarism-safe integrity mode (black-box test guidance)

## Tech Stack
- Frontend: React 19 + Vite
- Backend: Express 5
- DB: MongoDB (Mongoose)
- AI: OpenAI Responses API

## Setup
1. Install dependencies
   - `npm install`
2. Create `.env` from `.env.example`
   - Set `OPENAI_API_KEY`
   - Ensure `MONGO_URL` points to a running MongoDB instance
   - Optionally set `ADMIN_EMAILS` for teacher/admin access
3. Start MongoDB locally
4. Run the full stack
   - `npm run dev:full`
5. Open the app
   - Frontend: `http://localhost:5173`
   - API: `http://localhost:5174`

## Usage
- Create an account
- Create a team and invite group members
- Create an assignment and link it as the active assignment
- Upload code or paste assignment context
- Generate tests with integrity mode enabled

## Notes
- Team roles: `owner`, `admin`, `teacher`, `member` (student)
- Assignment creation for teams requires `owner`, `admin`, or `teacher`
- Integrity mode prevents solution output and encourages black-box testing
