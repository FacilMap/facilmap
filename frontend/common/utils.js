const utils = module.exports = {
	quoteJavaScript(str) {
		return "'" + (""+str).replace(/['\\]/g, '\\$1').replace(/\n/g, "\\n") + "'";
	},

	quoteHtml(str) {
		return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
	},

	quoteRegExp(str) {
		return (str+'').replace(/[.?*+^$[\]\\(){}|-]/g, "\\$&");
	}
};
