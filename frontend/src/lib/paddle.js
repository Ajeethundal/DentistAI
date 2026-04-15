// Paddle.js loader + initializer.
// Usage:
//   import { initPaddle, openCheckout } from '@/lib/paddle';
//   const paddle = await initPaddle();
//   openCheckout({ priceId, customer, customData });

import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

let _paddlePromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

export async function initPaddle() {
  if (_paddlePromise) return _paddlePromise;

  _paddlePromise = (async () => {
    // Fetch config from backend (client token, environment)
    const { data: cfg } = await axios.get(`${API}/api/paddle/config`);
    if (!cfg.client_token) {
      throw new Error(
        'Paddle is not yet configured. An administrator must set PADDLE_CLIENT_TOKEN.'
      );
    }

    await loadScript('https://cdn.paddle.com/paddle/v2/paddle.js');

    // Need to wait a tick for Paddle to attach to window
    await new Promise((r) => setTimeout(r, 50));

    if (!window.Paddle) throw new Error('Paddle.js failed to load');

    if (cfg.environment === 'sandbox') {
      window.Paddle.Environment.set('sandbox');
    }
    window.Paddle.Initialize({
      token: cfg.client_token,
      eventCallback: (ev) => {
        // Bubble to window for pages that want to listen
        window.dispatchEvent(
          new CustomEvent('paddle:event', { detail: ev })
        );
      },
    });

    return window.Paddle;
  })();

  return _paddlePromise;
}

export async function openCheckout({ priceId, customer, customData, successUrl }) {
  const paddle = await initPaddle();
  const opts = {
    items: [{ priceId, quantity: 1 }],
    settings: { displayMode: 'overlay' },
  };
  if (customer && customer.email) opts.customer = customer;
  if (customData) opts.customData = customData;
  if (successUrl) opts.settings.successUrl = successUrl;
  paddle.Checkout.open(opts);
}
