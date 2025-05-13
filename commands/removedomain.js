const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Load config
function getConfig() {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, '../config.json'), 'utf8'));
}

function fetchDNSRecordsForDomain(domain) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.cloudflare.com',
      path: `/client/v4/zones/${domain.zoneId}/dns_records`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${domain.cloudflareToken}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        const json = JSON.parse(data);
        if (json.success) {
          const records = json.result.map(r => ({ ...r, _domain: domain }));
          resolve(records);
        } else {
          reject(json.errors);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function deleteDNSRecord(domain, recordId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.cloudflare.com',
      path: `/client/v4/zones/${domain.zoneId}/dns_records/${recordId}`,
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${domain.cloudflareToken}`,
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
    .setDescription('Remove a DNS record from a specific domain (owners only).'),

  async execute(interaction) {
    const config = getConfig();

    if (!config.owners.includes(interaction.user.id)) {
      return interaction.reply({
        content: '❌ You are not authorized to use this command.',
        flags: 64
      });
    }

    // Step 1: Ask for domain
    const domainOptions = config.domains.map(d => ({
      label: d.name,
      value: d.name
    }));

    const domainSelect = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('choose-domain')
        .setPlaceholder('Choose a domain')
        .addOptions(domainOptions)
    );

    await interaction.reply({
      content: '🌐 Select the domain you want to manage:',
      components: [domainSelect],
      flags: 64
    });

    const domainCollector = interaction.channel.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id && i.customId === 'choose-domain',
      componentType: ComponentType.StringSelect,
      time: 20000,
      max: 1
    });

    domainCollector.on('collect', async domainSelectInteraction => {
      const selectedDomainName = domainSelectInteraction.values[0];
      const selectedDomain = config.domains.find(d => d.name === selectedDomainName);

      if (!selectedDomain) {
        return domainSelectInteraction.update({
          content: '❌ Domain not found.',
          components: []
        });
      }

      let records;
      try {
        records = await fetchDNSRecordsForDomain(selectedDomain);
      } catch (err) {
        return domainSelectInteraction.update({
          content: `❌ Failed to fetch DNS records for ${selectedDomain.name}`,
          components: []
        });
      }

      if (!records.length) {
        return domainSelectInteraction.update({
          content: `❌ No DNS records found for ${selectedDomain.name}`,
          components: []
        });
      }

      const recordSelect = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('choose-record')
          .setPlaceholder('Select a DNS record to delete')
          .addOptions(
            records.slice(0, 25).map(r => ({
              label: `${r.name} (${r.type})`,
              value: r.id
            }))
          )
      );

      await domainSelectInteraction.update({
        content: `📄 Select a DNS record from **${selectedDomain.name}** to delete:`,
        components: [recordSelect]
      });

      const recordCollector = interaction.channel.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id && i.customId === 'choose-record',
        componentType: ComponentType.StringSelect,
        time: 20000,
        max: 1
      });

      recordCollector.on('collect', async recordSelectInteraction => {
        const recordId = recordSelectInteraction.values[0];
        const record = records.find(r => r.id === recordId);

        if (!record) {
          return recordSelectInteraction.update({
            content: '❌ Record not found.',
            components: []
          });
        }

        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('confirm-delete')
            .setLabel('✅ Confirm Deletion')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('cancel-delete')
            .setLabel('❌ Cancel')
            .setStyle(ButtonStyle.Secondary)
        );

        await recordSelectInteraction.update({
          content: `⚠️ Are you sure you want to delete \`${record.name}\` (${record.type})?`,
          components: [confirmRow]
        });

        const confirmCollector = interaction.channel.createMessageComponentCollector({
          filter: i => i.user.id === interaction.user.id,
          componentType: ComponentType.Button,
          time: 15000,
          max: 1
        });

        confirmCollector.on('collect', async confirmInteraction => {
          if (confirmInteraction.customId === 'confirm-delete') {
            try {
              await deleteDNSRecord(selectedDomain, recordId);
              await confirmInteraction.update({
                content: `✅ \`${record.name}\` was deleted successfully.`,
                components: []
              });
            } catch (err) {
              await confirmInteraction.update({
                content: `❌ Failed to delete record: ${err[0]?.message || 'Unknown error'}`,
                components: []
              });
            }
          } else {
            await confirmInteraction.update({
              content: `❌ Deletion cancelled.`,
              components: []
            });
          }
        });
      });
    });
  }
};
