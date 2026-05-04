const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const authRoutes = require('./routes/auth');
const PORT = process.env.PORT || process.env.SERVER_PORT || 3000;
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/data', express.static(path.join(__dirname, 'data')));

app.use('/api/auth', authRoutes);

app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'File System Login System OK',
    usersCount: require('./utils/db').db?.data?.users?.length || 0
  });
});

app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: 'Not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`Admin: admin/admin123`);
});
