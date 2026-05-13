import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { createServer } from "node:http";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const distRoot = join(process.cwd(), "dist", "domino-angular", "browser");

const contentTypes = new Map([
    [".css", "text/css; charset=utf-8"],
    [".html", "text/html; charset=utf-8"],
    [".ico", "image/x-icon"],
    [".js", "text/javascript; charset=utf-8"],
    [".json", "application/json; charset=utf-8"],
    [".m4a", "audio/mp4"],
    [".mp3", "audio/mpeg"],
    [".png", "image/png"],
    [".svg", "image/svg+xml"],
    [".txt", "text/plain; charset=utf-8"],
    [".webp", "image/webp"],
    [".woff", "font/woff"],
    [".woff2", "font/woff2"],
    [".xml", "application/xml; charset=utf-8"],
]);

function resolvePath(urlPath) {
    const decodedPath = decodeURIComponent(urlPath.split("?")[0]);
    const normalizedPath = normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
    const candidate = join(distRoot, normalizedPath);

    if (existsSync(candidate) && statSync(candidate).isFile()) {
        return candidate;
    }

    return join(distRoot, "index.html");
}

createServer((request, response) => {
    const requestPath = request.url ?? "/";
    const filePath = resolvePath(requestPath === "/" ? "/index.html" : requestPath);
    const extension = extname(filePath).toLowerCase();
    const contentType = contentTypes.get(extension) ?? "application/octet-stream";

    response.writeHead(200, {
        "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
        "Content-Type": contentType,
    });

    createReadStream(filePath).pipe(response).on("error", () => {
        response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Internal Server Error");
    });
}).listen(port, "0.0.0.0", () => {
    console.log(`Serving dist from ${distRoot} on http://0.0.0.0:${port}`);
});
