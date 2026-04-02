export enum eEvent {
    ROOM_STATE = "room:state",
    ROOM_CREATE = "room:create",
    ROOM_CREATED = "room:created",
    ROOM_JOIN = "room:join",
    ROOM_JOINED = "room:joined",
    ROOM_RECONNECT = "room:reconnect",
    ROOM_ERROR = "room:error",

    VOTE_START = "vote:start",
    VOTE_CAST = "vote:cast",
    VOTE_UPDATED = "vote:updated",
    VOTE_REVEAL = "vote:reveal",
    VOTE_REVEALED = "vote:revealed",
    VOTE_END = "vote:end",

    USER_SET_SPECTATOR = "user:setSpectator",
    ADMIN_GRANT = "admin:grant",

    EMOJI_THROW = "emoji:throw",
    EMOJI_THROWN = "emoji:thrown",
}