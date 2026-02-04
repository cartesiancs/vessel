/**
 * Enclave API 테스트
 *
 * 사용법:
 *   cd apps/enclave/tests
 *   npm install
 *   npm test                         # 텍스트 전용 테스트
 *   npm test ./path/to/image.jpg     # 이미지 분석 테스트
 */

import { readFileSync } from 'fs';
import { encryptImage } from './crypto.mjs';

const BASE_URL = process.env.ENCLAVE_URL || 'http://localhost:3000';

// 테스트 결과 추적
const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

/** 테스트 실행 헬퍼 */
async function test(name, fn) {
  process.stdout.write(`  ${name}... `);
  try {
    await fn();
    console.log('✓');
    results.passed++;
    results.tests.push({ name, status: 'passed' });
  } catch (error) {
    console.log('✗');
    console.log(`    Error: ${error.message}`);
    results.failed++;
    results.tests.push({ name, status: 'failed', error: error.message });
  }
}

/** 단언 헬퍼 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

/** API 호출 헬퍼 */
async function api(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error ${response.status}: ${error}`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

// ============================================
// 테스트 케이스
// ============================================

async function testHealthCheck() {
  const response = await fetch(`${BASE_URL}/health`);
  assertEqual(response.status, 200, 'Health check should return 200');
  const text = await response.text();
  assertEqual(text, 'OK', 'Health check should return OK');
}

async function testPublicKey() {
  const data = await api('/api/public-key');
  assert(data.public_key, 'Response should have public_key');
  assert(data.public_key.length > 0, 'Public key should not be empty');
  // Base64 encoded 32 bytes = 44 characters
  assertEqual(data.public_key.length, 44, 'Public key should be 44 chars (base64 of 32 bytes)');
  return data.public_key;
}

async function testTextChat() {
  const data = await api('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message: '1+1은?' }),
  });
  assert(data.response, 'Response should have response field');
  assert(data.response.length > 0, 'Response should not be empty');
}

async function testTextChatEmptyMessage() {
  const data = await api('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message: '' }),
  });
  // 빈 메시지도 처리되어야 함
  assert(data.response !== undefined, 'Response should exist');
}

async function testImageEncryption(publicKey) {
  // 테스트용 더미 이미지 데이터 (1x1 JPEG)
  const dummyJpeg = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
    0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
    0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
    0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0a, 0x0b, 0xff, 0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03,
    0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7d,
    0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
    0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08,
    0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72,
    0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
    0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45,
    0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
    0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75,
    0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
    0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3,
    0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6,
    0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9,
    0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
    0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4,
    0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01,
    0x00, 0x00, 0x3f, 0x00, 0xfb, 0xd5, 0xdb, 0x20, 0xa8, 0xf1, 0x45, 0x10,
    0xff, 0xd9,
  ]);

  const encrypted = await encryptImage(dummyJpeg, publicKey);

  assert(encrypted.ephemeral_public_key, 'Should have ephemeral_public_key');
  assert(encrypted.nonce, 'Should have nonce');
  assert(encrypted.ciphertext, 'Should have ciphertext');

  assertEqual(encrypted.ephemeral_public_key.length, 44, 'Ephemeral public key should be 44 chars');
  assertEqual(encrypted.nonce.length, 32, 'Nonce should be 32 chars (24 bytes base64)');
  assert(encrypted.ciphertext.length > 0, 'Ciphertext should not be empty');
}

async function testImageAnalysis(imagePath, publicKey) {
  // 이미지 로드
  const imageData = new Uint8Array(readFileSync(imagePath));
  console.log(`\n    Image: ${imagePath} (${imageData.length} bytes)`);

  // 이미지 암호화
  const encrypted = await encryptImage(imageData, publicKey);
  console.log(`    Encrypted: ${encrypted.ciphertext.length} chars (base64)`);

  // API 호출
  const data = await api('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      message: '이 이미지에 무엇이 있는지 간단히 설명해주세요.',
      encrypted_image: encrypted,
    }),
  });

  assert(data.response, 'Response should have response field');
  assert(data.response.length > 0, 'Response should not be empty');
  console.log(`    Response: ${data.response.substring(0, 100)}...`);
}

async function testInvalidEncryptedImage() {
  try {
    await api('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'test',
        encrypted_image: {
          ephemeral_public_key: 'invalid',
          nonce: 'invalid',
          ciphertext: 'invalid',
        },
      }),
    });
    throw new Error('Should have thrown error for invalid encrypted image');
  } catch (error) {
    assert(error.message.includes('API Error'), 'Should return API error');
  }
}

// ============================================
// 메인
// ============================================

async function main() {
  console.log(`\nEnclave API Tests`);
  console.log(`Server: ${BASE_URL}`);
  console.log('─'.repeat(50));

  let publicKey = null;

  // 기본 테스트
  console.log('\n[Basic Tests]');
  await test('Health check', testHealthCheck);
  await test('Get public key', async () => {
    publicKey = await testPublicKey();
  });

  // 텍스트 채팅 테스트
  console.log('\n[Text Chat Tests]');
  await test('Text chat', testTextChat);
  await test('Empty message', testTextChatEmptyMessage);

  // 암호화 테스트
  console.log('\n[Encryption Tests]');
  await test('Image encryption', () => testImageEncryption(publicKey));
  await test('Invalid encrypted image', testInvalidEncryptedImage);

  // 이미지 분석 테스트 (이미지 경로가 제공된 경우)
  const imagePath = process.argv[2];
  if (imagePath) {
    console.log('\n[Image Analysis Tests]');
    await test('Image analysis', () => testImageAnalysis(imagePath, publicKey));
  } else {
    console.log('\n[Image Analysis Tests]');
    console.log('  Skipped (no image path provided)');
    console.log('  Usage: npm test ./path/to/image.jpg');
  }

  // 결과 출력
  console.log('\n' + '─'.repeat(50));
  console.log(`Results: ${results.passed} passed, ${results.failed} failed`);

  if (results.failed > 0) {
    console.log('\nFailed tests:');
    results.tests
      .filter((t) => t.status === 'failed')
      .forEach((t) => console.log(`  - ${t.name}: ${t.error}`));
    process.exit(1);
  }

  console.log('\nAll tests passed! ✓\n');
}

main().catch((error) => {
  console.error('\nTest suite failed:', error.message);
  process.exit(1);
});
