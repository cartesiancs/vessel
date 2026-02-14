use base64::{engine::general_purpose::STANDARD, Engine};
use zeroize::{Zeroize, ZeroizeOnDrop};

/// 복호화된 이미지 - Capsule 내부에서만 존재
///
/// # 보안 특성
/// - `Debug` 미구현: 로그에 출력 불가
/// - `Display` 미구현: `println!` 등으로 출력 불가
/// - `Clone` 미구현: 복사 불가
/// - `Zeroize` + `ZeroizeOnDrop`: Drop 시 자동 메모리 클리어
///
/// # 컴파일 타임 보안
/// ```compile_fail
/// let img = DecryptedImage::new(vec![1, 2, 3]);
/// println!("{:?}", img);  // 컴파일 에러: Debug 미구현
/// ```
///
/// ```compile_fail
/// let img = DecryptedImage::new(vec![1, 2, 3]);
/// let copy = img.clone();  // 컴파일 에러: Clone 미구현
/// ```
#[derive(Zeroize, ZeroizeOnDrop)]
pub struct DecryptedImage {
    /// 복호화된 이미지 데이터 (private 필드)
    data: Vec<u8>,
}

impl DecryptedImage {
    /// 내부에서만 생성 가능 (crate 내부 가시성)
    pub(crate) fn new(data: Vec<u8>) -> Self {
        Self { data }
    }

    /// OpenAI API 호출용 base64 인코딩
    ///
    /// # 주의
    /// 반환된 `String`도 사용 후 명시적으로 zeroize 권장
    ///
    /// # Example
    /// ```
    /// let mut base64_str = decrypted.to_base64();
    /// // ... OpenAI API 호출 ...
    /// base64_str.zeroize();  // 명시적 클리어
    /// ```
    pub fn to_base64(&self) -> String {
        STANDARD.encode(&self.data)
    }

    /// 이미지 크기 (바이트)
    pub fn len(&self) -> usize {
        self.data.len()
    }

    /// 이미지가 비어있는지 확인
    pub fn is_empty(&self) -> bool {
        self.data.is_empty()
    }
}

// Debug, Display, Clone을 의도적으로 구현하지 않음
// 이는 컴파일 타임에 민감 데이터 노출을 방지함
