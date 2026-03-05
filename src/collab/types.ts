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
  GetRoomRequest,
  GetRoomResponse,
  ListRoomsRequest,
  ListRoomsResponse,
  RoomSummary,
} from './gen/excaliframe/v1/models/collab_pb';

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
} from './gen/excaliframe/v1/models/collab_pb';

// App-level config type (not a proto message)
export interface CollabProps {
  relayUrl: string;
  sessionId: string;
  username: string;
}
