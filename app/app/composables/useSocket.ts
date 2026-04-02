import { io, Socket } from "socket.io-client";
import { ref } from "vue";
import { eTokenName } from "~/types/enums";

const socket = ref<Socket | null>(null);

export function useSocket() {
	const config = useRuntimeConfig();

	const connect = (token?: string | null) => {
		if (socket.value && socket.value.connected) return socket.value;

		const currentToken = token || localStorage.getItem(eTokenName.TOKEN);

		socket.value = io(config.public.api_url as string, {
			auth: currentToken ? { token: currentToken } : {},
			reconnectionDelayMax: 10000,
		});

		return socket.value;
	};

	return {
		socket,
		connect,
	};
}
