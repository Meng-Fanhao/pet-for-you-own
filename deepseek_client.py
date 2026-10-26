"""DeepSeek API client – OpenAI-compatible chat completion."""

import httpx
from utils import logger


class DeepSeekClient:
    """Lightweight client for the DeepSeek chat API."""

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.deepseek.com/v1",
        model: str = "deepseek-chat",
        max_tokens: int = 150,
        temperature: float = 0.9,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.max_tokens = max_tokens
        self.temperature = temperature
        self._client = httpx.Client(timeout=30.0)

    def chat(
        self,
        message: str,
        persona: str = "",
        history: list[dict[str, str]] | None = None,
    ) -> str:
        """Send a chat message with optional persona and history. Returns response text."""
        messages: list[dict[str, str]] = []

        if persona:
            messages.append({"role": "system", "content": persona})

        if history:
            messages.extend(history)

        messages.append({"role": "user", "content": message})

        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
        }

        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        logger.debug("Sending to DeepSeek: %s", message[:80])

        resp = self._client.post(url, json=payload, headers=headers)
        resp.raise_for_status()

        data = resp.json()
        choice = data["choices"][0]
        content = choice["message"]["content"].strip()
        logger.info("DeepSeek response: %s", content[:80])
        return content

    def chat_with_context(
        self,
        message: str,
        persona: str,
        history: list[tuple[str, str]],
    ) -> str:
        """Convenience: chat with persona and (user, assistant) tuple history."""
        msg_list: list[dict[str, str]] = []
        for user_msg, assistant_msg in history:
            msg_list.append({"role": "user", "content": user_msg})
            msg_list.append({"role": "assistant", "content": assistant_msg})
        return self.chat(message, persona=persona, history=msg_list)
