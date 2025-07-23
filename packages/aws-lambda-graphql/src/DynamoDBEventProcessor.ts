import { DynamoDBStreamHandler } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { isAsyncIterable, getAsyncIterator } from 'iterall';
import { ExecutionResult } from 'graphql';
import { ArrayPubSub } from './ArrayPubSub';
import { IEventProcessor } from './types';
import { formatMessage } from './formatMessage';
import { execute } from './execute';
import { SERVER_EVENT_TYPES } from './protocol';
import { Server } from './Server';
import { IDynamoDBSubscriptionEvent } from './DynamoDBEventStore';
import { isTTLExpired } from './helpers/isTTLExpired';

interface DynamoDBEventProcessorOptions {
  onError?: (err: any) => void;
  /**
   * Enable log
   */
  debug?: boolean;

  /**
   * Allow injecting a logging function
   */
  log?: (message: any, ...optionalParams: any[]) => void;
}

/**
 * DynamoDBEventProcessor
 *
 * Processes DynamoDB stream event in order to send events to subscribed clients
 */
export class DynamoDBEventProcessor<TServer extends Server = Server>
  implements IEventProcessor<TServer, DynamoDBStreamHandler> {
  private onError: (err: any) => void;

  private debug: boolean;

  private log: (message: any, ...optionalParams: any[]) => void;

  constructor(options: DynamoDBEventProcessorOptions = {}) {
    this.log = options.log || console.log;
    this.onError = options.onError || ((err: any) => this.log(err));
    this.debug = options.debug || false;
  }

  public createHandler(server: TServer): DynamoDBStreamHandler {
    return async (lambdaEvent, lambdaContext) => {
      const connectionManager = server.getConnectionManager();
      const subscriptionManager = server.getSubscriptionManager();
      const { Records } = lambdaEvent;

      for (const record of Records) {
        // process only INSERT events
        if (record.eventName !== 'INSERT') {
          continue;
        }

        // now construct event from dynamodb image
        const event: IDynamoDBSubscriptionEvent = unmarshall(
          record.dynamodb!.NewImage as any,
        ) as any;

        // skip if event is expired
        if (isTTLExpired(event.ttl)) {
          if (this.debug) this.log('Discarded event : TTL expired', event);
          continue;
        }

        this.log('Processing event', event);

        // iterate over subscribers that listen to this event
        // and for each connection:
        //  - create a schema (so we have subscribers registered in PubSub)
        //  - execute operation from event againt schema
        //  - if iterator returns a result, send it to client
        //  - clean up subscriptions and follow with next page of subscriptions
        //  - if they are no more subscriptions, process next event
        // make sure that you won't throw any errors otherwise dynamo will call
        // handler with same events again
        for await (const subscribers of subscriptionManager.subscribersByEvent(
          event,
        )) {
          const promises = subscribers
            .map(async (subscriber) => {
              // create PubSub for this subscriber
              const pubSub = new ArrayPubSub([event]);

              const options = await server.createGraphQLServerOptions(
                lambdaEvent as any,
                lambdaContext,
                {
                  // this allows createGraphQLServerOptions() to append more extra data
                  // to context from connection.data.context
                  connection: subscriber.connection,
                  operation: subscriber.operation,
                  pubSub,
                },
              );

              // execute operation by executing it and then publishing the event
              const iterable = await execute({
                connectionManager,
                subscriptionManager,
                schema: options.schema,
                event: lambdaEvent as any, // we don't have an API GW event here
                lambdaContext,
                context: options.context,
                connection: subscriber.connection,
                operation: subscriber.operation,
                pubSub,
                registerSubscriptions: false,
              });

              if (!isAsyncIterable(iterable)) {
                // something went wrong, probably there is an error
                this.log('Execution result: non iterable', event);
                return Promise.resolve();
              }

              const iterator = getAsyncIterator(iterable);
              const result: IteratorResult<ExecutionResult> = await iterator.next();

              if (result.value != null) {
                if (this.debug) this.log('Send event ', result);
                return connectionManager.sendToConnection(
                  subscriber.connection,
                  formatMessage({
                    id: subscriber.operationId,
                    payload: result.value,
                    type: SERVER_EVENT_TYPES.GQL_DATA,
                  }),
                );
              }

              return Promise.resolve();
            })
            .map((promise) => promise.catch(this.onError));

          await Promise.all(promises);
        }
      }
    };
  }
}
