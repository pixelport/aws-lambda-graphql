import assert from 'assert';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  BatchWriteCommand,
  TransactWriteCommand,
  GetCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import type {
  QueryCommandOutput,
  ScanCommandOutput,
  GetCommandOutput,
} from '@aws-sdk/lib-dynamodb';
import {
  IConnection,
  ISubscriber,
  ISubscriptionManager,
  IdentifiedOperationRequest,
  ISubscriptionEvent,
} from './types';
import { computeTTL } from './helpers';

const DEFAULT_TTL = 7200;

// polyfill Symbol.asyncIterator
if (Symbol.asyncIterator === undefined) {
  (Symbol as any).asyncIterator = Symbol.for('asyncIterator');
}

interface DynamoDBSubscriber extends ISubscriber {
  /**
   * works as range key in DynamoDb (event is partition key)
   * it is in format connectionId:operationId
   */
  subscriptionId: string;
  /**
   * TTL in UNIX seconds
   */
  ttl?: number;
}

interface DynamoDBSubscriptionManagerOptions {
  /**
   * Use this to override default document client (for example if you want to use local dynamodb)
   *
   * Provide either a DynamoDBDocumentClient or DynamoDBClient (which will be wrapped)
   */
  dynamoDbClient?: DynamoDBDocumentClient | DynamoDBClient;
  /**
   * Subscriptions table name (default is Subscriptions)
   */
  subscriptionsTableName?: string;
  /**
   * Subscriptions operations table name (default is SubscriptionOperations)
   */
  subscriptionOperationsTableName?: string;
  /**
   * Optional TTL for subscriptions (stored in ttl field) in seconds
   *
   * Default value is 2 hours
   *
   * Set to false to turn off TTL
   */
  ttl?: number | false;
  /**
   * Optional function that can get subscription name from event
   *
   * Default is (event: ISubscriptionEvent) => event.event
   *
   * Useful for multi-tenancy
   */
  getSubscriptionNameFromEvent?: (event: ISubscriptionEvent) => string;
  /**
   * Optional function that can get subscription name from subscription connection
   *
   * Default is (name: string, connection: IConnection) => name
   *
   * Useful for multi-tenancy
   */
  getSubscriptionNameFromConnection?: (
    name: string,
    connection: IConnection,
  ) => string;
}

/**
 * DynamoDBSubscriptionManager
 *
 * Stores all subsrciptions in Subscriptions and SubscriptionOperations tables (both can be overridden)
 *
 * DynamoDB table structures
 *
 * Subscriptions:
 *  event: primary key (HASH)
 *  subscriptionId: range key (RANGE) - connectionId:operationId (this is always unique per client)
 *
 * SubscriptionOperations:
 *  subscriptionId: primary key (HASH) - connectionId:operationId (this is always unique per client)
 */
export class DynamoDBSubscriptionManager implements ISubscriptionManager {
  private subscriptionsTableName: string;

  private subscriptionOperationsTableName: string;

  private db: DynamoDBDocumentClient;

  private ttl: number | false;

  private getSubscriptionNameFromEvent: (event: ISubscriptionEvent) => string;

  private getSubscriptionNameFromConnection: (
    name: string,
    connection: IConnection,
  ) => string;

  constructor({
    dynamoDbClient,
    subscriptionsTableName = 'Subscriptions',
    subscriptionOperationsTableName = 'SubscriptionOperations',
    ttl = DEFAULT_TTL,
    getSubscriptionNameFromEvent = (event) => event.event,
    getSubscriptionNameFromConnection = (name) => name,
  }: DynamoDBSubscriptionManagerOptions = {}) {
    assert.ok(
      typeof subscriptionOperationsTableName === 'string',
      'Please provide subscriptionOperationsTableName as a string',
    );
    assert.ok(
      typeof subscriptionsTableName === 'string',
      'Please provide subscriptionsTableName as a string',
    );
    assert.ok(
      ttl === false || (typeof ttl === 'number' && ttl > 0),
      'Please provide ttl as a number greater than 0 or false to turn it off',
    );
    assert.ok(
      dynamoDbClient == null || typeof dynamoDbClient === 'object',
      'Please provide dynamoDbClient as an instance of DynamoDBDocumentClient or DynamoDBClient',
    );

    this.subscriptionsTableName = subscriptionsTableName;
    this.subscriptionOperationsTableName = subscriptionOperationsTableName;

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

    this.ttl = ttl;
    this.getSubscriptionNameFromEvent = getSubscriptionNameFromEvent;
    this.getSubscriptionNameFromConnection = getSubscriptionNameFromConnection;
  }

