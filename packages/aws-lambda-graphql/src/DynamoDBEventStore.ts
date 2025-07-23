import assert from 'assert';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulid';
import { IEventStore, ISubscriptionEvent } from './types';
import { computeTTL } from './helpers';

export interface IDynamoDBSubscriptionEvent extends ISubscriptionEvent {
  /**
   * TTL in UNIX seconds
   */
  ttl?: number;
}

const DEFAULT_TTL = 7200;

interface DynamoDBEventStoreOptions {
  /**
   * Use this to override default document client (for example if you want to use local dynamodb)
   *
   * Provide either a DynamoDBDocumentClient or DynamoDBClient (which will be wrapped)
   */
  dynamoDbClient?: DynamoDBDocumentClient | DynamoDBClient;
  /**
   * Events table name (default is Events)
   */
  eventsTable?: string;
  /**
   * Optional TTL for events (stored in ttl field) in seconds
   *
   * Default value is 2 hours
   *
   * Set to false to turn off TTL
   */
  ttl?: number | false;
}

/**
 * DynamoDB event store
 *
 * This event store stores published events in DynamoDB table
 *
 * The server needs to expose DynamoDBEventProcessor handler in order to process these events
 */
export class DynamoDBEventStore implements IEventStore {
  private db: DynamoDBDocumentClient;

  private tableName: string;

  private ttl: number | false;

  constructor({
    dynamoDbClient,
    eventsTable = 'Events',
    ttl = DEFAULT_TTL,
  }: DynamoDBEventStoreOptions = {}) {
    assert.ok(
      ttl === false || (typeof ttl === 'number' && ttl > 0),
      'Please provide ttl as a number greater than 0 or false to turn it off',
    );
    assert.ok(
      dynamoDbClient == null || typeof dynamoDbClient === 'object',
      'Please provide dynamoDbClient as an instance of DynamoDBDocumentClient or DynamoDBClient',
    );
    assert.ok(
      typeof eventsTable === 'string',
      'Please provide eventsTable as a string',
    );

    // Handle both DynamoDBDocumentClient and DynamoDBClient
    if (dynamoDbClient) {
      this.db =
        dynamoDbClient instanceof DynamoDBDocumentClient
          ? dynamoDbClient
          : DynamoDBDocumentClient.from(dynamoDbClient, {
              marshallOptions: {
                convertClassInstanceToMap: true,
              },
            });
    } else {
      this.db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
        marshallOptions: {
          convertClassInstanceToMap: true,
        },
      });
    }

    this.tableName = eventsTable;
    this.ttl = ttl;
  }

  publish = async (event: ISubscriptionEvent): Promise<void> => {
    await this.db.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          id: ulid(),
          ...event,
          ...(this.ttl === false || this.ttl == null
            ? {}
            : { ttl: computeTTL(this.ttl) }),
        },
      }),
    );
  };
}
