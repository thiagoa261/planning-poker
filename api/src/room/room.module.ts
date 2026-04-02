import { Module } from "@nestjs/common";
import Redis from "ioredis";
import { RoomService } from "./room.service";
import { RedisRoomStore } from "./redis-room.store";
import { RoomStore } from "src/types/room.types";
import { RoomGateway } from "./room.gateway";
import { SessionModule } from "src/session/session.module";

@Module({
	imports: [SessionModule],
	providers: [
		{
			provide: "REDIS_CLIENT",
			useFactory: () => {
				return new Redis({
					host: process.env.REDIS_HOST,
					port: Number(process.env.REDIS_PORT),
					password: process.env.REDIS_PASSWORD,
				});
			},
		},
		{
			provide: RoomStore,
			useClass: RedisRoomStore,
		},
		RoomService,
		RoomGateway,
	],
	exports: [RoomService],
})
export class RoomModule {}
