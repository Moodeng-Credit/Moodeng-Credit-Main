"""Firebase Admin SDK initialization and client."""
import os
from typing import Any

from firebase_admin import firestore, initialize_app

from app.core.config import settings

_app: Any = None


def get_firebase_app():
    """Return initialized Firebase app (idempotent)."""
    global _app
    if _app is None:
        options = {"projectId": settings.firebase_project_id or os.environ.get("GOOGLE_CLOUD_PROJECT")}
        cred_path = settings.firebase_credentials_path or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        if cred_path and os.path.isfile(cred_path):
            import firebase_admin.credentials
            _app = initialize_app(credentials=firebase_admin.credentials.Certificate(cred_path), options=options)
        else:
            _app = initialize_app(options=options)
    return _app


def get_firestore() -> firestore.Client:
    """Return Firestore client."""
    get_firebase_app()
    return firestore.client()
