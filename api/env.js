module.exports = function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
        BASE_API: process.env.BASE_API || "",
        AUTH_TOKEN_KEY: process.env.AUTH_TOKEN_KEY || ""
    });
};
