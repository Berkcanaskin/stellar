const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'campaigns.json');

function load() {
  try {
    if (!fs.existsSync(FILE)) return [];
    const raw = fs.readFileSync(FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    console.error('Failed to load campaigns.json', e);
    return [];
  }
}

function save(list) {
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2), 'utf8');
}

function addCampaign(c) {
  const list = load();
  list.push(c);
  save(list);
}

function all() {
  return load();
}

function deleteCampaign(id){
  const list = load();
  const idx = list.findIndex(x => Number(x.id) === Number(id));
  if(idx === -1) return false;
  list.splice(idx, 1);
  save(list);
  return true;
}

module.exports = { addCampaign, all, load, save, deleteCampaign };
