import Cookies from "js-cookie";
import { computed, reactive, readonly, ref } from "vue";

export interface Cookies {
	lang?: string;
}

const cookieCounter = ref(0);

function cookie(name: string) {
	return computed(() => {
		cookieCounter.value;
		return Cookies.get(name);
	});
}

export const cookies = readonly(reactive({
	lang: cookie("lang")
}));

const hasStorageAccessP = (async () => {
	if ("hasStorageAccess" in document) {
		return await document.hasStorageAccess();
	} else {
		return true;
	}
})();

async function setLongTermCookie(name: keyof Cookies, value: string): Promise<void> {
	try {
		Cookies.set(name, value, {
			expires: 3650,
			partitioned: !(await hasStorageAccessP)
		});
	} finally {
		cookieCounter.value++;
	}
}

export async function setLangCookie(value: string): Promise<void> {
	await setLongTermCookie("lang", value);
}

// Renew long-term cookies (see https://developer.chrome.com/blog/cookie-max-age-expires)
if (cookies.lang) {
	void setLangCookie(cookies.lang);
}