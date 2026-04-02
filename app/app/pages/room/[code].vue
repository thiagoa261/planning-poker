<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useSocket } from "@/composables/useSocket";
import { type IRoom, eVoteState } from "@/types/room.types";
import { eEvent, eTokenName } from "~/types/enums";
import EmojiPicker from "vue3-emoji-picker";
import "vue3-emoji-picker/css";

const route = useRoute();
const router = useRouter();
const { socket, connect } = useSocket();

const room = ref<IRoom | null>(null);
const voteStats = ref<{ avg: number; median: number; mode: number } | null>(null);
const myUserId = ref<string | null>(null);

const joinDisplayName = ref("");
const canSubmitJoinName = computed(() => joinDisplayName.value.trim().length > 0);

const isJoinNameModalOpen = ref(false);
const isGrantAdminModalOpen = ref(false);

const pendingJoinSocket = ref<any>(null);
const pendingAdminTargetUserId = ref<string | null>(null);

const selectedEmoji = ref<string | null>(null);
const isEmojiPickerOpen = ref(false);
const participantRefs = ref<Record<string, HTMLElement>>({});

interface EmojiThrowAnimation {
	id: string;
	emoji: string;
	startX: number;
	startY: number;
	endX: number;
	endY: number;
}
const emojiThrows = ref<EmojiThrowAnimation[]>([]);

const onEmojiSelect = (emoji: any) => {
	selectedEmoji.value = emoji.i;
	isEmojiPickerOpen.value = false;
};

const cancelEmojiSelection = () => {
	selectedEmoji.value = null;
};

const getParticipantCenter = (userId: string): { x: number; y: number } | null => {
	const el = participantRefs.value[userId];
	if (!el) return null;
	const rect = el.getBoundingClientRect();
	return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};

const addEmojiThrow = (fromUserId: string, targetUserId: string, emoji: string) => {
	const start = getParticipantCenter(fromUserId);
	const end = getParticipantCenter(targetUserId);
	if (!start || !end) return;

	const id = crypto.randomUUID();
	emojiThrows.value.push({ id, emoji, startX: start.x, startY: start.y, endX: end.x, endY: end.y });
	setTimeout(() => {
		emojiThrows.value = emojiThrows.value.filter((t) => t.id !== id);
	}, 1000);
};

const throwEmoji = (targetParticipantId: string) => {
	if (!selectedEmoji.value) return;
	socket.value?.emit(eEvent.EMOJI_THROW, {
		targetUserId: targetParticipantId,
		emoji: selectedEmoji.value,
	});
};

const onParticipantCardClick = (participantId: string) => {
	if (selectedEmoji.value && participantId !== getMyParticipant()?.id) {
		throwEmoji(participantId);
	}
};

const onNameClick = (participantId: string) => {
	if (selectedEmoji.value && participantId !== getMyParticipant()?.id) {
		throwEmoji(participantId);
		return;
	}
	grantAdmin(participantId);
};

const handleKeyDown = (e: KeyboardEvent) => {
	if (e.key === "Escape") cancelEmojiSelection();
};

const openJoinNameModal = (s: any) => {
	pendingJoinSocket.value = s;
	joinDisplayName.value = "";
	isJoinNameModalOpen.value = true;
};

const cancelJoinName = () => {
	isJoinNameModalOpen.value = false;
	pendingJoinSocket.value = null;
	router.push("/");
};

const setMyUserIdFromToken = (token: string) => {
	try {
		const part = token.split(".")[1];
		if (!part) return;
		const payload = JSON.parse(atob(part));
		if (payload?.userId) myUserId.value = payload.userId;
	} catch {}
};

const submitJoinName = () => {
	const name = joinDisplayName.value.trim();
	const s = pendingJoinSocket.value;

	if (!name || !s) return;

	isJoinNameModalOpen.value = false;
	pendingJoinSocket.value = null;

	s.emit(eEvent.ROOM_JOIN, {
		roomCode: route.params.code,
		displayName: name,
	});

	s.once(eEvent.ROOM_JOINED, (response: any) => {
		localStorage.setItem(eTokenName.TOKEN, response.token);
		setMyUserIdFromToken(response.token);

		s.auth = { token: response.token };
		s.disconnect().connect();

		s.emit(eEvent.ROOM_RECONNECT, { roomCode: route.params.code });
	});
};

