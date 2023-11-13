import { createApp, defineComponent, h } from "vue";
import ExampleRoot from "./example-root.vue";
import "../lib/bootstrap.scss";

const Root = defineComponent({
	setup() {
		return () => h(ExampleRoot);
	}
});

createApp(Root).mount(document.getElementById("app")!);
