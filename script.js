// Game state variables
let initialCapital = 500000;
let capital = initialCapital;
let firmValuation = 1000000;
let currentRound = 1;
let monitoringPortfolio = false;
let countdown = 30;
let currentTimer;
let portfolioTimer; // New timer for monitoring portfolio separately
let gameStarted = false;
let portfolio = [];
let activeCharts = [];
let currentStartup;
let startupNames = new Set(); // Store unique startup names

// Data structure for financials by round (Series-A, B, C, etc.)
const seriesRounds = {
    'Series-A': { minInvestment: 50000, maxInvestment: 250000, targetMultiplier: 10 },
    'Series-B': { minInvestment: 200000, maxInvestment: 1000000, targetMultiplier: 10 },
    'Series-C': { minInvestment: 1000000, maxInvestment: 5000000, targetMultiplier: 100 }
};

const sectors = ['Tech', 'Healthcare', 'Energy', 'Finance', 'Retail'];
const newsMessages = [
    { message: "Tech boom! Positive news in the tech sector boosts financials by 20%", sector: "Tech", change: 0.2 },
    { message: "Healthcare breakthrough! A big win for healthcare companies.", sector: "Healthcare", change: 0.15 },
    { message: "Energy crisis! Energy sector companies hit by rising costs.", sector: "Energy", change: -0.2 },
    { message: "Finance shake-up! Regulation changes hurt finance sector companies.", sector: "Finance", change: -0.15 },
    { message: "Retail renaissance! Retail is back with strong consumer spending.", sector: "Retail", change: 0.1 }
];

// DOM Elements
const elements = {
    capitalDisplay: document.getElementById('capital'),
    valuationDisplay: document.getElementById('firmValuation'),
    portfolioList: document.getElementById('portfolio-list'),
    timeLeftDisplay: document.getElementById('timeLeft'),
    nextStartupButton: document.getElementById('nextStartup'),
    investButton: document.getElementById('invest'),
    passButton: document.getElementById('pass'),
    newsSection: document.getElementById('news-list'),
    instructionsModal: document.getElementById('instructions-modal'),
    showInstructionsButton: document.getElementById('showInstructions'),
    startButton: document.getElementById('startButton') // Start button element
};

// GameError for better error handling
class GameError extends Error {
    constructor(message, details) {
        super(message);
        this.details = details;
    }
}

// Startup class for managing startup data
class Startup {
    constructor(name, sector, investmentRequired, marketSize, teamExperience, financials, goal) {
        this.name = name;
        this.sector = sector;
        this.investmentRequired = investmentRequired;
        this.marketSize = marketSize;
        this.teamExperience = teamExperience;
        this.financials = financials;
        this.goal = goal;
    }

    updateFinancials(change) {
        this.financials += this.financials * change;
    }

    isSuccessful() {
        return this.financials >= this.goal;
    }
}

// Portfolio class to manage a player's investments
class Portfolio {
    constructor() {
        this.startups = [];
    }

    addStartup(startup) {
        this.startups.push(startup);
    }

    updateFinancials(sector, change) {
        this.startups.forEach(startup => {
            if (startup instanceof Startup && startup.sector === sector) {
                startup.updateFinancials(change);
            }
        });
    }

    allFailed() {
        return this.startups.every(startup => startup.financials <= 0);
    }

    hasIPO() {
        return this.startups.some(startup => startup.financials >= startup.goal);
    }
}

// Global portfolio object
const portfolioInstance = new Portfolio();

// Utility functions
function debounce(func, delay) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

