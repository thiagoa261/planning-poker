import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { RoomModule } from "./room/room.module";
import { SessionModule } from "./session/session.module";

@Module({
	imports: [
		ConfigModule.forRoot(),
		JwtModule.register({
			global: true,
			secret: process.env.JWT_SECRET,
			signOptions: {
				expiresIn: "6h",
			},
		}),
		SessionModule,
		RoomModule,
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule { }
