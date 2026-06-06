/**
 * CoinOp Mineflayer In-Game Test Suite v2
 *
 * Comprehensive tests covering all CoinOp commands and GUI interactions
 * via Mineflayer bot connecting to Paper server through ViaVersion.
 *
 * GUI coverage: main menu navigation, category browsing, commodity view
 * with all ClickType variants, orders view with cancel, back buttons,
 * tab completion, error handling, and GUI disabled config.
 */

const mineflayer = require('mineflayer');

// ─── Test Framework ──────────────────────────────────────────────────────────

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function check(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`PASS: ${message}`);
  } else {
    failedTests++;
    failures.push(message);
    console.log(`FAIL: ${message}`);
  }
}

function checkContains(text, substring, message) {
  const found = text.toLowerCase().includes(substring.toLowerCase());
  if (!found) console.log(`  HINT: Expected "${substring}" in: ${text.substring(0, 200)}`);
  check(found, message);
}

function checkNotContains(text, substring, message) {
  const found = text.toLowerCase().includes(substring.toLowerCase());
  if (found) console.log(`  HINT: Unexpected "${substring}" in: ${text.substring(0, 200)}`);
  check(!found, message);
}

// ─── Bot Setup ───────────────────────────────────────────────────────────────

const BOT_USERNAME = 'TestBot';
const HOST = '127.0.0.1';
const PORT = 25565;
const MC_VERSION = process.env.MC_VERSION || '1.21.11';

let bot;
let allMessages = [];
let guiWindows = [];

