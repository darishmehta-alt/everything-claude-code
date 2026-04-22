import json
import pytest
from pathlib import Path
from unittest.mock import patch
from llm.core.auth import load_credentials, CredentialsNotFoundError, CredentialsInvalidError
from llm.providers.claude import ClaudeProvider
from llm.providers.openai import OpenAIProvider
from llm.providers.ollama import OllamaProvider

def test_load_credentials_missing_file(tmp_path):
    with patch("llm.core.auth.CREDENTIALS_PATH", tmp_path / "credentials.json"):
        with pytest.raises(CredentialsNotFoundError):
            load_credentials()

def test_load_credentials_missing_token(tmp_path):
    creds_file = tmp_path / "credentials.json"
    creds_file.write_text(json.dumps({"token_type": "bearer"}))
    with patch("llm.core.auth.CREDENTIALS_PATH", creds_file):
        with pytest.raises(CredentialsInvalidError):
            load_credentials()

def test_load_credentials_valid(tmp_path):
    creds_file = tmp_path / "credentials.json"
    creds = {"access_token": "gho_abc123", "token_type": "bearer", "scope": "read:user", "github_login": "testuser", "stored_at": "2026-01-01T00:00:00Z"}
    creds_file.write_text(json.dumps(creds))
    with patch("llm.core.auth.CREDENTIALS_PATH", creds_file):
        result = load_credentials()
    assert result["access_token"] == "gho_abc123"
    assert result["github_login"] == "testuser"


def test_claude_provider_requires_credentials(tmp_path):
    with patch("llm.core.auth.CREDENTIALS_PATH", tmp_path / "credentials.json"):
        with pytest.raises(CredentialsNotFoundError):
            ClaudeProvider(api_key="sk-test")


def test_openai_provider_requires_credentials(tmp_path):
    with patch("llm.core.auth.CREDENTIALS_PATH", tmp_path / "credentials.json"):
        with pytest.raises(CredentialsNotFoundError):
            OpenAIProvider(api_key="sk-test")


def test_ollama_provider_requires_credentials(tmp_path):
    with patch("llm.core.auth.CREDENTIALS_PATH", tmp_path / "credentials.json"):
        with pytest.raises(CredentialsNotFoundError):
            OllamaProvider()
