const {
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ComponentType,
  StringSelectMenuOptionBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const config = require(path.join(__dirname, '..', 'config.json'));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removerecord')
    .setDescription('Remove a DNS record from a selected domain')
    .addStringOption(option =>
      option.setName('domain')
        .setDescription('Pick a domain to remove a record from')
        .setRequired(true)
        .addChoices(...config.domains.map(d => ({ name: d.name, value: d.name })))
    ),

  async execute(interaction) {
    const domainName = interaction.options.getString('domain');

    if (!config.owners.includes(interaction.user.id)) {
      return interaction.reply({
        content: '❌ Only bot owners can remove records.',
        ephemeral: true
      });
    }

    const domainData = config.domains.find(d => d.name === domainName);
    if (!domainData) {
      return interaction.reply({
        content: '❌ Domain not found.',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    // Fetch DNS records
    let records;
    try {
      const res = await axios.get(
        `https://api.cloudflare.com/client/v4/zones/${domainData.zoneId}/dns_records`,
        {
          headers: {
            Authorization: `Bearer ${domainData.cloudflareToken}`
          }
        }
      );
      records = res.data.result;
    } catch (err) {
      return interaction.editReply({ content: '❌ Failed to fetch records from Cloudflare.' });
    }

    if (records.length === 0) {
      return interaction.editReply({ content: `❌ No records found for \`${domainName}\`.` });
    }

    // Create select menu
    const menu = new StringSelectMenuBuilder()
      .setCustomId('select_record_to_remove')
      .setPlaceholder('Select a record to remove')
      .addOptions(
        records.slice(0, 25).map(r =>
          new StringSelectMenuOptionBuilder()
            .setLabel(`${r.type} - ${r.name}`)
            .setValue(r.id)
        )
      );

    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.editReply({
      content: `📄 Choose a record to remove from \`${domainName}\`:`,
      components: [row]
    });

    const selection = await interaction.channel.awaitMessageComponent({
      componentType: ComponentType.StringSelect,
      time: 20000,
      filter: i => i.user.id === interaction.user.id
    }).catch(() => null);

    if (!selection) {
      return interaction.editReply({
        content: '⏱️ Timed out. No record removed.',
        components: []
      });
    }

    const recordId = selection.values[0];
    const record = records.find(r => r.id === recordId);

    try {
      await axios.delete(
        `https://api.cloudflare.com/client/v4/zones/${domainData.zoneId}/dns_records/${recordId}`,
        {
          headers: {
            Authorization: `Bearer ${domainData.cloudflareToken}`
          }
        }
      );
      await selection.update({
        content: `✅ Removed record \`${record.name}\` (${record.type}) from \`${domainName}\`.`,
        components: []
      });
    } catch (err) {
      await selection.update({
        content: '❌ Failed to remove record.',
        components: []
      });
    }
  }
};
