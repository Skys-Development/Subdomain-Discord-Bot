const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const { getConfig } = require('../utils.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('createdns')
    .setDescription('Create a DNS record (DNS Prems Needed)')
    .addStringOption(option =>
      option.setName('type').setDescription('Record type').setRequired(true)
        .addChoices(
          { name: 'A', value: 'A' },
          { name: 'AAAA', value: 'AAAA' },
          { name: 'CNAME', value: 'CNAME' },
          { name: 'TXT', value: 'TXT' }
        ))
    .addStringOption(option =>
      option.setName('subdomain').setDescription('Subdomain').setRequired(true))
    .addStringOption(option =>
      option.setName('content').setDescription('Record content').setRequired(true))
    .addBooleanOption(option =>
      option.setName('proxied').setDescription('Proxy through Cloudflare?').setRequired(true)),

  async execute(interaction) {
    const config = getConfig();

    if (!interaction.member.roles.cache.has(config.requiredDnsRoleId)) {
      return interaction.reply({
        content: '❌ You need a special role to use this command.\n Please open a ticket to request access.',
        ephemeral: true
      });
    }

    if (config.dnsLocked) {
      return interaction.reply({
        content: '🔒 DNS creation is currently locked by the owners.',
        ephemeral: true
      });
    }

    const type = interaction.options.getString('type');
    const subdomain = interaction.options.getString('subdomain');
    const content = interaction.options.getString('content');
    const proxied = interaction.options.getBoolean('proxied');
    const fqdn = `${subdomain}.${config.rootDomain}`;

    await interaction.reply({ content: `Creating ${type} record for \`${fqdn}\`...`, ephemeral: true });

    try {
      const response = await axios.post(
        `https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records`,
        {
          type,
          name: fqdn,
          content,
          ttl: 1,
          proxied: ['A', 'AAAA', 'CNAME'].includes(type) ? proxied : false
        },
        {
          headers: {
            Authorization: `Bearer ${config.cloudflareToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        await interaction.editReply({ content: `✅ ${type} record created: \`${fqdn}\` -> \`${content}\`` });
      } else {
        await interaction.editReply({ content: `❌ Failed: ${JSON.stringify(response.data.errors)}` });
      }
    } catch (error) {
      await interaction.editReply({ content: `❌ Error: ${error.message}` });
    }
  }
};
