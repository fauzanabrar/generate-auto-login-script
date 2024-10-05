const serializeJavascript = require("serialize-javascript");

function produce(dataFile) {
	const login = {
		myData: dataFile,
		run: function () {
			const myData = this.myData;

			document.cookie.split(";").forEach(function (cookie) {
				document.cookie = cookie
					.replace(/^ +/, "")
					.replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
			});

			myData.cookies.forEach((cookie) => {
				document.cookie = `${cookie.name}=${cookie.value}; expires=${new Date(cookie.expires * 1000).toUTCString()}; path=${cookie.path}; domain=${cookie.domain}; ${cookie.secure ? "secure" : ""}; SameSite=${cookie.sameSite || "Lax"}`;
			});

			myData.origins[0].localStorage.forEach((item) => {
				localStorage.setItem(item.name, item.value);
			});
		},
	};
	return login;
}

module.exports = produce;
