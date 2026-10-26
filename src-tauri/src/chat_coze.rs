use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
struct CozeRequest<'a> {
    bot_id: &'a str,
    user_id: &'a str,
    stream: bool,
    auto_save_history: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    conversation_id: Option<String>,
    additional_messages: Vec<CozeMessage>,
}

#[derive(Debug, Serialize)]
struct CozeMessage {
    role: String,
    content: String,
    content_type: String,
}

#[derive(Debug, Deserialize)]
struct CozeResponse {
    code: i32,
    msg: Option<String>,
    data: Option<CozeData>,
}

#[derive(Debug, Deserialize)]
struct CozeData {
    conversation_id: Option<String>,
    content: Option<String>,
    messages: Option<Vec<CozeRespMessage>>,
}

#[derive(Debug, Deserialize)]
struct CozeRespMessage {
    role: Option<String>,
    content: Option<String>,
}

pub async fn send_coze_message(
    pat: &str,
    bot_id: &str,
    base_url: &str,
    user_id: &str,
    conversation_id: &mut Option<String>,
    message: &str,
) -> Result<String, String> {
    let request = CozeRequest {
        bot_id,
        user_id,
        stream: false,
        auto_save_history: true,
        conversation_id: conversation_id.clone(),
        additional_messages: vec![CozeMessage {
            role: "user".into(),
            content: message.to_string(),
            content_type: "text".into(),
        }],
    };

    let url = format!("{}/chat", base_url.trim_end_matches('/'));
    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", pat))
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Coze network error: {}", e))?;

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Coze HTTP {}: {}", status, body));
    }

    let coze_resp: CozeResponse = resp
        .json()
        .await
        .map_err(|e| format!("Coze parse error: {}", e))?;

    if coze_resp.code != 0 {
        return Err(coze_resp.msg.unwrap_or_else(|| "unknown error".into()));
    }

    let data = coze_resp.data.ok_or("no data in Coze response")?;

    // Update conversation_id for next turn
    if data.conversation_id.is_some() {
        *conversation_id = data.conversation_id;
    }

    // Extract text from response
    if let Some(messages) = data.messages {
        for msg in messages.iter().rev() {
            if msg.role.as_deref() == Some("assistant") {
                if let Some(content) = &msg.content {
                    return Ok(content.clone());
                }
            }
        }
    }

    data.content
        .ok_or_else(|| "no content in Coze response".into())
}
