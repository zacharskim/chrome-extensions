function processComments() {
  const moreComments = document.querySelector("a.more-comments");
  if (moreComments && !moreComments.dataset.processed) {
    moreComments.dataset.processed = "true";

    // Open the comments page in a hidden iframe to interact with it
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = moreComments.href;
    document.body.appendChild(iframe);

    iframe.onload = () => {
      const iframeDoc = iframe.contentDocument;

      // Click all Load More buttons in the iframe
      function clickAllLoadMore() {
        const buttons = iframeDoc.querySelectorAll("button");
        let clicked = false;
        buttons.forEach((button) => {
          if (button.textContent.includes("Load More")) {
            button.click();
            clicked = true;
          }
        });

        // If we clicked a button, wait and check again
        if (clicked) {
          setTimeout(clickAllLoadMore, 500);
        } else {
          // No more buttons, extract comments
          const comments = iframeDoc.querySelector(".comment-list-container");
          moreComments.replaceWith(comments.cloneNode(true));
          iframe.remove();
        }
      }

      clickAllLoadMore();
    };
  }

  const moreRepliesLinks = document.querySelectorAll("a.more-replies");
  moreRepliesLinks.forEach((moreReplies) => {
    if (moreReplies && !moreReplies.dataset.processed) {
      moreReplies.dataset.processed = "true";

      fetch(moreReplies.href)
        .then((r) => r.text())
        .then((html) => {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, "text/html");
          const comments = doc.querySelector(".comment-list-container");
          moreReplies.replaceWith(comments);
        });
    }
  });
}

// Run initially
processComments();

// Watch for URL changes (for client-side routing)
let lastUrl = location.href;
let timeout;
new MutationObserver(() => {
  if (timeout) return;
  timeout = setTimeout(() => {
    timeout = null;
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      setTimeout(processComments, 1000);
    }
  }, 100); // Throttle to check at most every 100ms
}).observe(document, { subtree: true, childList: true });
