const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const https = require('https');
const { getConfig } = require('../utils');

function fetchDNSRecords(config) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.cloudflare.com',
      path: `/client/v4/zones/${config.zoneId}/dns_records`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.cloudflareToken}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        const json = JSON.parse(data);
        if (json.success) resolve(json.result);
        else reject(json.errors);
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function deleteDNSRecord(config, recordId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.cloudflare.com',
      path: `/client/v4/zones/${config.zoneId}/dns_records/${recordId}`,
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${config.cloudflareToken}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        const json = JSON.parse(data);
        if (json.success) resolve(json.result);
        else reject(json.errors);
      });
    });

    req.on('error', reject);
    req.end();
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removedomain')
    .setDescription('Remove a domain from Cloudflare. (owner only)'),

  async execute(interaction) {
    const config = getConfig();

    if (!config.owners.includes(interaction.user.id)) {
      return interaction.reply({ content: '❌ You are not authorized to use this command.', ephemeral: true });
    }

    const dnsRecords = await fetchDNSRecords(config);
    const items = dnsRecords.filter(r => r.name.endsWith(config.rootDomain));

    if (!items.length) {
      return interaction.reply({ content: 'No domains found to remove.', ephemeral: true });
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId('domain-select')
      .setPlaceholder('Choose a domain to remove')
      .addOptions(
        items.slice(0, 25).map(record => ({
          label: record.name,
          value: record.id
        }))
      );

    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.reply({
      content: 'Select a domain to delete:',
      components: [row],
      ephemeral: true
    });

    const collector = interaction.channel.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id && i.customId === 'domain-select',
      componentType: ComponentType.StringSelect,
      time: 20000,
      max: 1
    });

    collector.on('collect', async i => {
      const selectedId = i.values[0];
      const record = items.find(r => r.id === selectedId);

      const confirmButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('confirm-delete')
          .setLabel('✅ Yes, delete')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('cancel-delete')
          .setLabel('❌ Cancel')
          .setStyle(ButtonStyle.Secondary)
      );

      await i.update({
        content: `⚠️ Are you sure you want to delete \`${record.name}\`?`,
        components: [confirmButton]
      });

      const buttonCollector = i.channel.createMessageComponentCollector({
        filter: btn => btn.user.id === interaction.user.id,
        componentType: ComponentType.Button,
        time: 15000,
        max: 1
      });

      buttonCollector.on('collect', async btn => {
        if (btn.customId === 'confirm-delete') {
          await deleteDNSRecord(config, selectedId);
          await btn.update({ content: `✅ Domain \`${record.name}\` has been deleted.`, components: [] });
        } else {
          await btn.update({ content: `❌ Deletion cancelled.`, components: [] });
        }
      });

      buttonCollector.on('end', collected => {
        if (!collected.size) {
          i.editReply({ content: '❌ Time expired. Deletion cancelled.', components: [] });
        }
      });
    });

    collector.on('end', collected => {
      if (!collected.size) {
        interaction.editReply({ content: '❌ Time expired. No domain was selected.', components: [] });
      }
    });
  }
};
