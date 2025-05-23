const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 2045;

app.use(express.static(path.join(__dirname, 'public')));

// Criar pastas de upload
const folders = ['imagens', 'videos', 'audios', 'gifs', 'outros'];
const baseUpload = path.join(__dirname, 'uploads');
folders.forEach(folder => {
  const dir = path.join(baseUpload, folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Função para decidir a pasta com base na extensão
function getFolderByMimeType(mimetype) {
  if (mimetype.startsWith('image/')) return 'imagens';
  if (mimetype.startsWith('video/')) return 'videos';
  if (mimetype.startsWith('audio/')) return 'audios';
  if (mimetype === 'image/gif') return 'gifs';
  return 'outros';
}

// Configurar multer com verificação de duplicados
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

    cb(null, file.originalname); // Salva com nome original
  }
});
const upload = multer({ storage });

// Rotas estáticas
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/media', express.static(path.join(__dirname, 'public/media')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use('/uploads', express.static(baseUpload));

// Servir HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota de upload com verificação de duplicados
app.post('/upload', (req, res) => {
  upload.single('file')(req, res, function(err) {
    if (err && err.message === 'duplicate') {
      return res.json({ error: 'duplicate' });
    }
    if (err || !req.file) {
      return res.status(400).json({ error: 'Erro no upload' });
    }

    const file = req.file;
    const folder = getFolderByMimeType(file.mimetype);
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${folder}/${file.filename}`;
    res.json({ fileUrl });
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando em: http://localhost:${PORT}`);
});
