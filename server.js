/**
 * Servidor HTTP Local Leve (Zero Dependências, ES Module)
 * Executa com: node server.js ou npm start
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const BASE_DIR = __dirname;
const IMAGES_DIR = path.join(BASE_DIR, 'images');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function generateFileName(originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `upload_${timestamp}_${random}${ext}`;
}

function parseMultipart(body, boundary) {
  const parts = body.split(`--${boundary}`);
  const result = { fields: {}, files: [] };
  
  for (const part of parts) {
    if (!part.includes('\r\n\r\n') || part.trim() === '' || part.includes('--\r\n')) continue;
    
    const [headersBlock, ...contentParts] = part.split('\r\n\r\n');
    const content = contentParts.join('\r\n\r\n').replace(/\r\n$/, '');
    
    const headers = {};
    headersBlock.split('\r\n').forEach(line => {
      const [key, value] = line.split(': ');
      if (key && value) headers[key.toLowerCase()] = value;
    });
    
    const contentDisposition = headers['content-disposition'] || '';
    const nameMatch = contentDisposition.match(/name="([^"]+)"/);
    const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
    
    if (nameMatch) {
      const name = nameMatch[1];
      if (filenameMatch) {
        const filename = filenameMatch[1];
        const contentType = headers['content-type'] || 'application/octet-stream';
        result.files.push({ name, filename, contentType, content: Buffer.from(content, 'binary') });
      } else {
        result.fields[name] = content;
      }
    }
  }
  
  return result;
}

async function handleImageUpload(req, res) {
  return new Promise((resolve) => {
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(.+)/);
    
    if (!boundaryMatch) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Content-Type multipart/form-data requerido' }));
      resolve();
      return;
    }
    
    const boundary = boundaryMatch[1];
    const chunks = [];
    
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks);
        
        if (body.length > MAX_FILE_SIZE) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Arquivo muito grande. Máximo 5MB.' }));
          resolve();
          return;
        }
        
        const parsed = parseMultipart(body.toString('binary'), boundary);
        const file = parsed.files[0];
        
        if (!file) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Nenhum arquivo enviado' }));
          resolve();
          return;
        }
        
        if (!ALLOWED_IMAGE_TYPES.includes(file.contentType)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Tipo de arquivo não permitido. Use JPG, PNG, WebP ou GIF.' }));
          resolve();
          return;
        }
        
        const fileName = generateFileName(file.filename);
        const filePath = path.join(IMAGES_DIR, fileName);
        
        fs.writeFileSync(filePath, file.content);
        
        const imageUrl = `/images/${fileName}`;
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          url: imageUrl,
          fileName: fileName
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro ao processar upload: ' + err.message }));
      }
      resolve();
    });
  });
}

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API: Upload de imagem
  if (req.method === 'POST' && req.url === '/api/upload-image') {
    await handleImageUpload(req, res);
    return;
  }

  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(BASE_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=UTF-8' });
      res.end(`<h1>404 — Página não encontrada</h1><p><a href="/">Voltar ao Cardápio</a></p>`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Cardápio Online + WhatsApp Rodando!`);
  console.log(`📱 Cardápio do Cliente: http://localhost:${PORT}/index.html`);
  console.log(`⚙️  Painel da Pizzaria:   http://localhost:${PORT}/admin.html`);
  console.log(`======================================================\n`);
});
