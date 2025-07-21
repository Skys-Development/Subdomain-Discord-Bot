const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const recordsFile = path.join(__dirname, '../records.json');

function loadRecords() {
  if (!fs.existsSync(recordsFile)) return {};
  return JSON.parse(fs.readFileSync(recordsFile));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('listdns')
    .setDescription('List your DNS records.'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const records = loadRecords();
    const userRecords = records[userId] || [];

    if (userRecords.length === 0) {
      return interaction.reply({ content: '❌ You have no DNS records saved.', ephemeral: true });
    }

    const formatted = userRecords
      .map((record, i) => `${i + 1}. \`${record}\``)
      .join('\n');

    await interaction.reply({
      content: `✅ **Your DNS Records:**\n${formatted}`,
      ephemeral: true
    });
  }
};
