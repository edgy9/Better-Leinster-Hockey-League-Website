/**
 * Cloudflare Worker — Leinster Hockey API proxy
 *
 * Deploy steps:
 *   1. Go to https://dash.cloudflare.com → Workers & Pages → Create
 *   2. Paste this file into the editor
 *   3. Click "Deploy"
 *   4. Copy your worker URL (e.g. https://lha-proxy.YOUR-NAME.workers.dev)
 *   5. Set PROXY_BASE in src/lib/config.ts to that URL
 *
 * The worker forwards POST requests to the LHA WordPress AJAX endpoint,
 * adding the headers LHA requires, and returns the response with CORS
 * headers so the browser can read it from any origin.
 */

const LHA_ENDPOINT = 'https://www.leinsterhockey.ie/wp-admin/admin-ajax.php?action=competition_listing';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
    }

    let body;
    try {
      body = await request.text();
    } catch {
      return new Response('Bad request', { status: 400, headers: CORS_HEADERS });
    }

    // Validate that the body looks like a legitimate LHA API call
    if (!body.includes('action=competition_listing') || !body.includes('userid=7971')) {
      return new Response('Invalid request', { status: 400, headers: CORS_HEADERS });
    }

    try {
      const lhaResponse = await fetch(LHA_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          'Origin': 'https://www.leinsterhockey.ie',
          'Referer': 'https://www.leinsterhockey.ie/competition/',
          'User-Agent': 'Mozilla/5.0 (compatible; LHA-Proxy/1.0)',
        },
        body,
      });

      if (!lhaResponse.ok) {
        return new Response(
          JSON.stringify({ error: `LHA returned ${lhaResponse.status}` }),
          { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }

      const data = await lhaResponse.text();
      return new Response(data, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
        },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: err.message }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }
  },
};
