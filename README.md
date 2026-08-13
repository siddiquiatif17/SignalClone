# Signal Clone - Secure Messaging Platform

A recreation of Signal's user interface and messaging workflows built as part of the Scaler SDE Fullstack Assignment.

## Stack
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: FastAPI + SQLAlchemy + SQLite
- **Real-Time Communication**: WebSockets (WS)

---

## Directory Structure
```
signal-clone/
├── frontend/          # Next.js App Router Frontend
│   ├── app/           # Pages & Layouts
│   ├── utils/         # API Utilities
│   └── .env.example
├── backend/           # FastAPI Python Backend
│   ├── app/           # Application logic (models, schemas, routers, ws)
│   ├── requirements.txt
│   └── .env.example
└── README.md
```

---

## Setup & Running Locally

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
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
4. Create your `.env` configuration:
   ```bash
   copy .env.example .env
   ```
5. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --port 8001
   ```

The API docs will be available at `http://localhost:8001/docs`.

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create your `.env.local` configuration:
   ```bash
   copy .env.example .env.local
   ```
4. Start the Next.js development server:
   ```bash
   npm run dev
   ```

The web application will be accessible at `http://localhost:3000`.

---

## Troubleshooting Windows Socket Bindings

If you encounter the error `[WinError 10013] An attempt was made to access a socket in a way forbidden by its access permissions` when launching the backend:

1. **Verify if the port is reserved by Hyper-V / WSL2**:
   Open PowerShell as Administrator and run:
   ```powershell
   netsh interface ipv4 show excludedportrange protocol=tcp
   ```
   If port `8001` (or your target port) falls within any of the excluded port ranges, Windows has locked that range.

2. **Free up reserved port ranges**:
   You can restart the Windows NAT driver (`winnat`) to release dynamic reservations. In Administrator PowerShell, run:
   ```powershell
   net stop winnat
   net start winnat
   ```

3. **Change Ports**:
   If port `8001` is also locked, you can specify any other port (e.g. `8002`) in your `package.json` script:
   ```json
   "dev:backend": "cd backend && venv\\Scripts\\python.exe -m uvicorn app.main:app --reload --port 8002"
   ```
   Remember to update the `NEXT_PUBLIC_API_URL` environment variables in `frontend/.env.local` accordingly.

