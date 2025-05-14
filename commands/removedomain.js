const fs = require('fs');
const path = require('path');
const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');
const config = require('../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removedomain')
    .setDescription('Remove a domain from the domain list')
    .addStringOption(option =>
      option.setName('domain')
        .setDescription('Select the domain to remove')
        .setRequired(true)
        .addChoices(
          ...config.domains.map(d => ({ name: d.name, value: d.name }))
        )
    ),

  async execute(interaction) {
    const domainToRemove = interaction.options.getString('domain');

    if (!config.owners.includes(interaction.user.id)) {
      return interaction.reply({
        content: '❌ Only bot owners can remove domains.',
        ephemeral: true
      });
    }

    const domain = config.domains.find(d => d.name === domainToRemove);
    if (!domain) {
      return interaction.reply({
        content: '❌ Domain not found.',
        ephemeral: true
      });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('confirm_remove')
        .setLabel('Yes, remove it')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('cancel_remove')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      content: `⚠️ Are you sure you want to remove \`${domainToRemove}\` from config?`,
      components: [row],
      ephemeral: true
    });

    const confirmation = await interaction.channel.awaitMessageComponent({
      componentType: ComponentType.Button,
      time: 15000,
      filter: i => i.user.id === interaction.user.id
    }).catch(() => null);

    if (!confirmation) {
      return interaction.editReply({
        content: '⏱️ Confirmation timed out.',
        components: []
      });
    }

    if (confirmation.customId === 'cancel_remove') {
      return confirmation.update({
        content: '❌ Domain removal cancelled.',
        components: []
      });
    }

    config.domains = config.domains.filter(d => d.name !== domainToRemove);
    fs.writeFileSync(
      path.join(__dirname, '../../config.json'),
      JSON.stringify(config, null, 2)
    );

    confirmation.update({
      content: `✅ Domain \`${domainToRemove}\` has been removed.`,
      components: []
    });
  }
};
