const { JSONFile } = require('lowdb/node');
const path = require('path');
require('dotenv').config();

class FSDatabase {
  constructor() {
    this.dbPath = process.env.DATA_PATH || './data/users.json';
    this.db = null;
    this.init();
  }

  async init() {
    const fs = require('fs');
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new JSONFile(this.dbPath);
    await this.db.read();
    this.db.data ||= { users: [] };
    if (this.db.data.users.length === 0) {
      await this.createDefaultAdmin();
    }

    await this.db.write();
    console.log('File DB initialized');
  }

  async createDefaultAdmin() {
    const bcrypt = require('bcryptjs');
    const adminPassword = await bcrypt.hash('admin123', 12);
    
    this.db.data.users.push({
      id: '1',
      username: 'admin',
      email: 'admin@system.com',
      password: adminPassword,
      failedAttempts: 0,
      lockedUntil: null,
      isActive: true,
      createdAt: new Date().toISOString(),
      lastLogin: null
    });

    await this.db.write();
    console.log('👤 Default admin created: admin/admin123');
  }

  async findUser(identifier) {
    return this.db.data.users.find(user => 
      user.username === identifier || user.email === identifier
    );
  }

  async findUserById(id) {
    return this.db.data.users.find(user => user.id === id);
  }

  async createUser(userData) {
    const bcrypt = require('bcryptjs');
    const newId = Date.now().toString();
    
    const user = {
      id: newId,
      ...userData,
      password: await bcrypt.hash(userData.password, 12),
      failedAttempts: 0,
      lockedUntil: null,
      isActive: true,
      createdAt: new Date().toISOString(),
      lastLogin: null
    };

    this.db.data.users.push(user);
    await this.db.write();
    return user;
  }

  async updateUser(id, updates) {
    const index = this.db.data.users.findIndex(user => user.id === id);
    if (index !== -1) {
      this.db.data.users[index] = { ...this.db.data.users[index], ...updates };
      await this.db.write();
      return this.db.data.users[index];
    }
    return null;
  }

  async incrementFailedAttempts(id) {
    const user = await this.findUserById(id);
    if (user) {
      user.failedAttempts += 1;
      if (user.failedAttempts >= 3) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      }
      await this.updateUser(id, user);
      return user;
    }
    return null;
  }

  async resetAttempts(id) {
    return this.updateUser(id, {
      failedAttempts: 0,
      lockedUntil: null,
      lastLogin: new Date().toISOString()
    });
  }

  async userExists(identifier) {
    return this.db.data.users.some(user => 
      user.username === identifier || user.email === identifier
    );
  }
}

module.exports = new FSDatabase();