import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

import * as morgan from "morgan";

async function bootstrap() {
	if (!process.env.PORT) throw new Error("PORT não definido no .env");

	const app = await NestFactory.create(AppModule);

	app.enableCors();

	app.useGlobalPipes(
		new ValidationPipe({
			transform: true,
			whitelist: true,
			forbidNonWhitelisted: true,
		}),
	);

	app.use(morgan("dev"));

	await app.listen(process.env.PORT);

	console.clear();

	console.log(`Application is running on: http://localhost:${process.env.PORT}`);
}

bootstrap();
