// Mini proxy usado quando não há nginx (compose.yaml): substitui X-Real-IP e
// X-Forwarded-For pelo IP real da ligação, como o nginx faria.
import http from "node:http";

export function startEdge(listenPort, targetPort) {
  const server = http.createServer((req, res) => {
    const ip = (req.socket.remoteAddress ?? "").replace(/^::ffff:/, "");
    const headers = { ...req.headers, "x-real-ip": ip, "x-forwarded-for": ip };
    const upstream = http.request(
      { host: "127.0.0.1", port: targetPort, method: req.method, path: req.url, headers },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on("error", () => {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    res.on("close", () => upstream.destroy());
    req.pipe(upstream);
  });
  server.requestTimeout = 0; // SSE: ligações longas
  server.listen(listenPort, "0.0.0.0");
}
