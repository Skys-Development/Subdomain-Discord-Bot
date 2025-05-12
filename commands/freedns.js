const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const { getConfig } = require('../utils.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('freedns')
    .setDescription('Claim a free Minecraft subdomain (A + SRV record)')
    .addStringOption(option =>
      option.setName('subdomain').setDescription('Your desired subdomain').setRequired(true))
    .addStringOption(option =>
      option.setName('ip').setDescription('Your server IP address').setRequired(true))
    .addIntegerOption(option =>
      option.setName('port').setDescription('Your Minecraft server port').setRequired(true)),

  async execute(interaction) {
    const config = getConfig();

    if (config.dnsLocked) {
      return interaction.reply({ content: '🔒 DNS creation is currently locked by the owners.', ephemeral: true });
    }

    const subdomain = interaction.options.getString('subdomain');
    const ip = interaction.options.getString('ip');
    const port = interaction.options.getInteger('port');
    const fqdn = `${subdomain}.${config.rootDomain}`;

    await interaction.reply({ content: `⏳ Creating A + SRV records for \`${fqdn}\`...`, ephemeral: true });

    try {
      // 1. Create A Record
      const aRecordRes = await axios.post(
        `https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records`,
        {
          type: 'A',
          name: fqdn,
          content: ip,
          ttl: 1,
          proxied: false
        },
        {
          headers: {
            Authorization: `Bearer ${config.cloudflareToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!aRecordRes.data.success) {
        return interaction.editReply({ content: `❌ Failed to create A record: ${JSON.stringify(aRecordRes.data.errors)}` });
      }

      // 2. Create SRV Record
      const srvName = `_minecraft._tcp.${subdomain}`;
      const srvRecordRes = await axios.post(
        `https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records`,
        {
          type: 'SRV',
          data: {
            service: '_minecraft',
            proto: '_tcp',
            name: subdomain,
            priority: 0,
            weight: 5,
            port: port,
            target: fqdn
          },
          ttl: 1
        },
        {
          headers: {
            Authorization: `Bearer ${config.cloudflareToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!srvRecordRes.data.success) {
        return interaction.editReply({ content: `⚠️ A record created, but failed to create SRV record: ${JSON.stringify(srvRecordRes.data.errors)}` });
      }

      await interaction.editReply({
        content: `✅ Subdomain \`${fqdn}\` created!\n\n🔹 A Record → \`${ip}\`\n🔹 SRV Record → \`_minecraft._tcp.${fqdn}:${port}\``
      });

    } catch (error) {
      await interaction.editReply({ content: `❌ Error: ${error.message}` });
    }
  },
};
