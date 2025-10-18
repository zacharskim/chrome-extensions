function loadSavedTargetTime(result) {
  const input = document.getElementById("sampleSecond");
  if (result.targetTime) {
    input.value = result.targetTime;
  }
}

function showLoadingState(targetTime) {
  const body = document.body;
  const winningTime = targetTime - 1;

  const phrases = [
    "Analyzing the grid",
    "Consulting the dictionary",
    "Channeling crossword energy",
    "Calculating optimal strategy",
    "Summoning wordplay skills",
    "Evaluating clue patterns",
    "Thinking very hard",
    "Almost there",
  ];

  let phraseIndex = 0;
  let dotCount = 0;
  let dotCycles = 0;

  body.innerHTML = `
    <div style="padding: 30px 20px; text-align: center; font-family: Georgia, serif;">
      <h2 style="font-size: 18px; margin-bottom: 20px; color: #121212; font-weight: 700;">Goal Time: ${winningTime}s</h2>
      <div style="margin: 20px 0;">
        <p id="loadingPhrase" style="font-size: 14px; color: #666; min-height: 20px; font-style: italic;">
          <span id="phraseText"></span><span id="dots" style="display: inline-block; width: 1.2em; text-align: left;"></span>
        </p>
      </div>
    </div>
  `;

  const phraseTextElement = document.getElementById("phraseText");
  const dotsElement = document.getElementById("dots");

  // Rotate phrases and animate dots
  const interval = setInterval(() => {
    dotCount = (dotCount + 1) % 4;
    const dots = ".".repeat(dotCount);
    phraseTextElement.textContent = phrases[phraseIndex];
    dotsElement.textContent = dots;

    // Change phrase every ~3 seconds (every 8-9 dot cycles)
    if (dotCount === 0) {
      dotCycles++;
      if (dotCycles >= 2) {
        phraseIndex = (phraseIndex + 1) % phrases.length;
        dotCycles = 0;
      }
    }
  }, 350);

  // Store interval ID so we can clear it later
  return interval;
}

function handleMessageResponse(response) {
  const submitBtn = document.getElementById("submitBtn");
  const input = document.getElementById("sampleSecond");

  if (chrome.runtime.lastError) {
    console.error("Error sending message:", chrome.runtime.lastError.message);
    alert("Error: " + chrome.runtime.lastError.message);
  } else {
    console.log("Message sent successfully:", response);

    // Clear the saved value
    chrome.storage.local.remove("targetTime");

    // Close after a short delay
    setTimeout(() => {
      // window.close();
    }, 800);
  }
}

function sendMessageToContentScript(tabs, targetTime) {
  console.log(tabs, targetTime, "ahh");
  chrome.tabs.sendMessage(
    tabs[0].id,
    {
      action: "setTargetTime",
      targetTime: targetTime,
    },
    handleMessageResponse,
  );
}

function onTargetTimeSaved(targetTime) {
  console.log("Target time saved:", targetTime, "seconds");
  console.log("Your winning time will be:", targetTime - 1, "seconds");

  // Send message to content script
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) =>
    sendMessageToContentScript(tabs, targetTime),
  );
}

function handleSubmitClick() {
  const input = document.getElementById("sampleSecond");
  const targetTime = parseFloat(input.value);

  if (isNaN(targetTime) || targetTime <= 0) {
    alert("Please enter a valid time in seconds");
    return;
  }

  // Show loading state
  showLoadingState(targetTime);

  // Save the target time
  chrome.storage.local.set({ targetTime: targetTime }, () =>
    onTargetTimeSaved(targetTime),
  );
}

function handleEnterKeyPress(event) {
  if (event.key === "Enter") {
    const submitBtn = document.getElementById("submitBtn");
    submitBtn.click();
  }
}

function checkIfOnMiniPage(tabs) {
  const body = document.body;
  const submitBtn = document.getElementById("submitBtn");
  const input = document.getElementById("sampleSecond");

  const currentTab = tabs[0];
  const isOnMiniPage =
    currentTab.url &&
    currentTab.url.includes("nytimes.com/crosswords/game/mini");

  if (!isOnMiniPage) {
    // Hide the form and show a message
    body.innerHTML = `
      <div style="padding: 20px; text-align: center; font-family: Georgia, serif;">
        <h2 style="font-size: 16px; margin-bottom: 10px; color: #121212; font-weight: 700;">Not on Mini Crossword</h2>
        <p style="font-size: 13px; color: #666; line-height: 1.5;">Navigate to the NYT Mini Crossword to use this extension.</p>
      </div>
    `;
    return;
  }

  // Load saved target time if it exists
  chrome.storage.local.get(["targetTime"], loadSavedTargetTime);

  // Set up event listeners
  submitBtn.addEventListener("click", handleSubmitClick);
  input.addEventListener("keypress", handleEnterKeyPress);
}

document.addEventListener("DOMContentLoaded", function initializePopup() {
  // Check if we're on the NYT Mini crossword page
  chrome.tabs.query({ active: true, currentWindow: true }, checkIfOnMiniPage);
});