  subscribersByEvent = (
    event: ISubscriptionEvent,
  ): AsyncIterable<ISubscriber[]> & AsyncIterator<ISubscriber[]> => {
    let ExclusiveStartKey: Record<string, any> | undefined;
    let done = false;

    const name = this.getSubscriptionNameFromEvent(event);

    return {
      next: async () => {
        if (done) {
          return { value: [], done: true };
        }

        const time = Math.round(Date.now() / 1000);
        const result: QueryCommandOutput = await this.db.send(
          new QueryCommand({
            ExclusiveStartKey,
            TableName: this.subscriptionsTableName,
            Limit: 50,
            KeyConditionExpression: 'event = :event',
            FilterExpression: '#ttl > :time OR attribute_not_exists(#ttl)',
            ExpressionAttributeValues: {
              ':event': name,
              ':time': time,
            },
            ExpressionAttributeNames: {
              '#ttl': 'ttl',
            },
          }),
        );

        ExclusiveStartKey = result.LastEvaluatedKey;

        if (ExclusiveStartKey == null) {
          done = true;
        }

        // we store connectionData on subscription too so we don't
        // need to load data from connections table
        const value = (result.Items || []) as DynamoDBSubscriber[];

        return { value, done: done && value.length === 0 };
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };
  };

  subscribe = async (
    names: string[],
    connection: IConnection,
    operation: IdentifiedOperationRequest,
  ): Promise<void> => {
    const subscriptionId = this.generateSubscriptionId(
      connection.id,
      operation.operationId,
    );

    // we can only subscribe to one subscription in GQL document
    if (names.length !== 1) {
      throw new Error('Only one active operation per event name is allowed');
    }
    let [name] = names;
    name = this.getSubscriptionNameFromConnection(name, connection);

    const ttlField =
      this.ttl === false || this.ttl == null
        ? {}
        : { ttl: computeTTL(this.ttl) };

    await this.db.send(
      new BatchWriteCommand({
        RequestItems: {
          [this.subscriptionsTableName]: [
            {
              PutRequest: {
                Item: {
                  connection,
                  operation,
                  event: name,
                  subscriptionId,
                  operationId: operation.operationId,
                  ...ttlField,
                } as DynamoDBSubscriber,
              },
            },
          ],
          [this.subscriptionOperationsTableName]: [
            {
              PutRequest: {
                Item: {
                  subscriptionId,
                  event: name,
                  ...ttlField,
                },
              },
            },
          ],
        },
      }),
    );
  };

  unsubscribe = async (subscriber: ISubscriber) => {
    const subscriptionId = this.generateSubscriptionId(
      subscriber.connection.id,
      subscriber.operationId,
    );

    await this.db.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Delete: {
              TableName: this.subscriptionsTableName,
              Key: {
                event: subscriber.event,
                subscriptionId,
              },
            },
          },
          {
            Delete: {
              TableName: this.subscriptionOperationsTableName,
              Key: {
                subscriptionId,
              },
            },
          },
        ],
      }),
    );
  };

  unsubscribeOperation = async (connectionId: string, operationId: string) => {
    const operation: GetCommandOutput = await this.db.send(
      new GetCommand({
        TableName: this.subscriptionOperationsTableName,
        Key: {
          subscriptionId: this.generateSubscriptionId(
            connectionId,
            operationId,
          ),
        },
      }),
    );

    if (operation.Item) {
      await this.db.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Delete: {
                TableName: this.subscriptionsTableName,
                Key: {
                  event: operation.Item.event,
                  subscriptionId: operation.Item.subscriptionId,
                },
              },
            },
            {
              Delete: {
                TableName: this.subscriptionOperationsTableName,
                Key: {
                  subscriptionId: operation.Item.subscriptionId,
                },
              },
            },
          ],
        }),
      );
    }
  };

  unsubscribeAllByConnectionId = async (connectionId: string) => {
    let cursor: Record<string, any> | undefined;

    do {
      const result: ScanCommandOutput = await this.db.send(
        new ScanCommand({
          TableName: this.subscriptionsTableName,
          ExclusiveStartKey: cursor,
          FilterExpression: 'begins_with(subscriptionId, :connection_id)',
          ExpressionAttributeValues: {
            ':connection_id': connectionId,
          },
          Limit: 12, // Maximum of 25 request items sent to DynamoDB a time
        }),
      );

      const { Items, LastEvaluatedKey } = result;

      if (Items == null || (LastEvaluatedKey == null && Items.length === 0)) {
        return;
      }

      if (Items.length > 0) {
        await this.db.send(
          new BatchWriteCommand({
            RequestItems: {
              [this.subscriptionsTableName]: Items.map((item) => ({
                DeleteRequest: {
                  Key: {
                    event: item.event,
                    subscriptionId: item.subscriptionId,
                  },
                },
              })),
              [this.subscriptionOperationsTableName]: Items.map((item) => ({
                DeleteRequest: {
                  Key: { subscriptionId: item.subscriptionId },
                },
              })),
            },
          }),
        );
      }

      cursor = LastEvaluatedKey;
    } while (cursor);
  };

  generateSubscriptionId = (
    connectionId: string,
    operationId: string,
  ): string => {
    return `${connectionId}:${operationId}`;
  };
}
