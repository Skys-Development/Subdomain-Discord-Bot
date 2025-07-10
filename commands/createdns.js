const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../config.json'); // directly require your config

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
    .setName('createdns')
    .setDescription('Create a DNS record or Minecraft subdomain')
    .addStringOption(option =>
      option.setName('domain')
        .setDescription('Select the base domain')
        .setRequired(true)
        .addChoices(...config.domains.map(d => ({ name: d.name, value: d.name })))
    )
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Record type (A, AAAA, CNAME, TXT, or MINECRAFT for A+SRV)')
        .setRequired(true)
        .addChoices(
          { name: 'A', value: 'A' },
          { name: 'AAAA', value: 'AAAA' },
          { name: 'CNAME', value: 'CNAME' },
          { name: 'TXT', value: 'TXT' },
          { name: 'Minecraft (A + SRV)', value: 'MINECRAFT' }
        )
    )
    .addStringOption(option =>
      option.setName('subdomain')
        .setDescription('Subdomain to create')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('content')
        .setDescription('Record content (IP or other)')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option.setName('port')
        .setDescription('Minecraft server port (for Minecraft type only)')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('proxied')
        .setDescription('Proxy through Cloudflare (for normal records)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const records = loadRecords();
    const userRecords = records[userId] || [];

    if (userRecords.length >= 5) {
      return interaction.reply({
        content: `❌ You can only have up to 5 DNS records. Please delete one before creating a new one.`,
        ephemeral: true
      });
    }

    const domainName = interaction.options.getString('domain');
    const domainConfig = config.domains.find(d => d.name === domainName);
    if (!domainConfig) {
      return interaction.reply({ content: '❌ Invalid domain selected.', ephemeral: true });
    }

    const type = interaction.options.getString('type');
    const subdomain = interaction.options.getString('subdomain');
    const fqdn = `${subdomain}.${domainConfig.name}`;

    await interaction.reply({ content: `⏳ Creating DNS record for \`${fqdn}\`...`, ephemeral: true });

    try {
      if (type === 'MINECRAFT') {
        const ip = interaction.options.getString('content');
        const port = interaction.options.getInteger('port');
        if (!ip || !port) {
          return interaction.editReply({ content: '❌ You must provide both IP and port for a Minecraft domain.' });
        }

        // A record
        const aRes = await axios.post(
          `https://api.cloudflare.com/client/v4/zones/${domainConfig.zoneId}/dns_records`,
          {
            type: 'A',
            name: fqdn,
            content: ip,
            ttl: 1,
            proxied: false
          },
          {
            headers: {
              Authorization: `Bearer ${domainConfig.cloudflareToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!aRes.data.success) {
          return interaction.editReply({ content: `❌ Failed to create A record:\n\`\`\`json\n${JSON.stringify(aRes.data.errors, null, 2)}\n\`\`\`` });
        }

        // SRV record
        const srvRes = await axios.post(
          `https://api.cloudflare.com/client/v4/zones/${domainConfig.zoneId}/dns_records`,
          {
            type: 'SRV',
            name: `_minecraft._tcp.${fqdn}`,
            data: {
              service: '_minecraft',
              proto: '_tcp',
              name: subdomain,
              priority: 0,
              weight: 0,
              port: port,
              target: fqdn
            },
            ttl: 1
          },
          {
            headers: {
              Authorization: `Bearer ${domainConfig.cloudflareToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!srvRes.data.success) {
          return interaction.editReply({ content: `⚠️ A record created, but failed to create SRV record:\n\`\`\`json\n${JSON.stringify(srvRes.data.errors, null, 2)}\n\`\`\`` });
        }

        // Save record
        userRecords.push(fqdn);
        records[userId] = userRecords;
        saveRecords(records);

        return interaction.editReply({
          content: `✅ Subdomain \`${fqdn}\` created!\n\n🔹 **A Record** → \`${ip}\`\n🔹 **SRV Record** → \`_minecraft._tcp.${fqdn}:${port}\``
        });

      } else {
        const content = interaction.options.getString('content');
        const proxied = interaction.options.getBoolean('proxied') ?? false;

        const response = await axios.post(
          `https://api.cloudflare.com/client/v4/zones/${domainConfig.zoneId}/dns_records`,
          {
            type,
            name: fqdn,
            content,
            ttl: 1,
            proxied: ['A', 'AAAA', 'CNAME'].includes(type) ? proxied : false
          },
          {
            headers: {
              Authorization: `Bearer ${domainConfig.cloudflareToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.data.success) {
          userRecords.push(fqdn);
          records[userId] = userRecords;
          saveRecords(records);

          return interaction.editReply({ content: `✅ ${type} record created: \`${fqdn}\` → \`${content}\`` });
        } else {
          return interaction.editReply({ content: `❌ Failed: ${JSON.stringify(response.data.errors)}` });
        }
      }

    } catch (error) {
      const errorMsg = error.response?.data?.errors
        ? JSON.stringify(error.response.data.errors, null, 2)
        : error.message;
      return interaction.editReply({ content: `❌ Error:\n\`\`\`json\n${errorMsg}\n\`\`\`` });
    }
  }
};
