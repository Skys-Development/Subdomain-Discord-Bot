const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../config.json');

const recordsFile = path.join(__dirname, '../records.json');

function loadRecords() {
  if (!fs.existsSync(recordsFile)) return {};
  return JSON.parse(fs.readFileSync(recordsFile));
}

function saveRecords(data) {
  fs.writeFileSync(recordsFile, JSON.stringify(data, null, 2));
}

async function getDnsRecords(domainConfig, fqdn, type = null) {
  const res = await axios.get(
    `https://api.cloudflare.com/client/v4/zones/${domainConfig.zoneId}/dns_records`,
    {
      params: {
        name: fqdn,
        ...(type ? { type } : {})
      },
      headers: {
        Authorization: `Bearer ${domainConfig.cloudflareToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  return res.data.result || [];
}

async function deleteDnsRecord(domainConfig, recordId) {
  return axios.delete(
    `https://api.cloudflare.com/client/v4/zones/${domainConfig.zoneId}/dns_records/${recordId}`,
    {
      headers: {
        Authorization: `Bearer ${domainConfig.cloudflareToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removedns')
    .setDescription('Remove one of your DNS records')
    .addStringOption(option =>
      option.setName('domain')
        .setDescription('Base domain')
        .setRequired(true)
        .addChoices(...config.domains.map(d => ({ name: d.name, value: d.name })))
    )
    .addStringOption(option =>
      option.setName('subdomain')
        .setDescription('Subdomain to remove')
        .setRequired(true)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const records = loadRecords();
    const userRecords = records[userId] || [];

    const domainName = interaction.options.getString('domain');
    const subdomain = interaction.options.getString('subdomain');

    const domainConfig = config.domains.find(d => d.name === domainName);
    if (!domainConfig) {
      return interaction.reply({ content: '❌ Invalid domain.', ephemeral: true });
    }

    const fqdn = `${subdomain}.${domainName}`;

    if (!userRecords.includes(fqdn)) {
      return interaction.reply({ content: `❌ You don't own the record \`${fqdn}\`.`, ephemeral: true });
    }

    await interaction.reply({ content: `⏳ Removing DNS records for \`${fqdn}\`...`, ephemeral: true });

    try {
      // Get and delete all matching records (including SRV for Minecraft)
      const recordsToDelete = await getDnsRecords(domainConfig, fqdn);
      const srvRecords = await getDnsRecords(domainConfig, `_minecraft._tcp.${fqdn}`, 'SRV');

      const allRecords = [...recordsToDelete, ...srvRecords];

      if (allRecords.length === 0) {
        return interaction.editReply({ content: `⚠️ No DNS records found for \`${fqdn}\` on Cloudflare.` });
      }

      for (const record of allRecords) {
        await deleteDnsRecord(domainConfig, record.id);
      }

      // Remove from local user records
      records[userId] = userRecords.filter(r => r !== fqdn);
      saveRecords(records);

      return interaction.editReply({ content: `✅ Successfully removed \`${fqdn}\` from Cloudflare and your records.` });

    } catch (error) {
      const errorMsg = error.response?.data?.errors
        ? JSON.stringify(error.response.data.errors, null, 2)
        : error.message;
      return interaction.editReply({ content: `❌ Error removing DNS:\n\`\`\`json\n${errorMsg}\n\`\`\`` });
    }
  }
};
