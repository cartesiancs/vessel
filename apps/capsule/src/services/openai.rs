use axum::response::sse::Event;
use futures_util::{Stream, StreamExt};
use reqwest::Client;
use serde::{Deserialize, Serialize};
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
                content: MessageContent::Text(prompt.to_string()),
            });
        }

        if let Some(history) = history {
            for msg in history {
                messages.push(Message {
                    role: msg.role.clone(),
                    content: MessageContent::Text(msg.content.clone()),
                });
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
    ) -> Result<ChatResult, anyhow::Error> {
        let current = Message {
            role: "user".to_string(),
            content: MessageContent::Text(message.to_string()),
        };

        let request_body = ChatRequest {
            model: self.model.clone(),
            messages: Self::build_messages(system_prompt, history, current),
            max_tokens: Some(4096),
            stream: false,
            stream_options: None,
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

        Ok(ChatResult {
            content: response_body
                .choices
                .first()
                .map(|c| c.message.content.clone())
                .unwrap_or_default(),
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
        decrypted_image: DecryptedImage, // 소유권 이전 → 함수 종료 시 자동 drop
        system_prompt: Option<&str>,
        history: Option<&[HistoryMessage]>,
    ) -> Result<ChatResult, anyhow::Error> {
        // base64 인코딩 (임시 변수)
        let mut image_base64 = decrypted_image.to_base64();

        // decrypted_image는 여기서 drop됨 (함수 파라미터로 소유권 이전됨)
        // to_base64() 호출 후 더 이상 사용하지 않으므로 여기서 drop
        drop(decrypted_image);

        let current = Message {
            role: "user".to_string(),
            content: MessageContent::MultiPart(vec![
                ContentPart::Text {
                    text: message.to_string(),
                },
                ContentPart::ImageUrl {
                    image_url: ImageUrl {
                        url: format!("data:image/jpeg;base64,{}", image_base64),
                    },
                },
            ]),
        };

        let request_body = ChatRequest {
            model: self.model.clone(),
            messages: Self::build_messages(system_prompt, history, current),
            max_tokens: Some(4096),
            stream: false,
            stream_options: None,
        };

        let response = self
            .client
            .post(OPENAI_API_URL)
            .header("Authorization", format!("Bearer {}", &*self.api_key))
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await;

        // 민감 데이터 즉시 클리어 (응답 대기 전에도)
        image_base64.zeroize();

        let response = response?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow::anyhow!("OpenAI API error: {}", error_text));
        }

        let response_body: ChatResponse = response.json().await?;

        Ok(ChatResult {
            content: response_body
                .choices
                .first()
                .map(|c| c.message.content.clone())
                .unwrap_or_default(),
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
    ) -> Result<(Pin<Box<dyn Stream<Item = Result<Event, CapsuleError>> + Send>>, std::sync::Arc<std::sync::Mutex<TokenUsage>>), anyhow::Error>
    {
        let current = Message {
            role: "user".to_string(),
            content: MessageContent::Text(message.to_string()),
        };

        let request_body = ChatRequest {
            model: self.model.clone(),
            messages: Self::build_messages(system_prompt, history, current),
            max_tokens: Some(4096),
            stream: true,
            stream_options: Some(StreamOptions { include_usage: true }),
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
    ) -> Result<(Pin<Box<dyn Stream<Item = Result<Event, CapsuleError>> + Send>>, std::sync::Arc<std::sync::Mutex<TokenUsage>>), anyhow::Error>
    {
        let mut image_base64 = decrypted_image.to_base64();
        drop(decrypted_image);

        let current = Message {
            role: "user".to_string(),
            content: MessageContent::MultiPart(vec![
                ContentPart::Text {
                    text: message.to_string(),
                },
                ContentPart::ImageUrl {
                    image_url: ImageUrl {
                        url: format!("data:image/jpeg;base64,{}", image_base64),
                    },
                },
            ]),
        };

        let request_body = ChatRequest {
            model: self.model.clone(),
            messages: Self::build_messages(system_prompt, history, current),
            max_tokens: Some(4096),
            stream: true,
            stream_options: Some(StreamOptions { include_usage: true }),
        };

        let response = self
            .client
            .post(OPENAI_API_URL)
            .header("Authorization", format!("Bearer {}", &*self.api_key))
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await;

        // 민감 데이터 즉시 클리어
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

    /// SSE 스트림 처리 (with usage tracking)
    fn process_stream_with_usage(
        response: reqwest::Response,
        usage: std::sync::Arc<std::sync::Mutex<TokenUsage>>,
    ) -> impl Stream<Item = Result<Event, CapsuleError>> {
        async_stream::stream! {
            let mut stream = response.bytes_stream();

            while let Some(chunk) = stream.next().await {
                match chunk {
                    Ok(bytes) => {
                        let text = String::from_utf8_lossy(&bytes);

                        for line in text.lines() {
                            if line.starts_with("data: ") {
                                let data = &line[6..];

                                if data == "[DONE]" {
                                    yield Ok(Event::default().data("[DONE]"));
                                    return;
                                }

                                if let Ok(chunk) = serde_json::from_str::<StreamChunk>(data) {
                                    // Capture usage from the final chunk (when include_usage is true)
                                    if let Some(u) = chunk.usage {
                                        if let Ok(mut usage_guard) = usage.lock() {
                                            usage_guard.prompt_tokens = u.prompt_tokens;
                                            usage_guard.completion_tokens = u.completion_tokens;
                                            usage_guard.total_tokens = u.total_tokens;
                                        }
                                    }

                                    if let Some(choice) = chunk.choices.first() {
                                        if let Some(content) = &choice.delta.content {
                                            yield Ok(Event::default().data(content.clone()));
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

// OpenAI API 요청/응답 타입들

#[derive(Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<Message>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream_options: Option<StreamOptions>,
}

#[derive(Serialize)]
struct StreamOptions {
    include_usage: bool,
}

#[derive(Serialize)]
struct Message {
    role: String,
    content: MessageContent,
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
    content: String,
}

#[derive(Deserialize)]
struct StreamChunk {
    choices: Vec<StreamChoice>,
    usage: Option<Usage>,
}

#[derive(Deserialize)]
struct StreamChoice {
    delta: Delta,
}

#[derive(Deserialize)]
struct Delta {
    content: Option<String>,
}
