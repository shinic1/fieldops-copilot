const worker = {
  async fetch(request, env) {
    const configuredOrigin = env.UPSTREAM_ORIGIN;
    if (!configuredOrigin) {
      return new Response("Upstream service is not configured.", {
        status: 503,
      });
    }

    let upstreamOrigin;
    try {
      upstreamOrigin = new URL(configuredOrigin).origin;
    } catch {
      return new Response("Upstream service configuration is invalid.", {
        status: 503,
      });
    }

    const incomingUrl = new URL(request.url);
    const upstreamUrl = new URL(
      `${incomingUrl.pathname}${incomingUrl.search}`,
      upstreamOrigin,
    );
    const upstreamRequest = new Request(upstreamUrl, request);

    if (request.headers.has("origin")) {
      upstreamRequest.headers.set("origin", upstreamOrigin);
    }
    if (request.headers.has("referer")) {
      upstreamRequest.headers.set("referer", `${upstreamOrigin}/`);
    }

    return fetch(upstreamRequest);
  },
};

export default worker;
