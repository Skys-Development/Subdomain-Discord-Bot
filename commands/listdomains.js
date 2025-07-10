const { SlashCommandBuilder } = require('discord.js');
const config = require('../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('listdomains')
    .setDescription('List all available base domains'),

  async execute(interaction) {
    if (!config.domains || config.domains.length === 0) {
      return interaction.reply({ content: 'No domains are configured.', ephemeral: true });
    }

    const domainNames = config.domains.map(d => d.name).join('\n');

    await interaction.reply({
      content: `🌐 **Available Domains:**\n${domainNames}`,
      ephemeral: true
    });
  }
};
