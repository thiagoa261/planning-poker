import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { eVoteState, IRoom, RoomStore } from "src/types/room.types";

@Injectable()
export class RoomService {
	constructor(@Inject(RoomStore) private readonly store: RoomStore) { }

	async getRoom(code: string) {
		return this.store.get(code);
	}

	async createRoom(displayName: string): Promise<{ room: IRoom; userId: string }> {
		const userId = randomUUID();

		const room: IRoom = {
			code: Math.random().toString(36).substring(2, 8).toUpperCase(),
			ownerId: userId,
			options: [1, 2, 3, 5, 8, 13, 21, 34, 55, 89],
			voteState: eVoteState.IDLE,
			participants: {
				[userId]: {
					id: userId,
					displayName,
					socketId: "",
					isAdmin: true,
					isSpectator: false,
					vote: null,
				},
			},
			createdAt: new Date().toISOString(),
		};

		await this.store.create(room);

		return { room, userId };
	}

	async joinRoom(code: string, displayName: string): Promise<{ room: IRoom; userId: string }> {
		const room = await this.store.get(code);

		if (!room) {
			throw new Error("Room not found");
		}

		const userId = randomUUID();

		room.participants[userId] = {
			id: userId,
			displayName,
			socketId: "",
			isAdmin: false,
			isSpectator: false,
			vote: null,
		};

		await this.store.update(room);

		return { room, userId };
	}

	async removeParticipant(code: string, socketId: string) {
		const room = await this.store.get(code);
		if (!room) return null;

		const participantEntry = Object.entries(room.participants).find(([_, p]) => p.socketId === socketId);

		if (!participantEntry) return null;

		const [userId] = participantEntry;

		const wasAdmin = room.participants[userId].isAdmin;

		delete room.participants[userId];

		if (wasAdmin) {
			const admins = Object.values(room.participants).filter((p) => p.isAdmin);

			if (!admins.length && Object.values(room.participants).length) {
				// promove primeiro participante
				const first = Object.values(room.participants)[0];
				first.isAdmin = true;
			}
		}

		await this.store.update(room);

		return room;
	}

	async attachSocket(code: string, userId: string, socketId: string) {
		const room = await this.store.get(code);
		if (!room) throw new Error("Room not found");

		const participant = room.participants[userId];
		if (!participant) throw new Error("User not found");

		participant.socketId = socketId;

		await this.store.update(room);
	}

	async startVoting(code: string, requesterId: string) {
		const room = await this.store.get(code);
		if (!room) throw new Error("Room not found");

		const requester = room.participants[requesterId];
		if (!requester?.isAdmin) throw new Error("Not authorized");

		room.voteState = eVoteState.VOTING;

		Object.values(room.participants).forEach((p) => {
			p.vote = null;
		});

		await this.store.update(room);
	}

	async castVote(code: string, userId: string, value: number | "abstain") {
		const room = await this.store.get(code);
		if (!room) throw new Error("Room not found");

		if (room.voteState !== eVoteState.VOTING) {
			throw new Error("Voting not active");
		}

		const participant = room.participants[userId];
		if (!participant) throw new Error("User not found");

		if (participant.isSpectator) {
			throw new Error("Spectator cannot vote");
		}

		participant.vote = value;

		await this.store.update(room);
	}

	async revealVoting(code: string, requesterId: string) {
		const room = await this.store.get(code);
		if (!room) throw new Error("Room not found");

		const requester = room.participants[requesterId];
		if (!requester?.isAdmin) throw new Error("Not authorized");

		room.voteState = eVoteState.REVEALED;

		const stats = this.calculateStats(room);

		await this.store.update(room);

		return stats;
	}

	async endVoting(code: string, requesterId: string) {
		const room = await this.store.get(code);
		if (!room) throw new Error("Room not found");

		const requester = room.participants[requesterId];
		if (!requester?.isAdmin) throw new Error("Not authorized");

		room.voteState = eVoteState.IDLE;

		await this.store.update(room);
	}

	async setSpectator(code: string, userId: string, spectator: boolean) {
		const room = await this.store.get(code);
		if (!room) throw new Error("Room not found");

		const participant = room.participants[userId];
		if (!participant) throw new Error("User not found");

		participant.isSpectator = spectator;

		await this.store.update(room);
	}

	private calculateStats(room: IRoom) {
		const votes = Object.values(room.participants)
			.filter((p) => typeof p.vote === "number")
			.map((p) => p.vote as number);

		if (!votes.length) return null;

		const avg = votes.reduce((a, b) => a + b, 0) / votes.length;

		const sorted = [...votes].sort((a, b) => a - b);
		const mid = Math.floor(sorted.length / 2);

		const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

		const frequency: Record<number, number> = {};

		votes.forEach((v) => {
			frequency[v] = (frequency[v] || 0) + 1;
		});

		const mode = Number(Object.entries(frequency).sort((a, b) => b[1] - a[1])[0][0]);

		return { avg, median, mode };
	}
	
	async grantAdmin(code: string, requesterId: string, targetUserId: string) {
		const room = await this.store.get(code);
		if (!room) throw new Error("Room not found");

		const requester = room.participants[requesterId];
		if (!requester?.isAdmin) throw new Error("Not authorized");

		const targetUser = room.participants[targetUserId];
		if (!targetUser) throw new Error("Target user not found");

		requester.isAdmin = false;
		targetUser.isAdmin = true;

		await this.store.update(room);
	}
}
