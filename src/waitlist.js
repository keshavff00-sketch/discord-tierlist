const fs = require('fs');
const path = require('path');

const DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FILE = path.join(DIR, 'waitlist.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return {};
  }
}

function save(data) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function add(mode, userId) {
  const data = load();
  data[mode] = data[mode] || [];

  const index = data[mode].indexOf(userId);
  if (index !== -1) return { added: false, position: index + 1 };

  data[mode].push(userId);
  save(data);
  return { added: true, position: data[mode].length };
}

function remove(mode, userId) {
  const data = load();
  data[mode] = (data[mode] || []).filter(id => id !== userId);
  save(data);
}

function drain(mode) {
  const data = load();
  const list = data[mode] || [];
  data[mode] = [];
  save(data);
  return list;
}

module.exports = { add, remove, drain };
