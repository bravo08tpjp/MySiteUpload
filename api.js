const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.json({ limit: '5gb' }));
app.use(express.urlencoded({ limit: '5gb', extended: true }));

// Criar pastas de upload
const folders = ['imagens', 'videos', 'audios', 'gifs', 'outros'];
const baseUpload = path.join(__dirname, 'uploads');
folders.forEach(folder => {
  const dir = path.join(baseUpload, folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Função pra decidir pasta por tipo de arquivo
function getFolderByMimeType(mimetype) {
  if (mimetype.startsWith('image/')) return 'imagens';
  if (mimetype.startsWith('video/')) return 'videos';
  if (mimetype.startsWith('audio/')) return 'audios';
  if (mimetype === 'image/gif') return 'gifs';
  return 'outros';
}

// Configuração do multer com limite de 5GB
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = getFolderByMimeType(file.mimetype);
    cb(null, path.join(baseUpload, folder));
  },
  filename: (req, file, cb) => {
    const folder = getFolderByMimeType(file.mimetype);
    const uploadPath = path.join(baseUpload, folder);
    const filePath = path.join(uploadPath, file.originalname);

    if (fs.existsSync(filePath)) {
      return cb(new Error('duplicate'));
    }

    cb(null, file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 5000 } // 5GB limite
});

// Rotas estáticas
app.use('/uploads', (req, res, next) => {
  const file = path.join(baseUpload, req.path);

  if (fs.existsSync(file)) {
    const ext = path.extname(file);
    const mime = ext === '.mp4' ? 'video/mp4' : 'application/octet-stream';

    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', 'inline');
    fs.createReadStream(file).pipe(res);
  } else {
    next();
  }
});

app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/media', express.static(path.join(__dirname, 'public/media')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));

// Página principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Upload
app.post('/upload', (req, res) => {
  upload.single('file')(req, res, function(err) {
    if (err && err.message === 'duplicate') {
      console.log('Arquivo duplicado');
      return res.json({ error: 'duplicate' });
    }
    if (err) {
      console.log('Erro no upload:', err);
      return res.status(400).json({ error: 'Erro no upload', details: err.message });
    }
    if (!req.file) {
      console.log('Nenhum arquivo enviado');
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const file = req.file;
    const folder = getFolderByMimeType(file.mimetype);
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${folder}/${file.filename}`;
    console.log('Arquivo enviado:', file.filename);
    res.json({ fileUrl });
  });
});

// Streaming de vídeo (roda no navegador sem baixar)
app.get('/video/:folder/:filename', (req, res) => {
  const { folder, filename } = req.params;
  const filePath = path.join(baseUpload, folder, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Arquivo não encontrado');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = (end - start) + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando em: http://localhost:${PORT}`);
});
