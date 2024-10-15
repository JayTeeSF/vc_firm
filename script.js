// Game state variables
let initialCapital = 500000;
let capital = initialCapital;
let firmValuation = 1000000;
let currentRound = 1;
let monitoringPortfolio = false;
let countdown = 30;
let currentTimer;
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
    closeInstructionsButton: document.getElementById('closeInstructions')
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
        activeCharts.push(renderChart('teamExperienceChart', `Team Experience: ${startup.teamExperience}/10`, startup.teamExperience, 10, '#28a745'));
        activeCharts.push(renderChart('financialsChart', `Financials: ${startup.financials}M`, startup.financials, undefined, startup.financials >= 0 ? '#ffc107' : '#dc3545'));
    } catch (error) {
        console.error("Error rendering charts:", error);
        alert("An error occurred while rendering the charts.");
    }
}

// Startup generation and chart display
function nextStartup() {
    try {
        if (capital > 0) {
            stopTimer();
            elements.investButton.disabled = false;
            elements.passButton.disabled = false;

            currentStartup = createRandomStartup();
            if (!currentStartup) {
                throw new GameError("Failed to generate startup data.", { round: currentRound });
            }

            renderAllCharts(currentStartup);
            clearPreviousInvestment();
            displayInvestmentRequest(currentStartup.investmentRequired);
            applyRandomNewsEvent();
            startTimer();
        } else {
            checkGameOver();
        }
    } catch (error) {
        console.error("Error during next startup:", error);
        alert("Something went wrong when loading the next startup. Please refresh or try again.");
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
    portfolioInstance.startups.forEach(startup => {
        const color = startup.financials >= startup.investedAmount * 100 ? 'blue' : (startup.financials <= 0 ? 'red' : 'black');
        const li = document.createElement('li');
        li.innerHTML = `<strong style="color: ${color}">${startup.name}</strong> - ${startup.sector} - Market Size: ${startup.marketSize}M, 
                        Team Experience: ${startup.teamExperience}/10, 
                        <strong>Financials: $${startup.financials.toLocaleString()}M</strong>, 
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

    elements.investButton.disabled = true;

    if (capital <= 0 && !monitoringPortfolio) {
        monitorPortfolio(); // Start monitoring portfolio when capital hits 0
        stopTimer();
    } else {
        nextStartup(); // Automatically move to the next startup
    }
}, 300)); // Debounced click event

// Monitor portfolio growth
function monitorPortfolio() {
    monitoringPortfolio = true;
    const monitorInterval = setInterval(() => {
        let allResolved = true;
        portfolioInstance.startups.forEach(startup => {
            const { investedAmount, teamExperience, financials } = startup;

            // Calculate growth factor with a higher chance of success for better teams
            let growthFactor = (Math.random() * 10 - 5); // Base random growth factor (-5 to 5)
            
            // Adjust growth based on team experience: higher experience teams tend to grow more positively
            const successChance = teamExperience / 10; // 9/10 = 90% chance of positive growth
            const growthAdjustment = Math.random() < successChance ? Math.random() * 5 : Math.random() * -5;

            // Combine growth factors (base growth + team experience bias)
            growthFactor += growthAdjustment;

            // Additional adjustment: teams near their goal grow even faster
            const nearGoalFactor = financials >= investedAmount * 10 ? 0.25 : (financials >= investedAmount * 50 ? 0.5 : 0);
            growthFactor += nearGoalFactor;

            // If the company hasn't yet reached 100x the investment, continue growing
            if (financials > 0 && financials < investedAmount * 100) {
                startup.financials += growthFactor;
                allResolved = false;
            } 
            // Company IPO or reached the goal of 100x return
            else if (financials >= investedAmount * 100) {
                capital += startup.financials;
                alert(`Unicorn! ${startup.name} returned 100x its investment!`);
            }
        });

        updatePortfolio();
        elements.capitalDisplay.innerText = `$${capital.toLocaleString()}K`;

        if (allResolved) {
            clearInterval(monitorInterval);
            handleEndOfRound();
        }
    }, 30); // Faster updates (in ms)
}

// End of round handling
function handleEndOfRound() {
    if (capital <= 0 && portfolioInstance.allFailed()) {
        alert("You lose: all your investments failed.");
    } else if (portfolioInstance.hasIPO()) {
        alert("You win!!! Your company successfully IPO'd.");
    } else {
        alert(`Round ${currentRound} is complete! Your new capital is $${capital.toLocaleString()}. Starting next round.`);
        currentRound++;
        monitoringPortfolio = false;
        elements.investButton.disabled = false;
        elements.passButton.disabled = false;
        nextStartup();
    }
}

// Timer-related timeout handler
function handleTimeout() {
    alert("Time's up! Moving to the next startup.");
    nextStartup();
}

// Event Listeners
elements.nextStartupButton.addEventListener('click', nextStartup);
elements.showInstructionsButton.addEventListener('click', () => {
    elements.instructionsModal.style.display = elements.instructionsModal.style.display === 'none' || elements.instructionsModal.style.display === '' ? 'flex' : 'none';
});
elements.closeInstructionsButton.addEventListener('click', () => elements.instructionsModal.style.display = 'none');

// Check for game over
function checkGameOver() {
    if (capital <= 0 && portfolioInstance.allFailed()) {
        alert("You lose: all your investments failed.");
    } else {
        elements.nextStartupButton.disabled = true;
        elements.investButton.disabled = true;
        elements.passButton.disabled = true;
    }
}
