// serve.js
// A tiny web server for the app folder. Needs only Node (no Python).


const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 8080;
const APP_DIR = path.join(__dirname, "..", "app");

// The content type for each kind of file.
const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".gz": "application/gzip"
};

const server = http.createServer(function (request, response) {
  // "/js/app.js?x=1" -> "/js/app.js"
  let urlPath = decodeURIComponent(request.url.split("?")[0]);
  if (urlPath === "/") {
    urlPath = "/index.html";
  }

  // Build the file path, and make sure it stays inside the app folder.
  const filePath = path.join(APP_DIR, urlPath);
  if (!filePath.startsWith(APP_DIR)) {
    response.writeHead(403);
    response.end("Not allowed");
    return;
  }

  fs.readFile(filePath, function (error, content) {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    const extension = path.extname(filePath);
    const contentType = CONTENT_TYPES[extension] || "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType });
    response.end(content);
  });
});

server.listen(PORT, function () {
  console.log("Wordsmith is running at http://localhost:" + PORT);
  console.log("Press Ctrl+C to stop.");
});
