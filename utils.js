const fs = require('fs');
const path = require('path');
const configPath = path.join(__dirname, 'config.json');

function getConfig() {
  const data = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(data);
}

function setConfig(newConfig) {
  fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf-8');
}

module.exports = { getConfig, setConfig };
