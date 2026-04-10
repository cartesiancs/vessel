use axum::response::sse::Event;
use futures_util::{Stream, StreamExt};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::pin::Pin;
use zeroize::{Zeroize, Zeroizing};

use crate::error::CapsuleError;
use crate::types::{DecryptedImage, HistoryMessage};

const OPENAI_API_URL: &str = "https://api.openai.com/v1/chat/completions";

/// OpenAI API 서비스
///
/// # 보안
/// - `api_key`는 `Zeroizing<String>`으로 보호됨
/// - Drop 시 자동으로 메모리 클리어
pub struct OpenAIService {
    client: Client,
    api_key: Zeroizing<String>,
    model: String,
}

impl OpenAIService {
    /// 새 OpenAI 서비스 생성
    pub fn new(api_key: Zeroizing<String>) -> Self {
        Self {
            client: Client::new(),
            api_key,
            model: "gpt-4o".to_string(),
        }
    }

    /// 모델 설정
    pub fn with_model(mut self, model: String) -> Self {
        self.model = model;
        self
    }

    /// 메시지 배열 빌드: system_prompt → history → current_message
    fn build_messages(
        system_prompt: Option<&str>,
        history: Option<&[HistoryMessage]>,
        current_message: Message,
    ) -> Vec<Message> {
        let mut messages = Vec::new();

        if let Some(prompt) = system_prompt {
            messages.push(Message {
                role: "system".to_string(),
                content: Some(MessageContent::Text(prompt.to_string())),
                tool_call_id: None,
                tool_calls: None,
            });
        }

        if let Some(history) = history {
            for msg in history {
                let mut m = Message {
                    role: msg.role.clone(),
                    content: Some(MessageContent::Text(msg.content.clone())),
                    tool_call_id: None,
                    tool_calls: None,
                };
                if let Some(ref tc_id) = msg.tool_call_id {
                    m.tool_call_id = Some(tc_id.clone());
                }
                if let Some(ref tc) = msg.tool_calls {
                    m.tool_calls = Some(tc.clone());
                    if msg.content.is_empty() {
                        m.content = None;
                    }
                }
                messages.push(m);
            }
        }

        messages.push(current_message);
        messages
    }

