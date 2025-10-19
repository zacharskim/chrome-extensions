console.log("Mini Minus One content script loaded");

// Convert timer text like "2:29" to seconds (149)
function convertTextToSecondsNum(timerText) {
  if (!timerText) return 0;

  const parts = timerText.trim().split(":");

  if (parts.length === 2) {
    // Format: "MM:SS"
    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);
    return minutes * 60 + seconds;
  } else if (parts.length === 1) {
    // Format: "SS" (just seconds)
    return parseInt(parts[0], 10);
  }

  return 0;
}

// Generate a random commit ID (similar to NYT's format like "wqb6or")
function generateCommitID() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Submit the puzzle with a PUT request
async function submitPuzzle(puzzleData, winningTime) {
  const cells = puzzleData.body[0].cells;
  const puzzleID = puzzleData.id;
  console.log(puzzleData.body[0], "ahh");

  const now = Math.floor(Date.now() / 1000);
  const openedTime = now - winningTime - 10; // Pretend we opened it a bit before we started
  const solvedTime = now;

  // Build the board cells array with timestamps
  // Timestamps should be relative to when the puzzle was opened, not absolute unix time
  const boardCells = cells.map((cell, index) => {
    if (!cell.answer) {
      return { blank: true };
    }
    // Spread out the timestamps across the solving time (relative seconds)
    const relativeTimestamp = Math.floor((winningTime * index) / cells.length);
    return {
      guess: cell.answer,
      timestamp: relativeTimestamp, // Should be like 4, 5, 6... not unix timestamp
    };
  });

  // Try to get userID from localStorage
  let userID = null;

  // Method 1: Check for localforage key with userID in the name
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes("localforage/") && key.includes("#")) {
        // Extract userID from key like "localforage/93997391#pendingCommits"
        const match = key.match(/localforage\/(\d+)#/);
        if (match) {
          userID = parseInt(match[1], 10);
          console.log("Found userID from localStorage key:", userID);
          break;
        }
      }
    }
  } catch (e) {
    console.warn("Error searching localStorage:", e);
  }

  // Method 2: Try nyt-a as fallback
  if (!userID) {
    try {
      const nytData = localStorage.getItem("nyt-a");
      if (nytData) {
        const parsed = JSON.parse(nytData);
        userID = parsed?.id;
      }
    } catch (e) {
      console.warn("Could not get userID from nyt-a:", e);
    }
  }

  if (!userID) {
    console.error("Could not find userID - submission might fail");
    return null;
  }

  console.log("Using userID:", userID);

  // Get deviceID (seems to be a consistent format)
  const deviceID = "dum4n6-web"; // This might need to be retrieved from somewhere

  const payload = {
    commits: [
      {
        autocheckEnabled: false,
        board: {
          cells: boardCells,
        },
        commitID: generateCommitID(),
        deviceID: deviceID,
        firsts: {
          checked: openedTime,
          cleared: openedTime,
          opened: openedTime,
          solved: solvedTime,
        },
        minGuessTime: openedTime,
        puzzleID: puzzleID,
        reset: false,
        solved: true,
        timerDiff: winningTime,
        timestamp: now,
        userID: userID,
      },
    ],
    now: now,
  };

  console.log("Submitting puzzle with payload:", payload);

  try {
    const response = await fetch(
      "https://www.nytimes.com/svc/crosswords/v6/game.json",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Include cookies for authentication
        body: JSON.stringify(payload),
      },
    );

    const result = await response.json();
    console.log("✅ Submit response:", result);
    return result;
  } catch (error) {
    console.error("❌ Error submitting puzzle:", error);
    return null;
  }
}

// Get the puzzle date from the page DOM
function getPuzzleDateFromDOM() {
  const dateElement = document.querySelector(".xwd__details--date");
  if (!dateElement) {
    console.warn("Could not find puzzle date in DOM");
    return null;
  }

  // Parse "Sunday, October 19, 2025" format
  const dateText = dateElement.textContent.trim();
  const parsedDate = new Date(dateText);

  if (isNaN(parsedDate.getTime())) {
    console.warn("Could not parse date:", dateText);
    return null;
  }

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// Fetch the puzzle data directly!
async function getPuzzleData() {
  // Try to get the date from the page first
  let dateStr = getPuzzleDateFromDOM();

  // Fallback to today's date if we can't find it
  if (!dateStr) {
    console.log("Using fallback date (today)");
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    dateStr = `${year}-${month}-${day}`;
  }

  const url = `https://www.nytimes.com/svc/crosswords/v6/puzzle/mini/${dateStr}.json`;

  console.log("Fetching puzzle data from:", url);

  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log("Puzzle data received:", data);
    return data;
  } catch (error) {
    console.error("Error fetching puzzle data:", error);
    return null;
  }
}

