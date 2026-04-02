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

export abstract class RoomStore {
	abstract create(room: IRoom): Promise<void>;
	abstract get(code: string): Promise<IRoom | null>;
	abstract update(room: IRoom): Promise<void>;
	abstract delete(code: string): Promise<void>;
}
