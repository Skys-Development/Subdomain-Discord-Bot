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
    .setDescription('List all your DNS records created via the bot'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const records = loadRecords();
    const userRecords = records[userId] || [];

    if (userRecords.length === 0) {
      return interaction.reply({
        content: `❌ You don't have any saved DNS records yet.`,
        ephemeral: true
      });
    }

    const list = userRecords.map((record, i) => `\`${i + 1}.\` ${record}`).join('\n');

    return interaction.reply({
      content: `✅ **Your DNS Records:**\n${list}`,
      ephemeral: true
    });
  }
};