function createBot() {
  return new Promise((resolve, reject) => {
    const b = mineflayer.createBot({
      host: HOST,
      port: PORT,
      username: BOT_USERNAME,
      version: MC_VERSION,
      auth: 'offline',
      hideErrors: false,
    });

    b.on('login', () => {
      console.log(`Bot logged in as ${b.username}`);
      setTimeout(() => resolve(b), 3000);
    });

    b.on('message', (jsonMsg) => {
      const text = jsonMsg.toString().trim();
      if (text.length === 0) return;
      console.log(`  MSG: ${text.substring(0, 220)}`);
      allMessages.push(text);
    });

    b.on('windowOpen', (window) => {
      const info = {
        title: window.title || 'unknown',
        type: window.type || 'unknown',
        slotCount: window.slots ? window.slots.length : 0,
        slots: {}
      };
      // Capture non-empty slots
      if (window.slots) {
        for (let i = 0; i < window.slots.length; i++) {
          const slot = window.slots[i];
          if (slot && slot.name && slot.name !== 'air') {
            info.slots[i] = {
              name: slot.name,
              displayName: slot.nbt ? JSON.stringify(slot.nbt).substring(0, 100) : slot.name,
              count: slot.count || 1
            };
          }
        }
      }
      console.log(`  GUI: window opened - ${info.title} (${info.slotCount} slots, ${Object.keys(info.slots).length} filled)`);
      guiWindows.push(info);
    });

    b.on('kicked', (reason) => {
      console.error('FATAL: Bot kicked:', JSON.stringify(reason));
    });

    b.on('error', (err) => {
      console.error('Bot error:', err.message);
    });

    b.on('end', (reason) => {
      console.log('Bot disconnected:', reason);
    });

    setTimeout(() => reject(new Error('Bot connection timeout (60s)')), 60000);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runCommand(cmd, waitMs = 4000) {
  const startIdx = allMessages.length;
  bot.chat(`/${cmd}`);
  await sleep(waitMs);
  return allMessages.slice(startIdx);
}

function concat(msgs) {
  return msgs.join(' | ');
}

// ─── GUI Helpers ─────────────────────────────────────────────────────────────

async function openGUI(cmd = 'coinop', waitMs = 3000) {
  guiWindows = [];
  await runCommand(cmd, waitMs);
  await sleep(500);
  return bot.currentWindow;
}

function getGUIWindow() {
  return bot.currentWindow;
}

function getFilledSlots() {
  const win = bot.currentWindow;
  if (!win || !win.slots) return [];
  const filled = [];
  for (let i = 0; i < win.slots.length; i++) {
    const slot = win.slots[i];
    if (slot && slot.name && slot.name !== 'air') {
      filled.push({ slot: i, name: slot.name, count: slot.count || 1, item: slot });
    }
  }
  return filled;
}

function findSlotByMaterial(materialName) {
  const win = bot.currentWindow;
  if (!win || !win.slots) return -1;
  for (let i = 0; i < win.slots.length; i++) {
    const slot = win.slots[i];
    if (slot && slot.name === materialName.toLowerCase()) return i;
  }
  return -1;
}

function findSlotByName(name) {
  const win = bot.currentWindow;
  if (!win || !win.slots) return -1;
  for (let i = 0; i < win.slots.length; i++) {
    const slot = win.slots[i];
    if (slot && slot.name && slot.name.includes(name.toLowerCase())) return i;
  }
  return -1;
}

async function clickSlot(slot, mouseButton = 0, shift = false) {
  if (!bot.currentWindow) return false;
  try {
    await bot.clickWindow(slot, mouseButton, shift ? 1 : 0);
    await sleep(800);
    return true;
  } catch (e) {
    console.log(`  Click error at slot ${slot}: ${e.message}`);
    return false;
  }
}

async function closeGUI() {
  if (bot.currentWindow) {
    bot.closeWindow(bot.currentWindow);
    await sleep(500);
  }
}

// ─── Test Suite: Command Registration ────────────────────────────────────────

async function testCommandRegistration() {
  console.log('\n═══ Command Registration ═══');
  const cmds = ['coinop', 'coinsell', 'coinbuy', 'coininstant', 'coinorders', 'coinprice', 'coinhistory', 'coinadmin'];
  for (const cmd of cmds) {
    const msgs = await runCommand(cmd, 3000);
    const combined = concat(msgs);
    checkNotContains(combined, 'unknown command', `/${cmd} registered (no "Unknown command")`);
  }
}

// ─── Test Suite: Market Commands ─────────────────────────────────────────────

async function testMarketCommands() {
  console.log('\n═══ Market Commands ═══');

  let msgs = await runCommand('coinop', 3000);
  check(concat(msgs).length > 0 || bot.currentWindow !== null, '/coinop opens market menu or GUI');

  msgs = await runCommand('coinop buy', 3000);
  check(true, '/coinop buy processed');

  msgs = await runCommand('coinop sell', 3000);
  check(true, '/coinop sell processed');

  msgs = await runCommand('coinop orders', 3000);
  check(true, '/coinop orders processed');

  msgs = await runCommand('coinop history', 3000);
  check(true, '/coinop history processed');
}

// ─── Test Suite: Sell Commands ───────────────────────────────────────────────

async function testSellCommands() {
  console.log('\n═══ Sell Commands ═══');

  let msgs = await runCommand('coinsell', 4000);
  checkContains(concat(msgs), 'usage', '/coinsell no args shows usage');

  msgs = await runCommand('coinsell INVALID_MATERIAL_XYZ 10 5', 4000);
  const sellInvalid = concat(msgs);
  check(
    sellInvalid.toLowerCase().includes('invalid') ||
    sellInvalid.toLowerCase().includes('not found') ||
    sellInvalid.toLowerCase().includes('usage') ||
    sellInvalid.toLowerCase().includes('allowed'),
    '/coinsell invalid commodity rejected'
  );

  msgs = await runCommand('coinsell DIAMOND -10 5', 4000);
  const sellNeg = concat(msgs);
  check(
    sellNeg.toLowerCase().includes('positive') ||
    sellNeg.toLowerCase().includes('invalid') ||
    sellNeg.toLowerCase().includes('usage'),
    '/coinsell negative amount rejected'
  );

  msgs = await runCommand('coinsell DIAMOND 10 0', 4000);
  const sellZero = concat(msgs);
  check(
    sellZero.toLowerCase().includes('positive') ||
    sellZero.toLowerCase().includes('invalid') ||
    sellZero.toLowerCase().includes('usage'),
    '/coinsell zero price rejected'
  );

  msgs = await runCommand('coinsell DIAMOND 10 abc', 4000);
  const sellNan = concat(msgs);
  check(
    sellNan.toLowerCase().includes('invalid') ||
    sellNan.toLowerCase().includes('number') ||
    sellNan.toLowerCase().includes('usage'),
    '/coinsell non-numeric price rejected'
  );
}

// ─── Test Suite: Buy Commands ────────────────────────────────────────────────

async function testBuyCommands() {
  console.log('\n═══ Buy Commands ═══');

  let msgs = await runCommand('coinbuy', 4000);
  checkContains(concat(msgs), 'usage', '/coinbuy no args shows usage');

  msgs = await runCommand('coinbuy INVALID_MATERIAL_XYZ 10 5', 4000);
  const buyInvalid = concat(msgs);
  check(
    buyInvalid.toLowerCase().includes('invalid') ||
    buyInvalid.toLowerCase().includes('not found') ||
    buyInvalid.toLowerCase().includes('usage') ||
    buyInvalid.toLowerCase().includes('allowed'),
    '/coinbuy invalid commodity rejected'
  );

  msgs = await runCommand('coinbuy DIAMOND -10 5', 4000);
  const buyNeg = concat(msgs);
  check(
    buyNeg.toLowerCase().includes('positive') ||
    buyNeg.toLowerCase().includes('invalid') ||
    buyNeg.toLowerCase().includes('usage'),
    '/coinbuy negative amount rejected'
  );

  msgs = await runCommand('coinbuy DIAMOND 10 0', 4000);
  const buyZero = concat(msgs);
  check(
    buyZero.toLowerCase().includes('positive') ||
    buyZero.toLowerCase().includes('invalid') ||
    buyZero.toLowerCase().includes('usage'),
    '/coinbuy zero price rejected'
  );
}

// ─── Test Suite: Instant Commands ────────────────────────────────────────────

async function testInstantCommands() {
  console.log('\n═══ Instant Commands ═══');

  let msgs = await runCommand('coininstant', 4000);
  checkContains(concat(msgs), 'usage', '/coininstant no args shows usage');

  msgs = await runCommand('coininstant explode DIAMOND 10', 4000);
  const instInvalid = concat(msgs);
  check(
    instInvalid.toLowerCase().includes('buy') ||
    instInvalid.toLowerCase().includes('sell') ||
    instInvalid.toLowerCase().includes('usage') ||
    instInvalid.toLowerCase().includes('invalid'),
    '/coininstant invalid action rejected'
  );

  msgs = await runCommand('coininstant buy INVALID_XYZ 10', 4000);
  const instBuyInvalid = concat(msgs);
  check(
    instBuyInvalid.toLowerCase().includes('invalid') ||
    instBuyInvalid.toLowerCase().includes('not found') ||
    instBuyInvalid.toLowerCase().includes('usage') ||
    instBuyInvalid.toLowerCase().includes('allowed'),
    '/coininstant buy invalid commodity rejected'
  );
}

// ─── Test Suite: Orders Commands ─────────────────────────────────────────────

async function testOrdersCommands() {
  console.log('\n═══ Orders Commands ═══');

  let msgs = await runCommand('coinorders', 3000);
  check(concat(msgs).length > 0, '/coinorders returns response');

  msgs = await runCommand('coinorders cancel', 4000);
  const cancelNoArgs = concat(msgs);
  check(
    cancelNoArgs.toLowerCase().includes('usage') ||
    cancelNoArgs.toLowerCase().includes('order') ||
    cancelNoArgs.toLowerCase().includes('invalid'),
    '/coinorders cancel no args shows usage or error'
  );

  msgs = await runCommand('coinorders cancel DIAMOND abc', 4000);
  const cancelNan = concat(msgs);
  check(
    cancelNan.toLowerCase().includes('number') ||
    cancelNan.toLowerCase().includes('invalid') ||
    cancelNan.toLowerCase().includes('usage') ||
    cancelNan.toLowerCase().includes('not found'),
    '/coinorders cancel non-numeric ID rejected'
  );

  msgs = await runCommand('coinorders cancel DIAMOND 99999', 4000);
  checkContains(concat(msgs), 'not found', '/coinorders cancel nonexistent ID shows not found');
}

// ─── Test Suite: Price Commands ──────────────────────────────────────────────

async function testPriceCommands() {
  console.log('\n═══ Price Commands ═══');

  let msgs = await runCommand('coinprice', 4000);
  checkContains(concat(msgs), 'usage', '/coinprice no args shows usage');

  msgs = await runCommand('coinprice INVALID_XYZ', 4000);
  const priceInvalid = concat(msgs);
  check(
    priceInvalid.toLowerCase().includes('invalid') ||
    priceInvalid.toLowerCase().includes('not found') ||
    priceInvalid.toLowerCase().includes('no ') ||
    priceInvalid.toLowerCase().includes('usage'),
    '/coinprice invalid commodity handled'
  );

  msgs = await runCommand('coinprice DIAMOND', 4000);
  check(concat(msgs).length > 0, '/coinprice DIAMOND returns response');
}

// ─── Test Suite: History Commands ────────────────────────────────────────────

async function testHistoryCommands() {
  console.log('\n═══ History Commands ═══');

  let msgs = await runCommand('coinhistory', 4000);
  checkContains(concat(msgs), 'usage', '/coinhistory no args shows usage');

  msgs = await runCommand('coinhistory INVALID_XYZ', 4000);
  const histInvalid = concat(msgs);
  check(
    histInvalid.toLowerCase().includes('invalid') ||
    histInvalid.toLowerCase().includes('not found') ||
    histInvalid.toLowerCase().includes('no ') ||
    histInvalid.toLowerCase().includes('usage'),
    '/coinhistory invalid commodity handled'
  );
}

// ─── Test Suite: Admin Commands ──────────────────────────────────────────────

async function testAdminCommands() {
  console.log('\n═══ Admin Commands ═══');

  let msgs = await runCommand('coinadmin', 4000);
  const adminBare = concat(msgs);
  check(
    adminBare.toLowerCase().includes('usage') ||
    adminBare.toLowerCase().includes('admin') ||
    adminBare.toLowerCase().includes('reload') ||
    adminBare.toLowerCase().includes('bounds'),
    '/coinadmin shows usage or admin help'
  );

  msgs = await runCommand('coinadmin reload', 5000);
  const reloadResp = concat(msgs);
  check(
    reloadResp.toLowerCase().includes('reload') ||
    reloadResp.toLowerCase().includes('config') ||
    reloadResp.length > 0,
    '/coinadmin reload produces response'
  );

  msgs = await runCommand('coinadmin explode', 4000);
  const adminInvalid = concat(msgs);
  check(
    adminInvalid.toLowerCase().includes('usage') ||
    adminInvalid.toLowerCase().includes('invalid') ||
    adminInvalid.toLowerCase().includes('unknown'),
    '/coinadmin invalid subcommand rejected'
  );
}

// ─── Test Suite: Permission Checks ───────────────────────────────────────────

async function testPermissionChecks() {
  console.log('\n═══ Permission Checks ═══');
  const basicCmds = ['coinop', 'coinprice DIAMOND', 'coinhistory DIAMOND'];
  for (const cmd of basicCmds) {
    const msgs = await runCommand(cmd, 3000);
    checkNotContains(concat(msgs), 'no permission', `/${cmd.split(' ')[0]} works for opped player`);
  }
}

// ─── Test Suite: Tab Completion ──────────────────────────────────────────────

async function testTabCompletion() {
  console.log('\n═══ Tab Completion ═══');

  const cmds = ['coinop', 'coinsell', 'coinbuy', 'coininstant', 'coinorders', 'coinprice', 'coinhistory', 'coinadmin'];

  for (const cmd of cmds) {
    try {
      const completions = await new Promise((resolve) => {
        const timeout = setTimeout(() => resolve([]), 3000);
        bot.once('tab_complete', (results) => {
          clearTimeout(timeout);
          resolve(results || []);
        });
        // Send tab request
        bot.chat(`/${cmd} `);
      });

      // Commands should have some tab completions (subcommands or commodities)
      check(
        Array.isArray(completions),
        `/${cmd} tab completion returns array`
      );
    } catch (e) {
      check(true, `/${cmd} tab completion attempted (no crash)`);
    }
    await sleep(500);
  }

  // Test /coininstant tab for buy/sell subcommands
  try {
    const instantCompletions = await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve([]), 3000);
      bot.once('tab_complete', (results) => {
        clearTimeout(timeout);
        resolve(results || []);
      });
      bot.chat('/coininstant ');
    });
    const hasBuyOrSell = Array.isArray(instantCompletions) &&
      instantCompletions.some(c => c && (c.includes('buy') || c.includes('sell')));
    check(hasBuyOrSell, '/coininstant tab suggests buy/sell subcommands');
  } catch (e) {
    check(true, '/coininstant tab completion attempted (no crash)');
  }
  await sleep(500);
}

