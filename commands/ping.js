const { SlashCommandBuilder, InteractionFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with bot latency in ms'),

  async execute(interaction) {
    await interaction.reply({
      content: 'Pinging...',
      flags: 64
    });

    const reply = await interaction.fetchReply();
    const latency = reply.createdTimestamp - interaction.createdTimestamp;

    await interaction.editReply({
      content: `🏓 Pong! Latency is ${latency}ms.`,
      flags: 64
    });
  },
};
