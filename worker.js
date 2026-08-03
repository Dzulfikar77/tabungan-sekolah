// HTML SPA: paksa no-store agar update langsung tampil di semua domain (workers.dev & custom).
// Assets hashed (JS/CSS) tetap cache panjang via header bawaan Workers Assets.
export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    const pathname = new URL(request.url).pathname;
    if (pathname.match(/\.[a-z0-9]+$/i)) return response;
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
