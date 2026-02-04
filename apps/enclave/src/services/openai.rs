use axum::response::sse::Event;
use futures_util::{Stream, StreamExt};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::pin::Pin;
use zeroize::{Zeroize, Zeroizing};

use crate::error::EnclaveError;
use crate::types::DecryptedImage;

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

    /// 텍스트 전용 채팅
    pub async fn chat(&self, message: &str) -> Result<String, anyhow::Error> {
        let request_body = ChatRequest {
            model: self.model.clone(),
            messages: vec![Message {
                role: "user".to_string(),
                content: MessageContent::Text(message.to_string()),
            }],
            max_tokens: Some(4096),
            stream: false,
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

        Ok(response_body
            .choices
            .first()
            .map(|c| c.message.content.clone())
            .unwrap_or_default())
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
    ) -> Result<String, anyhow::Error> {
        // base64 인코딩 (임시 변수)
        let mut image_base64 = decrypted_image.to_base64();

        // decrypted_image는 여기서 drop됨 (함수 파라미터로 소유권 이전됨)
        // to_base64() 호출 후 더 이상 사용하지 않으므로 여기서 drop
        drop(decrypted_image);

        let request_body = ChatRequest {
            model: self.model.clone(),
            messages: vec![Message {
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
            }],
            max_tokens: Some(4096),
            stream: false,
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

        Ok(response_body
            .choices
            .first()
            .map(|c| c.message.content.clone())
            .unwrap_or_default())
    }

    /// 텍스트 전용 스트리밍 채팅
    pub async fn chat_stream(
        &self,
        message: &str,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<Event, EnclaveError>> + Send>>, anyhow::Error>
    {
        let request_body = ChatRequest {
            model: self.model.clone(),
            messages: vec![Message {
                role: "user".to_string(),
                content: MessageContent::Text(message.to_string()),
            }],
            max_tokens: Some(4096),
            stream: true,
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

        Ok(Box::pin(Self::process_stream(response)))
    }

    /// 이미지 분석 스트리밍 요청
    pub async fn analyze_image_stream(
        &self,
        message: &str,
        decrypted_image: DecryptedImage,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<Event, EnclaveError>> + Send>>, anyhow::Error>
    {
        let mut image_base64 = decrypted_image.to_base64();
        drop(decrypted_image);

        let request_body = ChatRequest {
            model: self.model.clone(),
            messages: vec![Message {
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
            }],
            max_tokens: Some(4096),
            stream: true,
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

        Ok(Box::pin(Self::process_stream(response)))
    }

    /// SSE 스트림 처리
    fn process_stream(
        response: reqwest::Response,
    ) -> impl Stream<Item = Result<Event, EnclaveError>> {
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
                        yield Err(EnclaveError::OpenAIError(e.to_string()));
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

#[derive(Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
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
}

#[derive(Deserialize)]
struct StreamChoice {
    delta: Delta,
}

#[derive(Deserialize)]
struct Delta {
    content: Option<String>,
}