// Auto-fill the crossword with answers from puzzle data
function fillCrossword(puzzleData, skipLast = false) {
  if (
    !puzzleData ||
    !puzzleData.body ||
    !puzzleData.body[0] ||
    !puzzleData.body[0].cells
  ) {
    console.error("Invalid puzzle data structure");
    return false;
  }

  const cells = puzzleData.body[0].cells;
  console.log(`Filling ${cells.length} cells... skipLast=${skipLast}`);

  // Find the last non-empty cell index
  let lastCellIndex = -1;
  for (let i = cells.length - 1; i >= 0; i--) {
    if (cells[i].answer) {
      lastCellIndex = i;
      break;
    }
  }

  console.log(`Last non-empty cell index: ${lastCellIndex}`);

  cells.forEach((cell, index) => {
    // Skip empty cells (blocks)
    if (!cell.answer) {
      return;
    }

    // Skip the last cell if requested
    if (skipLast && index === lastCellIndex) {
      console.log(
        `⏭️ Skipping last cell ${index} (answer: "${cell.answer}") - will fill before submit`,
      );
      return;
    }

    // Find the corresponding cell in the DOM by ID
    const cellRect = document.getElementById(`cell-id-${index}`);
    if (!cellRect) {
      console.warn(`Could not find cell-id-${index}`);
      return;
    }

    // Find the parent <g> element
    const cellGroup = cellRect.closest("g.xwd__cell");
    if (!cellGroup) {
      console.warn(`Could not find parent group for cell ${index}`);
      return;
    }

    // Find the text element for the answer (second text element with larger font)
    const textElements = cellGroup.querySelectorAll(
      'text[text-anchor="middle"]',
    );
    if (textElements.length === 0) {
      console.warn(`Could not find text element for cell ${index}`);
      return;
    }

    const answerTextElement = textElements[0];

    // Set the answer
    answerTextElement.textContent = cell.answer;
    console.log(`Set cell ${index} to: ${cell.answer}`);
  });

  console.log(
    skipLast
      ? "✅ Crossword filled (except last cell)!"
      : "✅ Crossword filled!",
  );
  return { success: true, lastCellIndex };
}

// Fill just the last cell
function fillLastCell(puzzleData, cellIndex) {
  const cells = puzzleData.body[0].cells;
  const cell = cells[cellIndex];

  if (!cell || !cell.answer) {
    console.error("Invalid cell index or no answer");
    return false;
  }

  const cellRect = document.getElementById(`cell-id-${cellIndex}`);
  if (!cellRect) {
    console.error(`Could not find cell-id-${cellIndex}`);
    return false;
  }

  const cellGroup = cellRect.closest("g.xwd__cell");
  const textElements = cellGroup.querySelectorAll('text[text-anchor="middle"]');
  const answerTextElement = textElements[0];

  answerTextElement.textContent = cell.answer;
  console.log(`✅ Filled last cell ${cellIndex} with: ${cell.answer}`);
  return true;
}

// Don't auto-run on page load - user needs to manually trigger via popup

// Check if "Play" button exists and click it
function clickPlayButtonIfExists() {
  const playButton = document.querySelector(
    'button.pz-moment__button[aria-label="Play"]',
  );

  if (playButton) {
    console.log("Found 'Play' button, clicking it...");
    playButton.click();
    return true;
  }

  console.log("No 'Play' button found");
  return false;
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "setTargetTime") {
    const targetTime = request.targetTime;
    const winningTime = targetTime - 1;

    console.log("Received target time:", targetTime);
    console.log("Your winning time will be:", winningTime);

    // Check for and click the Play button if it exists
    const playButtonClicked = clickPlayButtonIfExists();

    // Wait a bit if we clicked the button, to let the puzzle load
    const delay = playButtonClicked ? 1000 : 0;

    setTimeout(() => {
      // Get the puzzle data with answers
      getPuzzleData().then((puzzleData) => {
        if (puzzleData) {
          console.log("Got puzzle data! Now auto-solving...");

          // Fill in the crossword (but skip the last cell)
          const result = fillCrossword(puzzleData, true);

          // Send response immediately
          sendResponse({
            success: result.success,
            winningTime: winningTime,
          });

          if (result.success) {
            console.log(
              "🎉 Crossword filled (except last)! Waiting for timer to reach:",
              winningTime,
            );

            // Watch the timer and submit when it reaches winningTime
            const timerElement = document.querySelector(".timer-count");

            if (!timerElement) {
              console.error("Could not find timer element");
              return;
            }

            // Poll the timer every 100ms
            const timerInterval = setInterval(() => {
              const currentTimeText = timerElement.textContent;
              const currentSeconds = convertTextToSecondsNum(currentTimeText);

              console.log(
                `Timer: ${currentTimeText} (${currentSeconds}s) | Target: ${winningTime}s`,
              );

              if (currentSeconds >= winningTime) {
                clearInterval(timerInterval);
                console.log("🎯 Target time reached! Filling last cell...");

                // Fill the last cell now
                fillLastCell(puzzleData, result.lastCellIndex);

                // Wait a tiny bit then send PUT request
                setTimeout(() => {
                  console.log("📤 Sending PUT request...");
                  submitPuzzle(puzzleData, winningTime);
                }, 100);
              }
            }, 100);
          }
        } else {
          sendResponse({
            success: false,
            error: "Could not fetch puzzle data",
          });
        }
      });
    }, delay);

    return true; // Keep the message channel open for async response
  }
  return true;
});
