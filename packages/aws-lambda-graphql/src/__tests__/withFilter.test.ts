import { createAsyncIterator } from 'iterall';
import { withFilter } from '../withFilter';
import { IContext } from '../types';

describe('withFilter', () => {
  const mockContext: IContext = {
    event: {} as any,
    lambdaContext: {} as any,
    $$internal: {
      connectionManager: {} as any,
      subscriptionManager: {} as any,
    },
  };

  it('filters async iterator based on function result', async () => {
    const events = [{ type: 'A' }, { type: 'B' }, { type: 'A' }];

    const iterator = await withFilter(
      async () => createAsyncIterator(events) as any,
      (payload) => payload.type === 'A',
    )({}, {}, mockContext, undefined);

    await expect(iterator.next()).resolves.toEqual({
      done: false,
      value: { type: 'A' },
    });
    await expect(iterator.next()).resolves.toEqual({
      done: false,
      value: { type: 'A' },
    });
    await expect(iterator.next()).resolves.toEqual({
      done: true,
      value: undefined,
    });
  });

  it('filters async iterator based on async function result', async () => {
    const events = [{ type: 'A' }, { type: 'B' }, { type: 'A' }];

    const iterator = await withFilter(
      async () => createAsyncIterator(events) as any,
      async (payload) => payload.type === 'A',
    )({}, {}, mockContext, undefined);

    await expect(iterator.next()).resolves.toEqual({
      done: false,
      value: { type: 'A' },
    });
    await expect(iterator.next()).resolves.toEqual({
      done: false,
      value: { type: 'A' },
    });
    await expect(iterator.next()).resolves.toEqual({
      done: true,
      value: undefined,
    });
  });
});
