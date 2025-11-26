import * as core from '@actions/core';
import { SNSClient } from '@aws-sdk/client-sns';
import {
  publishMessage,
  MessageConfig
} from './sns';

async function run(): Promise<void> {
  try {
    // Get inputs
    const topicArn = core.getInput('topic-arn', { required: true });
    const message = core.getInput('message', { required: true });
    const subject = core.getInput('subject') || undefined;
    const messageAttributes = core.getInput('message-attributes') || undefined;
    const messageGroupId = core.getInput('message-group-id') || undefined;
    const messageDeduplicationId = core.getInput('message-deduplication-id') || undefined;
    const messageStructure = core.getInput('message-structure') || undefined;

    core.info('AWS SNS Send Message');
    core.info(`Topic ARN: ${topicArn}`);

    // Create SNS client (uses AWS credentials from environment)
    const client = new SNSClient({});

    // Build configuration
    const config: MessageConfig = {
      topicArn,
      message,
      subject,
      messageAttributes,
      messageGroupId,
      messageDeduplicationId,
      messageStructure
    };

    // Publish message
    const result = await publishMessage(client, config);

    // Handle result
    if (!result.success) {
      throw new Error(result.error || 'Failed to publish message');
    }

    // Set outputs
    if (result.messageId) {
      core.setOutput('message-id', result.messageId);
    }

    if (result.sequenceNumber) {
      core.setOutput('sequence-number', result.sequenceNumber);
    }

    // Summary
    core.info('');
    core.info('='.repeat(50));
    core.info('Message published successfully');
    if (result.messageId) {
      core.info(`Message ID: ${result.messageId}`);
    }
    if (result.sequenceNumber) {
      core.info(`Sequence Number: ${result.sequenceNumber}`);
    }
    core.info('='.repeat(50));

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.setFailed(errorMessage);
  }
}

run();
