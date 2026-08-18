import { Units, unitsValidator } from "facilmap-types";
import Cookies from "js-cookie";
import { computed, reactive, readonly, ref } from "vue";
import * as z from "zod";

const cookieValidators = {
	lang: z.string().optional(),
	units: unitsValidator.optional()
};

export type Cookies = {
	[Name in keyof typeof cookieValidators]: z.infer<typeof cookieValidators[Name]>;
}

const cookieCounter = ref(0);

function cookie<Name extends keyof Cookies>(name: Name) {
	return computed((): Cookies[Name] | undefined => {
		cookieCounter.value;
		const value = Cookies.get(name);
		if (value == null) {
			return undefined;
		}
		const result = cookieValidators[name].safeParse(value);
		return result.success ? result.data as Cookies[Name] : undefined;
	});
}

export const cookies = readonly(reactive({
	lang: cookie("lang"),
	units: cookie("units")
}));

async function setLongTermCookie(name: keyof Cookies, value: string): Promise<void> {
	try {
		// Set cookie twice, once as regular cookie and once as partitioned cookie, in case one of them fails.
		// In a third-party iframe, the regular cookie might fail depending on the browser settings. In an unencrypted HTTP context,
		// the partitioned cookie will fail, since it requires HTTPS. In general, an unpartitioned cookie is desirable for us, but
		// it is important enough to justify calling document.requestStorageAccess() to get the user's explicit permission.
		Cookies.set(name, value, {
			expires: 3650
		});
		Cookies.set(name, value, {
			expires: 3650,
			partitioned: true,
			secure: true
		});
	} finally {
		cookieCounter.value++;
	}
}

export async function setLangCookie(value: string): Promise<void> {
	await setLongTermCookie("lang", value);
}

export async function setUnitsCookie(value: Units): Promise<void> {
	await setLongTermCookie("units", value);
}

// Renew long-term cookies (see https://developer.chrome.com/blog/cookie-max-age-expires)
if (cookies.lang) {
	void setLangCookie(cookies.lang);
}
if (cookies.units) {
	void setUnitsCookie(cookies.units);
}