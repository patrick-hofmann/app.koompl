#!/usr/bin/env node

/**
 * Test script to demonstrate Mailgun attachment gathering functionality
 * This script simulates various Mailgun webhook payloads with attachments
 */

const {
  extractMailgunAttachments,
  getAttachmentStats,
  validateAttachment
} = require('./server/utils/mailgunHelpers.ts')

// Test payload 1: Standard attachment format
const testPayload1 = {
  from: 'test@example.com',
  to: 'agent@example.com',
  subject: 'Test with attachments',
  text: 'Please find the attached files.',
  'attachment-count': '2',
  'attachment-1': {
    filename: 'document.pdf',
    'content-type': 'application/pdf',
    data: Buffer.from('fake pdf content').toString('base64'),
    size: 1024
  },
  'attachment-2': {
    filename: 'image.jpg',
    'content-type': 'image/jpeg',
    data: Buffer.from('fake image content').toString('base64'),
    size: 2048
  }
}

// Test payload 2: Array format
const testPayload2 = {
  from: 'test@example.com',
  to: 'agent@example.com',
  subject: 'Test with array attachments',
  text: 'Please find the attached files.',
  attachments: [
    {
      filename: 'spreadsheet.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      content: Buffer.from('fake excel content').toString('base64'),
      size: 4096
    },
    {
      filename: 'presentation.pptx',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      base64: Buffer.from('fake powerpoint content').toString('base64'),
      size: 8192
    }
  ]
}

// Test payload 3: Inline attachments
const testPayload3 = {
  from: 'test@example.com',
  to: 'agent@example.com',
  subject: 'Test with inline attachments',
  text: 'Please find the inline images.',
  'inline-1': {
    filename: 'logo.png',
    'content-type': 'image/png',
    'content-disposition': 'inline; filename="logo.png"',
    'content-id': '<logo@example.com>',
    data: Buffer.from('fake logo content').toString('base64'),
    size: 512
  }
}

// Test payload 4: Malformed/invalid attachments
const testPayload4 = {
  from: 'test@example.com',
  to: 'agent@example.com',
  subject: 'Test with invalid attachments',
  text: 'This has some invalid attachments.',
  'attachment-count': '3',
  'attachment-1': {
    filename: 'valid.txt',
    'content-type': 'text/plain',
    data: Buffer.from('valid content').toString('base64'),
    size: 100
  },
  'attachment-2': {
    filename: 'invalid.exe',
    'content-type': 'application/x-executable',
    data: Buffer.from('malicious content').toString('base64'),
    size: 100
  },
  'attachment-3': {
    filename: 'huge-file.zip',
    'content-type': 'application/zip',
    data: Buffer.alloc(30 * 1024 * 1024).toString('base64'), // 30MB
    size: 30 * 1024 * 1024
  }
}

function runTest(testName, payload) {
  console.log(`\n=== ${testName} ===`)
  console.log('Payload keys:', Object.keys(payload))

  // Get stats
  const stats = getAttachmentStats(payload)
  console.log('Stats:', stats)

  // Extract attachments
  const attachments = extractMailgunAttachments(payload)
  console.log(`Extracted ${attachments.length} attachments:`)

  attachments.forEach((att, index) => {
    console.log(`  ${index + 1}. ${att.filename} (${att.mimeType}, ${att.size} bytes)`)

    // Validate each attachment
    const validation = validateAttachment(att)
    if (validation.isValid) {
      console.log(`     ✓ Valid`)
    } else {
      console.log(`     ✗ Invalid: ${validation.errors.join(', ')}`)
    }
  })
}

// Run all tests
console.log('🧪 Testing Mailgun Attachment Gathering')
console.log('=====================================')

runTest('Test 1: Standard attachment format', testPayload1)
runTest('Test 2: Array format', testPayload2)
runTest('Test 3: Inline attachments', testPayload3)
runTest('Test 4: Invalid/malformed attachments', testPayload4)

console.log('\n✅ All tests completed!')
console.log('\nTo enable debug mode in production, set: MAILGUN_ATTACHMENT_DEBUG=true')
