const widget_container = document.getElementById("widget-container");
const stores = document.getElementsByClassName("store");
const score_element = document.getElementById("score");
const lawn_div = document.getElementById("lawn-simulator");

const PRICE_INCREASE_PERCENTAGE = 1.05; // 5%

let score = 5;
let super_gompei_count = 0;

let lawn_count = 0;
let gompei_count = 0;
let sup_gompei_count = 0;
let lawnMowerActive = false;
let autoBuyEnabled = false;

function autoBuyCheapest() {
    // Loop as long as auto-buy is on and we can afford something
    while (autoBuyEnabled) {
        let cheapestStore = null;
        let minCost = Infinity;

        // The 'stores' HTMLCollection is live, so it updates when the lawn mower is removed.
        for (const store of stores) {
            const cost = parseInt(store.getAttribute("cost"));
            if (score >= cost && cost < minCost) {
                minCost = cost;
                cheapestStore = store;
            }
        }

        if (cheapestStore) {
            buy(cheapestStore);
        } else {
            // If we can't afford anything, break the loop.
            break;
        }
    }
}

function changeScore(amount) {
    console.log(score);
    score += amount;
    score_element.innerHTML = `Score: ${score}`;
    //set score element

    // pulse effect
    if (amount > 0) {
        // Calculate a dynamic scale based on the score increase.
        // It starts at 1.1x and grows, but we cap it to prevent it from getting too large.
        const dynamicScale = 1.1 + Math.min(amount / (score + 200), 0.4); // Caps the bonus scale at +0.4 (total 1.5x)
        score_element.style.setProperty('--pulse-scale', dynamicScale);

        // This is the key to re-triggering the animation:
        // 1. Remove the class to reset the state.
        score_element.classList.remove("pulsing");

        // 2. Force a browser "reflow". Accessing offsetWidth makes the browser
        //    process the class removal before moving on.
        void score_element.offsetWidth;

        // 3. Re-add the class to start the animation again from the beginning.
        score_element.classList.add("pulsing");
    }

    // Update the stores to show ones that are too expensive
    for (let store of stores) {
        let cost = parseInt(store.getAttribute("cost"));

        if (score < cost) {
            store.setAttribute("broke", "");
        } else {
            store.removeAttribute("broke");
        }
    }

    // If score was increased (i.e. not from a purchase), check for auto-buy
    if (amount > 0) {
        autoBuyCheapest();
    }
}
function buy(store) {
    const cost = parseInt(store.getAttribute("cost"));

    if (score < cost) {
        return
    }

    changeScore(-cost)

    const storeName = store.getAttribute("name");

    // Handle Upgrades first
    if (storeName.includes("Upgrade")) {
        const targetName = store.getAttribute("target-name");
        const upgradeAmount = parseInt(store.getAttribute("upgrade-amount"));

        // Find original store item to update its template for future buys
        const originalStore = Array.from(stores).find(s => s.getAttribute("name") === targetName);
        if (originalStore) {
            const templateWidget = originalStore.querySelector('.widget');
            const currentReap = parseInt(templateWidget.getAttribute("reap"));
            const newReap = currentReap + upgradeAmount;
            templateWidget.setAttribute("reap", newReap);

            // Update the reap text on the original store item's display
            // The user specified the format is "+(N) sqft".
            const scoreTextParagraph = Array.from(originalStore.getElementsByTagName("p")).find(p => p.textContent.includes('sqft'));
            if (scoreTextParagraph) {
                // This specifically finds text like "+(1) sqft" and updates it.
                scoreTextParagraph.textContent = `+${newReap} sqft`;
            }
        }

        // Update all existing widgets of that type that are already on the field
        for (const widget of widget_container.children) {
            if (widget.getAttribute("data-type") === targetName) {
                const currentReap = parseInt(widget.getAttribute("reap"));
                widget.setAttribute("reap", currentReap + upgradeAmount);
            }
        }

        // Increase cost of the upgrade itself (make them get expensive faster)
        const newCost = Math.ceil(cost * 1.5);
        store.setAttribute("cost", newCost);
        const pElements = store.getElementsByTagName("p");
        for (const p of pElements) {
            if (p.textContent.includes("points")) {
                p.textContent = `${newCost} points`;
                break;
            }
        }
        return; // We are done, no widget is created for an upgrade purchase
    }

    // check available to buy
    // change score

    // Increase the cost for the next purchase for all items except the lawn mower
    if (store.getAttribute("name") !== "Lawn Mower") {
        const newCost = Math.ceil(cost * PRICE_INCREASE_PERCENTAGE);
        store.setAttribute("cost", newCost);
        const pElements = store.getElementsByTagName("p");
        for (const p of pElements) {
            if (p.textContent.includes("points")) {
                p.textContent = `${newCost} points`;
                break;
            }
        }
    }

    if (store.getAttribute("name") === "Super-Gompei") {
        super_gompei_count += 1;
        document.body.style.setProperty("--gompei-count", super_gompei_count);
        const super_gompei_widget = document.querySelector("#widget-container #super-gompei")?.parentElement;

        // If Super-Gompei already exists
        if (super_gompei_widget) {
            const reapToAdd = 100; // Each purchase adds 100 to the total.
            const newTotalReap = parseInt(super_gompei_widget.getAttribute("reap")) + reapToAdd;
            super_gompei_widget.setAttribute("reap", newTotalReap);

            // Also update the template in the store so the text reflects the new total
            const templateWidget = store.querySelector('.widget');
            templateWidget.setAttribute("reap", newTotalReap);

            // Now update the display text.
            const scoreTextParagraph = Array.from(store.getElementsByTagName("p")).find(p => p.textContent.includes('sqft'));
            if (scoreTextParagraph) {
                scoreTextParagraph.textContent = `+${newTotalReap} sqft`;
            }

        } else {
            const pastureGompei = document.createElement('img');
            // Correctly get the image source from the store's display widget
            pastureGompei.src = store.querySelector('.widget img').src;
            pastureGompei.className = 'pasture-supergompei';

            lawn_div.appendChild(pastureGompei);
        }
        // Make the Gompei on the lawn grow
        const pasture_gompei_img = document.querySelector(".pasture-supergompei");
        if (pasture_gompei_img) {
            const initialSize = 100; // The base size in pixels
            const maxSize = 500; // The maximum size the gompei will approach
            const growthFactor = 0.85; // Determines how quickly it approaches the max size (closer to 1 is slower)

            // The formula for asymptotic growth: newSize = L - (L - a) * (b^n)
            // Where L=maxSize, a=initialSize, b=growthFactor, n=purchases after the first
            // We use super_gompei_count - 1 because the first purchase (count=1) should be the base size (n=0).
            const purchases = super_gompei_count - 1;
            const newSize = maxSize - (maxSize - initialSize) * Math.pow(growthFactor, purchases);

            pasture_gompei_img.style.width = `${newSize}px`;
        }

        if (super_gompei_widget) {
            return;
        }
    }

    if (store.getAttribute("name") === "Lawn Mower") {
        lawnMowerActive = true;
        // This is a one-time purchase, so remove the store item
        store.remove();

        // Trigger an initial harvest for any lawns that are ready
        for (const widget of widget_container.children) {
            if (widget.getAttribute("auto") !== 'true' && !widget.querySelector("#super-gompei")) {
                // harvest() has a check for "harvesting", so this is safe
                harvest(widget);
            }
        }
        return;
    }

    if (store.getAttribute("name") === "Gompei") {
        const pastureGompei = document.createElement('img');
        // Correctly get the image source from the store's display widget
        pastureGompei.src = store.querySelector('.widget img').src;
        pastureGompei.className = 'pasture-gompei';

        // Get pasture dimensions to place the gompei inside
        const pastureRect = lawn_div.getBoundingClientRect();
        const gompeiSize = 50; // Must match the width in CSS

        // Calculate random position, ensuring it's within bounds
        const randomTop = Math.random() * (pastureRect.height - gompeiSize);
        const randomLeft = Math.random() * (pastureRect.width - gompeiSize);
        const randomRotation = Math.random() * 90 - 45;

        pastureGompei.style.top = `${randomTop}px`;
        pastureGompei.style.left = `${randomLeft}px`;
        pastureGompei.style.transform = `rotate(${randomRotation}deg)`;

        lawn_div.appendChild(pastureGompei);
        console.log(randomTop, randomLeft);
    }


    // clone node for widget, and add to container
    const widget = store.firstElementChild.cloneNode(true);
    widget.setAttribute('data-type', store.getAttribute("name"));
    widget.onclick = () => {
        if (widget.getAttribute("auto") != 'true') {
            harvest(widget, true);
        }
    }
    widget_container.appendChild(widget);

    // Start the first cooldown without generating points
    startCooldown(widget);
}

