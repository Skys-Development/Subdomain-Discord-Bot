const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ComponentType } = require('discord.js');
const https = require('https');
const { getConfig } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('viewdns')
    .setDescription('View DNS records for a specific domain (owner only)'),

  async execute(interaction) {
    const config = getConfig();

    if (!config.owners.includes(interaction.user.id)) {
      return interaction.reply({
        content: 'You are not authorized to use this command.',
        ephemeral: true,
      });
    }

    const domainOptions = config.domains.map((domain, index) => ({
      label: domain.name,
      value: index.toString(),
    }));

    const selectRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('select_domain')
        .setPlaceholder('Choose a domain')
        .addOptions(domainOptions)
    );

    await interaction.reply({
      content: 'Please choose a domain to view DNS records:',
      components: [selectRow],
      ephemeral: true,
    });

    const collector = interaction.channel.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 60000,
    });

    collector.on('collect', async (selectInteraction) => {
      if (selectInteraction.user.id !== interaction.user.id) {
        return selectInteraction.reply({
          content: 'You can’t interact with this menu.',
          ephemeral: true,
        });
      }

      const selectedIndex = parseInt(selectInteraction.values[0]);
      const domain = config.domains[selectedIndex];

      const options = {
        hostname: 'api.cloudflare.com',
        path: `/client/v4/zones/${domain.zoneId}/dns_records`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${domain.cloudflareToken}`,
          'Content-Type': 'application/json',
        },
      };

      https.get(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', async () => {
          const parsedData = JSON.parse(data);

          if (!parsedData.success) {
            return selectInteraction.reply({
              content: 'Failed to fetch DNS records. Check credentials.',
              ephemeral: true,
            });
          }

          const records = parsedData.result;
          if (records.length === 0) {
            return selectInteraction.reply({
              content: 'No DNS records found for the selected domain.',
              ephemeral: true,
            });
          }

          let page = 0;
          const recordsPerPage = 3;
          const totalPages = Math.ceil(records.length / recordsPerPage);

          const getPageEmbed = (pageIndex) => {
            const start = pageIndex * recordsPerPage;
            const end = start + recordsPerPage;
            const chunk = records.slice(start, end);

            const desc = chunk.map((r, i) =>
              `**${start + i + 1}. ${r.type}**: ${r.name} → ${r.content}`
            ).join('\n');

            return new EmbedBuilder()
              .setTitle(`DNS Records for ${domain.name}`)
              .setDescription(`Page ${pageIndex + 1}/${totalPages}\n\n${desc}`)
              .setColor(0x00A8E8);
          };

          const navRow = () =>
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('back')
                .setLabel('Back')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === 0),
              new ButtonBuilder()
                .setCustomId('next')
                .setLabel('Next')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === totalPages - 1),
              new ButtonBuilder()
                .setCustomId('home')
                .setLabel('Go Home')
                .setStyle(ButtonStyle.Secondary)
            );

          const message = await selectInteraction.update({
            content: '',
            embeds: [getPageEmbed(page)],
            components: [navRow()],
            fetchReply: true,
          });

          const btnCollector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 120000,
          });

          btnCollector.on('collect', async (btn) => {
            if (btn.user.id !== interaction.user.id) {
              return btn.reply({
                content: 'You can’t use these buttons.',
                ephemeral: true,
              });
            }

            if (btn.customId === 'next' && page < totalPages - 1) page++;
            else if (btn.customId === 'back' && page > 0) page--;
            else if (btn.customId === 'home') {
              await btn.update({
                content: 'Please choose a domain to view DNS records:',
                embeds: [],
                components: [selectRow],
              });
              return;
            }

            await btn.update({
              embeds: [getPageEmbed(page)],
              components: [navRow()],
            });
          });

          btnCollector.on('end', () => {
            message.edit({
              components: [],
            });
          });
        });
      }).on('error', async () => {
        return selectInteraction.reply({
          content: 'Error occurred while fetching DNS records.',
          ephemeral: true,
        });
      });
    });
  },
};
