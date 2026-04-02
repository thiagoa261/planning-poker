<script setup lang="ts">
const toaster = {
	position: "bottom-right",
} as const;
</script>

<template>
	<UApp :toaster="toaster">
		<NuxtLayout>
			<NuxtPage />
		</NuxtLayout>
	</UApp>
</template>

<style>
.page-enter-active,
.page-leave-active {
	transition: all 0.4s;
}

.page-enter-from,
.page-leave-to {
	opacity: 0;
	transform: translateY(10px);
}
</style>
