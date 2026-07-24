export interface SOSPayload {
  tripId: string;
  lat: number;
  lng: number;
  triggerType: string;
  identitySnapshot: any;
  client_event_id: string;
  location_name?: string | null;
  recording_duration?: number | null;
  recording_size?: number | null;
  recording_mime_type?: string | null;
  audioClipUrl?: string | null;
}

function generateUUID(): string {
  // Simple UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

class SOSPayloadBuilder {
  private payload: Partial<SOSPayload>;

  constructor() {
    this.payload = {
      client_event_id: generateUUID(),
    };
  }

  public setTripInfo(tripId: string) {
    this.payload.tripId = tripId;
    return this;
  }

  public setTriggerType(triggerType: string) {
    this.payload.triggerType = triggerType;
    return this;
  }

  public setLocation(lat: number, lng: number, locationName?: string | null) {
    this.payload.lat = lat;
    this.payload.lng = lng;
    if (locationName !== undefined) {
      this.payload.location_name = locationName;
    }
    return this;
  }

  public setIdentity(identitySnapshot: any) {
    this.payload.identitySnapshot = identitySnapshot;
    return this;
  }

  public setAudioMetadata(duration?: number | null, size?: number | null, mimeType?: string | null) {
    if (duration !== undefined) this.payload.recording_duration = duration;
    if (size !== undefined) this.payload.recording_size = size;
    if (mimeType !== undefined) this.payload.recording_mime_type = mimeType;
    return this;
  }

  public setAudioUrl(url?: string | null) {
    if (url !== undefined) this.payload.audioClipUrl = url;
    return this;
  }

  public build(): SOSPayload {
    if (!this.payload.tripId || this.payload.lat == null || this.payload.lng == null || !this.payload.triggerType) {
      throw new Error('[SOSPayloadBuilder] Missing required fields');
    }
    return this.payload as SOSPayload;
  }
}

export default SOSPayloadBuilder;