function startCooldown(widget) {
    // Set harvesting flag to start animation
    widget.setAttribute("harvesting", "");
    // Set timeout to end harvest
    setup_end_harvest(widget);
}

function setup_end_harvest(widget) {
    setTimeout(() => {
        // Remove the harvesting flag
        widget.removeAttribute("harvesting");
        // If automatic, start again and collect points
        if (widget.getAttribute("auto") == 'true') {
            harvest(widget);
        }
        // If lawn mower is active and this is a lawn plot, harvest it
        else if (lawnMowerActive && !widget.querySelector("#super-gompei")) {
            harvest(widget);
        }
    }, parseFloat(widget.getAttribute("cooldown")) * 1000);
}

function harvest(widget, is_manual_click = false) {
    // Only run if currently not harvesting
    if (widget.hasAttribute("harvesting")) {
        return;
    }

    // For all harvests (auto, manual click, lawnmower), give points.
    changeScore(parseInt(widget.getAttribute("reap")));
    showPoint(widget);

    // Then, start the cooldown period.
    startCooldown(widget);
}


function showPoint(widget) {
    let number = document.createElement("span");
    number.className = "point";
    number.innerHTML = "+" + widget.getAttribute("reap");
    widget.appendChild(number);
    number.onanimationend = () => {
        number.remove();
    }
}


