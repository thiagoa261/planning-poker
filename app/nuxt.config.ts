// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	compatibilityDate: "2025-07-15",

	devtools: { enabled: false },

	modules: ["@nuxt/ui"],

	css: ["~/assets/css/main.css"],

	runtimeConfig: {
		public: {
			api_url: "",
		},
	},

	colorMode: {
		preference: "dark",
	},

	app: {
		pageTransition: { name: "page", mode: "out-in" },
		layoutTransition: { name: "layout", mode: "out-in" },

		head: {
			title: "Planning Poker",
			link: [
				{ rel: "icon", type: "image/svg+xml", href: "/icon.svg" }
			],
		},
	},
});