onMounted(() => {
	window.addEventListener("keydown", handleKeyDown);

	const token = localStorage.getItem(eTokenName.TOKEN);

	if (!token) {
		const s = connect(null);
		openJoinNameModal(s);

		s.on(eEvent.ROOM_STATE, (data: IRoom) => {
			room.value = data;
		});
	} else {
		setMyUserIdFromToken(token);
		const s = connect(token);

		s.emit(eEvent.ROOM_RECONNECT, { roomCode: route.params.code });

		s.once(eEvent.ROOM_ERROR, (err: any) => {
			if (err?.message === "Unauthorized" || err?.message === "Room not found" || err?.message === "Token is for a different room") {
				// console.log("Credenciais inválidas ou sala não encontrada. Solicitando novo nome...");
				localStorage.removeItem(eTokenName.TOKEN);
				s.auth = {};

				s.disconnect().connect();
				openJoinNameModal(s);
			}
		});
	}

	socket.value?.on(eEvent.VOTE_REVEALED, (data: any) => {
		room.value = data.room;
		voteStats.value = data.stats;
	});

	socket.value?.on(eEvent.ROOM_STATE, (data: IRoom) => {
		room.value = data;
		if (data.voteState !== eVoteState.REVEALED) voteStats.value = null;
	});

	socket.value?.on(eEvent.EMOJI_THROWN, (data: { fromUserId: string; targetUserId: string; emoji: string }) => {
		addEmojiThrow(data.fromUserId, data.targetUserId, data.emoji);
	});
});

onUnmounted(() => {
	window.removeEventListener("keydown", handleKeyDown);
});

const getMyParticipant = () => {
	if (!room.value) return null;
	if (myUserId.value) return room.value.participants[myUserId.value] || null;
	if (!socket.value) return null;
	return Object.values(room.value.participants).find((p) => p.socketId === socket.value?.id) || null;
};

const getMyVote = () => {
	return getMyParticipant()?.vote || null;
};

const castVote = (val: number | "abstain") => {
	socket.value?.emit(eEvent.VOTE_CAST, { value: val });
};

const adminStartVote = () => {
	socket.value?.emit(eEvent.VOTE_START);
};

const adminRevealVote = () => {
	socket.value?.emit(eEvent.VOTE_REVEAL);
};

const grantAdmin = (targetUserId: string) => {
	if (getMyParticipant()?.isAdmin && targetUserId !== getMyParticipant()?.id) {
		pendingAdminTargetUserId.value = targetUserId;
		isGrantAdminModalOpen.value = true;
	}
};

const cancelGrantAdmin = () => {
	pendingAdminTargetUserId.value = null;
	isGrantAdminModalOpen.value = false;
};

const confirmGrantAdmin = () => {
	if (!pendingAdminTargetUserId.value) return;

	socket.value?.emit(eEvent.ADMIN_GRANT, { targetUserId: pendingAdminTargetUserId.value });
	cancelGrantAdmin();
};

const getSeatPosition = (index: number, total: number) => {
	if (total === 0) return {};

	const angle = (index / total) * 2 * Math.PI - Math.PI / 2;

	const rx = 42;
	const ry = 38;

	const x = 50 + rx * Math.cos(angle);
	const y = 50 + ry * Math.sin(angle);

	return {
		left: `${x}%`,
		top: `${y}%`,
		transform: "translate(-50%, -50%)",
	};
};

const toast = useToast();
const copyInviteLink = () => {
	navigator.clipboard.writeText(window.location.href);
	toast.add({
		title: "Copiado para área de transferência",
		class: "bg-gray-800 ring-1 ring-gray-700",
		color: "success",
		icon: "i-heroicons-check-circle",
		ui: { title: "text-white" },
	});
};

useSeoMeta({
	ogTitle: `Planning Poker - Sala ${route.params.code}`,
	ogDescription: `Entre na sala ${route.params.code} para votar nas tarefas com sua equipe.`,
	ogImage: "https://pp.thiagoaio.com/banner.png",
	ogType: "website",
});
</script>