// ==================================================
// STORE INITIALIZATION
// ==================================================

const storeItemDefinitions = [
    { name: "Lawn", cost: 5, reap: 2, cooldown: 0.5, auto: false, image: './grass.jpeg', description: "+2 sqft" },
    { name: "Gompei", cost: 15, reap: 10, cooldown: 2.0, auto: true, image: './gompei.png', description: "+10 sqft" },
    { name: "Super-Gompei", cost: 150, reap: 100, cooldown: 5.0, auto: true, image: './gompei.png', id: 'super-gompei', description: "+100 sqft" },
    { name: "Lawn Mower", cost: 300, image: './lawn-mower.png', oneTime: true, description: "Auto-harvests lawns" },
    { name: "Lawn Upgrade", cost: 500, image: './grass.jpeg', type: 'upgrade', targetName: 'Lawn', upgradeAmount: 1, description: "+1 reap to Lawns" },
    { name: "Gompei Upgrade", cost: 1000, image: './gompei.png', type: 'upgrade', targetName: 'Gompei', upgradeAmount: 5, description: "+5 reap to Gompeis" }
];

function createStoreItemElement(item) {
    const storeItem = document.createElement('div');
    storeItem.className = 'store';
    storeItem.setAttribute('name', item.name);
    storeItem.setAttribute('cost', item.cost);

    if (item.type === 'upgrade') {
        storeItem.setAttribute('target-name', item.targetName);
        storeItem.setAttribute('upgrade-amount', item.upgradeAmount);
    }

    // The display inside the store. For regular items, this is also the template to be cloned.
    const displayWidget = document.createElement('div');
    displayWidget.className = 'widget';

    if (!item.oneTime && item.type !== 'upgrade') {
        // It's a clonable item, so the display widget needs all the data attributes
        displayWidget.setAttribute('reap', item.reap);
        displayWidget.setAttribute('cooldown', item.cooldown);
        displayWidget.setAttribute('auto', String(item.auto));
        displayWidget.setAttribute('name', item.name);
    }

    const img = document.createElement('img');
    img.src = item.image;
    img.alt = item.name;
    if (item.id) {
        img.id = item.id;
    }
    // Apply consistent styling for the image within the widget
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    displayWidget.appendChild(img);

    // Add overlay for clonable items for the cooldown animation
    if (!item.oneTime && item.type !== 'upgrade') {
        const overlay = document.createElement('div');
        overlay.className = 'overlay-slide';
        overlay.style.animationDuration = item.cooldown + 's';
        displayWidget.appendChild(overlay);
    }

    storeItem.appendChild(displayWidget);

    // Add text descriptions
    const nameP = document.createElement('p');
    nameP.textContent = item.name;
    storeItem.appendChild(nameP);

    const costP = document.createElement('p');
    costP.textContent = `${item.cost} points`;
    storeItem.appendChild(costP);

    if (item.description) {
        const descP = document.createElement('p');
        descP.textContent = item.description;
        storeItem.appendChild(descP);
    }

    if (item.cooldown) {
        const cooldownP = document.createElement('p');
        cooldownP.textContent = `${item.cooldown}s`;
        storeItem.appendChild(cooldownP);
    }

    // Attach event listeners for speed buy
    storeItem.onmousedown = function () { startSpeedBuy(this); };
    storeItem.onmouseup = stopSpeedBuy;
    storeItem.onmouseleave = stopSpeedBuy;

    return storeItem;
}