    /// 텍스트 전용 채팅
    pub async fn chat(
        &self,
        message: &str,
        system_prompt: Option<&str>,
        history: Option<&[HistoryMessage]>,
        tools: Option<&serde_json::Value>,
        tool_choice: Option<&serde_json::Value>,
    ) -> Result<ChatResult, anyhow::Error> {
        let current = Message {
            role: "user".to_string(),
            content: Some(MessageContent::Text(message.to_string())),
            tool_call_id: None,
            tool_calls: None,
        };

        let request_body = ChatRequest {
            model: self.model.clone(),
            messages: Self::build_messages(system_prompt, history, current),
            max_tokens: Some(4096),
            stream: false,
            stream_options: None,
            tools: tools.cloned(),
            tool_choice: tool_choice.cloned(),
        };

        let response = self
            .client
            .post(OPENAI_API_URL)
            .header("Authorization", format!("Bearer {}", &*self.api_key))
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow::anyhow!("OpenAI API error: {}", error_text));
        }

        let response_body: ChatResponse = response.json().await?;

        let choice = response_body.choices.first();
        Ok(ChatResult {
            content: choice
                .and_then(|c| c.message.content.clone())
                .unwrap_or_default(),
            tool_calls: choice.and_then(|c| c.message.tool_calls.clone()),
            usage: response_body.usage.into(),
        })
    }

    /// 이미지 분석 요청
    ///
    /// # 보안
    /// - `decrypted_image`는 소유권이 이전됨
    /// - 함수 종료 시 자동으로 drop → zeroize
    /// - base64 문자열도 사용 후 명시적 zeroize
    pub async fn analyze_image(
        &self,
        message: &str,
        decrypted_image: DecryptedImage,
        system_prompt: Option<&str>,
        history: Option<&[HistoryMessage]>,
        tools: Option<&serde_json::Value>,
        tool_choice: Option<&serde_json::Value>,
    ) -> Result<ChatResult, anyhow::Error> {
        let mut image_base64 = decrypted_image.to_base64();
        drop(decrypted_image);

        let current = Message {
            role: "user".to_string(),
            content: Some(MessageContent::MultiPart(vec![
                ContentPart::Text {
                    text: message.to_string(),
                },
                ContentPart::ImageUrl {
                    image_url: ImageUrl {
                        url: format!("data:image/jpeg;base64,{}", image_base64),
                    },
                },
            ])),
            tool_call_id: None,
            tool_calls: None,
        };

        let request_body = ChatRequest {
            model: self.model.clone(),
            messages: Self::build_messages(system_prompt, history, current),
            max_tokens: Some(4096),
            stream: false,
            stream_options: None,
            tools: tools.cloned(),
            tool_choice: tool_choice.cloned(),
        };

        let response = self
            .client
            .post(OPENAI_API_URL)
            .header("Authorization", format!("Bearer {}", &*self.api_key))
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await;

        image_base64.zeroize();

        let response = response?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow::anyhow!("OpenAI API error: {}", error_text));
        }

        let response_body: ChatResponse = response.json().await?;

        let choice = response_body.choices.first();
        Ok(ChatResult {
            content: choice
                .and_then(|c| c.message.content.clone())
                .unwrap_or_default(),
            tool_calls: choice.and_then(|c| c.message.tool_calls.clone()),
            usage: response_body.usage.into(),
        })
    }

    /// 텍스트 전용 스트리밍 채팅
    ///
    /// Returns a stream of SSE events and a shared usage tracker.
    /// The usage will be populated when the stream completes.
    pub async fn chat_stream(
        &self,
        message: &str,
        system_prompt: Option<&str>,
        history: Option<&[HistoryMessage]>,
        tools: Option<&serde_json::Value>,
        tool_choice: Option<&serde_json::Value>,
    ) -> Result<(Pin<Box<dyn Stream<Item = Result<Event, CapsuleError>> + Send>>, std::sync::Arc<std::sync::Mutex<TokenUsage>>), anyhow::Error>
    {
        let current = Message {
            role: "user".to_string(),
            content: Some(MessageContent::Text(message.to_string())),
            tool_call_id: None,
            tool_calls: None,
        };

        let request_body = ChatRequest {
            model: self.model.clone(),
            messages: Self::build_messages(system_prompt, history, current),
            max_tokens: Some(4096),
            stream: true,
            stream_options: Some(StreamOptions { include_usage: true }),
            tools: tools.cloned(),
            tool_choice: tool_choice.cloned(),
        };

        let response = self
            .client
            .post(OPENAI_API_URL)
            .header("Authorization", format!("Bearer {}", &*self.api_key))
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow::anyhow!("OpenAI API error: {}", error_text));
        }

        let usage = std::sync::Arc::new(std::sync::Mutex::new(TokenUsage::default()));
        let stream = Box::pin(Self::process_stream_with_usage(response, usage.clone()));
        Ok((stream, usage))
    }

    /// 이미지 분석 스트리밍 요청
    ///
    /// Returns a stream of SSE events and a shared usage tracker.
    /// The usage will be populated when the stream completes.
    pub async fn analyze_image_stream(
        &self,
        message: &str,
        decrypted_image: DecryptedImage,
        system_prompt: Option<&str>,
        history: Option<&[HistoryMessage]>,
        tools: Option<&serde_json::Value>,
        tool_choice: Option<&serde_json::Value>,
    ) -> Result<(Pin<Box<dyn Stream<Item = Result<Event, CapsuleError>> + Send>>, std::sync::Arc<std::sync::Mutex<TokenUsage>>), anyhow::Error>
    {
        let mut image_base64 = decrypted_image.to_base64();
        drop(decrypted_image);

        let current = Message {
            role: "user".to_string(),
            content: Some(MessageContent::MultiPart(vec![
                ContentPart::Text {
                    text: message.to_string(),
                },
                ContentPart::ImageUrl {
                    image_url: ImageUrl {
                        url: format!("data:image/jpeg;base64,{}", image_base64),
                    },
                },
            ])),
            tool_call_id: None,
            tool_calls: None,
        };

        let request_body = ChatRequest {
            model: self.model.clone(),
            messages: Self::build_messages(system_prompt, history, current),
            max_tokens: Some(4096),
            stream: true,
            stream_options: Some(StreamOptions { include_usage: true }),
            tools: tools.cloned(),
            tool_choice: tool_choice.cloned(),
        };

        let response = self
            .client
            .post(OPENAI_API_URL)
            .header("Authorization", format!("Bearer {}", &*self.api_key))
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await;

        image_base64.zeroize();

        let response = response?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow::anyhow!("OpenAI API error: {}", error_text));
        }

        let usage = std::sync::Arc::new(std::sync::Mutex::new(TokenUsage::default()));
        let stream = Box::pin(Self::process_stream_with_usage(response, usage.clone()));
        Ok((stream, usage))
    }

    /// SSE 스트림 처리 (with usage tracking and tool call accumulation)
    fn process_stream_with_usage(
        response: reqwest::Response,
        usage: std::sync::Arc<std::sync::Mutex<TokenUsage>>,
    ) -> impl Stream<Item = Result<Event, CapsuleError>> {
        async_stream::stream! {
            let mut stream = response.bytes_stream();
            let mut tool_call_buffer: HashMap<u32, AccumulatedToolCall> = HashMap::new();

            while let Some(chunk) = stream.next().await {
                match chunk {
                    Ok(bytes) => {
                        let text = String::from_utf8_lossy(&bytes);

                        for line in text.lines() {
                            if line.starts_with("data: ") {
                                let data = &line[6..];

                                if data == "[DONE]" {
                                    // Emit accumulated tool calls before [DONE] if any
                                    if !tool_call_buffer.is_empty() {
                                        let mut entries: Vec<_> = tool_call_buffer.drain().collect();
                                        entries.sort_by_key(|(idx, _)| *idx);
                                        let tool_calls: Vec<serde_json::Value> = entries
                                            .into_iter()
                                            .map(|(_, tc)| tc.to_json())
                                            .collect();
                                        if let Ok(json) = serde_json::to_string(&tool_calls) {
                                            yield Ok(Event::default().data(format!("[TOOL_CALLS]{}", json)));
                                        }
                                    }
                                    yield Ok(Event::default().data("[DONE]"));
                                    return;
                                }

                                if let Ok(chunk) = serde_json::from_str::<StreamChunk>(data) {
                                    if let Some(u) = chunk.usage {
                                        if let Ok(mut usage_guard) = usage.lock() {
                                            usage_guard.prompt_tokens = u.prompt_tokens;
                                            usage_guard.completion_tokens = u.completion_tokens;
                                            usage_guard.total_tokens = u.total_tokens;
                                        }
                                    }

                                    if let Some(choice) = chunk.choices.first() {
                                        // Stream text content
                                        if let Some(content) = &choice.delta.content {
                                            yield Ok(Event::default().data(content.clone()));
                                        }

                                        // Accumulate tool calls by index
                                        if let Some(ref tcs) = choice.delta.tool_calls {
                                            for tc in tcs {
                                                let entry = tool_call_buffer
                                                    .entry(tc.index)
                                                    .or_insert_with(AccumulatedToolCall::default);

                                                if let Some(ref id) = tc.id {
                                                    entry.id = id.clone();
                                                }
                                                if let Some(ref func) = tc.function {
                                                    if let Some(ref name) = func.name {
                                                        entry.function_name = name.clone();
                                                    }
                                                    if let Some(ref args) = func.arguments {
                                                        entry.arguments.push_str(args);
                                                    }
                                                }
                                            }
                                        }

                                        // Emit tool calls when finish_reason is "tool_calls"
                                        if choice.finish_reason.as_deref() == Some("tool_calls") && !tool_call_buffer.is_empty() {
                                            let mut entries: Vec<_> = tool_call_buffer.drain().collect();
                                            entries.sort_by_key(|(idx, _)| *idx);
                                            let tool_calls: Vec<serde_json::Value> = entries
                                                .into_iter()
                                                .map(|(_, tc)| tc.to_json())
                                                .collect();
                                            if let Ok(json) = serde_json::to_string(&tool_calls) {
                                                yield Ok(Event::default().data(format!("[TOOL_CALLS]{}", json)));
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        yield Err(CapsuleError::OpenAIError(e.to_string()));
                        return;
                    }
                }
            }
        }
    }
}

// -- Accumulated tool call buffer --

#[derive(Default)]
struct AccumulatedToolCall {
    id: String,
    function_name: String,
    arguments: String,
}

impl AccumulatedToolCall {
    fn to_json(&self) -> serde_json::Value {
        serde_json::json!({
            "id": self.id,
            "type": "function",
            "function": {
                "name": self.function_name,
                "arguments": self.arguments,
            }
        })
    }
}

// -- OpenAI API request/response types --

#[derive(Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<Message>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream_options: Option<StreamOptions>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tools: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_choice: Option<serde_json::Value>,
}

#[derive(Serialize)]
struct StreamOptions {
    include_usage: bool,
}

#[derive(Serialize)]
struct Message {
    role: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<MessageContent>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_call_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_calls: Option<serde_json::Value>,
}

#[derive(Serialize)]
#[serde(untagged)]
enum MessageContent {
    Text(String),
    MultiPart(Vec<ContentPart>),
}

#[derive(Serialize)]
#[serde(tag = "type")]
enum ContentPart {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "image_url")]
    ImageUrl { image_url: ImageUrl },
}

#[derive(Serialize)]
struct ImageUrl {
    url: String,
}

/// Token usage information from OpenAI API
#[derive(Debug, Clone, Default, Deserialize)]
pub struct TokenUsage {
    pub prompt_tokens: i32,
    pub completion_tokens: i32,
    pub total_tokens: i32,
}

/// Result of a chat request including content and token usage
#[derive(Debug, Clone)]
pub struct ChatResult {
    pub content: String,
    pub tool_calls: Option<serde_json::Value>,
    pub usage: TokenUsage,
}

#[derive(Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
    usage: Option<Usage>,
}

#[derive(Deserialize)]
struct Usage {
    prompt_tokens: i32,
    completion_tokens: i32,
    total_tokens: i32,
}

impl From<Option<Usage>> for TokenUsage {
    fn from(usage: Option<Usage>) -> Self {
        match usage {
            Some(u) => TokenUsage {
                prompt_tokens: u.prompt_tokens,
                completion_tokens: u.completion_tokens,
                total_tokens: u.total_tokens,
            },
            None => TokenUsage::default(),
        }
    }
}

#[derive(Deserialize)]
struct Choice {
    message: ResponseMessage,
}

#[derive(Deserialize)]
struct ResponseMessage {
    content: Option<String>,
    tool_calls: Option<serde_json::Value>,
}

#[derive(Deserialize)]
struct StreamChunk {
    choices: Vec<StreamChoice>,
    usage: Option<Usage>,
}

#[derive(Deserialize)]
struct StreamChoice {
    delta: Delta,
    #[serde(default)]
    finish_reason: Option<String>,
}

#[derive(Deserialize)]
struct Delta {
    content: Option<String>,
    #[serde(default)]
    tool_calls: Option<Vec<StreamToolCall>>,
}

#[derive(Deserialize)]
struct StreamToolCall {
    index: u32,
    id: Option<String>,
    #[serde(default)]
    function: Option<StreamToolCallFunction>,
}

#[derive(Deserialize, Default)]
struct StreamToolCallFunction {
    name: Option<String>,
    arguments: Option<String>,
}
