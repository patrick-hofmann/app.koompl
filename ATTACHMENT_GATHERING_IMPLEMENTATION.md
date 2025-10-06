# Mailgun Attachment Gathering Implementation

## Overview

This implementation provides comprehensive email attachment gathering functionality for Mailgun webhooks. The system can extract, validate, and process various attachment formats from incoming emails.

## Features Implemented

### 1. Enhanced Attachment Extraction (`server/utils/mailgunHelpers.ts`)

#### Multiple Format Support
- **Standard format**: `attachment-count` with `attachment-1`, `attachment-2`, etc.
- **Array format**: `attachments` array containing attachment objects
- **Individual fields**: Direct `attachment-*` fields without count
- **Inline attachments**: `inline-*` fields for embedded content
- **Form-data style**: Multipart form data attachments

#### Security Features
- **Size limits**: Maximum 25MB per attachment
- **MIME type validation**: Whitelist of allowed file types
- **Filename validation**: Protection against path traversal and malicious names
- **Data integrity checks**: Base64 validation and content verification

#### Enhanced Logging
- Detailed extraction process logging
- Attachment statistics and summaries
- Debug mode for troubleshooting
- Error reporting for invalid attachments

### 2. Attachment Processing Functions

#### Core Functions
- `extractMailgunAttachments()`: Main extraction function with multiple format support
- `getAttachmentStats()`: Get attachment statistics without processing
- `validateAttachment()`: Comprehensive security and format validation
- `debugAttachments()`: Debug logging for troubleshooting

#### Utility Functions
- `filterAttachmentsByMimeType()`: Filter by MIME type patterns
- `filterAttachmentsBySize()`: Filter by size range
- `groupAttachmentsByMimeType()`: Group attachments by type
- `validateAttachmentData()`: Internal data validation

### 3. Enhanced Inbound Email Handler (`server/api/mailgun/inbound.post.ts`)

#### Improved Processing Flow
1. **Statistics gathering**: Get attachment stats before processing
2. **Debug mode**: Optional detailed logging via environment variable
3. **Validation**: Comprehensive validation of each attachment
4. **Error handling**: Graceful handling of invalid attachments
5. **Storage**: Secure storage in datasafe with metadata

#### Environment Configuration
- `MAILGUN_ATTACHMENT_DEBUG=true`: Enable detailed debug logging

### 4. Security Measures

#### File Type Restrictions
```javascript
const ALLOWED_MIME_TYPES = [
  'image/',
  'text/',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/zip',
  'application/x-zip-compressed',
  'application/json',
  'application/xml',
  'application/octet-stream'
]
```

#### Filename Security
- Path traversal protection (`../` detection)
- Invalid character filtering
- Windows reserved name detection
- Filename sanitization

#### Size Limits
- Maximum 25MB per attachment
- Configurable limits via constants
- Size validation before processing

### 5. Enhanced Data Structure

#### MailgunAttachment Interface
```typescript
export interface MailgunAttachment {
  filename: string
  data: string
  encoding: 'base64'
  mimeType: string
  size: number
  isInline?: boolean
  contentId?: string
}
```

#### Validation Results
```typescript
{
  isValid: boolean
  errors: string[]
}
```

## Usage Examples

### Basic Attachment Extraction
```javascript
import { extractMailgunAttachments } from './server/utils/mailgunHelpers'

const payload = { /* Mailgun webhook payload */ }
const attachments = extractMailgunAttachments(payload)
console.log(`Found ${attachments.length} attachments`)
```

### Attachment Statistics
```javascript
import { getAttachmentStats } from './server/utils/mailgunHelpers'

const stats = getAttachmentStats(payload)
console.log(`Total: ${stats.totalCount} attachments, ${stats.totalSize} bytes`)
```

### Validation
```javascript
import { validateAttachment } from './server/utils/mailgunHelpers'

attachments.forEach(att => {
  const validation = validateAttachment(att)
  if (!validation.isValid) {
    console.log(`Invalid: ${validation.errors.join(', ')}`)
  }
})
```

### Debug Mode
```javascript
import { debugAttachments } from './server/utils/mailgunHelpers'

// Enable detailed logging
debugAttachments(payload)
```

## Testing

A comprehensive test script is provided (`test-attachment-gathering.js`) that demonstrates:
- Standard attachment format processing
- Array format processing
- Inline attachment handling
- Invalid attachment filtering
- Security validation

Run the test:
```bash
node test-attachment-gathering.js
```

## Configuration

### Environment Variables
- `MAILGUN_ATTACHMENT_DEBUG=true`: Enable debug logging

### Constants (configurable in code)
- `MAX_ATTACHMENT_SIZE`: Maximum file size (default: 25MB)
- `ALLOWED_MIME_TYPES`: Whitelist of allowed MIME types

## Error Handling

The system provides comprehensive error handling:
- Invalid base64 data
- Oversized files
- Disallowed MIME types
- Malicious filenames
- Storage failures

All errors are logged with detailed information for debugging.

## Integration

The attachment gathering system integrates seamlessly with:
- **Datasafe storage**: Automatic storage with metadata
- **Agent logging**: Email activity logging with attachment info
- **MCP tools**: Available for agent decision making
- **Email routing**: Part of the complete email processing pipeline

## Future Enhancements

Potential improvements:
- Virus scanning integration
- Image thumbnail generation
- OCR for scanned documents
- Automatic file type detection
- Compression for large files
- Cloud storage integration
