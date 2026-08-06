export type StudentSosIncidentType =
  | "robbery"
  | "burglary"
  | "being_followed"
  | "assault_or_threat"
  | "medical_emergency"
  | "unsafe_transport"
  | "other_danger";

export interface StudentSosLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  capturedAt: string;
  address: string;
}

export interface StudentSosSubmission {
  incidentType: StudentSosIncidentType;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  capturedAt: string;
  address?: string;
  clientRequestId: string;
}

export interface StudentSosPushSummary {
  requested: number;
  accepted: number;
  failed: number;
  message?: string;
}

export interface StudentSosResult {
  alertId: string;
  duplicate: boolean;
  incidentType: StudentSosIncidentType;
  incidentLabel: string;
  organizationId: string;
  organizationName: string;
  recipientUserId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  address?: string;
  mapUrl: string;
  reportedAt: string;
  notificationCreated: boolean;
  push: StudentSosPushSummary;
}