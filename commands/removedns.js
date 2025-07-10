const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const recordsFile = path.join(__dirname, '../records.json');

function loadRecords() {
  if (!fs.existsSync(recordsFile)) return {};
  return JSON.parse(fs.readFileSync(recordsFile));
}

function saveRecords(data) {
  fs.writeFileSync(recordsFile, JSON.stringify(data, null, 2));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removedns')
    .setDescription('Remove one of your saved DNS records')
    .addIntegerOption(option =>
      option.setName('index')
        .setDescription('The number of the record to remove (as listed in /listdns)')
        .setRequired(true)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const index = interaction.options.getInteger('index');

    const records = loadRecords();
    const userRecords = records[userId] || [];

    if (userRecords.length === 0) {
      return interaction.reply({
        content: '❌ You have no records to remove.',
        ephemeral: true
      });
    }

    if (index < 1 || index > userRecords.length) {
      return interaction.reply({
        content: `❌ Invalid index. Use /listdns to see your records.`,
        ephemeral: true
      });
    }

    const removed = userRecords.splice(index - 1, 1);
    records[userId] = userRecords;
    saveRecords(records);

    return interaction.reply({
      content: `✅ Removed DNS record: \`${removed[0]}\``,
      ephemeral: true
    });
  }
};
