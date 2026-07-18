// LinkedIn OAuth popup callback. External script (NOT inline) so it runs
// under the site CSP `script-src 'self'` — see oauth-callback.js.
(function () {
  var params = new URLSearchParams(window.location.search);
  var code = params.get("code");
  var state = params.get("state");
  var error = params.get("error");
  var errorReason = params.get("error_description") || error;

  function setStatus(title, message, isError) {
    document.getElementById("title").textContent = title;
    document.getElementById("message").textContent = message;
    if (isError) {
      document.getElementById("message").classList.add("err");
      var spinner = document.getElementById("spinner");
      if (spinner) spinner.style.display = "none";
    }
  }

  function notifyParent(payload) {
    if (!window.opener || window.opener.closed) return false;
    try {
      window.opener.postMessage(
        Object.assign({ type: "rf_li_oauth" }, payload),
        window.location.origin
      );
      return true;
    } catch {
      return false;
    }
  }

  if (error) {
    setStatus("Connection cancelled", errorReason || "You can try again whenever you're ready.", true);
    notifyParent({ ok: false, error: errorReason || error });
    setTimeout(function () { window.close(); }, 2500);
    return;
  }

  if (!code || !state) {
    setStatus("Missing OAuth response", "The LinkedIn callback didn't include the required parameters.", true);
    notifyParent({ ok: false, error: "Missing OAuth code or state" });
    setTimeout(function () { window.close(); }, 2500);
    return;
  }

  var sent = notifyParent({ ok: true, code: code, state: state });
  if (sent) {
    setStatus("Connected", "All set. You can close this window if it doesn't close automatically.");
    setTimeout(function () { window.close(); }, 800);
  } else {
    setStatus("Connection complete", "Return to the studio tab to finish setup.", false);
  }
})();