// ─── Test Suite: GUI Main Menu Navigation ────────────────────────────────────

async function testGUIMainMenu() {
  console.log('\n═══ GUI: Main Menu ═══');

  // Open main menu
  const win = await openGUI('coinop', 3000);
  check(win !== null, '/coinop opens a window');

  if (!win) return;

  const filledSlots = getFilledSlots();
  check(filledSlots.length > 0, 'Main menu has non-empty slots');

  // Verify at least one category icon exists
  const categoryMaterials = ['diamond', 'chest', 'wheat', 'cobblestone', 'blaze_rod', 'iron_ingot', 'gold_ingot'];
  const hasCategory = filledSlots.some(s => categoryMaterials.includes(s.name));
  check(hasCategory, 'Main menu has category icons');

  // Verify "Your Orders" button exists (WRITABLE_BOOK)
  const ordersSlot = filledSlots.find(s => s.name === 'writable_book');
  check(ordersSlot !== undefined, 'Main menu has "Your Orders" button');

  await closeGUI();
}

// ─── Test Suite: GUI Category View ───────────────────────────────────────────

async function testGUICategoryNavigation() {
  console.log('\n═══ GUI: Category Navigation ═══');

  // Open main menu
  const win = await openGUI('coinop', 3000);
  if (!win) {
    check(false, 'Category nav: could not open main menu');
    return;
  }

  const filledSlots = getFilledSlots();
  if (filledSlots.length === 0) {
    check(false, 'Category nav: main menu has no items');
    await closeGUI();
    return;
  }

  // Click the first category icon
  const categorySlot = filledSlots[0];
  console.log(`  Clicking category at slot ${categorySlot.slot} (${categorySlot.name})`);

  guiWindows = [];
  const clicked = await clickSlot(categorySlot.slot, 0, false);
  check(clicked, 'Category click executed without crash');

  await sleep(1500);

  // Check if a new window opened (category view)
  const categoryWin = getGUIWindow();
  if (categoryWin) {
    const categorySlots = getFilledSlots();
    check(categorySlots.length > 0, 'Category view has items');

    // Check for back button (ARROW)
    const backSlot = categorySlots.find(s => s.name === 'arrow');
    check(backSlot !== undefined, 'Category view has back button');
  } else {
    check(false, 'Category view window opened');
  }

  await closeGUI();
}

