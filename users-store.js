const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'users.json');

function load() {
  try {
    if (!fs.existsSync(FILE)) return [];
    const raw = fs.readFileSync(FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    console.error('Failed to load users.json', e);
    return [];
  }
}

function save(list) {
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2), 'utf8');
}

function addUser(u) {
  const list = load();
  list.push(u);
  save(list);
}

function all() { return load(); }

function getByUsername(username) {
  const list = load();
  return list.find(x => x.username === username);
}

function updateUser(username, patch) {
  const list = load();
  const idx = list.findIndex(x => x.username === username);
  if (idx === -1) return false;
  list[idx] = Object.assign({}, list[idx], patch);
  save(list);
  return true;
}

module.exports = { addUser, all, getByUsername, updateUser };
