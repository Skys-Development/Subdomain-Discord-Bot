const { SlashCommandBuilder } = require('discord.js');
const { getConfig, setConfig } = require('../utils.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lockdns')
    .setDescription('Locks the /createdns command (owner only)'),

  async execute(interaction) {
    const config = getConfig();
    if (!config.owners.includes(interaction.user.id)) {
      return interaction.reply({ content: '❌ You are not authorized to lock it.', ephemeral: true });
    }

    config.dnsLocked = true;
    setConfig(config);
    await interaction.reply({ content: '🔒 DNS creation has been locked.', ephemeral: true });
  },
};
