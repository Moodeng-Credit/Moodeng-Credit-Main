# Moodeng API (FastAPI + Firebase)

Python FastAPI backend that persists data to **Firebase Firestore** with a layered architecture.

## Layers

- **API (routes)** – HTTP endpoints in `app/api/routes/`
- **Services** – Business logic in `app/services/`
- **Repositories** – Firebase/Firestore data access in `app/repositories/`
- **Models** – Pydantic schemas in `app/models/`
- **Core** – Config and Firebase init in `app/core/`

## Setup

1. Create a virtualenv and install deps:

   ```bash
   cd backend/api
   python -m venv .venv
   source .venv/bin/activate   # or .venv\Scripts\activate on Windows
   pip install -r requirements.txt
   ```

2. Firebase:
   - Create a project in [Firebase Console](https://console.firebase.google.com/)
   - Enable **Firestore Database**
   - Go to Project Settings → Service accounts → Generate new private key (JSON)
   - Save the JSON and set one of:
     - `GOOGLE_APPLICATION_CREDENTIALS` to the path of that JSON, or
     - In `.env`: `firebase_credentials_path=/path/to/key.json` and `firebase_project_id=your-project-id`

3. Create `.env` in `backend/api/` (optional):

   ```env
   firebase_project_id=your-project-id
   firebase_credentials_path=./path/to/serviceAccountKey.json
   ```

## Run

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API: http://localhost:8000
- Docs: http://localhost:8000/docs
- Health: http://localhost:8000/health

## Endpoints (example)

- `POST /api/v1/records` – create record (body: `title`, optional `description`, `value`)
- `GET /api/v1/records` – list records
- `GET /api/v1/records/{id}` – get one
- `PATCH /api/v1/records/{id}` – update
- `DELETE /api/v1/records/{id}` – delete

Data is stored in Firestore in the `records` collection. Add new repositories under `app/repositories/`, services under `app/services/`, and routes under `app/api/routes/` to extend the API.
