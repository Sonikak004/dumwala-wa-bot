const venom = require('venom-bot');
const fs = require('fs');

venom
  .create({
    session: 'dumwala-session',
    headless: false,
    useChrome: false,
    disableSpins: true,
    disableWelcome: true,
    logQR: true,
    browserArgs: ['--no-sandbox'],
    puppeteerOptions: {
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  })
  .then(client => start(client))
  .catch(error => console.error('Error starting venom:', error));

let userStates = {};
const synonyms = {
  'order biryani': '1',
  'view menu': '2',
  'contact support': '3',
  'chicken': '1',
  'mutton': '2',
  'paneer': '3',
  'back': '4',
  'gulab jamun': '1',
  'kabab': '2',
  'eggs': '3',
  'no addons': '4',
  'next 4–6 hours': '1',
  'next day': '2',
  'custom': '3',
  'yes': '1',
  'no': '2',
  'speak to us': '3'
};

function normalizeInput(text) {
  const cleaned = text.toLowerCase().trim();
  return synonyms[cleaned] || cleaned;
}

function getAvailableSlots() {
  const now = new Date();
  const currentHour = now.getHours();
  const slots = [];
  for (let i = 4; i <= 7; i++) {
    let slotHour = currentHour + i;
    if (slotHour > 22) break; // Cap at 10 PM
    let hour12 = slotHour % 12 || 12;
    let ampm = slotHour >= 12 ? 'PM' : 'AM';
    slots.push(`${hour12} ${ampm}`);
  }
  return slots;
}

function start(client) {
  console.log('✅ Dumwala Bot is running!');

  client.onMessage(async message => {
    const from = message.from;
    let text = (message.body || '').toLowerCase().trim();

    // Reset state if user clears chat (simulate by 'hi', 'hello', or any greeting)
    if (!userStates[from] || ['hi', 'hello', 'start', 'restart', 'menu'].includes(text)) {
      userStates[from] = { stage: 'main' };
      return sendMainMenu(client, from);
    }

    text = normalizeInput(text);
    const state = userStates[from];

    switch (state.stage) {
      case 'main':
        if (text === '1') {
          state.stage = 'choose-biryani';
          return client.sendText(from,
            `🔥 Choose your *3.5kg Bucket Biryani*:\n\n🍗 1. Chicken – ₹1299\n🥩 2. Mutton – ₹2099\n🧀 3. Paneer – ₹1499\n4️⃣ Back`
          );
        } else if (text === '2') {
          return client.sendText(from,
            `🧾 *Dumwala Bucket Menu (3.5kg)*\n(Serves 6–7 people)\n\n🍗 Chicken – ₹1299\n🥩 Mutton – ₹2099\n🧀 Paneer – ₹1499\n\n➕ *Add-ons:* (Each for 6–7)\n🍬 Gulab Jamun – ₹70\n🍢 Kabab (500g) – ₹249\n🥚 Eggs – ₹70\n\nType *1* to go back 🔙`
          );
        } else if (text === '3') {
          state.stage = 'support-phone';
          return client.sendText(from, `☎️ Please share your *10-digit phone number*. Our team will call you back.`);
        } else {
          // Unknown input resets to main menu
          userStates[from] = { stage: 'main' };
          return sendMainMenu(client, from);
        }

      case 'choose-biryani':
        if (['1', '2', '3'].includes(text)) {
          const biryaniTypes = {
            '1': { name: 'Chicken Biryani 🍗 – ₹1299', price: 1299 },
            '2': { name: 'Mutton Biryani 🥩 – ₹2099', price: 2099 },
            '3': { name: 'Paneer Biryani 🧀 – ₹1499', price: 1499 }
          };
          const selected = biryaniTypes[text];
          state.biryani = selected.name;
          state.price = selected.price;
          state.stage = 'choose-style';

          if (text === '3') {
            // Paneer no styles, go straight to quantity
            state.stage = 'quantity';
            return client.sendText(from, `🧤 How many *buckets* would you like?`);
          } else {
            return client.sendText(from,
              `Pick a style:\n1️⃣ Hyderabadi\n2️⃣ Ambur\n3️⃣ Donne\n4️⃣ Thalapakatti`
            );
          }
        } else if (text === '4') {
          state.stage = 'main';
          return sendMainMenu(client, from);
        } else {
          return client.sendText(from, `❗Please choose 1–4`);
        }

      case 'choose-style':
        const styles = ['Hyderabadi', 'Ambur', 'Donne', 'Thalapakatti'];
        const idx = parseInt(text);
        if (idx >= 1 && idx <= 4) {
          const style = styles[idx - 1];
          state.biryani = `${style} ${state.biryani}`;
          state.stage = 'quantity';
          return client.sendText(from, `🧤 How many *buckets* would you like?`);
        } else {
          return client.sendText(from, `❗Pick from 1–4.`);
        }

      case 'quantity':
        const quantity = parseInt(text);
        if (isNaN(quantity) || quantity <= 0) {
          return client.sendText(from, `❗Please enter a valid number.`);
        }
        state.quantity = quantity;
        if (quantity >= 5) {
          state.stage = 'confirm-quantity';
          return client.sendText(from,
            `😲 That's quite a feast! Just confirming—*${quantity} buckets*, right?\n\nType *yes* to continue or *no* to start over.`
          );
        } else {
          state.stage = 'addons';
          return client.sendText(from,
            `Would you like any *Add-ons*?\n\n1️⃣ Gulab Jamun – ₹70\n2️⃣ Kabab (500g) – ₹249\n3️⃣ Eggs – ₹70\n4️⃣ No Add-ons\n\n(You can type multiple e.g. 1,2)`
          );
        }

      case 'confirm-quantity':
        if (text === '1') { // yes
          state.stage = 'addons';
          return client.sendText(from,
            `Sweet! Pick your *Add-ons*:\n\n1️⃣ Gulab Jamun – ₹70\n2️⃣ Kabab (500g) – ₹249\n3️⃣ Eggs – ₹70\n4️⃣ No Add-ons\n\n(You can type multiple e.g. 1,3)`
          );
        } else if (text === '2') { // no
          state.stage = 'main';
          return sendMainMenu(client, from);
        } else {
          return client.sendText(from, `❗Type yes (1) or no (2).`);
        }

      case 'addons':
        const prices = {
          '1': { name: 'Gulab Jamun 🍬 (for 7 people)', price: 70 },
          '2': { name: 'Kabab 🍢 (500g)', price: 249 },
          '3': { name: 'Eggs 🥚 (for 7 people)', price: 70 }
        };
        if (text === '4') {
          state.addons = [];
        } else {
          state.addons = text.split(',').map(i => prices[i.trim()]).filter(Boolean);
        }
        state.stage = 'delivery-options';

        // Show delivery option menu
        return client.sendText(from,
          `📦 Delivery options:\n1️⃣ Today (Choose a slot)\n2️⃣ Tomorrow (Choose time)\n3️⃣ Other Date (Enter date & time)`
        );

      case 'delivery-options':
        if (text === '1') {
          // Show slots for today, based on current time + 4 to 7 hours capped at 10PM
          const slots = getAvailableSlots();
          if (slots.length === 0) {
            // No slots available today, ask for tomorrow
            state.stage = 'delivery-options';
            return client.sendText(from, `Sorry, no slots available today. Please choose:\n2️⃣ Tomorrow\n3️⃣ Other Date`);
          }
          state.stage = 'choose-today-slot';
          state.availableSlots = slots;
          return client.sendText(from,
            `Available delivery slots today:\n${slots.map((s, i) => `${i + 1}️⃣ ${s}`).join('\n')}\n\nChoose a slot (1-${slots.length}):`
          );
        } else if (text === '2') {
          state.stage = 'tomorrow-time';
          const tomorrow = new Date(Date.now() + 86400000);
          state.deliveryDate = tomorrow.toLocaleDateString('en-GB');
          return client.sendText(from, `⏰ Please enter your preferred delivery time tomorrow (e.g., 6 PM):`);
        } else if (text === '3') {
          state.stage = 'other-date';
          return client.sendText(from, `📅 Please enter delivery date (DD/MM/YYYY):`);
        } else {
          return client.sendText(from, `❗Choose 1, 2, or 3.`);
        }

      case 'choose-today-slot':
        const slotIndex = parseInt(text) - 1;
        if (!state.availableSlots || slotIndex < 0 || slotIndex >= state.availableSlots.length) {
          return client.sendText(from, `❗Invalid choice. Pick a slot number from 1 to ${state.availableSlots ? state.availableSlots.length : 0}.`);
        }
        state.deliveryDate = new Date().toLocaleDateString('en-GB');
        state.deliverySlot = state.availableSlots[slotIndex];
        state.stage = 'location';
        return client.sendText(from, `📍 Please enter your delivery location:`);

      case 'tomorrow-time':
        if (!text) {
          return client.sendText(from, `❗Please enter a valid time (e.g., 6 PM).`);
        }
        state.deliverySlot = text;
        state.stage = 'location';
        return client.sendText(from, `📍 Please enter your delivery location:`);

      case 'other-date':
        // Expect date DD/MM/YYYY
        if (!/^(\d{2})\/(\d{2})\/(\d{4})$/.test(text)) {
          return client.sendText(from, `❗Please enter date in DD/MM/YYYY format.`);
        }
        state.deliveryDate = text;
        state.stage = 'other-time';
        return client.sendText(from, `⏰ Please enter preferred delivery time (e.g., 6 PM):`);

      case 'other-time':
        if (!text) {
          return client.sendText(from, `❗Please enter a valid time (e.g., 6 PM).`);
        }
        state.deliverySlot = text;
        state.stage = 'location';
        return client.sendText(from, `📍 Please enter your delivery location:`);

      case 'location':
        if (!text) {
          return client.sendText(from, `❗Please enter a delivery location.`);
        }
        state.location = text;
        const baseCost = state.price * state.quantity;
        const addonCost = (state.addons || []).reduce((sum, a) => sum + a.price, 0);
        const totalCost = baseCost + addonCost;

        state.stage = 'pre-confirm';

        // IMPORTANT: Location is NOT shown in order summary as requested
        const addonDetails = (state.addons && state.addons.length)
          ? state.addons.map(a => `- ${a.name} – ₹${a.price}`).join('\n')
          : 'None';

        return client.sendText(from,
          `🧾 *Order Summary:*\n🍛 ${state.biryani} x${state.quantity} = ₹${baseCost}\n➕ Add-ons:\n${addonDetails}\n🗓️ Delivery: ${state.deliveryDate} at ${state.deliverySlot}\n\n💰 *Total: ₹${totalCost}*\n\nConfirm order?\n1️⃣ Yes\n2️⃣ Start Over\n3️⃣ Speak to Us`
        );

      case 'pre-confirm':
        if (text === '1') {
          await client.sendText(from, `✅ Order confirmed. Please scan the QR below to pay.`);
          await client.sendImage(from, './qr.png', 'dumwala_qr.jpg', '📸 Scan & Pay via UPI');
          await client.sendText(from, `📲 Send screenshot of payment.\n🧾 For terms: www.dumwala.com`);
          state.stage = 'wait-for-screenshot';
        } else if (text === '2') {
          state.stage = 'main';
          return sendMainMenu(client, from);
        } else if (text === '3') {
          state.stage = 'support-phone';
          return client.sendText(from, `☎️ Please share your *10-digit phone number*.`);
        } else {
          return client.sendText(from, `❗Please select 1, 2, or 3.`);
        }
        break;

      case 'wait-for-screenshot':
        // After receiving payment screenshot, reset chat to main menu
        await client.sendText(from,
          `💛 Thanks for ordering with Dumwala!\n\n👉 Type *1* to place another order\n*2* to view menu\n*3* to contact support`
        );
        userStates[from] = { stage: 'main' };
        break;

      case 'support-phone':
  if (/^\d{10}$/.test(text)) {
    await client.sendText(from, `🫡 Got your number! We’ll get back to you soon 💛`);
    delete userStates[from];
  } else {
    await client.sendText(from, `❗Please enter a valid 10-digit phone number.`);
  }
  break;

      default:
        userStates[from] = { stage: 'main' };
        return sendMainMenu(client, from);
    }
  });
}

async function sendMainMenu(client, from) {
  await client.sendImage(
    from,
    './poster.png',
    'dumwala_poster.jpg',
    `Hey foodie! Welcome to *Dumwala* 🍛\n\n🔥 *LIMITED TIME OFFER:* 3.5kg Bucket Biryani @ ₹1299 (Serves 6–7)\n\nWhat would you like to do?\n\n1️⃣ Order Biryani\n2️⃣ View Menu 🗞️\n3️⃣ Contact Support ☎️`
  );
}
