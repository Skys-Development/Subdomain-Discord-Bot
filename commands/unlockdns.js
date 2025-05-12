const { SlashCommandBuilder } = require('discord.js');
const { getConfig, setConfig } = require('../utils.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlockdns')
    .setDescription('Unlocks the /createdns command (owner only)'),

  async execute(interaction) {
    const config = getConfig();
    if (!config.owners.includes(interaction.user.id)) {
      return interaction.reply({ content: '❌ You are not authorized to unlock it.', ephemeral: true });
    }

    config.dnsLocked = false;
    setConfig(config);
    await interaction.reply({ content: '🔓 DNS creation has been unlocked.', ephemeral: true });
  },
};
