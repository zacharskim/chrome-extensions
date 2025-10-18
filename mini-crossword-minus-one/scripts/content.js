console.log("Mini Minus One content script loaded");

function getCluesFromDOM() {
  const clues = {
    across: [],
    down: [],
  };

  // Get both clue list wrappers
  const wrappers = document.querySelectorAll(".xwd__clue-list--wrapper");

  if (wrappers.length >= 2) {
    // First wrapper is Across
    const acrossClues = wrappers[0].querySelectorAll(".xwd__clue--li");
    acrossClues.forEach((clue) => {
      const label = clue.querySelector(".xwd__clue--label")?.textContent;
      const text = clue.querySelector(".xwd__clue--text")?.textContent;
      if (label && text) {
        clues.across.push({ number: label, clue: text });
      }
    });

    // Second wrapper is Down
    const downClues = wrappers[1].querySelectorAll(".xwd__clue--li");
    downClues.forEach((clue) => {
      const label = clue.querySelector(".xwd__clue--label")?.textContent;
      const text = clue.querySelector(".xwd__clue--text")?.textContent;
      if (label && text) {
        clues.down.push({ number: label, clue: text });
      }
    });
  }

  return clues;
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "setTargetTime") {
    const targetTime = request.targetTime;
    const winningTime = targetTime - 1;

    console.log("Received target time:", targetTime);
    console.log("Your winning time will be:", winningTime);

    // Get all the clues from the page
    const clues = getCluesFromDOM();
    console.log("Clues found:", clues);
    console.log("Across clues:", clues.across.length);
    console.log("Down clues:", clues.down.length);

    // TODO: Add logic here to modify the displayed time on the page
    // You'll want to find the time element and change it to winningTime

    sendResponse({ success: true, winningTime: winningTime, clues: clues });
  }
  return true; // Keep the message channel open for async response
});
