import {
  SNSClient,
  PublishCommand,
  PublishCommandInput,
  MessageAttributeValue
} from '@aws-sdk/client-sns';
import * as core from '@actions/core';

export interface MessageConfig {
  topicArn: string;
  message: string;
  subject?: string;
  messageAttributes?: string; // JSON string
  messageGroupId?: string;
  messageDeduplicationId?: string;
  messageStructure?: string;
}

export interface MessageResult {
  success: boolean;
  messageId?: string;
  sequenceNumber?: string;
  error?: string;
}

/**
 * Parse message attributes from JSON string to SNS format
 */
export function parseMessageAttributes(
  attributesJson: string
): Record<string, MessageAttributeValue> {
  try {
    const parsed = JSON.parse(attributesJson);
    const attributes: Record<string, MessageAttributeValue> = {};
    const attributeKeys = Object.keys(parsed);

    // Validate: max 10 attributes
    if (attributeKeys.length > 10) {
      throw new Error(
        `Too many message attributes: ${attributeKeys.length}. Maximum allowed is 10.`
      );
    }

    // Valid data types
    const validDataTypes = ['String', 'Number', 'Binary', 'String.Array'];

    for (const [key, value] of Object.entries(parsed)) {
      const attr = value as {
        DataType: string;
        StringValue?: string;
        BinaryValue?: string;
      };

      // Validate: DataType is required
      if (!attr.DataType) {
        throw new Error(
          `Missing DataType for attribute "${key}". Must be one of: ${validDataTypes.join(', ')}`
        );
      }

      // Validate: DataType is valid
      if (!validDataTypes.includes(attr.DataType)) {
        throw new Error(
          `Invalid DataType "${attr.DataType}" for attribute "${key}". Must be one of: ${validDataTypes.join(', ')}`
        );
      }

      // Validate: has appropriate value for the DataType
      if (attr.DataType === 'String' || attr.DataType === 'Number' || attr.DataType === 'String.Array') {
        if (attr.StringValue === undefined) {
          throw new Error(
            `Missing StringValue for attribute "${key}" with DataType "${attr.DataType}"`
          );
        }
      } else if (attr.DataType === 'Binary') {
        if (attr.BinaryValue === undefined) {
          throw new Error(
            `Missing BinaryValue for attribute "${key}" with DataType "Binary"`
          );
        }
      }

      const messageAttr: MessageAttributeValue = {
        DataType: attr.DataType
      };

      if (attr.StringValue !== undefined) {
        messageAttr.StringValue = String(attr.StringValue);
      }
      if (attr.BinaryValue !== undefined) {
        // Convert base64 string to Uint8Array
        const buffer = Buffer.from(attr.BinaryValue, 'base64');
        messageAttr.BinaryValue = new Uint8Array(buffer);
      }

      attributes[key] = messageAttr;
    }

    return attributes;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse message attributes: ${errorMessage}`);
  }
}

/**
 * Validate FIFO topic requirements
 */
export function validateFifoTopic(topicArn: string, messageGroupId?: string): void {
  const isFifo = topicArn.endsWith('.fifo');

  if (isFifo && !messageGroupId) {
    throw new Error(
      'message-group-id is required for FIFO topics (topic ARN ends with .fifo)'
    );
  }

  if (!isFifo && messageGroupId) {
    core.warning(
      'message-group-id is provided but topic ARN does not end with .fifo. ' +
      'This parameter will be ignored for standard topics.'
    );
  }
}

/**
 * Validate topic ARN format
 */
export function validateTopicArn(topicArn: string): void {
  const arnPattern = /^arn:aws:sns:[a-z0-9-]+:\d+:.+$/;

  if (!arnPattern.test(topicArn)) {
    throw new Error(
      `Invalid topic ARN format: "${topicArn}". ` +
      'Expected format: arn:aws:sns:{region}:{account-id}:{topic-name}'
    );
  }
}

/**
 * Validate message size (max 256 KB)
 */
export function validateMessage(message: string): void {
  const sizeInBytes = Buffer.byteLength(message, 'utf8');
  const maxSizeBytes = 256 * 1024; // 256 KB

  if (sizeInBytes > maxSizeBytes) {
    throw new Error(
      `Message size (${sizeInBytes} bytes) exceeds maximum allowed size (${maxSizeBytes} bytes / 256 KB)`
    );
  }
}

/**
 * Validate message structure
 */
export function validateMessageStructure(messageStructure?: string): void {
  if (messageStructure !== undefined && messageStructure !== 'json') {
    throw new Error(
      `Invalid message-structure: "${messageStructure}". Must be "json" or left empty.`
    );
  }
}

/**
 * Publish a message to an SNS topic
 */
export async function publishMessage(
  client: SNSClient,
  config: MessageConfig
): Promise<MessageResult> {
  try {
    // Validate inputs
    validateTopicArn(config.topicArn);
    validateMessage(config.message);
    validateMessageStructure(config.messageStructure);
    validateFifoTopic(config.topicArn, config.messageGroupId);

    core.info(`Publishing message to topic: ${config.topicArn}`);
    core.info(`Message size: ${Buffer.byteLength(config.message, 'utf8')} bytes`);

    // Build command input
    const input: PublishCommandInput = {
      TopicArn: config.topicArn,
      Message: config.message
    };

    // Add optional parameters
    if (config.subject) {
      input.Subject = config.subject;
      core.info(`Subject: ${config.subject}`);
    }

    if (config.messageAttributes) {
      input.MessageAttributes = parseMessageAttributes(config.messageAttributes);
      core.info(`Message attributes: ${Object.keys(input.MessageAttributes).length} attribute(s)`);
    }

    if (config.messageStructure) {
      input.MessageStructure = config.messageStructure;
      core.info(`Message structure: ${config.messageStructure}`);
    }

    // FIFO topic parameters
    if (config.messageGroupId) {
      input.MessageGroupId = config.messageGroupId;
      core.info(`Message group ID: ${config.messageGroupId}`);
    }

    if (config.messageDeduplicationId) {
      input.MessageDeduplicationId = config.messageDeduplicationId;
      core.info(`Message deduplication ID: ${config.messageDeduplicationId}`);
    }

    // Publish message
    const command = new PublishCommand(input);
    const response = await client.send(command);

    core.info('✓ Message published successfully');
    if (response.MessageId) {
      core.info(`Message ID: ${response.MessageId}`);
    }
    if (response.SequenceNumber) {
      core.info(`Sequence number: ${response.SequenceNumber}`);
    }

    return {
      success: true,
      messageId: response.MessageId,
      sequenceNumber: response.SequenceNumber
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.error(`Failed to publish message: ${errorMessage}`);
    return {
      success: false,
      error: errorMessage
    };
  }
}
