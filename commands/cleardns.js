const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cleardns')
    .setDescription('⚠️ Owner only: Clear ALL DNS records on a domain.')
    .addStringOption(option =>
      option.setName('domain')
        .setDescription('The base domain to clear')
        .setRequired(true)
        .addChoices(...config.domains.map(d => ({ name: d.name, value: d.name })))
    ),

  async execute(interaction) {
    if (!config.owners.includes(interaction.user.id)) {
      return interaction.reply({ content: '❌ You are not authorized to use this command.', ephemeral: true });
    }

    const domainName = interaction.options.getString('domain');
    const domainConfig = config.domains.find(d => d.name === domainName);

    if (!domainConfig) {
      return interaction.reply({ content: '❌ Invalid domain.', ephemeral: true });
    }

    await interaction.reply({ content: `⏳ Fetching DNS records for **${domainName}**...`, ephemeral: true });

    try {
      // Fetch all DNS records
      const listRes = await axios.get(
        `https://api.cloudflare.com/client/v4/zones/${domainConfig.zoneId}/dns_records`,
        {
          headers: {
            Authorization: `Bearer ${domainConfig.cloudflareToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!listRes.data.success) {
        return interaction.editReply({ content: `❌ Failed to fetch records:\n\`\`\`json\n${JSON.stringify(listRes.data.errors, null, 2)}\n\`\`\`` });
      }

      const records = listRes.data.result;
      if (records.length === 0) {
        return interaction.editReply({ content: `✅ No DNS records to delete for **${domainName}**.` });
      }

      for (const record of records) {
        await axios.delete(
          `https://api.cloudflare.com/client/v4/zones/${domainConfig.zoneId}/dns_records/${record.id}`,
          {
            headers: {
              Authorization: `Bearer ${domainConfig.cloudflareToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
      }

      return interaction.editReply({ content: `✅ Successfully deleted **${records.length}** DNS record(s) on **${domainName}**.` });
    } catch (error) {
      const errMsg = error.response?.data?.errors
        ? JSON.stringify(error.response.data.errors, null, 2)
        : error.message;
      return interaction.editReply({ content: `❌ Error:\n\`\`\`json\n${errMsg}\n\`\`\`` });
    }
  }
};
