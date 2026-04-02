export enum eVoteState {
    IDLE = "idle",
    VOTING = "voting",
    REVEALED = "revealed",
}

export interface IParticipant {
    id: string;
    displayName: string;
    socketId: string;
    isAdmin: boolean;
    isSpectator: boolean;
    vote: number | "abstain" | "hidden" | null;
}

export interface IRoom {
    code: string;
    ownerId: string;
    options: number[];
    voteState: eVoteState;
    participants: Record<string, IParticipant>;
    createdAt: string;
}
