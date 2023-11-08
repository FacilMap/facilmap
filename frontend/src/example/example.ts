import { createApp, defineComponent, h } from "vue";
import ExampleRoot from "./example-root.vue";

const Root = defineComponent({
	setup() {
		return h(ExampleRoot);
	}
});

createApp(Root).mount(document.getElementById("app")!);
