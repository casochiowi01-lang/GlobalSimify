// Browser fixtures only: no actual credentials, orders, payments or email sends.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fixture = {
  id: 'fixture-esim',
  lpa: 'LPA:1$fixture.invalid$NOT-A-REAL-ACTIVATION',
  iccid: '0000000000000000000',
  smdpAddress: 'fixture.invalid',
  matchingId: 'NOT-A-REAL-ACTIVATION',
  profileStatus: 'RELEASED',
  destIso: 'AE',
  initialBytes: 1e9,
  remainingBytes: 1e9,
};
const order = {
  id: 'fixture-order',
  kind: 'PURCHASE',
  title: 'TEST ONLY - UAE 1 GB',
  quantity: 1,
  status: 'COMPLETED',
  esims: [fixture],
  totalKes: 10,
  currency: 'USD',
};
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [390, 1280]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        serviceWorkers: 'block',
      });
      await context.addInitScript(
        ({ native }) => {
          window.testShares = [];
          window.cancelShare = false;
          Object.defineProperty(navigator, 'canShare', {
            configurable: true,
            value: () => native,
          });
          Object.defineProperty(navigator, 'share', {
            configurable: true,
            value: async ({ files }) => {
              if (window.cancelShare)
                throw new DOMException('Cancelled', 'AbortError');
              window.testShares.push(
                files.map((f) => ({
                  name: f.name,
                  type: f.type,
                  size: f.size,
                })),
              );
            },
          });
        },
        { native: width === 390 },
      );
      const page = await context.newPage();
      page.setDefaultNavigationTimeout(90_000);
      let authed = false,
        polls = 0,
        pdfRequests = 0,
        failAccount = false,
        refreshes = 0;
      await page.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname.startsWith('/api/v1')) {
          const p = url.pathname.slice(7);
          let status = 200,
            body = {};
          const headers = {
            'access-control-allow-origin': 'http://localhost:3107',
            'access-control-allow-credentials': 'true',
            'access-control-allow-headers':
              'authorization,x-order-token,content-type',
            'access-control-allow-methods': 'GET,POST,OPTIONS',
          };
          if (route.request().method() === 'OPTIONS')
            return route.fulfill({ status: 204, headers });
          if (p === '/auth/refresh') {
            refreshes++;
            status = authed ? 200 : 401;
            body = { accessToken: 'fixture-token-' + refreshes };
          } else if (p === '/users/me')
            body = {
              id: 'owner',
              email: 'owner@example.invalid',
              role: 'CUSTOMER',
            };
          else if (p === '/orders/fixture-order') {
            assert.equal(
              route.request().headers()['x-order-token'],
              'private-fixture',
            );
            body =
              ++polls < 2 ? { ...order, status: 'PAID', esims: [] } : order;
          } else if (p === '/orders') {
            status = failAccount ? 503 : 200;
            body = failAccount ? { message: 'Temporary outage' } : [order];
          } else if (p === '/esims/fixture-esim/installation.pdf') {
            assert.equal(
              url.search,
              '',
              'private capability must not be put in a URL',
            );
            if (!authed)
              assert.equal(
                route.request().headers()['x-order-token'],
                'private-fixture',
              );
            else
              assert.match(
                route.request().headers().authorization,
                /^Bearer fixture-token-/,
              );
            pdfRequests++;
            // Also exercise the authenticated binary-fetch refresh path once.
            if (authed && pdfRequests === 2)
              return route.fulfill({
                status: 401,
                contentType: 'application/json',
                headers,
                body: '{}',
              });
            return route.fulfill({
              status: 200,
              contentType: 'application/pdf',
              headers,
              body: fs.readFileSync(
                path.resolve('.cache/delivery-fixture.pdf'),
              ),
            });
          } else if (p.endsWith('/usage'))
            body = {
              initialBytes: 1e9,
              remainingBytes: 1e9,
              usedBytes: 0,
              pctUsed: 0,
              remainingLabel: '1 GB',
              totalLabel: '1 GB',
              expiresAt: null,
              daysLeft: null,
            };
          else if (
            p.endsWith('/history') ||
            p === '/products' ||
            p === '/countries'
          )
            body = [];
          else if (p === '/assistant/status') body = { enabled: false };
          else if (p.endsWith('/device')) body = null;
          return route.fulfill({
            status,
            contentType: 'application/json',
            headers,
            body: JSON.stringify(body),
          });
        }
        if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1')
          return route.abort();
        return route.continue();
      });
      await page.goto(
        'http://localhost:3107/order/fixture-order#access=private-fixture',
      );
      await page.getByText('Payment confirmed.', { exact: false }).waitFor();
      await page
        .getByRole('heading', { name: 'Your eSIMs are ready' })
        .waitFor();
      assert.ok(!page.url().includes('private-fixture'));
      const pngButton = page.getByRole('button', {
        name: 'Download QR image',
        exact: true,
      });
      await pngButton.waitFor();
      await page.waitForFunction(() =>
        Array.from(document.querySelectorAll('button')).some(
          (b) => b.textContent === 'Download QR image' && !b.disabled,
        ),
      );
      let download = page.waitForEvent('download');
      await pngButton.click();
      const png = await download;
      assert.match(png.suggestedFilename(), /\.png$/);
      const bytes = fs.readFileSync(await png.path());
      assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
      assert.ok(bytes.length > 1000);
      download = page.waitForEvent('download');
      await page
        .getByRole('button', { name: 'Download PDF guide', exact: true })
        .click();
      assert.match((await download).suggestedFilename(), /\.pdf$/);
      if (width === 390) {
        await page
          .getByRole('button', { name: 'Share via WhatsApp', exact: true })
          .click();
        assert.equal((await page.evaluate(() => window.testShares)).length, 1);
        await page.evaluate(() => (window.cancelShare = true));
        await page
          .getByRole('button', { name: 'Share via WhatsApp', exact: true })
          .click();
        assert.equal(
          await page.locator('#esim-fixture-esim').getByRole('alert').count(),
          0,
        );
      } else {
        download = page.waitForEvent('download');
        await page
          .getByRole('button', { name: 'Share via WhatsApp', exact: true })
          .click();
        await download;
        await page
          .getByText('QR image downloaded.', { exact: false })
          .waitFor();
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `.cache/delivery-${width}.png`,
        fullPage: true,
      });
      const dimensions = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      assert.ok(dimensions.scroll <= dimensions.width + 1);
      // The exact same eSIM is available after signing in; account outages are not empty inventory.
      authed = true;
      failAccount = true;
      await page.goto('http://localhost:3107/account/esims');
      await page
        .getByRole('button', { name: 'Try again', exact: true })
        .waitFor();
      assert.equal(
        await page.getByText('No eSIMs yet', { exact: true }).count(),
        0,
      );
      failAccount = false;
      await page
        .getByRole('button', { name: 'Try again', exact: true })
        .click();
      await page.getByRole('heading', { name: order.title }).waitFor();
      download = page.waitForEvent('download');
      await page
        .getByRole('button', { name: 'Download PDF guide', exact: true })
        .click();
      await download;
      assert.equal(
        pdfRequests,
        3,
        'guest download plus authenticated refresh-and-retry',
      );
      await context.close();
      console.log(
        `PASS delivery ${width}px: guest paid-to-ready, PNG/PDF, secure token, share/cancel/fallback, account/retry/session refresh`,
      );
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
