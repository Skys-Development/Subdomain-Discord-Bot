const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');
const path = require('path');
const config = require(path.join(__dirname, '..', 'config.json'));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('listdomains')
    .setDescription('Lists all configured domains'),

  async execute(interaction) {
    const domains = config.domains;
    const pageSize = 3;
    let currentPage = 0;

    if (!domains.length) {
      return interaction.reply({
        content: '❌ No domains are configured.',
        ephemeral: true
      });
    }

    const generateEmbed = (page) => {
      const start = page * pageSize;
      const end = start + pageSize;
      const sliced = domains.slice(start, end);

      return new EmbedBuilder()
        .setTitle('Configured Domains')
        .setColor('#5865F2')
        .setDescription(
          sliced.map((d, i) => `**${start + i + 1}.** \`${d.name}\``).join('\n')
        )
        .setFooter({ text: `Page ${page + 1} of ${Math.ceil(domains.length / pageSize)}` });
    };

    const getButtons = (page) => {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('prev_page')
          .setLabel('Back')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId('next_page')
          .setLabel('Next')
          .setStyle(ButtonStyle.Primary)
          .setDisabled((page + 1) * pageSize >= domains.length)
      );
    };

    await interaction.reply({
      embeds: [generateEmbed(currentPage)],
      components: [getButtons(currentPage)],
      ephemeral: false
    });

    const collector = interaction.channel.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60_000,
      filter: i => i.user.id === interaction.user.id
    });

    collector.on('collect', async i => {
      if (i.customId === 'prev_page') currentPage--;
      else if (i.customId === 'next_page') currentPage++;

      await i.update({
        embeds: [generateEmbed(currentPage)],
        components: [getButtons(currentPage)]
      });
    });

    collector.on('end', async () => {
      try {
        await interaction.editReply({ components: [] });
      } catch (e) {
      }
    });
  }
};
