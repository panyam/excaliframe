// Re-export proto-generated types as the canonical type definitions.
// The generated types use protobuf-es conventions (camelCase, bigint for int64, oneof unions).
export type {
  CollabAction,
  JoinRoom,
  LeaveRoom,
  PresenceUpdate,
  CollabEvent,
  RoomJoined,
  PeerInfo,
  PeerJoined,
  PeerLeft,
  ErrorEvent,
  SessionEnded,
  OwnerChanged,
  SceneUpdate,
  ElementUpdate,
  CursorUpdate,
  TextUpdate,
  SceneInitRequest,
  SceneInitResponse,
  GetRoomRequest,
  GetRoomResponse,
  TitleChanged,
  ListRoomsRequest,
  ListRoomsResponse,
  RoomSummary,
} from '@panyam/massrelay/models';

// Re-export schemas for creating proto message instances
export {
  CollabActionSchema,
  JoinRoomSchema,
  LeaveRoomSchema,
  PresenceUpdateSchema,
  CollabEventSchema,
  RoomJoinedSchema,
  PeerInfoSchema,
  PeerJoinedSchema,
  PeerLeftSchema,
  ErrorEventSchema,
  SceneUpdateSchema,
  ElementUpdateSchema,
  CursorUpdateSchema,
  TextUpdateSchema,
  SceneInitRequestSchema,
  SceneInitResponseSchema,
} from '@panyam/massrelay/models';

// App-level config types (not proto messages)

export interface RelayServerOption {
  label: string;
  url: string;   // "/relay" (relative) or "wss://excaliframe.com/relay"
}

export const DEFAULT_RELAY_SERVERS: RelayServerOption[] = [
  { label: 'This server', url: '/relay' },
  { label: 'excaliframe.com', url: 'wss://excaliframe.com/relay' },
];

export interface CollabConfig {
  drawingId: string;              // local drawing identifier
  initialRelayUrl?: string;       // from ?connect= param — auto-opens dialog
  relayServers?: RelayServerOption[];
  autoJoin?: boolean;             // auto-connect as follower (same-origin or join link)
  autoJoinRelayUrl?: string;      // which relay to auto-join on
  autoJoinSessionId?: string;     // relay sessionId to join (from localStorage or join link)
}
