import { APIGatewayWebSocketEvent } from '../types';

export function extractEndpointFromEvent(
  event: APIGatewayWebSocketEvent,
): string {
  const endpoint = `https://${event.requestContext.domainName}/${event.requestContext.stage}`;
  console.log('[DEBUG] extractEndpointFromEvent:', {
    domainName: event.requestContext.domainName,
    stage: event.requestContext.stage,
    extractedEndpoint: endpoint,
  });
  return endpoint;
}
