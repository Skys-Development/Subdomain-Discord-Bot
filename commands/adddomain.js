const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { getConfig } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('adddomain')
    .setDescription('Add a domain (owner only)')
    .addStringOption(opt =>
      opt.setName('name').setDescription('Domain name (e.g., example.com)').setRequired(true))
    .addStringOption(opt =>
      opt.setName('zoneid').setDescription('Cloudflare Zone ID').setRequired(true))
    .addStringOption(opt =>
      opt.setName('token').setDescription('Cloudflare API Token').setRequired(true)),

  async execute(interaction) {
    const configPath = path.join(__dirname, '..', 'config.json');
    const config = getConfig();

    if (!config.owners.includes(interaction.user.id)) {
      return interaction.reply({ content: '❌ You are not authorized.', flags: 64 });
    }

    const name = interaction.options.getString('name');
    const zoneId = interaction.options.getString('zoneid');
    const token = interaction.options.getString('token');

    config.domains.push({ name, zoneId, cloudflareToken: token });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    interaction.reply({ content: `✅ Added domain: \`${name}\``, flags: 64 });
  }
};
