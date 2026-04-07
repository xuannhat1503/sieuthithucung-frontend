module.exports = async function handler(req, res) {
    const backendApiBase = String(process.env.BACKEND_API_BASE || "").trim().replace(/\/$/, "");

    if (!backendApiBase) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({
            message: "Missing BACKEND_API_BASE environment variable"
        }));
        return;
    }

    const incomingUrl = new URL(req.url, `http://${req.headers.host}`);
    const apiPath = incomingUrl.pathname.replace(/^\/api\/?/, "");
    const targetUrl = new URL(`${backendApiBase}/${apiPath}`);
    targetUrl.search = incomingUrl.search;

    const headers = { ...req.headers };
    delete headers.host;
    delete headers.connection;
    delete headers["content-length"];

    let body;
    if (req.method !== "GET" && req.method !== "HEAD") {
        body = await new Promise((resolve, reject) => {
            const chunks = [];
            req.on("data", (chunk) => chunks.push(chunk));
            req.on("end", () => resolve(Buffer.concat(chunks)));
            req.on("error", reject);
        });
    }

    try {
        const upstream = await fetch(targetUrl.toString(), {
            method: req.method,
            headers,
            body
        });

        res.statusCode = upstream.status;
        upstream.headers.forEach((value, key) => {
            if (key.toLowerCase() === "transfer-encoding") {
                return;
            }

            res.setHeader(key, value);
        });

        const arrayBuffer = await upstream.arrayBuffer();
        res.end(Buffer.from(arrayBuffer));
    } catch (error) {
        res.statusCode = 502;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({
            message: "Proxy request failed",
            detail: error.message
        }));
    }
};
