import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

@Injectable()
export class SessionService {
	constructor(private readonly jwtService: JwtService) {}

	generateToken(payload: { userId: string; roomCode: string }) {
		return this.jwtService.sign(payload);
	}

	verifyToken(token: string) {
		return this.jwtService.verify(token);
	}
}
