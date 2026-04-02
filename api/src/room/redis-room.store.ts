import { Inject, Injectable } from "@nestjs/common";
import Redis from "ioredis";
import { IRoom, RoomStore } from "../types/room.types";

@Injectable()
export class RedisRoomStore extends RoomStore {
	constructor(@Inject("REDIS_CLIENT") private readonly redis: Redis) {
		super();
	}

	private key(code: string) {
		return `${process.env.REDIS_PREFIX}:${code}`;
	}

	async create(room: IRoom) {
		await this.redis.set(
			this.key(room.code),
			JSON.stringify(room),
			"EX",
			60 * 60 * 6, // 6 horas
		);
	}

	async get(code: string): Promise<IRoom | null> {
		const data = await this.redis.get(this.key(code));
		if (!data) return null;
		return JSON.parse(data);
	}

	async update(room: IRoom) {
		await this.redis.set(this.key(room.code), JSON.stringify(room), "KEEPTTL");
	}

	async delete(code: string) {
		await this.redis.del(this.key(code));
	}
}