function initializeStore() {
    const storeContainer = document.getElementById('store-container');
    storeContainer.innerHTML = ''; // Clear any hardcoded store items
    storeItemDefinitions.forEach(itemData => {
        const storeItemElement = createStoreItemElement(itemData);
        storeContainer.appendChild(storeItemElement);
    });
}

// Speed buy functionality
let speedBuyTimeout = null;
let speedBuyInterval = null;

function startSpeedBuy(store) {
    // Prevent multiple triggers
    if (speedBuyTimeout || speedBuyInterval) return;

    // Buy once immediately
    buy(store);

    // Set a timeout to start the interval buying
    speedBuyTimeout = setTimeout(() => {
        speedBuyInterval = setInterval(() => {
            buy(store);
        }, 100); // Buy rapidly
    }, 150); // Wait 150ms before starting to speed buy
}

function stopSpeedBuy() {
    clearTimeout(speedBuyTimeout);
    clearInterval(speedBuyInterval);
    speedBuyTimeout = null;
    speedBuyInterval = null;
}

// Auto-buy button creation
function createAutoBuyButton() {
    const autoBuyButton = document.createElement('button');
    autoBuyButton.id = 'auto-buy-toggle';
    autoBuyButton.textContent = 'Auto-Buy: OFF';
    autoBuyButton.title = 'When ON, automatically buys the cheapest available item.';

    const storeContainer = document.getElementById('store-container');
    storeContainer.appendChild(autoBuyButton);

    autoBuyButton.addEventListener('click', () => {
        autoBuyEnabled = !autoBuyEnabled;
        autoBuyButton.textContent = `Auto-Buy: ${autoBuyEnabled ? 'ON' : 'OFF'}`;
        autoBuyButton.classList.toggle('active', autoBuyEnabled);
        if (autoBuyEnabled) {
            // Immediately check if we can buy something
            autoBuyCheapest();
        }
    });
}

// Initial game setup
initializeStore();
createAutoBuyButton();
changeScore(0); // Initial call to set store availability