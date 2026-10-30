// Browser regression with mocked API only; never authenticates a real customer.
// Set PLAYWRIGHT_MODULE to a local Playwright module; start the web app on :3107.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 1280, height: 900 },
    ]) {
      const context = await browser.newContext({
        viewport,
        serviceWorkers: 'block',
      });
      const page = await context.newPage();
      let authed = true,
        questions = [];
      await page.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname.startsWith('/api/v1')) {
          const path = url.pathname.slice(7);
          let status = 200,
            body = {};
          if (path === '/auth/refresh') {
            status = authed ? 200 : 401;
            body = { accessToken: 'fixture-only' };
          } else if (path === '/users/me')
            body = {
              id: 'customer-a',
              email: 'customer@example.invalid',
              role: 'CUSTOMER',
            };
          else if (path === '/auth/logout') {
            authed = false;
            body = { ok: true };
          } else if (path === '/assistant/status') body = { enabled: true };
          else if (path === '/assistant/chat') {
            assert.equal(
              route.request().headers().authorization,
              'Bearer fixture-only',
            );
            const input = route.request().postDataJSON();
            questions.push(input);
            assert.equal(input.messages.at(-1).role, 'user');
            body = {
              available: true,
              reply: 'Verified quote below.',
              cards: [
                {
                  kind: 'quote',
                  title: 'UAE 1 GB',
                  lines: [
                    'Trip total: USD 21.06',
                    'Payment amount: KES 2728.12',
                  ],
                  href: '/plan/fixture',
                  label: 'Review dates and price at checkout',
                },
              ],
            };
          } else if (path === '/orders') body = [];
          else if (
            path === '/countries' ||
            path === '/products' ||
            path === '/search'
          )
            body = [];
          return route.fulfill({
            status,
            contentType: 'application/json',
            body: JSON.stringify(body),
            headers: {
              'access-control-allow-origin': 'http://localhost:3107',
              'access-control-allow-credentials': 'true',
            },
          });
        }
        if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1')
          return route.abort();
        return route.continue();
      });
      await page.goto('http://localhost:3107/help');
      await page
        .locator('header')
        .getByRole('link', { name: 'My eSIMs', exact: true })
        .waitFor();
      await page
        .getByRole('button', { name: 'Open GlobalSimify support' })
        .click();
      const dialog = page.getByRole('dialog', {
        name: 'GlobalSimify support assistant',
      });
      await dialog.waitFor();
      assert.equal(await dialog.getByRole('textbox').isDisabled(), true);
      await dialog.getByRole('checkbox').click();
      await dialog
        .getByRole('textbox')
        .fill('Quote UAE October 1 to October 7, two eSIMs');
      await dialog.getByRole('button', { name: 'Send question' }).click();
      await dialog
        .getByText('Trip total: USD 21.06', { exact: true })
        .waitFor();
      assert.equal(questions.length, 1);
      assert.equal(questions[0].messages[0].cards, undefined);
      const box = await dialog.boundingBox();
      assert.ok(
        box.x >= 0 &&
          box.y >= 0 &&
          box.x + box.width <= viewport.width + 1 &&
          box.y + box.height <= viewport.height + 1,
      );
      await page.screenshot({
        path: `.cache/assistant-${viewport.width}.png`,
        fullPage: false,
      });
      await dialog.getByRole('button', { name: 'Clear chat' }).click();
      assert.equal(await dialog.getByText('Trip total: USD 21.06').count(), 0);
      if (viewport.width > 600) {
        await dialog.getByRole('textbox').fill('Show my private eSIMs');
        await dialog.getByRole('button', { name: 'Send question' }).click();
        await dialog
          .getByText('Trip total: USD 21.06', { exact: true })
          .waitFor();
        await page
          .getByRole('button', { name: 'Log out', exact: true })
          .click();
        await page
          .getByRole('link', { name: 'Log in', exact: true })
          .first()
          .waitFor();
        assert.equal(
          await page.getByRole('dialog').count(),
          0,
          'sign out must unmount private chat',
        );
        await page
          .getByRole('button', { name: 'Open GlobalSimify support' })
          .click();
        assert.equal(await page.getByText('Trip total: USD 21.06').count(), 0);
      }
      await context.close();
      console.log(
        `PASS assistant UI ${viewport.width}px, consent, authenticated request, verified price card, clear${viewport.width > 600 ? ', logout isolation' : ''}`,
      );
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
