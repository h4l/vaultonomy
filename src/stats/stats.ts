import { EventQueue, EventSender, PayloadBuilder } from "./ga4mp";
import { AnyEvent, AnyPayload } from "./payload_schemas";

function createEventSender(): EventSender<typeof AnyEvent> | undefined {
  const stats = VAULTONOMY.stats;
  if (!stats) return undefined;

  return new EventSender<typeof AnyEvent>(events, {
    api_secret: stats.api_secret,
    measurement_id: stats.measurement_id,
    endpoint: stats.endpoint,
    payloadBuilder: new DefaultPayloadBuilder(stats.client_id),
  });
}

class DefaultPayloadBuilder implements PayloadBuilder<AnyEvent> {
  constructor(readonly client_id: string) {}

  buildPayload(events: AnyEvent[]): AnyPayload {
    return {
      client_id: this.client_id,
      timestamp_micros: Math.round(Date.now() * 1000),
      events,
      user_properties: {
        build_version: { value: VAULTONOMY.version },
        build_target: {
          value: `${VAULTONOMY.releaseTarget}-${VAULTONOMY.browserTarget}`,
        },
      },
    };
  }
}

export const events = new EventQueue(AnyEvent, { maxBufferSize: 1024 });
export const sender = createEventSender();
