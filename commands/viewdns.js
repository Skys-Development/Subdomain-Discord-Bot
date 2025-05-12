const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const https = require('https');
const { getConfig } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('viewdns')
    .setDescription('View all DNS records for the domain (owner only)'),

  async execute(interaction) {
    const config = getConfig();

    if (!config.owners.includes(interaction.user.id)) {
      return interaction.reply({
        content: 'You are not authorized to use this command.',
        ephemeral: true,
      });
    }

    const { cloudflareToken, zoneId } = config;

    const options = {
      hostname: 'api.cloudflare.com',
      path: `/client/v4/zones/${zoneId}/dns_records`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cloudflareToken}`,
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
          return interaction.reply({
            content: 'Failed to fetch DNS records. Please check the API credentials.',
            ephemeral: true,
          });
        }

        const records = parsedData.result;
        if (records.length === 0) {
          return interaction.reply({
            content: 'No DNS records found for the domain.',
            ephemeral: true,
          });
        }

        let page = 0;
        const recordsPerPage = 3; // Adjusting to 3 records per page
        const totalPages = Math.ceil(records.length / recordsPerPage);

        const getRecordPage = (pageIndex) => {
          const startIndex = pageIndex * recordsPerPage;
          const endIndex = startIndex + recordsPerPage;
          const recordsToDisplay = records.slice(startIndex, endIndex);

          let recordList = '';
          recordsToDisplay.forEach((record, index) => {
            recordList += `**${startIndex + index + 1}. ${record.type}**: ${record.name} - ${record.content}\n`;
          });

          return recordList;
        };

        const recordList = getRecordPage(page);
        const embed = new EmbedBuilder()
          .setTitle('DNS Records')
          .setDescription(`Here are the DNS records for your domain (page ${page + 1}/${totalPages}):\n\n${recordList}`)
          .setColor('#0099FF');

        const row = {
          type: 1,
          components: [
            {
              type: 2,
              style: 1,
              label: 'Back',
              custom_id: 'back',
              disabled: page === 0,
            },
            {
              type: 2,
              style: 1,
              label: 'Next',
              custom_id: 'next',
              disabled: page === totalPages - 1,
            },
          ],
        };

        const reply = await interaction.reply({
          embeds: [embed],
          components: [row],
          ephemeral: true,
        });

        const collector = reply.createMessageComponentCollector({
          time: 60000,
        });

        collector.on('collect', async (buttonInteraction) => {
          if (buttonInteraction.user.id !== interaction.user.id) {
            return buttonInteraction.reply({
              content: 'You are not allowed to interact with these buttons.',
              ephemeral: true,
            });
          }

          if (buttonInteraction.customId === 'next' && page < totalPages - 1) {
            page++;
          } else if (buttonInteraction.customId === 'back' && page > 0) {
            page--;
          }

          const updatedRecordList = getRecordPage(page);
          const updatedEmbed = new EmbedBuilder()
            .setTitle('DNS Records')
            .setDescription(`Here are the DNS records for your domain (page ${page + 1}/${totalPages}):\n\n${updatedRecordList}`)
            .setColor('#0099FF');

          const updatedRow = {
            type: 1,
            components: [
              {
                type: 2,
                style: 1,
                label: 'Back',
                custom_id: 'back',
                disabled: page === 0,
              },
              {
                type: 2,
                style: 1,
                label: 'Next',
                custom_id: 'next',
                disabled: page === totalPages - 1,
              },
            ],
          };

          try {
            await buttonInteraction.update({
              embeds: [updatedEmbed],
              components: [updatedRow],
            });
          } catch (error) {
            console.error('Failed to update interaction:', error);
          }
        });

        collector.on('end', () => {
          reply.edit({
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 2,
                    style: 1,
                    label: 'Back',
                    custom_id: 'back',
                    disabled: true,
                  },
                  {
                    type: 2,
                    style: 1,
                    label: 'Next',
                    custom_id: 'next',
                    disabled: true,
                  },
                ],
              },
            ],
          });
        });
      });
    }).on('error', (error) => {
      console.error(error);
      return interaction.reply({
        content: 'An error occurred while fetching the DNS records.',
        ephemeral: true,
      });
    });
  },
};
