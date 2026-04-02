import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
	apiStatus() {
		return "Hello World!";
	}
}