function throttle(func, limit) {
    let lastFunc;
    let lastRan;
    return function (...args) {
        if (!lastRan) {
            func.apply(this, args);
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(() => {
                if ((Date.now() - lastRan) >= limit) {
                    func.apply(this, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    };
}

// Function to generate a unique startup name
function generateUniqueStartupName() {
    const namePrefixes = ['Acme', 'Zephyr', 'Solara', 'Nimbus', 'Orion'];
    const nameSuffixes = ['Industries', 'Labs', 'Ventures', 'Enterprises', 'Solutions'];
    let name;

    do {
        name = `${namePrefixes[Math.floor(Math.random() * namePrefixes.length)]} ${nameSuffixes[Math.floor(Math.random() * nameSuffixes.length)]}`;
    } while (startupNames.has(name)); // Ensure uniqueness

    startupNames.add(name);
    return name;
}

// Chart rendering functions
function renderChart(elementId, label, data, maxValue, backgroundColor) {
    const ctx = document.getElementById(elementId).getContext('2d');
    return new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [label],
            datasets: [{
                label: label,
                data: [data],
                backgroundColor: [backgroundColor]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: maxValue || data + 10,
                    ticks: { font: { size: 36 } }
                },
                x: { ticks: { font: { size: 36 } } }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    titleFont: { size: 36 },
                    bodyFont: { size: 36 }
                }
            }
        }
    });
}

function renderAllCharts(startup) {
    try {
        if (activeCharts.length) {
            activeCharts.forEach(chart => chart.destroy());
            activeCharts = [];
        }
        activeCharts.push(renderChart('marketSizeChart', `Market Size: ${startup.marketSize}M`, startup.marketSize, 1000, '#007bff'));
        activeCharts.push(renderChart('teamExperienceChart', `Team: ${startup.teamExperience}/10`, startup.teamExperience, 10, '#28a745'));
        activeCharts.push(renderChart('financialsChart', `Financials: ${startup.financials}M`, startup.financials, undefined, startup.financials >= 0 ? '#ffc107' : '#dc3545'));
    } catch (error) {
        console.error("Error rendering charts:", error);
        alert("An error occurred while rendering the charts.");
    }
}

// Timer-related timeout handler for pitch
function handleTimeout() {
    alert("Time's up! Moving to the next startup.");
    nextStartup();
}

// Enable and disable buttons based on game flow
function enableButtons() {
    elements.investButton.disabled = false;
    elements.passButton.disabled = false;
    elements.nextStartupButton.disabled = false; // Enable next startup button as well
}

function disableButtons() {
    elements.investButton.disabled = true;
    elements.passButton.disabled = true;
    elements.nextStartupButton.disabled = true; // Disable next startup button as well
}

// Startup generation and chart display Refactored the startup flow to ensure the button state is consistent
function nextStartup() {
  try {
    console.log('Starting nextStartup function. Current capital:', capital); // Added log

    if (capital > 0) {
      stopTimer();
      enableButtons(); // Re-enable buttons only when necessary

      // Only clear currentStartup AFTER rendering or when moving on to the next one
      if (currentStartup) {
        console.log('Clearing previous startup reference.');
      }

      currentStartup = createRandomStartup();
      if (!currentStartup) {
        throw new GameError('Failed to generate startup data.', { round: currentRound });
      }
      console.log('New startup generated:', currentStartup); // Added log

      renderAllCharts(currentStartup); // Renders charts
      clearPreviousInvestment(); // Safe to call after charts are rendered
      displayInvestmentRequest(currentStartup.investmentRequired); // Ensure investmentRequired is accessed safely
      applyRandomNewsEvent();
      startTimer();
    } else {
      console.log('No capital left, checking for game over.'); // Added log
      checkGameOver(); // Capital is 0, we check if game is over
    }
  } catch (error) {
    console.error('Error during next startup:', error);
    alert('Something went wrong when loading the next startup. Please refresh or try again.');
    disableButtons(); // Ensure buttons are disabled on failure to prevent multiple clicks
  }
}

function createRandomStartup() {
    const seriesRound = seriesRounds[`Series-${String.fromCharCode(64 + currentRound)}`];
    if (!seriesRound) throw new GameError("Invalid series round data", { currentRound });

    const sector = sectors[Math.floor(Math.random() * sectors.length)];
    const name = generateUniqueStartupName();
    const baseInvestment = Math.floor(Math.random() * (seriesRound.maxInvestment - seriesRound.minInvestment)) + seriesRound.minInvestment;

    return new Startup(
        name,
        sector,
        baseInvestment,
        Math.floor(Math.random() * 1000),
        Math.floor(Math.random() * 10) + 1,
        Math.floor(Math.random() * 100) - 50,
        baseInvestment * seriesRound.targetMultiplier
    );
}

// Display requested investment and clear previous
function displayInvestmentRequest(investment) {
    const investmentPitch = document.createElement('p');
    investmentPitch.id = 'investmentPitch';
    investmentPitch.innerText = `Requested Investment: $${investment.toLocaleString()} - Target: ${currentStartup.goal.toLocaleString()}M`;
    document.getElementById('startup-container').appendChild(investmentPitch);
}

function clearPreviousInvestment() {
  const prevInvestment = document.getElementById('investmentPitch');
  if (prevInvestment) prevInvestment.remove();

  // Do not set currentStartup to null here as it is still being processed
  // Removing this ensures that currentStartup remains valid during the entire flow.
  console.log('Cleared previous investment pitch.');
}

// Apply random news event
function applyRandomNewsEvent() {
    const randomEvent = newsMessages[Math.floor(Math.random() * newsMessages.length)];
    elements.newsSection.innerText = randomEvent.message;

    portfolioInstance.updateFinancials(randomEvent.sector, randomEvent.change);
    updatePortfolio();
}

// Portfolio updates and display
function updatePortfolio() {
  elements.portfolioList.innerHTML = '';
  portfolioInstance.startups.forEach((startup) => {
    const color = startup.financials >= startup.investedAmount * 100 ? 'blue' : (startup.financials <= 0 ? 'red' : 'black');
    const li = document.createElement('li');
    li.innerHTML = `<strong style="color: ${color}">${startup.name}</strong> - ${startup.sector} - Market Size: ${startup.marketSize}M, 
                    Team: ${startup.teamExperience}/10, 
                    <strong>Financials: $${startup.financials.toLocaleString()}M (Goal: $${startup.goal.toLocaleString()}M)</strong>, 
                    Invested: $${startup.investedAmount.toLocaleString()}`;
    elements.portfolioList.appendChild(li);
  });
}

// Timer management
function startTimer() {
    if (currentTimer) clearInterval(currentTimer); // Clear any existing timers
    countdown = 30;
    elements.timeLeftDisplay.innerText = countdown;

    currentTimer = setInterval(() => {
        countdown--;
        elements.timeLeftDisplay.innerText = countdown;
        if (countdown <= 0) {
            clearInterval(currentTimer);
            handleTimeout();
        }
    }, 1000);
}

function stopTimer() {
    clearInterval(currentTimer);
}

// Handle investments and button click
elements.investButton.addEventListener('click', debounce(() => {
    let investAmount = currentStartup.investmentRequired;

    if (capital <= 0) {
        alert("You don't have any capital left to invest!");
        return;
    }

    if (capital < investAmount) {
        investAmount = capital; // Partial investment if not enough capital
        alert(`Partial investment! You invested $${investAmount.toLocaleString()} in this startup!`);
    } else {
        alert(`You invested $${investAmount.toLocaleString()} in this startup!`);
    }

    portfolioInstance.addStartup({ ...currentStartup, investedAmount: investAmount });
    capital -= investAmount;
    elements.capitalDisplay.innerText = `$${capital.toLocaleString()}K`;

    disableButtons();

    if (capital <= 0 && !monitoringPortfolio) {
        monitorPortfolio(); // Start monitoring portfolio when capital hits 0
    } else {
        nextStartup(); // Automatically move to the next startup
    }
}, 300)); // Debounced click event

// Monitor portfolio growth with fast updates and final resolution after 30 seconds
function monitorPortfolio() {
    monitoringPortfolio = true;
    const fastInterval = 30;  // Interval of 30ms for fast updates
    let monitorCountdown = 1000;  // Countdown to represent 30 seconds (1000 iterations of 30ms)

    const monitorInterval = setInterval(() => {
        let allResolved = true;

        portfolioInstance.startups.forEach(startup => {
            const { investedAmount, teamExperience, financials, goal } = startup;

            // Calculate growth factor with a higher chance of success for better teams
            let growthFactor = (Math.random() * 10 - 5);  // Base random growth factor (-5 to 5)
            const successChance = teamExperience / 10;  // Chance of success based on team experience
            const growthAdjustment = Math.random() < successChance ? Math.random() * 5 : Math.random() * -5;
            growthFactor += growthAdjustment;

            const progressThreshold = 0.10;  // 10% of the target goal for early success

            // Early resolution (within 20 seconds): If financials are near goal, mark as successful
            if (monitorCountdown <= 600 && financials / goal >= progressThreshold) {
                startup.financials = goal;
                capital += startup.financials;
                alert(`${startup.name} reached its target quickly!`);
            }

            // Continue to update financials dynamically until the final resolution
            if (financials > 0 && financials < investedAmount * 100) {
                startup.financials += growthFactor;
                allResolved = false;
            } else if (financials >= investedAmount * 100) {
                capital += startup.financials;
                alert(`Unicorn! ${startup.name} returned 100x its investment!`);
            }
        });

        // Update the portfolio visually and update capital display
        updatePortfolio();

        // Countdown mechanism to transition to final resolution after 1000 iterations (30 seconds)
        monitorCountdown--;
        if (monitorCountdown <= 0) {
            clearInterval(monitorInterval);  // Stop the fast updates
            resolveRemainingPortfolio();  // Move to final resolution of remaining startups
        }

    }, fastInterval);  // Fast updates every 30ms
}

// Resolve remaining companies after 30-second monitoring period
function resolveRemainingPortfolio() {
    portfolioInstance.startups.forEach(startup => {
        const { financials, goal } = startup;

        // Final resolution: Check if company is within 10% of its goal
        const nearGoalThreshold = 0.10;
        if (financials / goal >= nearGoalThreshold) {
            startup.financials = goal;
            capital += startup.financials;
            alert(`${startup.name} reached its target successfully!`);
        } else {
            // Final 30% chance of random success
            if (Math.random() < 0.3) {
                startup.financials = goal;
                capital += startup.financials;
                alert(`${startup.name} succeeded randomly!`);
            } else {
                startup.financials = 0;
                alert(`${startup.name} failed to reach its target.`);
            }
        }
    });

    // After resolving all startups, update portfolio and handle end of round
    updatePortfolio();
    handleEndOfRound();
}

// Function to check game over and handle end of round logic
function checkGameOver() {
  if (capital <= 0 && portfolioInstance.allFailed()) {
    alert('Game Over! You have no capital left and all your investments failed.');
    disableButtons();  // Disable buttons since the game is over
  } else if (portfolioInstance.hasIPO()) {
    alert("You win!!! Your company successfully IPO'd.");
    disableButtons();  // Disable buttons since the game is over
  } else {
    console.log('Function. Current capital:', capital);
    // Refill capital from successful investments and move to next round
    alert(`Round ${currentRound} is complete! Your new capital is $${capital.toLocaleString()}. Starting next round.`);
    currentRound += 1;
    monitoringPortfolio = false;
    portfolioInstance.startups = [];
    enableButtons(); // Re-enable buttons for the next round
    nextStartup();
  }
}

// End of round handling
function handleEndOfRound() {
    if (capital <= 0 && portfolioInstance.allFailed()) {
        alert("You lose: all your investments failed.");
        disableButtons(); // Disable all buttons since the game is over
    } else if (portfolioInstance.hasIPO()) {
        alert("You win!!! Your company successfully IPO'd.");
        disableButtons(); // Disable all buttons since the game is over
    } else {
        alert(`Round ${currentRound} is complete! Your new capital is $${capital.toLocaleString()}. Starting next round.`);
        currentRound++;
        monitoringPortfolio = false;
        portfolioInstance.startups = [];
        enableButtons(); // Re-enable buttons for the next round
        nextStartup(); // Proceed to the next startup
    }
}

// Ensure Start button is always visible, and triggers the first pitch
elements.startButton.addEventListener('click', () => {
    if (gameStarted) {
        const confirmReset = confirm("Are you sure you want to reset the game?");
        if (confirmReset) {
            resetGame();
        }
    } else {
        startGame();
    }
});

// Function to reset the game state
function resetGame() {
  capital = initialCapital;
  firmValuation = 1000000;
  currentRound = 1;
  portfolio = [];
  monitoringPortfolio = false;
  gameStarted = false;
  elements.capitalDisplay.innerText = `$${capital.toLocaleString()}K`;
  elements.valuationDisplay.innerText = '$1M';
  elements.portfolioList.innerHTML = '';
  elements.newsSection.innerText = '';
  elements.startButton.innerText = 'Start Game';
  stopTimer();  // Stop any running timer
  disableButtons();  // Disable buttons until game is started
}

// Function to start the game
function startGame() {
  gameStarted = true;
  elements.startButton.innerText = "Next Game";
  nextStartup();  // Start first startup pitch
}

// Handle "Pass" button functionality
elements.passButton.addEventListener('click', debounce(() => {
  alert('You passed on this startup.');

  // Free the reference to the current startup
  currentStartup = null;

  disableButtons();  // Disable buttons after making a decision
  nextStartup();  // Move to the next startup
}, 300)); // Debounced click event

// Handle "Next Startup" button functionality
elements.nextStartupButton.addEventListener('click', () => {
  console.log('Pitching nextStartup');
  if (capital > 0) {
    nextStartup();  // Trigger next startup only if capital is available
  } else {
    checkGameOver();  // Check if the game is over if capital is zero
  }
});

// Handle "Show Instructions" button toggle functionality
elements.showInstructionsButton.addEventListener('click', () => {
  // Check if the modal is currently visible, and toggle its visibility
  if (elements.instructionsModal.style.display === 'block') {
    elements.instructionsModal.style.display = 'none';  // Hide if visible
  } else {
    elements.instructionsModal.style.display = 'block'; // Show if hidden
  }
});
