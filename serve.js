//@ts-check

// simple_http_server.js
import http from "http";
import fs from "fs/promises";
import path from "path";
import url from "url";
import net from "net";

class SimpleHTTPRequestHandler {
  constructor(rootDir = process.cwd(), port = 8000) {
    this.rootDir = rootDir;
    this.port = port;
    this.server = http.createServer(this.handleRequest.bind(this));
  }

  // Start the server
  serve() {
    this.server.listen(this.port, () => {
      console.log(`Serving HTTP on 0.0.0.0 port ${this.port} (http://localhost:${this.port}/)`);
    });
  }

  // Main request handler
  /**
   * 
   * @param {Request} req 
   * @param {http.ServerResponse} res 
   */
  async handleRequest(req, res) {
    try {
      const parsedUrl = url.parse(req.url);
      if(parsedUrl.pathname?.toLowerCase() === '/sitemap'){
        const siteMapContent = await this.renderSiteMap();
          // Send response
        res.writeHead(200, { "Content-Type": 'text/html' });
        res.end(siteMapContent);
        return;
      }
      let pathname = decodeURIComponent(parsedUrl.pathname);

      // Normalize path to prevent directory traversal
      pathname = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
      let filepath = path.join(this.rootDir, pathname);

      // If directory, append index.html
      let stat;
      try {
        stat = await fs.stat(filepath);
        if (stat.isDirectory()) {
          filepath = path.join(this.rootDir, '/index.html'); //path.join(filepath, "index.html");
          stat = await fs.stat(filepath);
        }
      } catch {
        const siteMapContent = await this.renderSiteMap();
        // Send response
        res.writeHead(200, { "Content-Type": 'text/html' });
        res.end(siteMapContent);
        return;
      }

      // If requested .html doesn't exist → fallback to root index.html (SPA mode)
      if ((!stat || !stat.isFile()) && pathname.endsWith(".html")) {
        
        
        filepath = path.join(this.rootDir, "index.html");
      }

      // Read file
      const ext = path.extname(filepath).toLowerCase();
      let content = await fs.readFile(filepath);

      // SSI processing for HTML
      if (ext === ".html") {
        content = await this.processIncludes(content.toString(), path.dirname(filepath));
        content = Buffer.from(content);
      }

      // Send response
      res.writeHead(200, { "Content-Type": this.getMimeType(ext) });
      res.end(content);

    } catch (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end(`404 Not Found: ${JSON.stringify(err, null, 2)} \n`);
    }
  }

  /**
   * Recursively find all .html files
   * @param {*} dir 
   * @returns 
   */
  async findHtmlFiles(dir) {
    /** @type {string[]} */
    const results = [];
    const dirEntris = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of dirEntris) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const subFiles = await this.findHtmlFiles(fullPath);
        results.push(...subFiles);
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        results.push(fullPath);
      }
    }

    return results;
  }

  /**
   * Extract <title> from HTML file
   * @param {string} filePath 
   * @returns 
   */
  async extractTitle(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const match = content.match(/<title>(.*?)<\/title>/i);
      return match ? match[1] : path.basename(filePath);
    } catch {
      return path.basename(filePath);
    }
  }

  /**
   * Build HTML list
   * @param {string[]} files 
   * @param {string} baseDir 
   */
  buildHtmlList(files, baseDir) {
    /**
     * @type {any}
     */
    const tree = {};

    // Build nested structure
    for (const file of files) {
      const relativePath = path.relative(baseDir, file);
      const parts = relativePath.split(path.sep);
      let current = tree;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (i === parts.length - 1) {
          current[part] = file; // Leaf node: file path
        } else {
          current[part] = current[part] || {};
          current = current[part];
        }
      }
    }
    return this.renderTree(tree, baseDir);
  }

  // Render HTML
  /**
   * 
   * @param {any} node 
   * @param {string} baseDir
   * @returns 
   */
  async renderTree(node, baseDir) {
    let html = '<ul>';
    for (const key in node) {
      const value = node[key];
      if (typeof value === 'string') {
        const title = await this.extractTitle(value);
        const href = path.relative(baseDir, value).replace(/\\/g, '/');
        html += String.raw `<li><a href="${href}">${title}</a></li>`;
      } else {
        html += String.raw`
        <li>
          <details>
            <summary>${key}</summary>
            ${await this.renderTree(value, baseDir)}
          </details>
        </li>
        `;
      }
    }
    html += '</ul>';
    return html;
  }

  async renderSiteMap(){
    // Run it
    const baseDir = process.cwd();
    const htmlFiles = await this.findHtmlFiles(baseDir);
    const htmlOutput = await this.buildHtmlList(htmlFiles, baseDir);
    const fullHTMLOutput = String.raw `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Site Map</title>
        <style>
          @import "https://unpkg.com/open-props";

          /* optional imports that use the props */
          @import "https://unpkg.com/open-props/normalize.min.css";
          @import "https://unpkg.com/open-props/buttons.min.css";

          /* just dark or light themes */
          @import "https://unpkg.com/open-props/normalize.dark.min.css";
          @import "https://unpkg.com/open-props/buttons.dark.min.css";
          @import "https://unpkg.com/open-props/normalize.light.min.css";
          @import "https://unpkg.com/open-props/buttons.light.min.css";
          @media (prefers-color-scheme: light) {
            /* Styles for light mode */
            body {
              background: #ffffff;
              color: #000000;
            }

          }

          @media (prefers-color-scheme: dark) {
            /* Styles for dark mode */
            body {
              background: #000000;
              color: #ffffff;
            }


          }

          ul{
            list-style-type: none; /* Removes bullets */
          }

          li {
            max-inline-size: 100%;
          }

          summary{
            color: black;
          }

          a {
            color: hotpink;
          }
        </style>
      </head>
      <body>
      ${htmlOutput}
      </body>
    </html>
    `;
    return fullHTMLOutput;
  }

  /**
   * Process SSI includes
   * @param {string} html 
   * @param {*} currentDir 
   * @returns 
   */
  async processIncludes(html, currentDir) {
    const includeRegex = /<!--\s*#include\s+virtual="([^"]+)"\s*-->/g;

    const tasks = [];
    let match;
    while ((match = includeRegex.exec(html)) !== null) {
      const includeString = match[1];
      const includePath = includeString.startsWith('/') ? path.join(process.cwd(), includeString) :  path.join(currentDir, includeString);
      const content = await fs.readFile(includePath, 'utf8');
      html = html.replace(match[0], content);

    }


    return html;
  }


  /**
   * Basic MIME type mapping
   * @param {string} ext 
   * @returns 
   */
  getMimeType(ext) {

    return types[ext] || "application/octet-stream";
  }
}

/**
 * 
 * @param {number} startingAt 
 * @returns 
 */
function getAvailablePort(startingAt) {
  /**
   * 
   * @param {number} currentPort 
   * @param {(value: any) => void} cb 
   */
  function getNextAvailablePort(currentPort, cb) {
    const server = net.createServer();
    server.listen(currentPort, () => {
      server.once('close', () => {
        cb(currentPort);
      });
      server.close();
    });
    server.on('error', _ => {
      getNextAvailablePort(++currentPort, cb);
    });
  }
  return new Promise(resolve => {
    getNextAvailablePort(startingAt, resolve);
  });
}

/**
 * @type {{[key: string]: string}}
 */
const types = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
};

// Run if executed directly
if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  const port = await getAvailablePort(Number(process.env.PORT) || 8000);
  const server = new SimpleHTTPRequestHandler(process.cwd(), port);
  server.serve();
}
