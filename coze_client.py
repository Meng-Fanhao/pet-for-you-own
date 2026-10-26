"""Coze API client – chat with a Coze bot via Personal Access Token."""

import uuid
import httpx
from utils import logger


class CozeClient:
    """Send messages to a Coze bot and track conversation."""

    def __init__(
        self,
        pat: str,
        bot_id: str,
        base_url: str = "https://api.coze.cn/v3",
        user_id: str = "desktop_pet_user",
    ):
        self.pat = pat
        self.bot_id = bot_id
        self.base_url = base_url.rstrip("/")
        self.user_id = user_id
        self.conversation_id: str | None = None
        self._client = httpx.Client(timeout=30.0)

    def chat(self, message: str) -> str:
        """Send a message and return the bot's text response."""
        payload = {
            "bot_id": self.bot_id,
            "user_id": self.user_id,
            "stream": False,
            "auto_save_history": True,
            "additional_messages": [
                {"role": "user", "content": message, "content_type": "text"}
            ],
        }
        if self.conversation_id:
            payload["conversation_id"] = self.conversation_id

        url = f"{self.base_url}/chat"
        headers = {
            "Authorization": f"Bearer {self.pat}",
            "Content-Type": "application/json",
        }

        logger.debug("Sending to Coze bot %s: %s", self.bot_id, message[:80])

        resp = self._client.post(url, json=payload, headers=headers)
        resp.raise_for_status()

        data = resp.json()
        if data.get("code") != 0:
            raise RuntimeError(f"Coze API error: {data.get('msg', 'unknown')}")

        inner = data.get("data", {})
        self.conversation_id = inner.get("conversation_id") or self.conversation_id

        # Coze may return messages array or single content
        messages = inner.get("messages", [])
        if messages:
            # Take the last assistant message
            for msg in reversed(messages):
                if msg.get("role") == "assistant" and msg.get("content"):
                    text = msg["content"].strip()
                    logger.info("Coze response: %s", text[:80])
                    return text

        content = inner.get("content", "").strip()
        logger.info("Coze response: %s", content[:80])
        return content

    def clear_conversation(self):
        """Start a fresh conversation."""
        self.conversation_id = None
