import json
from pathlib import Path

CREDENTIALS_PATH = Path.home() / ".config" / "ecc2" / "credentials.json"

class CredentialsNotFoundError(Exception):
    pass

class CredentialsInvalidError(Exception):
    pass

def load_credentials() -> dict:
    if not CREDENTIALS_PATH.exists():
        raise CredentialsNotFoundError(
            f"Not logged in. Run 'ecc login' to authenticate. (looked in {CREDENTIALS_PATH})"
        )
    try:
        data = json.loads(CREDENTIALS_PATH.read_text())
    except (json.JSONDecodeError, OSError) as e:
        raise CredentialsInvalidError(f"Credentials file corrupt: {e}") from e
    if not data.get("access_token"):
        raise CredentialsInvalidError("Credentials missing access_token. Run 'ecc login'.")
    return data
