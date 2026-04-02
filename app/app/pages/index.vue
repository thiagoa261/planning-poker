<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useSocket } from "@/composables/useSocket";
import { eEvent, eTokenName } from "~/types/enums";

const router = useRouter();

const loading = ref(false);
const displayName = ref("");

const { socket, connect } = useSocket();

onMounted(() => {
	localStorage.removeItem(eTokenName.TOKEN);
	if (socket.value) socket.value.disconnect();
	connect(null);
});

const createRoom = () => {
	try {
		loading.value = true;

		if (!displayName.value || !socket.value) return;

		socket.value.emit(eEvent.ROOM_CREATE, {
			displayName: displayName.value,
		});

		socket.value.once(eEvent.ROOM_CREATED, (response: any) => {
			localStorage.setItem(eTokenName.TOKEN, response.token);

			socket.value!.auth = { token: response.token };
			socket.value!.disconnect().connect();

			router.push(`/room/${response.roomCode}`);
		});
	} catch (error) {
		console.error(error);
	} finally {
		loading.value = false;
	}
};
</script>

<template>
	<div class="min-h-screen bg-gray-950 font-sans relative text-gray-100">
		<header class="bg-gray-900 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
			<div class="flex items-center gap-3">
				<div
					class="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center text-white shadow-sm transform -rotate-12 transition-transform hover:rotate-0"
				>
					<UIcon name="i-mdi-cards-playing" class="w-6 h-6 rotate-45" />
				</div>
				<h1 class="text-xl font-bold leading-none tracking-tight text-white">Planning Poker</h1>
			</div>
		</header>

		<div class="flex min-h-screen items-center justify-center p-4">
			<div class="w-full max-w-md bg-gray-900 shadow-2xl rounded-[30px] p-8 space-y-6 border border-gray-800">
				<div class="text-center space-y-2">
					<h2 class="text-2xl font-bold text-white">Criar Nova Sala</h2>
					<p class="text-gray-400 text-sm">Digite seu nome para iniciar uma nova sessão.</p>
				</div>

				<div class="space-y-4">
					<UInput
						v-model="displayName"
						placeholder="Seu nome"
						icon="i-heroicons-user"
						size="lg"
						@keyup.enter="createRoom"
						class="w-full"
						:ui="{
							base: 'bg-gray-800 text-gray-100 ring-gray-700',
						}"
					/>

					<UButton
						size="lg"
						color="primary"
						class="font-semibold shadow-sm w-full justify-center"
						:loading="loading"
						:disabled="!displayName || loading"
						@click="createRoom"
					>
						Criar Sala
					</UButton>
				</div>
			</div>
		</div>
	</div>
</template>
