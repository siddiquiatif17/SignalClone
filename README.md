# Signal Clone - End-to-End Secure Messaging Platform

A comprehensive recreation of Signal's desktop interface and core messaging workflows. Built with a Next.js frontend and a FastAPI backend, synchronizing in real time over WebSockets.

---

## Architecture & Features
- **Frontend App Router**: Next.js + TypeScript + Tailwind CSS (dynamic dark/light modes, responsive layout collapse on mobile viewports).
- **REST APIs**: FastAPI backend with SQLAlchemy models, migrations, schemas, CORS settings, and SQLite storage.
- **Real-Time WebSockets**: Dedicated connection manager supporting online presence tracking, typing indicators, read/delivery receipts, and instant message distribution.
- **Group Chats**: Group conversation creation, role assignment (`admin`/`member`), list rosters, and members management (adding/removing participants by admins).
- **Reply-To Threading**: Quoted message bubbles, composer previews, hover context reply buttons, and click-to-scroll navigation.

---

## Directory Structure
```
signal-clone/
├── frontend/          # Next.js Frontend Workspace
│   ├── app/           # App route pages, layouts, global style sheets
│   ├── components/    # Reusable widgets (Modals, Placeholders)
│   ├── context/       # State contexts (Auth, WS, Toast Notification)
│   ├── utils/         # API HTTP fetch helpers
│   ├── vercel.json    # Deployment specifications
│   └── .env.example
├── backend/           # FastAPI Backend Workspace
│   ├── app/           # Python app modules (models, routers, services, ws)
│   │   ├── routers/   # REST routes (auth, contacts, groups, messages)
│   │   ├── ws/        # WebSocket routing and managers
│   │   ├── seed.py    # Mock database populator
│   │   └── main.py    # Uvicorn boot entrypoint
│   ├── requirements.txt
│   ├── render.yaml    # Blueprint cloud descriptor
│   └── .env.example
├── signal_clone.db    # SQLite local database file
└── README.md
```

---

## Quick Start & Installation

### 1. Backend Workspace Setup
1. Open a terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Setup a virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure environment parameters:
   Create a `.env` file from the example:
   ```bash
   copy .env.example .env
   ```
5. Seed database with users and historical mock conversations:
   ```bash
   python -m app.seed
   ```
6. Spin up the FastAPI server:
   ```bash
   uvicorn app.main:app --reload --reload-dir app --port 8001
   ```
   API interactive docs will launch at `http://127.0.0.1:8001/docs`.

### 2. Frontend Workspace Setup
1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create your local environment settings file:
   ```bash
   copy .env.example .env.local
   ```
4. Start the Next.js development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` to access the application dashboard.

---

## API Documentation Reference

### Authentication (REST)
- **POST `/auth/register`**: Submit `phone_or_username` and `display_name`. Returns an OTP (e.g. `123456`).
- **POST `/auth/login`**: Submit `phone_or_username` to receive an OTP.
- **POST `/auth/verify-otp`**: Submit `phone_or_username` and `otp`. Returns a signed JWT `token` and the `user` profile data.
- **POST `/auth/logout`**: Terminate active authentication session.
- **GET `/auth/users/me`**: Get current user profile details.
- **PATCH `/auth/users/me`**: Update display name or avatar URL.

### Contacts & Chats (REST)
- **GET `/contacts`**: Retrieve all contacts.
- **POST `/contacts`**: Add a new contact by username.
- **GET `/conversations`**: List conversations with metadata, presence, and unread counters.

### Messaging (REST)
- **GET `/conversations/{id}/messages`**: Paginated message history (newest-first, returned chronologically).
- **POST `/conversations/{id}/messages`**: Persist and broadcast a message. Accepts optional `reply_to_id`.
- **POST `/conversations/{id}/read`**: Mark all receipts for messages up to a specific `message_id` as read.

### Group Management (REST)
- **POST `/groups`**: Create a group with `name` and list of `member_ids`.
- **GET `/groups/{id}/members`**: Retrieve details of group members.
- **POST `/groups/{id}/members`**: Add a member to the group (Admin only).
- **DELETE `/groups/{id}/members/{user_id}`**: Remove a member from the group (Admin only).

### WebSockets (WS)
- **Connect Endpoint**: `ws://127.0.0.1:8001/ws/{token}`
- **Events**:
  - **Outgoing**:
    - `{ "type": "send_message", "conversation_id": X, "content": "..." }`
    - `{ "type": "read", "conversation_id": X, "message_id": Y }`
    - `{ "type": "typing", "conversation_id": X, "is_typing": true/false }`
  - **Incoming**:
    - `{ "type": "new_message", "message": MessageRead }`
    - `{ "type": "receipt_update", "message_id": X, "user_id": Y, "status": "delivered"/"read" }`
    - `{ "type": "presence_update", "user_id": X, "is_online": true/false }`
    - `{ "type": "typing", "conversation_id": X, "user_id": Y, "is_typing": true/false }`

---

## Troubleshooting Guide

### 1. Windows Socket Binding Conflicts (WinError 10013)
If port `8001` falls in a range locked by WSL2 or Hyper-V, release the range in PowerShell as Admin:
```powershell
net stop winnat
net start winnat
```

### 2. WebSocket Abnormal Closure (Code 1006)
Verify:
1. The backend application is running.
2. The port number matches `8001` in both configuration environments.
3. The auth token is present and valid.

### 3. Infinite Uvicorn Watcher Restart Loops on Windows
If SQLite writes trigger uvicorn server reloads continuously, make sure uvicorn is launched with the source scope directory restriction:
`uvicorn app.main:app --reload --reload-dir app --port 8001`. This prevents writing to `.db` files in the root folder from triggering file-watcher rebuilds.

---

## Cloud Deployment Configurations

### Frontend (Vercel)
The directory is optimized for Vercel out of the box using `vercel.json`:
```json
{
  "version": 2,
  "framework": "nextjs"
}
```

### Backend (Render)
Create a web service blueprint in Render using the included `backend/render.yaml` specification:
```yaml
services:
  - type: web
    name: signal-backend
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```
