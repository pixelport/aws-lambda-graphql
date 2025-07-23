// Mock implementations for AWS SDK v3
// Simple mock for util-dynamodb - don't use proxy to avoid circular references
export const unmarshall = jest.fn((data) => data);
export const marshall = jest.fn((data) => data);

// ApiGatewayManagementApi mocks
export const postToConnectionMock = jest.fn();
export const deleteConnectionMock = jest.fn();

export class ApiGatewayManagementApiClient {
  send = jest.fn((command) => {
    if (command.constructor.name === 'PostToConnectionCommand') {
      return postToConnectionMock(command.input);
    }
    if (command.constructor.name === 'DeleteConnectionCommand') {
      return deleteConnectionMock(command.input);
    }
    throw new Error(`Unknown command: ${command.constructor.name}`);
  });
}

// Command classes - mocked to prevent imports
export class PostToConnectionCommand {
  input: any;

  constructor(input: any) {
    this.input = input;
  }
}

export class DeleteConnectionCommand {
  input: any;

  constructor(input: any) {
    this.input = input;
  }
}

// DynamoDB Document Client mocks
export const batchWriteMock = jest.fn();
export const deleteMock = jest.fn();
export const getMock = jest.fn();
export const putMock = jest.fn();
export const queryMock = jest.fn();
export const scanMock = jest.fn();
export const updateMock = jest.fn();
export const transactWriteMock = jest.fn();

export class DynamoDBDocumentClient {
  static from = jest.fn(() => new DynamoDBDocumentClient());

  send = jest.fn((command) => {
    switch (command.constructor.name) {
      case 'PutCommand':
        return putMock(command.input);
      case 'GetCommand':
        return getMock(command.input);
      case 'DeleteCommand':
        return deleteMock(command.input);
      case 'UpdateCommand':
        return updateMock(command.input);
      case 'QueryCommand':
        return queryMock(command.input);
      case 'ScanCommand':
        return scanMock(command.input);
      case 'BatchWriteCommand':
        return batchWriteMock(command.input);
      case 'TransactWriteCommand':
        return transactWriteMock(command.input);
      default:
        throw new Error(`Unknown command: ${command.constructor.name}`);
    }
  });
}

// DynamoDB Client mock (for wrapping)
export class DynamoDBClient {
  // Empty client - will be wrapped by DynamoDBDocumentClient
}

// Command classes for DynamoDB
export class PutCommand {
  input: any;

  constructor(input: any) {
    this.input = input;
  }
}

export class GetCommand {
  input: any;

  constructor(input: any) {
    this.input = input;
  }
}

export class DeleteCommand {
  input: any;

  constructor(input: any) {
    this.input = input;
  }
}

export class UpdateCommand {
  input: any;

  constructor(input: any) {
    this.input = input;
  }
}

export class QueryCommand {
  input: any;

  constructor(input: any) {
    this.input = input;
  }
}

export class ScanCommand {
  input: any;

  constructor(input: any) {
    this.input = input;
  }
}

export class BatchWriteCommand {
  input: any;

  constructor(input: any) {
    this.input = input;
  }
}

export class TransactWriteCommand {
  input: any;

  constructor(input: any) {
    this.input = input;
  }
}

// For backwards compatibility, export legacy promise mock names
export const putPromiseMock = putMock;
export const getPromiseMock = getMock;
export const deletePromiseMock = deleteMock;
export const batchWritePromiseMock = batchWriteMock;
export const updatePromiseMock = updateMock;
export const queryPromiseMock = queryMock;
export const transactWritePromiseMock = transactWriteMock;
export const postToConnectionPromiseMock = postToConnectionMock;
export const deleteConnectionPromiseMock = deleteConnectionMock;

// Reset all mocks function for convenience
export const resetAllMocks = () => {
  [
    postToConnectionMock,
    deleteConnectionMock,
    batchWriteMock,
    deleteMock,
    getMock,
    putMock,
    queryMock,
    scanMock,
    updateMock,
    transactWriteMock,
  ].forEach((mock) => {
    mock.mockReset();
    mock.mockClear();
  });
};

// Default exports for different packages
export default {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
  DeleteConnectionCommand,
  DynamoDBDocumentClient,
  DynamoDBClient,
  PutCommand,
  GetCommand,
  DeleteCommand,
  UpdateCommand,
  QueryCommand,
  ScanCommand,
  BatchWriteCommand,
  TransactWriteCommand,
  unmarshall,
  marshall,
};
