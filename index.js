const fs = require('node:fs');
const path = require('node:path');
const {
  Client,
  Collection,
  GatewayIntentBits,
  REST,
  Routes,
  EmbedBuilder
} = require('discord.js');
const config = require('./config.json');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

// Load commands
const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
  } else {
    console.warn(`[WARNING] The command at ${file} is missing "data" or "execute".`);
  }
}

// Register commands
client.once('ready', async () => {
  const rest = new REST({ version: '10' }).setToken(config.token);
  try {
    console.log('Registering commands globally...');
    await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
    console.log('Commands registered. Bot is online as', client.user.tag);
  } catch (error) {
    console.error('Error registering commands:', error);
  }
});

// Handle interactions
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({
      content: '❌ There was an error executing that command.',
      ephemeral: true
    });
  }
});

client.login(config.token);
