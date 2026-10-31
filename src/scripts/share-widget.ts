// The "Поделиться" button of an article page (src/components/ShareWidget.astro). Ported on
// 2026-10-31 from the Hugo theme, MIGRATION-PLAN.md §7:
//   ../klub_biolocation/themes/void/assets/js/main.js, initShareWidgets(), copyToClipboard() and
//   fallbackCopyText() (lines 140-207).
// Until that day the button rendered with every data attribute the theme's script reads, and no
// script read them: a click did nothing on the dev server and on the live site alike. The rest of
// main.js (footnotes, callouts) is still the TODO in src/scripts/site.ts.
//
// What it does, as in the theme: a click copies the title, the description and the address of
// the page, one per line, and the label says "Скопировано" for 1.6s (or the failure message, in
// red); there is no system share sheet, because the theme has none.
//
// Mapping onto the theme's code:
//   document.addEventListener("DOMContentLoaded", ...initShareWidgets()) -> a plain call: Astro
//     bundles this as a module script, which runs after the document is parsed.
//   the `messages` fallbacks "Share", "Copied", "Copy failed." -> kept; the component always
//     writes the Russian labels, so they only show if an attribute goes missing.
//   data-share-copy-summary-success, written by the component, is read by nothing here either:
//     the theme's script never used it.
//   fallbackCopyText() with document.execCommand("copy") -> kept verbatim. It is deprecated, and it
//     is only reached where navigator.clipboard is missing, which is a page served over plain
//     http from an address other than localhost.

function initShareWidgets() {
  const widgets = document.querySelectorAll<HTMLElement>("[data-share-widget]");
  if (widgets.length === 0) return;

  widgets.forEach((widget) => {
    const copySummaryButton = widget.querySelector<HTMLElement>(
      "[data-share-copy-summary]",
    );
    const label = widget.querySelector<HTMLElement>("[data-share-label]");
    const shareData = {
      title: widget.dataset.shareTitle || document.title,
      text: widget.dataset.shareText || "",
      url: widget.dataset.shareUrl || window.location.href,
    };
    const shareSummary = [shareData.title, shareData.text, shareData.url]
      .filter(Boolean)
      .join("\n");
    const messages = {
      defaultLabel: widget.dataset.shareLabelDefault || "Share",
      successLabel: widget.dataset.shareLabelSuccess || "Copied",
      copyFailed: widget.dataset.shareCopyFailed || "Copy failed.",
    };
    let feedbackTimer: number | null = null;

    const setButtonState = (message: string, isError = false) => {
      if (!copySummaryButton || !label) return;
      label.textContent = message;
      copySummaryButton.classList.toggle("is-error", isError);
      copySummaryButton.classList.toggle(
        "is-success",
        !isError && message === messages.successLabel,
      );

      if (feedbackTimer) window.clearTimeout(feedbackTimer);
      feedbackTimer = window.setTimeout(() => {
        label.textContent = messages.defaultLabel;
        copySummaryButton.classList.remove("is-error", "is-success");
      }, 1600);
    };

    if (copySummaryButton) {
      copySummaryButton.addEventListener("click", async () => {
        try {
          await copyToClipboard(shareSummary);
          setButtonState(messages.successLabel);
          copySummaryButton.blur();
        } catch {
          setButtonState(messages.copyFailed, true);
        }
      });
    }
  });
}

async function copyToClipboard(text: string) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  fallbackCopyText(text);
}

function fallbackCopyText(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

initShareWidgets();
