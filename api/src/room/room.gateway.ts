import {
	WebSocketGateway,
	WebSocketServer,
	SubscribeMessage,
	OnGatewayConnection,
	ConnectedSocket,
	MessageBody,
	OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { RoomService } from "./room.service";
import { SessionService } from "src/session/session.service";
import { eEvent } from "src/types/event.types";
import { eVoteState, IRoom } from "src/types/room.types";

@WebSocketGateway({
	cors: { origin: "*" },
})
export class RoomGateway implements OnGatewayConnection, OnGatewayDisconnect {
	@WebSocketServer() server: Server;

	constructor(
		private readonly roomService: RoomService,
		private readonly sessionService: SessionService,
	) {}

	async handleConnection(client: Socket) {
		const token = client.handshake.auth?.token;

		if (!token) return;

		try {
			const payload = this.sessionService.verifyToken(token);
			client.data.user = payload;
		} catch {
			client.data.user = null;
		}
	}

	async handleDisconnect(client: Socket) {
		const user = client.data.user;
		if (!user) return;

		const { roomCode } = user;

		const room = await this.roomService.removeParticipant(roomCode, client.id);

		if (room) this.emitRoomState(room);
	}

	private getAuthenticatedUser(client: Socket) {
		const user = client.data.user;

		if (!user) {
			client.emit(eEvent.ROOM_ERROR, { message: "Unauthorized" });
			return null;
		}

		return user;
	}

	private emitRoomState(room: IRoom) {
		const sockets = this.server.sockets.adapter.rooms.get(room.code);

		if (sockets) {
			for (const socketId of sockets) {
				const client = this.server.sockets.sockets.get(socketId);

				if (client) {
					const userId = client.data.user?.userId;
					client.emit(eEvent.ROOM_STATE, this.sanitizeRoom(room, userId));
				}
			}
		}
	}

	private sanitizeRoom(room: IRoom, requesterId?: string) {
		if (room.voteState !== eVoteState.VOTING) return room;

		const sanitized = {
			...room,
			participants: {},
		};

		Object.entries(room.participants).forEach(([id, p]: any) => {
			sanitized.participants[id] = {
				...p,
				vote: p.vote !== null ? (id === requesterId ? p.vote : "hidden") : null,
			};
		});

		return sanitized;
	}

	@SubscribeMessage(eEvent.ROOM_CREATE)
	async handleCreate(@ConnectedSocket() client: Socket, @MessageBody() payload: { displayName: string }) {
		const { room, userId } = await this.roomService.createRoom(payload.displayName);

		const token = this.sessionService.generateToken({
			userId,
			roomCode: room.code,
		});

		await this.roomService.attachSocket(room.code, userId, client.id);

		client.join(room.code);

		client.emit(eEvent.ROOM_CREATED, {
			roomCode: room.code,
			token,
		});

		const updatedRoom = await this.roomService.getRoom(room.code);
		this.emitRoomState(updatedRoom);
	}

	@SubscribeMessage(eEvent.ROOM_JOIN)
	async handleJoin(@ConnectedSocket() client: Socket, @MessageBody() payload: { roomCode: string; displayName: string }) {
		const { room, userId } = await this.roomService.joinRoom(payload.roomCode, payload.displayName);

		const token = this.sessionService.generateToken({
			userId,
			roomCode: room.code,
		});

		await this.roomService.attachSocket(room.code, userId, client.id);

		client.join(room.code);

		client.emit(eEvent.ROOM_JOINED, {
			roomCode: room.code,
			token,
		});

		const updatedRoom = await this.roomService.getRoom(room.code);
		this.emitRoomState(updatedRoom);
	}

	@SubscribeMessage(eEvent.ROOM_RECONNECT)
	async handleReconnect(@ConnectedSocket() client: Socket, @MessageBody() payload: { roomCode: string }) {
		const user = this.getAuthenticatedUser(client);
		if (!user) {
			return;
		}

		if (user.roomCode !== payload.roomCode) {
			client.emit(eEvent.ROOM_ERROR, { message: "Token is for a different room" });
			return;
		}

		const room = await this.roomService.getRoom(user.roomCode);
		if (!room) {
			client.emit(eEvent.ROOM_ERROR, { message: "Room not found" });
			return;
		}

		try {
			await this.roomService.attachSocket(user.roomCode, user.userId, client.id);
		} catch {
			client.emit(eEvent.ROOM_ERROR, { message: "Unauthorized" });
			return;
		}

		client.join(user.roomCode);

		client.emit(eEvent.ROOM_STATE, this.sanitizeRoom(room, user.userId));
	}

	@SubscribeMessage(eEvent.VOTE_START)
	async handleStart(@ConnectedSocket() client: Socket) {
		const user = this.getAuthenticatedUser(client);
		if (!user) return;

		const { userId, roomCode } = user;

		await this.roomService.startVoting(roomCode, userId);

		const room = await this.roomService.getRoom(roomCode);

		this.emitRoomState(room);
	}

	@SubscribeMessage(eEvent.VOTE_CAST)
	async handleVote(@ConnectedSocket() client: Socket, @MessageBody() payload: { value: number | "abstain" }) {
		const user = this.getAuthenticatedUser(client);
		if (!user) return;

		const { userId, roomCode } = user;

		await this.roomService.castVote(roomCode, userId, payload.value);

		const room = await this.roomService.getRoom(roomCode);

		this.emitRoomState(room);

		const votedCount = Object.values(room.participants).filter((p) => p.vote !== null).length;

		const totalEligible = Object.values(room.participants).filter((p) => !p.isSpectator).length;

		this.server.to(roomCode).emit(eEvent.VOTE_UPDATED, {
			votedCount,
			totalEligible,
		});
	}

	@SubscribeMessage(eEvent.VOTE_REVEAL)
	async handleReveal(@ConnectedSocket() client: Socket) {
		const user = this.getAuthenticatedUser(client);
		if (!user) return;

		const { userId, roomCode } = user;

		const stats = await this.roomService.revealVoting(roomCode, userId);

		const room = await this.roomService.getRoom(roomCode);

		this.server.to(roomCode).emit(eEvent.VOTE_REVEALED, {
			room,
			stats,
		});
	}

	@SubscribeMessage(eEvent.VOTE_END)
	async handleEnd(@ConnectedSocket() client: Socket) {
		const user = this.getAuthenticatedUser(client);
		if (!user) return;

		const { userId, roomCode } = user;

		await this.roomService.endVoting(roomCode, userId);

		const room = await this.roomService.getRoom(roomCode);

		this.emitRoomState(room);
	}

	@SubscribeMessage(eEvent.USER_SET_SPECTATOR)
	async handleSpectator(@ConnectedSocket() client: Socket, @MessageBody() payload: { spectator: boolean }) {
		const user = this.getAuthenticatedUser(client);
		if (!user) return;

		const { userId, roomCode } = user;

		await this.roomService.setSpectator(roomCode, userId, payload.spectator);

		const room = await this.roomService.getRoom(roomCode);

		this.emitRoomState(room);
	}

	@SubscribeMessage(eEvent.ADMIN_GRANT)
	async handleAdminGrant(@ConnectedSocket() client: Socket, @MessageBody() payload: { targetUserId: string }) {
		const user = this.getAuthenticatedUser(client);
		if (!user) return;

		const { userId, roomCode } = user;

		await this.roomService.grantAdmin(roomCode, userId, payload.targetUserId);

		const room = await this.roomService.getRoom(roomCode);

		this.emitRoomState(room);
	}

	@SubscribeMessage(eEvent.EMOJI_THROW)
	async handleEmojiThrow(@ConnectedSocket() client: Socket, @MessageBody() payload: { targetUserId: string; emoji: string }) {
		const user = this.getAuthenticatedUser(client);
		if (!user) return;

		const { userId, roomCode } = user;

		if (!payload.emoji) return;

		const room = await this.roomService.getRoom(roomCode);
		if (!room || !room.participants[payload.targetUserId]) return;

		this.server.to(roomCode).emit(eEvent.EMOJI_THROWN, {
			fromUserId: userId,
			targetUserId: payload.targetUserId,
			emoji: payload.emoji,
		});
	}
}