<template>
	<div class="min-h-screen bg-gray-950 pb-32 font-sans relative text-gray-100">
		<header class="bg-gray-900 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
			<div class="flex items-center gap-3">
				<div
					class="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center text-white shadow-sm transform -rotate-12 transition-transform hover:rotate-0"
				>
					<UIcon name="i-mdi-cards-playing" class="w-6 h-6 rotate-45" />
				</div>

				<div class="flex flex-col">
					<div class="flex items-center gap-1.5">
						<h1 class="text-xl font-bold leading-none tracking-tight text-white">Planning Poker</h1>
					</div>
					<div class="text-xs mt-1 text-gray-400" v-if="room">
						<span class="font-bold text-gray-200 ml-0.5">Sala: {{ route.params.code }}</span>
					</div>
				</div>
			</div>

			<div class="flex items-center gap-4" v-if="room">
				<div class="hidden sm:flex items-center gap-2">
					<UAvatar :alt="getMyParticipant()?.displayName || 'User'" size="sm" class="ring-1 ring-gray-700" />
					<span class="text-sm font-semibold text-gray-200">
						{{ getMyParticipant()?.displayName || "Jogador" }}
					</span>
				</div>

				<div class="w-px h-8 bg-gray-800 hidden sm:block mx-1"></div>

				<UButton
					variant="outline"
					color="primary"
					icon="i-heroicons-user-plus"
					class="font-semibold px-4 rounded-lg hidden sm:flex border-primary-800 bg-primary-900/10 hover:bg-primary-900/30"
					@click="copyInviteLink"
				>
					Convidar jogadores
				</UButton>
			</div>
		</header>

		<div class="max-w-5xl mx-auto p-4 md:p-12 mb-24 cursor-default">
			<div v-if="room" class="relative w-full h-[400px] md:h-[500px] mt-6 flex items-center justify-center">
				<div
					class="w-[60%] md:w-[45%] h-[40%] md:h-[35%] bg-primary-900/20 rounded-[24px] md:rounded-[32px] flex flex-col items-center justify-center relative transition-colors duration-500"
				>
					<div class="text-primary-300 font-bold text-sm md:text-base text-center px-4 tracking-wide flex flex-col items-center">
						<span v-if="room.voteState === eVoteState.VOTING" class="animate-pulse opacity-90"
							>Aguardando os votos dos jogadores...</span
						>

						<template v-else-if="room.voteState === eVoteState.REVEALED">
							<span class="text-primary-500 mb-2">Votos Revelados!</span>

							<div v-if="voteStats" class="flex gap-4 mt-2 text-sm text-primary-300/80">
								<div class="flex flex-col">
									<span class="text-xs uppercase tracking-wider opacity-70">Média</span>
									<span class="font-bold text-lg text-primary-300">{{ voteStats.avg.toFixed(1) }}</span>
								</div>

								<div class="w-px bg-primary-800"></div>

								<div class="flex flex-col">
									<span class="text-xs uppercase tracking-wider opacity-70">Mediana</span>
									<span class="font-bold text-lg text-primary-300">{{ voteStats.median }}</span>
								</div>
							</div>
						</template>

						<span v-else>Pronto para iniciar</span>

						<div v-if="getMyParticipant()?.isAdmin" class="mt-4 flex gap-2">
							<UButton
								v-if="room.voteState === eVoteState.IDLE || room.voteState === eVoteState.REVEALED"
								color="primary"
								variant="solid"
								size="sm"
								class="shadow-sm font-semibold px-4 rounded-full"
								@click="adminStartVote"
							>
								Iniciar Votação
							</UButton>

							<UButton
								v-if="room.voteState === eVoteState.VOTING"
								color="primary"
								variant="solid"
								size="sm"
								class="shadow-sm font-semibold px-4 rounded-full"
								@click="adminRevealVote"
							>
								Revelar Votos
							</UButton>
						</div>
					</div>
				</div>

				<div
					v-for="(p, i) in Object.values(room.participants)"
					:key="p.id"
					:ref="
						(el: any) => {
							if (el) participantRefs[p.id] = el.$el || el;
						}
					"
					:data-participant-id="p.id"
					class="absolute transition-all duration-700 ease-out"
					:class="{ 'cursor-crosshair': selectedEmoji && p.id !== getMyParticipant()?.id }"
					:style="getSeatPosition(i, Object.keys(room.participants).length)"
					@click="onParticipantCardClick(p.id)"
				>
					<div class="flex flex-col items-center gap-1.5 md:gap-2">
						<div
							class="w-[36px] h-[52px] md:w-[44px] md:h-[62px] rounded-md md:rounded-lg flex items-center justify-center font-bold text-lg md:text-xl transition-all duration-300 pointer-events-none"
							:class="[
								p.vote !== null && room.voteState === eVoteState.REVEALED
									? 'bg-primary-500 text-white shadow-md -translate-y-2 scale-105'
									: p.vote !== null && room.voteState === eVoteState.VOTING
										? p.vote !== 'hidden'
											? 'bg-gray-950 border-2 border-emerald-500 text-emerald-500 shadow-sm transform -translate-y-1'
											: 'bg-primary-500 shadow-sm border border-primary-600/20 transform -translate-y-1'
										: 'bg-gray-800',
							]"
						>
							<span v-if="room.voteState === eVoteState.REVEALED && p.vote !== null">
								<template v-if="p.vote === 'abstain'">
									<UIcon name="i-ph-coffee-fill" class="w-5 h-5 text-white opacity-80" />
								</template>

								<template v-else>
									{{ p.vote }}
								</template>
							</span>

							<span
								v-else-if="room.voteState === eVoteState.VOTING && p.vote !== null"
								class="w-full h-full flex items-center justify-center"
							>
								<template v-if="p.vote !== 'hidden'">
									<template v-if="p.vote === 'abstain'">
										<UIcon name="i-ph-coffee-fill" class="w-5 h-5 text-white opacity-80" />
									</template>

									<template v-else>
										{{ p.vote }}
									</template>
								</template>

								<template v-else>
									<UIcon name="i-heroicons-check-circle-20-solid" class="w-5 h-5 md:w-6 md:h-6 text-white opacity-80" />
								</template>
							</span>
						</div>

						<div class="flex flex-col items-center gap-1 mt-1">
							<div
								class="text-[13px] md:text-sm font-bold text-white flex items-center justify-center transition-colors px-2 py-0.5 rounded-md"
								:class="{
									'cursor-pointer hover:bg-gray-800': !selectedEmoji && getMyParticipant()?.isAdmin && p.id !== getMyParticipant()?.id,
								}"
								@click.stop="onNameClick(p.id)"
								:title="
									selectedEmoji && p.id !== getMyParticipant()?.id
										? `Arremessar ${selectedEmoji}`
										: getMyParticipant()?.isAdmin && p.id !== getMyParticipant()?.id
											? 'Transferir Administrador'
											: ''
								"
							>
								{{ p.displayName.split(" ")[0] }}

								<UIcon
									v-if="p.isAdmin"
									name="i-heroicons-star-20-solid"
									class="w-3 h-3 text-amber-500 shrink-0 ml-1"
									title="Administrador"
								/>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div v-else class="flex flex-col items-center justify-center h-64 space-y-4">
				<UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
				<p class="text-gray-500">Conectando à sala...</p>
			</div>
		</div>

		<div
			v-for="t in emojiThrows"
			:key="t.id"
			class="emoji-projectile pointer-events-none select-none fixed z-999"
			:style="{
				'--start-x': t.startX + 'px',
				'--start-y': t.startY + 'px',
				'--end-x': t.endX + 'px',
				'--end-y': t.endY + 'px',
			}"
		>
			{{ t.emoji }}
		</div>

		<div v-if="room" class="fixed bottom-8 right-4 z-40 flex flex-col items-end gap-2">
			<Transition name="emoji-picker-slide">
				<div v-if="isEmojiPickerOpen" class="emoji-picker-wrapper">
					<EmojiPicker :native="true" :disable-skin-tones="false" :display-recent="true" theme="dark" @select="onEmojiSelect" />
				</div>
			</Transition>

			<button
				v-if="selectedEmoji && !isEmojiPickerOpen"
				class="w-12 h-12 mb-1 rounded-full flex items-center justify-center shadow-lg ring-1 ring-red-700 bg-red-900 text-red-300 hover:bg-red-800 transition-colors focus:outline-none"
				title="Remover emoji"
				@click="cancelEmojiSelection"
			>
				<UIcon name="i-heroicons-x-mark-20-solid" class="w-5 h-5" />
			</button>

			<button
				class="w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-lg ring-1 transition-colors focus:outline-none"
				:class="
					isEmojiPickerOpen
						? 'bg-primary-900 ring-primary-700 text-primary-300'
						: 'bg-gray-800 ring-gray-700 text-gray-200 hover:bg-gray-700'
				"
				title="Arremessar emoji"
				@click="isEmojiPickerOpen = !isEmojiPickerOpen"
			>
				{{ selectedEmoji ?? "🎯" }}
			</button>
		</div>

		<div
			v-if="room"
			class="fixed bottom-0 left-0 w-full transition-transform duration-300 pb-8 pt-4 bg-gray-950/90 pointer-events-none z-30"
			:class="room.voteState === eVoteState.VOTING ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'"
		>
			<div class="max-w-4xl mx-auto flex flex-col items-center pointer-events-auto">
				<div class="text-center text-[15px] text-gray-300 mb-4 flex items-center justify-center">
					Escolha seu voto <span class="text-lg ml-1">👇</span>
				</div>

				<div class="flex flex-wrap items-center justify-center gap-1.5 md:gap-[10px] px-4">
					<button
						v-for="opt in room.options"
						:key="opt"
						@click="castVote(opt)"
						class="w-[42px] h-[60px] md:w-[48px] md:h-[68px] rounded-[10px] border-[1.5px] flex items-center justify-center text-lg md:text-xl font-bold transition-all hover:-translate-y-1 focus:outline-none"
						:class="
							getMyVote() === opt
								? 'bg-emerald-500/20 border-emerald-400 text-emerald-400 -translate-y-2'
								: 'bg-[#0f172a] border-emerald-500 text-emerald-500 hover:bg-emerald-500/10'
						"
					>
						{{ opt }}
					</button>

					<button
						@click="castVote('abstain')"
						title="Abster-se"
						class="w-[42px] h-[60px] md:w-[48px] md:h-[68px] rounded-[10px] border-[1.5px] flex items-center justify-center text-lg md:text-xl font-bold transition-all hover:-translate-y-1 focus:outline-none"
						:class="
							getMyVote() === 'abstain'
								? 'bg-emerald-500/20 border-emerald-400 text-emerald-400 -translate-y-2 '
								: 'bg-[#0f172a] border-emerald-500 text-emerald-500 hover:bg-emerald-500/10'
						"
					>
						<UIcon name="i-ph-coffee-fill" class="w-5 h-5 text-white opacity-80" />
					</button>
				</div>
			</div>
		</div>

		<UModal
			v-model:open="isGrantAdminModalOpen"
			:dismissible="false"
			:close="false"
			title="Transferir administrador"
			:ui="{
				content: 'bg-gray-900 ring-1 ring-gray-800',
				header: 'border-b border-gray-800',
				title: 'text-gray-100',
			}"
		>
			<template #body>
				<p class="text-sm text-gray-300">
					Deseja realmente transferir os privilégios de administrador para este usuário? Você perderá o acesso de admin.
				</p>

				<div class="flex items-center justify-end gap-2 w-full mt-7">
					<UButton color="neutral" variant="soft" @click="cancelGrantAdmin">Cancelar</UButton>
					<UButton color="primary" @click="confirmGrantAdmin">Transferir</UButton>
				</div>
			</template>
		</UModal>

		<UModal
			v-model:open="isJoinNameModalOpen"
			:dismissible="false"
			:close="false"
			title="Seu nome"
			:ui="{
				content: 'bg-gray-900 ring-1 ring-gray-800',
				header: 'border-b border-gray-800',
				title: 'text-gray-100',
			}"
		>
			<template #body>
				<div class="space-y-3">
					<p class="text-sm text-gray-300">Digite seu nome para entrar na sala.</p>

					<UInput
						v-model="joinDisplayName"
						placeholder="Seu nome"
						autofocus
						class="w-full"
						:ui="{
							base: 'bg-gray-800 text-gray-100 ring-gray-700',
						}"
						@keyup.enter="submitJoinName"
					/>
				</div>

				<div class="flex items-center justify-end gap-2 w-full mt-7">
					<UButton color="neutral" variant="soft" @click="cancelJoinName">Cancelar</UButton>
					<UButton color="primary" :disabled="!canSubmitJoinName" @click="submitJoinName">Entrar</UButton>
				</div>
			</template>
		</UModal>
	</div>