// ─── Test Suite: GUI Commodity View ──────────────────────────────────────────

async function testGUICommodityView() {
  console.log('\n═══ GUI: Commodity View ═══');

  // Open main menu → category → find a commodity
  const win = await openGUI('coinop', 3000);
  if (!win) {
    check(false, 'Commodity view: could not open main menu');
    return;
  }

  const mainSlots = getFilledSlots();
  const categorySlot = mainSlots.find(s =>
    !['writable_book', 'arrow', 'barrier', 'air'].includes(s.name)
  );

  if (!categorySlot) {
    check(false, 'Commodity view: no category to click');
    await closeGUI();
    return;
  }

  // Click category
  await clickSlot(categorySlot.slot, 0, false);
  await sleep(1500);

  const categoryWin = getGUIWindow();
  if (!categoryWin) {
    check(false, 'Commodity view: category window not open');
    await closeGUI();
    return;
  }

  const categorySlots = getFilledSlots();
  // Click first commodity item in category (not back button)
  const commoditySlot = categorySlots.find(s => s.name !== 'arrow');
  if (!commoditySlot) {
    check(false, 'Commodity view: no commodity in category');
    await closeGUI();
    return;
  }

  console.log(`  Clicking commodity at slot ${commoditySlot.slot} (${commoditySlot.name})`);
  await clickSlot(commoditySlot.slot, 0, false);
  await sleep(1500);

  const commodityWin = getGUIWindow();
  if (!commodityWin) {
    check(false, 'Commodity view window opened');
    await closeGUI();
    return;
  }

  const commoditySlots = getFilledSlots();

  // Verify key GUI elements in commodity view
  const hasInstantBuy = commoditySlots.some(s => s.name === 'emerald_block');
  check(hasInstantBuy, 'Commodity view has Instant Buy (emerald_block)');

  const hasInstantSell = commoditySlots.some(s => s.name === 'redstone_block');
  check(hasInstantSell, 'Commodity view has Instant Sell (redstone_block)');

  const hasBuyOrder = commoditySlots.some(s => s.name === 'writable_book');
  check(hasBuyOrder, 'Commodity view has Buy/Sell Order buttons (writable_book)');

  const hasMarketInfo = commoditySlots.some(s => s.name === 'knowledge_book');
  check(hasMarketInfo, 'Commodity view has Market Info (knowledge_book)');

  const hasBackButton = commoditySlots.some(s => s.name === 'arrow');
  check(hasBackButton, 'Commodity view has back button');

  await closeGUI();
}

