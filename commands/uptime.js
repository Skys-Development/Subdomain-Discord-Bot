const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('uptime')
    .setDescription('Replies with how long the bot has been online'),
  async execute(interaction) {
    const totalSeconds = Math.floor(process.uptime());
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const uptime = `${days}d ${hours}h ${minutes}m ${seconds}s`;
    await interaction.reply({ content: `🕒 Bot uptime: ${uptime}`, ephemeral: true });
  },
};