</template>

<style scoped>
@keyframes emoji-projectile {
	0% {
		left: var(--start-x);
		top: var(--start-y);
		opacity: 1;
		transform: translate(-50%, -50%) scale(0.5) rotate(0deg);
	}
	15% {
		opacity: 1;
		transform: translate(-50%, -50%) scale(1.4) rotate(-15deg);
	}
	50% {
		opacity: 1;
		transform: translate(-50%, calc(-50% - 40px)) scale(1.1) rotate(10deg);
	}
	85% {
		opacity: 1;
		transform: translate(-50%, -50%) scale(1.3) rotate(-5deg);
	}
	100% {
		left: var(--end-x);
		top: var(--end-y);
		opacity: 0;
		transform: translate(-50%, -50%) scale(1.8) rotate(15deg);
	}
}

.emoji-projectile {
	font-size: 2rem;
	animation: emoji-projectile 0.9s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

.emoji-hint-fade-enter-active,
.emoji-hint-fade-leave-active {
	transition:
		opacity 0.2s ease,
		transform 0.2s ease;
}
.emoji-hint-fade-enter-from,
.emoji-hint-fade-leave-to {
	opacity: 0;
	transform: translateY(6px);
}

.emoji-picker-slide-enter-active,
.emoji-picker-slide-leave-active {
	transition:
		opacity 0.15s ease,
		transform 0.15s ease;
}
.emoji-picker-slide-enter-from,
.emoji-picker-slide-leave-to {
	opacity: 0;
	transform: translateY(8px) scale(0.97);
}
</style>
