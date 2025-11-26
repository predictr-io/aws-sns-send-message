# AWS SNS Send Message

A GitHub Action to publish messages to AWS SNS topics. Seamlessly integrate message publishing into your CI/CD workflows with support for standard and FIFO topics.

## Features

- **Publish messages** - Publish messages to standard or FIFO SNS topics
- **Message attributes** - Support for custom message attributes
- **Email subjects** - Set subject lines for email subscriptions
- **FIFO support** - Full support for FIFO topics with message grouping and deduplication
- **JSON message structure** - Support for platform-specific message formatting
- **Simple integration** - Works with existing SNS topics

## Prerequisites

Configure AWS credentials before using this action.

### Option 1: AWS Credentials (Production)

Use `aws-actions/configure-aws-credentials@v4` for real AWS environments:

```yaml
- name: Configure AWS Credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::123456789012:role/my-github-actions-role
    aws-region: us-east-1
```

### Option 2: LocalStack (Testing)

Use LocalStack as a service container for testing within the workflow:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      localstack:
        image: localstack/localstack
        ports:
          - 4566:4566
        env:
          SERVICES: sns
    steps:
      - name: Publish message to LocalStack SNS
        uses: predictr-io/aws-sns-send-message@v1
        env:
          AWS_ENDPOINT_URL: http://localhost:4566
          AWS_ACCESS_KEY_ID: test
          AWS_SECRET_ACCESS_KEY: test
          AWS_DEFAULT_REGION: us-east-1
        with:
          topic-arn: 'arn:aws:sns:us-east-1:000000000000:test-topic'
          message: 'Test message'
```

## Usage

### Publish Simple Message

Publish a basic message to an SNS topic:

```yaml
- name: Publish message to SNS
  uses: predictr-io/aws-sns-send-message@v1
  with:
    topic-arn: 'arn:aws:sns:us-east-1:123456789012:my-topic'
    message: 'Hello from GitHub Actions!'
```

### Publish Message with Subject

Publish a message with a subject (useful for email subscriptions):

```yaml
- name: Publish message with subject
  uses: predictr-io/aws-sns-send-message@v1
  with:
    topic-arn: 'arn:aws:sns:us-east-1:123456789012:my-topic'
    message: 'Deployment completed successfully!'
    subject: 'Production Deployment'
```

### Publish Message with Attributes

Publish a message with custom attributes:

```yaml
- name: Publish message with attributes
  uses: predictr-io/aws-sns-send-message@v1
  with:
    topic-arn: 'arn:aws:sns:us-east-1:123456789012:my-topic'
    message: '{"orderId": "12345", "amount": 99.99}'
    message-attributes: |
      {
        "OrderType": {
          "DataType": "String",
          "StringValue": "premium"
        },
        "Priority": {
          "DataType": "Number",
          "StringValue": "1"
        }
      }
```

### Publish to FIFO Topic

Publish a message to a FIFO topic:

```yaml
- name: Publish message to FIFO topic
  uses: predictr-io/aws-sns-send-message@v1
  with:
    topic-arn: 'arn:aws:sns:us-east-1:123456789012:my-topic.fifo'
    message: '{"event": "user-signup", "userId": "user123"}'
    message-group-id: 'user-events'
    message-deduplication-id: 'signup-user123-20251126'
```

### Publish FIFO with Content-Based Deduplication

For FIFO topics with content-based deduplication enabled:

```yaml
- name: Publish to FIFO topic with auto-deduplication
  uses: predictr-io/aws-sns-send-message@v1
  with:
    topic-arn: 'arn:aws:sns:us-east-1:123456789012:my-topic.fifo'
    message: '{"event": "deployment", "sha": "${{ github.sha }}"}'
    message-group-id: 'deployments'