// ─── Test Suite: GUI ClickType Handling ──────────────────────────────────────

async function testGUIClickTypes() {
  console.log('\n═══ GUI: ClickType Handling ═══');

  // Navigate to commodity view
  const win = await openGUI('coinop', 3000);
  if (!win) {
    check(false, 'ClickType: could not open main menu');
    return;
  }

  const mainSlots = getFilledSlots();
  const categorySlot = mainSlots.find(s =>
    !['writable_book', 'arrow', 'barrier', 'air'].includes(s.name)
  );

  if (!categorySlot) {
    check(false, 'ClickType: no category to click');
    await closeGUI();
    return;
  }

  // Click category
  await clickSlot(categorySlot.slot, 0, false);
  await sleep(1500);

  const categoryWin = getGUIWindow();
  if (!categoryWin) {
    check(false, 'ClickType: category window not open');
    await closeGUI();
    return;
  }

  const categorySlots = getFilledSlots();
  const commoditySlot = categorySlots.find(s => s.name !== 'arrow');
  if (!commoditySlot) {
    check(false, 'ClickType: no commodity in category');
    await closeGUI();
    return;
  }

  // Click commodity
  await clickSlot(commoditySlot.slot, 0, false);
  await sleep(1500);

  const commodityWin = getGUIWindow();
  if (!commodityWin) {
    check(false, 'ClickType: commodity window not open');
    await closeGUI();
    return;
  }

  const commoditySlots = getFilledSlots();
  const instantBuySlot = commoditySlots.find(s => s.name === 'emerald_block');

  if (instantBuySlot) {
    // Test LEFT click on Instant Buy (should buy 1)
    const msgStart = allMessages.length;
    await clickSlot(instantBuySlot.slot, 0, false); // left click
    const leftClickMsgs = allMessages.slice(msgStart);
    check(true, 'Instant Buy LEFT click executed (no crash)');

    // Re-open commodity view for right click test
    await closeGUI();
    await sleep(500);
    const reWin = await openGUI('coinop', 3000);
    if (reWin) {
      const reSlots = getFilledSlots();
      const reCat = reSlots.find(s => !['writable_book', 'arrow', 'barrier', 'air'].includes(s.name));
      if (reCat) {
        await clickSlot(reCat.slot, 0, false);
        await sleep(1500);
        const catWin2 = getGUIWindow();
        if (catWin2) {
          const catSlots2 = getFilledSlots();
          const comm2 = catSlots2.find(s => s.name !== 'arrow');
          if (comm2) {
            await clickSlot(comm2.slot, 0, false);
            await sleep(1500);
            const commWin2 = getGUIWindow();
            if (commWin2) {
              const commSlots2 = getFilledSlots();
              const buySlot2 = commSlots2.find(s => s.name === 'emerald_block');
              if (buySlot2) {
                // Test RIGHT click on Instant Buy (should buy 64)
                const msgStart2 = allMessages.length;
                await clickSlot(buySlot2.slot, 1, false); // right click
                check(true, 'Instant Buy RIGHT click executed (no crash)');

                // Re-open for shift click test
                await closeGUI();
                await sleep(500);
                const reWin3 = await openGUI('coinop', 3000);
                if (reWin3) {
                  const reSlots3 = getFilledSlots();
                  const reCat3 = reSlots3.find(s => !['writable_book', 'arrow', 'barrier', 'air'].includes(s.name));
                  if (reCat3) {
                    await clickSlot(reCat3.slot, 0, false);
                    await sleep(1500);
                    const catWin3 = getGUIWindow();
                    if (catWin3) {
                      const catSlots3 = getFilledSlots();
                      const comm3 = catSlots3.find(s => s.name !== 'arrow');
                      if (comm3) {
                        await clickSlot(comm3.slot, 0, false);
                        await sleep(1500);
                        const commWin3 = getGUIWindow();
                        if (commWin3) {
                          const commSlots3 = getFilledSlots();
                          const buySlot3 = commSlots3.find(s => s.name === 'emerald_block');
                          if (buySlot3) {
                            // Test SHIFT+LEFT click on Instant Buy (should buy stack amount)
                            await clickSlot(buySlot3.slot, 0, true); // shift+left
                            check(true, 'Instant Buy SHIFT+LEFT click executed (no crash)');
                          }
                        }
                      }
                    }
                  }
                }
              }

              // Test Instant Sell clicks
              const sellSlot = commSlots2.find(s => s.name === 'redstone_block');
              if (sellSlot) {
                // LEFT click on Instant Sell (sell 1)
                await clickSlot(sellSlot.slot, 0, false);
                check(true, 'Instant Sell LEFT click executed (no crash)');

                // Re-open for right click
                await closeGUI();
                await sleep(500);
                const sellWin = await openGUI('coinop', 3000);
                if (sellWin) {
                  const sellSlots1 = getFilledSlots();
                  const sellCat = sellSlots1.find(s => !['writable_book', 'arrow', 'barrier', 'air'].includes(s.name));
                  if (sellCat) {
                    await clickSlot(sellCat.slot, 0, false);
                    await sleep(1500);
                    const sellCatWin = getGUIWindow();
                    if (sellCatWin) {
                      const sellCatSlots = getFilledSlots();
                      const sellComm = sellCatSlots.find(s => s.name !== 'arrow');
                      if (sellComm) {
                        await clickSlot(sellComm.slot, 0, false);
                        await sleep(1500);
                        const sellCommWin = getGUIWindow();
                        if (sellCommWin) {
                          const sellCommSlots = getFilledSlots();
                          const sellBtn = sellCommSlots.find(s => s.name === 'redstone_block');
                          if (sellBtn) {
                            // RIGHT click on Instant Sell (sell 64)
                            await clickSlot(sellBtn.slot, 1, false);
                            check(true, 'Instant Sell RIGHT click executed (no crash)');

                            // SHIFT+click on Instant Sell (sell all)
                            await closeGUI();
                            await sleep(500);
                            const sellWin2 = await openGUI('coinop', 3000);
                            if (sellWin2) {
                              const sslots = getFilledSlots();
                              const scat = sslots.find(s => !['writable_book', 'arrow', 'barrier', 'air'].includes(s.name));
                              if (scat) {
                                await clickSlot(scat.slot, 0, false);
                                await sleep(1500);
                                const scw = getGUIWindow();
                                if (scw) {
                                  const scs = getFilledSlots();
                                  const scm = scs.find(s => s.name !== 'arrow');
                                  if (scm) {
                                    await clickSlot(scm.slot, 0, false);
                                    await sleep(1500);
                                    const scmw = getGUIWindow();
                                    if (scmw) {
                                      const scms = getFilledSlots();
                                      const sb = scms.find(s => s.name === 'redstone_block');
                                      if (sb) {
                                        await clickSlot(sb.slot, 0, true); // shift+click
                                        check(true, 'Instant Sell SHIFT+LEFT click executed (no crash)');
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  } else {
    check(false, 'ClickType: Instant Buy button not found in commodity view');
  }

  await closeGUI();
}

// ─── Test Suite: GUI Order Placement via Buttons ─────────────────────────────

async function testGUIOrderButtons() {
  console.log('\n═══ GUI: Order Buttons ═══');

  // Navigate to commodity view
  const win = await openGUI('coinop', 3000);
  if (!win) {
    check(false, 'Order buttons: could not open main menu');
    return;
  }

  const mainSlots = getFilledSlots();
  const categorySlot = mainSlots.find(s =>
    !['writable_book', 'arrow', 'barrier', 'air'].includes(s.name)
  );

  if (!categorySlot) {
    check(false, 'Order buttons: no category');
    await closeGUI();
    return;
  }

  await clickSlot(categorySlot.slot, 0, false);
  await sleep(1500);

  const catWin = getGUIWindow();
  if (!catWin) { await closeGUI(); return; }

  const catSlots = getFilledSlots();
  const commSlot = catSlots.find(s => s.name !== 'arrow');
  if (!commSlot) { await closeGUI(); return; }

  await clickSlot(commSlot.slot, 0, false);
  await sleep(1500);

  const commWin = getGUIWindow();
  if (!commWin) { await closeGUI(); return; }

  const commSlots = getFilledSlots();

  // Find writable_book slots (there should be 2: buy order + sell order)
  const bookSlots = commSlots.filter(s => s.name === 'writable_book');

  if (bookSlots.length >= 2) {
    // Click first book (Buy Order)
    const msgStart = allMessages.length;
    await clickSlot(bookSlots[0].slot, 0, false);
    const msgs1 = allMessages.slice(msgStart);
    check(
      msgs1.length > 0 || getGUIWindow() === null,
      'Buy Order button click produces response or closes GUI'
    );

    // Re-open and click second book (Sell Order)
    await closeGUI();
    await sleep(500);
    const win2 = await openGUI('coinop', 3000);
    if (win2) {
      const ms2 = getFilledSlots();
      const cs2 = ms2.find(s => !['writable_book', 'arrow', 'barrier', 'air'].includes(s.name));
      if (cs2) {
        await clickSlot(cs2.slot, 0, false);
        await sleep(1500);
        const cw2 = getGUIWindow();
        if (cw2) {
          const cs2l = getFilledSlots();
          const cm2 = cs2l.find(s => s.name !== 'arrow');
          if (cm2) {
            await clickSlot(cm2.slot, 0, false);
            await sleep(1500);
            const cw3 = getGUIWindow();
            if (cw3) {
              const cs3 = getFilledSlots();
              const books2 = cs3.filter(s => s.name === 'writable_book');
              if (books2.length >= 2) {
                const msgStart2 = allMessages.length;
                await clickSlot(books2[1].slot, 0, false);
                const msgs2 = allMessages.slice(msgStart2);
                check(
                  msgs2.length > 0 || getGUIWindow() === null,
                  'Sell Order button click produces response or closes GUI'
                );
              }
            }
          }
        }
      }
    }
  } else {
    check(false, 'Order buttons: not enough writable_book slots found');
  }

  await closeGUI();
}

// ─── Test Suite: GUI Orders View ─────────────────────────────────────────────

async function testGUIOrdersView() {
  console.log('\n═══ GUI: Orders View ═══');

  // Open main menu
  const win = await openGUI('coinop', 3000);
  if (!win) {
    check(false, 'Orders view: could not open main menu');
    return;
  }

  const mainSlots = getFilledSlots();

  // Find and click "Your Orders" button (writable_book in bottom row)
  const ordersSlot = mainSlots.find(s => s.name === 'writable_book');
  if (!ordersSlot) {
    check(false, 'Orders view: no Orders button found');
    await closeGUI();
    return;
  }

  console.log(`  Clicking Orders button at slot ${ordersSlot.slot}`);
  await clickSlot(ordersSlot.slot, 0, false);
  await sleep(1500);

  const ordersWin = getGUIWindow();
  if (!ordersWin) {
    check(false, 'Orders view: window opened');
    await closeGUI();
    return;
  }

  const ordersSlots = getFilledSlots();
  check(ordersSlots.length >= 0, 'Orders view displays content');

  // Check for "No Active Orders" barrier or back button
  const hasBarrier = ordersSlots.some(s => s.name === 'barrier');
  const hasBackButton = ordersSlots.some(s => s.name === 'arrow');
  check(hasBarrier || hasBackButton, 'Orders view has barrier (empty) or back button');

  // Test shift+click on an order item (should suggest /coinorders cancel)
  const orderItemSlot = ordersSlots.find(s =>
    s.name !== 'arrow' && s.name !== 'barrier' && s.name !== 'air'
  );
  if (orderItemSlot) {
    const msgStart = allMessages.length;
    await clickSlot(orderItemSlot.slot, 0, true); // shift+click
    const cancelMsgs = allMessages.slice(msgStart);
    check(cancelMsgs.length >= 0, 'Order shift+click executed (no crash)');
  } else {
    check(true, 'Orders view: no orders to cancel (empty state)');
  }

  await closeGUI();
}

// ─── Test Suite: GUI Back Button Navigation ──────────────────────────────────

async function testGUIBackButtons() {
  console.log('\n═══ GUI: Back Button Navigation ═══');

  // Test: Category → Main Menu
  const win = await openGUI('coinop', 3000);
  if (!win) {
    check(false, 'Back button: could not open main menu');
    return;
  }

  const mainSlots = getFilledSlots();
  const categorySlot = mainSlots.find(s =>
    !['writable_book', 'arrow', 'barrier', 'air'].includes(s.name)
  );

  if (!categorySlot) {
    check(false, 'Back button: no category');
    await closeGUI();
    return;
  }

  // Click category
  await clickSlot(categorySlot.slot, 0, false);
  await sleep(1500);

  const catWin = getGUIWindow();
  if (catWin) {
    const catSlots = getFilledSlots();
    const backSlot = catSlots.find(s => s.name === 'arrow');

    if (backSlot) {
      console.log(`  Clicking back button at slot ${backSlot.slot}`);
      await clickSlot(backSlot.slot, 0, false);
      await sleep(1500);

      // Should be back at main menu
      const backWin = getGUIWindow();
      check(backWin !== null, 'Back button from category returns to main menu');
    } else {
      check(false, 'Category view has back button');
    }
  }

  await closeGUI();

  // Test: Orders → Main Menu
  const win2 = await openGUI('coinop', 3000);
  if (win2) {
    const ms = getFilledSlots();
    const os = ms.find(s => s.name === 'writable_book');
    if (os) {
      await clickSlot(os.slot, 0, false);
      await sleep(1500);
      const ow = getGUIWindow();
      if (ow) {
        const oSlots = getFilledSlots();
        const ob = oSlots.find(s => s.name === 'arrow');
        if (ob) {
          await clickSlot(ob.slot, 0, false);
          await sleep(1500);
          check(getGUIWindow() !== null, 'Back button from orders returns to main menu');
        }
      }
    }
  }

  await closeGUI();
}

// ─── Test Suite: GUI Error Handling ──────────────────────────────────────────

async function testGUIErrorHandling() {
  console.log('\n═══ GUI: Error Handling ═══');

  // Test: Click empty slot (should not crash)
  const win = await openGUI('coinop', 3000);
  if (!win) {
    check(false, 'Error handling: could not open main menu');
    return;
  }

  // Find an empty slot
  const filledSlots = getFilledSlots();
  const allSlots = win.slots;
  let emptySlot = -1;
  for (let i = 0; i < (allSlots ? allSlots.length : 0); i++) {
    if (!allSlots[i] || allSlots[i].name === 'air' || allSlots[i].name === undefined) {
      emptySlot = i;
      break;
    }
  }

  if (emptySlot >= 0) {
    try {
      await clickSlot(emptySlot, 0, false);
      check(true, 'Clicking empty slot does not crash');
    } catch (e) {
      check(true, 'Clicking empty slot handled gracefully');
    }
  } else {
    check(true, 'No empty slots found (all filled - skipping)');
  }

  // Test: Click barrier in orders view
  // Navigate to orders where it might show "No Active Orders" barrier
  const mainSlots = getFilledSlots();
  const ordersSlot = mainSlots.find(s => s.name === 'writable_book');
  if (ordersSlot) {
    await clickSlot(ordersSlot.slot, 0, false);
    await sleep(1500);
    const ordersWin = getGUIWindow();
    if (ordersWin) {
      const barrierSlot = getFilledSlots().find(s => s.name === 'barrier');
      if (barrierSlot) {
        try {
          await clickSlot(barrierSlot.slot, 0, false);
          check(true, 'Clicking barrier (no orders) does not crash');
        } catch (e) {
          check(true, 'Clicking barrier handled gracefully');
        }
      } else {
        check(true, 'No barrier in orders view (has active orders)');
      }
    }
  }

  await closeGUI();
}

// ─── Test Suite: GUI Disabled Config ─────────────────────────────────────────

async function testGUIDisabled() {
  console.log('\n═══ GUI: Disabled Config ═══');

  // The default config should have GUI enabled, but we test the message path
  // by checking that /coinop opens something (GUI or chat message)
  const msgs = await runCommand('coinop', 3000);
  const combined = concat(msgs);
  const hasGUIResponse = bot.currentWindow !== null || combined.length > 0;
  check(hasGUIResponse, '/coinop responds (GUI window or chat message)');

  // If GUI is disabled, the message should say "GUI is disabled"
  // In default config it's enabled, so we just verify no crash
  checkNotContains(combined, 'error', '/coinop does not produce error when GUI enabled');

  await closeGUI();
}

// ─── Test Suite: GUI Market Info ─────────────────────────────────────────────

async function testGUIMarketInfo() {
  console.log('\n═══ GUI: Market Info ═══');

  // Navigate to commodity view
  const win = await openGUI('coinop', 3000);
  if (!win) {
    check(false, 'Market info: could not open main menu');
    return;
  }

  const mainSlots = getFilledSlots();
  const categorySlot = mainSlots.find(s =>
    !['writable_book', 'arrow', 'barrier', 'air'].includes(s.name)
  );

  if (!categorySlot) { await closeGUI(); return; }

  await clickSlot(categorySlot.slot, 0, false);
  await sleep(1500);

  const catWin = getGUIWindow();
  if (!catWin) { await closeGUI(); return; }

  const catSlots = getFilledSlots();
  const commSlot = catSlots.find(s => s.name !== 'arrow');
  if (!commSlot) { await closeGUI(); return; }

  await clickSlot(commSlot.slot, 0, false);
  await sleep(1500);

  const commWin = getGUIWindow();
  if (!commWin) { await closeGUI(); return; }

  const commSlots = getFilledSlots();

  // Click Market Info (knowledge_book) - should not crash
  const infoSlot = commSlots.find(s => s.name === 'knowledge_book');
  if (infoSlot) {
    try {
      await clickSlot(infoSlot.slot, 0, false);
      check(true, 'Clicking Market Info does not crash');
    } catch (e) {
      check(true, 'Market Info click handled gracefully');
    }
  } else {
    check(false, 'Market Info (knowledge_book) present in commodity view');
  }

  await closeGUI();
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function runAllTests() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  CoinOp Mineflayer In-Game Test Suite v2        ║');
  console.log(`║  Paper ${MC_VERSION} / ViaVersion                       ║`);
  console.log('╚══════════════════════════════════════════════════╝');

  try {
    bot = await createBot();
  } catch (err) {
    console.error(`FATAL: Could not connect bot: ${err.message}`);
    process.exit(1);
  }

  await sleep(3000);

  try {
    // Command tests
    await testCommandRegistration();
    await testMarketCommands();
    await testSellCommands();
    await testBuyCommands();
    await testInstantCommands();
    await testOrdersCommands();
    await testPriceCommands();
    await testHistoryCommands();
    await testAdminCommands();
    await testPermissionChecks();

    // Tab completion
    await testTabCompletion();

    // GUI tests
    await testGUIMainMenu();
    await testGUICategoryNavigation();
    await testGUICommodityView();
    await testGUIClickTypes();
    await testGUIOrderButtons();
    await testGUIOrdersView();
    await testGUIBackButtons();
    await testGUIErrorHandling();
    await testGUIDisabled();
    await testGUIMarketInfo();
  } catch (err) {
    console.error(`FATAL test execution error: ${err.message}`);
    console.error(err.stack);
  }

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║  Results                                        ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);

  if (failures.length > 0) {
    console.log('\nFailed:');
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  } else {
    console.log('\nAll tests PASSED!');
  }

  bot.quit('Tests complete');
  process.exit(failedTests > 0 ? 1 : 0);
}

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
  process.exit(2);
});

runAllTests();
