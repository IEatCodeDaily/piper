export interface PersonRef {
  id: string;
  externalId: string;
  displayName: string;
  email: string;
  jobTitle?: string;
  department?: string;
  avatarUrl?: string;
  presence?: "online" | "busy" | "away" | "offline";
}