```

### Publish with JSON Message Structure

Publish with platform-specific message formatting:

```yaml
- name: Publish with JSON structure
  uses: predictr-io/aws-sns-send-message@v1
  with:
    topic-arn: 'arn:aws:sns:us-east-1:123456789012:my-topic'
    message: |
      {
        "default": "Default message",
        "email": "Email-specific message",
        "sqs": "{\"event\": \"notification\"}",
        "lambda": "{\"event\": \"notification\"}"
      }
    message-structure: 'json'
```

### Complete Pipeline Example

Trigger downstream notifications via SNS:

```yaml
name: Deploy and Notify

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: us-east-1

      - name: Deploy application
        run: |
          echo "Deploying..."

      - name: Publish deployment notification
        id: notify
        uses: predictr-io/aws-sns-send-message@v1
        with:
          topic-arn: ${{ secrets.SNS_TOPIC_ARN }}
          subject: 'Deployment to Production'
          message: |
            {
              "event": "deployment",
              "repository": "${{ github.repository }}",
              "sha": "${{ github.sha }}",
              "actor": "${{ github.actor }}",
              "timestamp": "${{ github.event.head_commit.timestamp }}"
            }
          message-attributes: |
            {
              "EventType": {
                "DataType": "String",
                "StringValue": "deployment"
              },
              "Environment": {
                "DataType": "String",
                "StringValue": "production"
              }
            }

      - name: Log message ID
        run: |
          echo "Message published with ID: ${{ steps.notify.outputs.message-id }}"
```

## Inputs

### Required Inputs

| Input | Description |
|-------|-------------|
| `topic-arn` | SNS topic ARN (e.g., `arn:aws:sns:us-east-1:123456789012:my-topic`) |
| `message` | Message content (string, max 256 KB) |

### Optional Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `subject` | Message subject (used for email subscriptions) | - |
| `message-attributes` | Message attributes as JSON object | - |
| `message-group-id` | Message group ID (required for FIFO topics) | - |
| `message-deduplication-id` | Message deduplication ID for FIFO topics | - |
| `message-structure` | Message structure: `json` for platform-specific payloads | - |

## Outputs

| Output | Description |
|--------|-------------|
| `message-id` | Unique identifier assigned to the message by SNS |
| `sequence-number` | Sequence number (only for FIFO topics) |

## Message Attributes Format

Message attributes must be provided as a JSON object with the following structure:

```json
{
  "AttributeName": {
    "DataType": "String|Number|Binary|String.Array",
    "StringValue": "value",
    "BinaryValue": "base64-encoded-binary"
  }
}
```

### Supported Data Types

- **String** - Text data
- **Number** - Numeric data (integers and floats)
- **Binary** - Base64-encoded binary data
- **String.Array** - Array of strings

### Example

```yaml
message-attributes: |
  {
    "Author": {
      "DataType": "String",
      "StringValue": "John Doe"
    },
    "Priority": {
      "DataType": "Number",
      "StringValue": "5"
    },
    "Metadata": {
      "DataType": "Binary",
      "BinaryValue": "aGVsbG8gd29ybGQ="
    }
  }
```

## FIFO Topics

### Message Group ID

Required for FIFO topics. Messages with the same group ID are processed in order:

```yaml
message-group-id: 'user-123-events'
```

### Message Deduplication ID

Optional for FIFO topics with content-based deduplication enabled. Required otherwise:

```yaml
message-deduplication-id: 'unique-id-12345'
```

### Sequence Numbers

For FIFO topics, the action outputs a sequence number:

```yaml
- name: Publish to FIFO
  id: publish
  uses: predictr-io/aws-sns-send-message@v1
  with:
    topic-arn: ${{ vars.FIFO_TOPIC_ARN }}
    message: 'Test'
    message-group-id: 'group1'

- name: Check sequence
  run: echo "Sequence: ${{ steps.publish.outputs.sequence-number }}"
