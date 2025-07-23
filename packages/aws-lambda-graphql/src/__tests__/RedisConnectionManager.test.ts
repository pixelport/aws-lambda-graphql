import {
  // @ts-ignore
  postToConnectionPromiseMock,
  // @ts-ignore
  deleteConnectionPromiseMock,
} from 'aws-sdk';
import { RedisConnectionManager } from '../RedisConnectionManager';

const subscriptionManager: any = {
  unsubscribeAllByConnectionId: jest.fn(),
};

describe('RedisConnectionManager', () => {
  const redisClient = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(() => {
    // eslint-disable-next-line guard-for-in
    for (const key in redisClient) {
      (redisClient[key] as jest.Mock).mockReset();
    }
    postToConnectionPromiseMock.mockReset();
    deleteConnectionPromiseMock.mockReset();
    subscriptionManager.unsubscribeAllByConnectionId.mockReset();
  });

  describe('registerConnection', () => {
    it('registers connection by its connectionId and returns a Connection', async () => {
      const manager = new RedisConnectionManager({
        subscriptions: subscriptionManager,
        redisClient: redisClient as any,
      });

      await expect(
        manager.registerConnection({ connectionId: 'id', endpoint: '' }),
      ).resolves.toEqual({
        id: 'id',
        data: {
          endpoint: '',
          context: {},
          isInitialized: false,
        },
      });

      expect(redisClient.set as jest.Mock).toHaveBeenCalledTimes(1);
    });
  });

  describe('hydrateConnection', () => {
    const manager = new RedisConnectionManager({
      subscriptions: subscriptionManager,
      redisClient: redisClient as any,
    });

    it('throws an error if connection is not found', async () => {
      await expect(manager.hydrateConnection('id', {})).rejects.toThrowError(
        'Connection id not found',
      );
    });

    it('returns a Connection object if connection is found', async () => {
      (redisClient.get as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({ endpoint: '' }),
      );

      await expect(manager.hydrateConnection('id', {})).resolves.toEqual({
        endpoint: '',
      });
    });
  });

  describe('setConnectionData', () => {
    const manager = new RedisConnectionManager({
      subscriptions: subscriptionManager,
      redisClient: redisClient as any,
    });

    it('sets connection data to store', async () => {
      await expect(
        manager.setConnectionData(
          { context: {}, isInitialized: false },
          { id: 'id', data: { context: {}, isInitialized: false } },
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('sendToConnection', () => {
    const manager = new RedisConnectionManager({
      subscriptions: subscriptionManager,
      redisClient: redisClient as any,
    });

    it('sends a message to a connection', async () => {
      await expect(
        manager.sendToConnection(
          {
            id: 'id',
            data: { endpoint: '', context: {}, isInitialized: false },
          },
          'Message',
        ),
      ).resolves.toBeUndefined();
    });

    it('closes stale connection', async () => {
      (postToConnectionPromiseMock as jest.Mock).mockRejectedValueOnce({
        $metadata: { httpStatusCode: 410 },
      });

      await expect(
        manager.sendToConnection(
          {
            id: 'id',
            data: { endpoint: '', context: {}, isInitialized: false },
          },
          'Message',
        ),
      ).resolves.toBeUndefined();
    });

    it('throws an error if not HTTP 410', async () => {
      (postToConnectionPromiseMock as jest.Mock).mockRejectedValueOnce({
        statusCode: 500,
      });

      await expect(
        manager.sendToConnection(
          {
            id: 'id',
            data: { endpoint: '', context: {}, isInitialized: false },
          },
          'Message',
        ),
      ).rejects.toEqual({
        statusCode: 500,
      });
    });
  });

  describe('unregisterConnection', () => {
    const manager = new RedisConnectionManager({
      subscriptions: subscriptionManager,
      redisClient: redisClient as any,
    });

    it('removes connection from store and unsubscribes it from all subscriptions', async () => {
      await expect(
        manager.unregisterConnection({
          id: 'id',
          data: { context: {}, isInitialized: false },
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('closeConnection', () => {
    const manager = new RedisConnectionManager({
      subscriptions: subscriptionManager,
      redisClient: redisClient as any,
    });

    it('removes connection and closes it', async () => {
      await expect(
        manager.closeConnection({
          id: 'id',
          data: { context: {}, isInitialized: false },
        }),
      ).resolves.toBeUndefined();
    });
  });
});
