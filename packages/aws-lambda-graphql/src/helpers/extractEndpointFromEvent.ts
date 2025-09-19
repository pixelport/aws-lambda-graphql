import { APIGatewayWebSocketEvent } from '../types';

export function extractEndpointFromEvent(
  event: APIGatewayWebSocketEvent,
): string {
  const endpoint = `https://${event.requestContext.domainName}/${event.requestContext.stage}`;
  return endpoint;
}
