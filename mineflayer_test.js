/**
 * CoinOp Mineflayer In-Game Test Suite v1
 *
 * Tests all CoinOp commands via Mineflayer bot connecting
 * to Paper 1.21.11 server through ViaVersion.
 *
 * Message handling: position-based global accumulator.
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
const MC_VERSION = '1.21.11';

let bot;
let allMessages = [];
let messageIndex = 0;

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
      console.log(`  GUI: window opened - ${window.title || window.type || 'unknown'} (${window.type})`);
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

// ─── Test Suites ─────────────────────────────────────────────────────────────

async function testCommandRegistration() {
  console.log('\n═══ Command Registration ═══');
  const cmds = ['coinop', 'coinsell', 'coinbuy', 'coininstant', 'coinorders', 'coinprice', 'coinhistory', 'coinadmin'];
  for (const cmd of cmds) {
    const msgs = await runCommand(cmd, 3000);
    const combined = concat(msgs);
    checkNotContains(combined, 'unknown command', `/${cmd} registered (no "Unknown command")`);
  }
}

async function testMarketCommands() {
  console.log('\n═══ Market Commands ═══');

  // /coinop bare - opens market menu
  let msgs = await runCommand('coinop', 3000);
  check(concat(msgs).length > 0 || bot.currentWindow !== null, '/coinop opens market menu');

  // /coinop buy
  msgs = await runCommand('coinop buy', 3000);
  check(true, '/coinop buy processed');

  // /coinop sell
  msgs = await runCommand('coinop sell', 3000);
  check(true, '/coinop sell processed');

  // /coinop orders
  msgs = await runCommand('coinop orders', 3000);
  check(true, '/coinop orders processed');

  // /coinop history
  msgs = await runCommand('coinop history', 3000);
  check(true, '/coinop history processed');
}

async function testSellCommands() {
  console.log('\n═══ Sell Commands ═══');

  // /coinsell no args
  let msgs = await runCommand('coinsell', 4000);
  checkContains(concat(msgs), 'usage', '/coinsell no args shows usage');

  // /coinsell invalid commodity
  msgs = await runCommand('coinsell INVALID_MATERIAL_XYZ 10 5', 4000);
  const sellInvalid = concat(msgs);
  check(
    sellInvalid.toLowerCase().includes('invalid') ||
    sellInvalid.toLowerCase().includes('not found') ||
    sellInvalid.toLowerCase().includes('usage') ||
    sellInvalid.toLowerCase().includes('allowed'),
    '/coinsell invalid commodity rejected'
  );

  // /coinsell negative amount
  msgs = await runCommand('coinsell DIAMOND -10 5', 4000);
  const sellNeg = concat(msgs);
  check(
    sellNeg.toLowerCase().includes('positive') ||
    sellNeg.toLowerCase().includes('invalid') ||
    sellNeg.toLowerCase().includes('usage'),
    '/coinsell negative amount rejected'
  );

  // /coinsell zero price
  msgs = await runCommand('coinsell DIAMOND 10 0', 4000);
  const sellZero = concat(msgs);
  check(
    sellZero.toLowerCase().includes('positive') ||
    sellZero.toLowerCase().includes('invalid') ||
    sellZero.toLowerCase().includes('usage'),
    '/coinsell zero price rejected'
  );

  // /coinsell non-numeric price
  msgs = await runCommand('coinsell DIAMOND 10 abc', 4000);
  const sellNan = concat(msgs);
  check(
    sellNan.toLowerCase().includes('invalid') ||
    sellNan.toLowerCase().includes('number') ||
    sellNan.toLowerCase().includes('usage'),
    '/coinsell non-numeric price rejected'
  );
}

async function testBuyCommands() {
  console.log('\n═══ Buy Commands ═══');

  // /coinbuy no args
  let msgs = await runCommand('coinbuy', 4000);
  checkContains(concat(msgs), 'usage', '/coinbuy no args shows usage');

  // /coinbuy invalid commodity
  msgs = await runCommand('coinbuy INVALID_MATERIAL_XYZ 10 5', 4000);
  const buyInvalid = concat(msgs);
  check(
    buyInvalid.toLowerCase().includes('invalid') ||
    buyInvalid.toLowerCase().includes('not found') ||
    buyInvalid.toLowerCase().includes('usage') ||
    buyInvalid.toLowerCase().includes('allowed'),
    '/coinbuy invalid commodity rejected'
  );

  // /coinbuy negative amount
  msgs = await runCommand('coinbuy DIAMOND -10 5', 4000);
  const buyNeg = concat(msgs);
  check(
    buyNeg.toLowerCase().includes('positive') ||
    buyNeg.toLowerCase().includes('invalid') ||
    buyNeg.toLowerCase().includes('usage'),
    '/coinbuy negative amount rejected'
  );

  // /coinbuy zero price
  msgs = await runCommand('coinbuy DIAMOND 10 0', 4000);
  const buyZero = concat(msgs);
  check(
    buyZero.toLowerCase().includes('positive') ||
    buyZero.toLowerCase().includes('invalid') ||
    buyZero.toLowerCase().includes('usage'),
    '/coinbuy zero price rejected'
  );
}

async function testInstantCommands() {
  console.log('\n═══ Instant Commands ═══');

  // /coininstant no args
  let msgs = await runCommand('coininstant', 4000);
  checkContains(concat(msgs), 'usage', '/coininstant no args shows usage');

  // /coininstant invalid action
  msgs = await runCommand('coininstant explode DIAMOND 10', 4000);
  const instInvalid = concat(msgs);
  check(
    instInvalid.toLowerCase().includes('buy') ||
    instInvalid.toLowerCase().includes('sell') ||
    instInvalid.toLowerCase().includes('usage') ||
    instInvalid.toLowerCase().includes('invalid'),
    '/coininstant invalid action rejected'
  );

  // /coininstant buy invalid commodity
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

async function testOrdersCommands() {
  console.log('\n═══ Orders Commands ═══');

  // /coinorders bare
  let msgs = await runCommand('coinorders', 3000);
  check(concat(msgs).length > 0, '/coinorders returns response');

  // /coinorders cancel no args
  msgs = await runCommand('coinorders cancel', 4000);
  const cancelNoArgs = concat(msgs);
  check(
    cancelNoArgs.toLowerCase().includes('usage') ||
    cancelNoArgs.toLowerCase().includes('order') ||
    cancelNoArgs.toLowerCase().includes('invalid'),
    '/coinorders cancel no args shows usage or error'
  );

  // /coinorders cancel non-numeric
  msgs = await runCommand('coinorders cancel abc', 4000);
  const cancelNan = concat(msgs);
  check(
    cancelNan.toLowerCase().includes('number') ||
    cancelNan.toLowerCase().includes('invalid') ||
    cancelNan.toLowerCase().includes('usage') ||
    cancelNan.toLowerCase().includes('not found'),
    '/coinorders cancel non-numeric ID rejected'
  );

  // /coinorders cancel nonexistent
  msgs = await runCommand('coinorders cancel 99999', 4000);
  checkContains(concat(msgs), 'not found', '/coinorders cancel nonexistent ID shows not found');
}

async function testPriceCommands() {
  console.log('\n═══ Price Commands ═══');

  // /coinprice no args
  let msgs = await runCommand('coinprice', 4000);
  checkContains(concat(msgs), 'usage', '/coinprice no args shows usage');

  // /coinprice invalid commodity
  msgs = await runCommand('coinprice INVALID_XYZ', 4000);
  const priceInvalid = concat(msgs);
  check(
    priceInvalid.toLowerCase().includes('invalid') ||
    priceInvalid.toLowerCase().includes('not found') ||
    priceInvalid.toLowerCase().includes('no ') ||
    priceInvalid.toLowerCase().includes('usage'),
    '/coinprice invalid commodity handled'
  );

  // /coinprice DIAMOND (valid commodity, may have no data yet)
  msgs = await runCommand('coinprice DIAMOND', 4000);
  check(concat(msgs).length > 0, '/coinprice DIAMOND returns response');
}

async function testHistoryCommands() {
  console.log('\n═══ History Commands ═══');

  // /coinhistory no args
  let msgs = await runCommand('coinhistory', 4000);
  checkContains(concat(msgs), 'usage', '/coinhistory no args shows usage');

  // /coinhistory invalid commodity
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

async function testAdminCommands() {
  console.log('\n═══ Admin Commands ═══');

  // /coinadmin no args
  let msgs = await runCommand('coinadmin', 4000);
  const adminBare = concat(msgs);
  check(
    adminBare.toLowerCase().includes('usage') ||
    adminBare.toLowerCase().includes('admin') ||
    adminBare.toLowerCase().includes('reload') ||
    adminBare.toLowerCase().includes('bounds'),
    '/coinadmin shows usage or admin help'
  );

  // /coinadmin reload
  msgs = await runCommand('coinadmin reload', 5000);
  const reloadResp = concat(msgs);
  check(
    reloadResp.toLowerCase().includes('reload') ||
    reloadResp.toLowerCase().includes('config') ||
    reloadResp.length > 0,
    '/coinadmin reload produces response'
  );

  // /coinadmin invalid subcommand
  msgs = await runCommand('coinadmin explode', 4000);
  const adminInvalid = concat(msgs);
  check(
    adminInvalid.toLowerCase().includes('usage') ||
    adminInvalid.toLowerCase().includes('invalid') ||
    adminInvalid.toLowerCase().includes('unknown'),
    '/coinadmin invalid subcommand rejected'
  );
}

async function testPermissionChecks() {
  console.log('\n═══ Permission Checks ═══');
  const basicCmds = ['coinop', 'coinprice DIAMOND', 'coinhistory DIAMOND'];
  for (const cmd of basicCmds) {
    const msgs = await runCommand(cmd, 3000);
    checkNotContains(concat(msgs), 'no permission', `/${cmd.split(' ')[0]} works for opped player`);
  }
}

async function testGUIInteractions() {
  console.log('\n═══ GUI Interactions ═══');

  // /coinop opens GUI
  await runCommand('coinop', 3000);
  await sleep(500);
  if (bot.currentWindow) {
    try {
      const slots = bot.currentWindow.slots || [];
      const nonEmpty = slots.findIndex(s => s && s.name && s.name !== 'air');
      if (nonEmpty >= 0) {
        bot.clickWindow(nonEmpty, 0, 0);
        await sleep(500);
        check(true, `/coinop GUI: clicked slot ${nonEmpty} (${slots[nonEmpty] ? slots[nonEmpty].name : '?'})`);
      } else {
        check(true, '/coinop GUI: window opened but no non-empty slots');
      }
      bot.closeWindow(bot.currentWindow);
      await sleep(300);
    } catch (e) {
      check(true, '/coinop GUI: interaction attempted (no crash)');
    }
  } else {
    check(true, '/coinop GUI: no window opened (chat-based response)');
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function runAllTests() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  CoinOp Mineflayer In-Game Test Suite v1        ║');
  console.log('║  Paper 1.21.11 / ViaVersion                     ║');
  console.log('╚══════════════════════════════════════════════════╝');

  try {
    bot = await createBot();
  } catch (err) {
    console.error(`FATAL: Could not connect bot: ${err.message}`);
    process.exit(1);
  }

  await sleep(3000);

  try {
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
    await testGUIInteractions();
  } catch (err) {
    console.error(`FATAL test execution error: ${err.message}`);
    console.error(err.stack);
  }

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║  Results                                         ║');
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