```

## Message Structure

### Raw Message (Default)

By default, the message is sent as-is to all subscriptions:

```yaml
message: 'This message will be sent to all subscribers'
```

### JSON Message Structure

Use `message-structure: 'json'` to send platform-specific messages:

```yaml
message: |
  {
    "default": "Default message",
    "email": "Email-specific message",
    "email-json": "{\"subject\": \"Alert\", \"body\": \"Email body\"}",
    "sqs": "{\"event\": \"notification\"}",
    "lambda": "{\"event\": \"notification\"}",
    "http": "HTTP-specific message",
    "https": "HTTPS-specific message",
    "sms": "SMS-specific message"
  }
message-structure: 'json'
```

## Error Handling

The action handles common scenarios:

- **Invalid topic ARN**: Fails with validation error
- **Message too large**: Fails with size limit error (max 256 KB)
- **Missing FIFO parameters**: Fails if `message-group-id` not provided for FIFO topics
- **AWS permission errors**: Fails with AWS SDK error message
- **Invalid JSON**: Fails with JSON parsing error for attributes

## Topic ARN Format

### Standard Topic

```
arn:aws:sns:{region}:{account-id}:{topic-name}
```

### FIFO Topic

```
arn:aws:sns:{region}:{account-id}:{topic-name}.fifo
```

You can find your topic ARN in the AWS Console or using AWS CLI:

```bash
aws sns list-topics
```

## Development

### Setup

Clone and install dependencies:

```bash
git clone https://github.com/predictr-io/aws-sns-send-message.git
cd aws-sns-send-message
npm install
```

### Development Scripts

```bash
# Build the action (compile TypeScript + bundle with dependencies)
npm run build

# Run TypeScript type checking
npm run type-check

# Run ESLint
npm run lint

# Run all checks (type-check + lint)
npm run check
```

### Build Process

The build process uses `@vercel/ncc` to compile TypeScript and bundle all dependencies into a single `dist/index.js` file:

```bash
npm run build
```

**Output:**
- `dist/index.js` - Bundled action (includes AWS SDK)
- `dist/index.js.map` - Source map for debugging
- `dist/licenses.txt` - License information for bundled dependencies

**Important:** The `dist/` directory **must be committed** to git. GitHub Actions runs the compiled code directly from the repository.

### Making Changes

1. **Edit source files** in `src/`
2. **Run checks** to validate:
   ```bash
   npm run check
   ```
3. **Build** to update `dist/`:
   ```bash
   npm run build
   ```
4. **Test locally** (optional) - Use [act](https://github.com/nektos/act) or create a test workflow
5. **Commit everything** including `dist/`:
   ```bash
   git add src/ dist/
   git commit -m "Description of changes"
   ```

### Release Process

Follow these steps to create a new release:

#### 1. Make and Test Changes

```bash
# Make your changes to src/
# Run checks
npm run check

# Build
npm run build

# Commit source and dist/
git add .
git commit -m "Add new feature"
git push origin main
```

#### 2. Create Version Tag

```bash
# Create annotated tag (use semantic versioning)
git tag -a v1.0.0 -m "Release v1.0.0: Initial release"

# Push tag to trigger release workflow
git push origin v1.0.0
```

#### 3. Automated Release

GitHub Actions automatically:
- ✓ Verifies `dist/` is committed
- ✓ Verifies `dist/` is up-to-date with source
- ✓ Creates GitHub Release with auto-generated notes
- ✓ Updates major version tag (e.g., `v1` → `v1.0.0`)

#### 4. Version References

Users can reference the action:
- **Recommended:** `predictr-io/aws-sns-send-message@v1` (floating major version, gets updates)
- **Pinned:** `predictr-io/aws-sns-send-message@v1.0.0` (specific version, never changes)

### Troubleshooting

**Release workflow fails with "dist/ is out of date":**
```bash
npm run build
git add dist/
git commit -m "Update dist/ for release"
git tag -f v1.0.0
git push -f origin v1.0.0
```

**ESLint errors:**
```bash
npm run lint
# Fix issues, then:
npm run check
```

**TypeScript errors:**
```bash
npm run type-check
```

## License

MIT

## Contributing

Contributions welcome! Please submit a Pull Request.
