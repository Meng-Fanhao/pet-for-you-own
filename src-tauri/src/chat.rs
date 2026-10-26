use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    max_tokens: u32,
    temperature: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
struct ChatResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatMessage,
}

pub async fn send_chat_message(
    api_key: &str,
    persona: &str,
    history: &[(String, String)],
    user_message: &str,
) -> Result<String, String> {
    let mut messages: Vec<ChatMessage> = Vec::new();

    // System persona
    messages.push(ChatMessage {
        role: "system".into(),
        content: persona.to_string(),
    });

    // Conversation history
    for (user_msg, assistant_msg) in history {
        messages.push(ChatMessage {
            role: "user".into(),
            content: user_msg.clone(),
        });
        messages.push(ChatMessage {
            role: "assistant".into(),
            content: assistant_msg.clone(),
        });
    }

    // Current user message
    messages.push(ChatMessage {
        role: "user".into(),
        content: user_message.to_string(),
    });

    let request_body = ChatRequest {
        model: "deepseek-v4-pro".into(),
        messages,
        max_tokens: 120,
        temperature: 0.9,
    };

    let client = reqwest::Client::new();
    let resp = client
        .post("https://lilin.ink/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("API error ({}): {}", status, body));
    }

    let chat_resp: ChatResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    chat_resp
        .choices
        .into_iter()
        .next()
        .map(|c| c.message.content)
        .ok_or_else(|| "No response from AI".into())
}
